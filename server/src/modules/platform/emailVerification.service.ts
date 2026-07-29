import crypto from 'crypto';
import type { EmailVerificationPurpose, Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { sendPlatformMail } from '../../lib/platformSmtp.service.js';

const CODE_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;

export class EmailVerificationError extends Error {
  constructor(
    message: string,
    readonly statusCode: 400 | 404 | 409 | 429 | 503 = 400,
  ) {
    super(message);
    this.name = 'EmailVerificationError';
  }
}

export function normalizeVerificationEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidVerificationEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** 한국 휴대폰 — 숫자만 10~11자리 */
export function normalizeSignupPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (!/^01[016789]\d{7,8}$/.test(digits)) {
    throw new EmailVerificationError('휴대폰 번호를 확인해 주세요. (예: 01012345678)');
  }
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function hashVerificationCode(code: string): string {
  return crypto.createHash('sha256').update(code.trim()).digest('hex');
}

function generateVerificationCode(): string {
  return String(crypto.randomInt(100000, 999999));
}

export async function sendEmailVerificationCode(input: {
  purpose: EmailVerificationPurpose;
  email: string;
  payload: Prisma.InputJsonValue;
  requestIp?: string | null;
  mailSubject: string;
  mailHtml: (code: string) => string;
  mailText: (code: string) => string;
}): Promise<{ challengeId: string; expiresAt: string; message: string }> {
  const email = normalizeVerificationEmail(input.email);
  if (!isValidVerificationEmail(email)) {
    throw new EmailVerificationError('이메일 주소를 확인해 주세요.');
  }

  const recent = await prisma.emailVerificationChallenge.findFirst({
    where: {
      email,
      purpose: input.purpose,
      consumedAt: null,
      createdAt: { gte: new Date(Date.now() - RESEND_COOLDOWN_MS) },
    },
    orderBy: { createdAt: 'desc' },
  });
  if (recent) {
    throw new EmailVerificationError('잠시 후 다시 인증번호를 요청해 주세요.', 429);
  }

  const code = generateVerificationCode();
  const expiresAt = new Date(Date.now() + CODE_TTL_MS);

  const mail = await sendPlatformMail({
    to: email,
    subject: input.mailSubject,
    html: input.mailHtml(code),
    text: input.mailText(code),
  });
  if (!mail.sent) {
    throw new EmailVerificationError(
      '인증 메일을 보낼 수 없습니다. 잠시 후 다시 시도하거나 플랫폼 관리자에게 문의해 주세요.',
      503,
    );
  }

  const challenge = await prisma.emailVerificationChallenge.create({
    data: {
      purpose: input.purpose,
      email,
      codeHash: hashVerificationCode(code),
      payload: input.payload,
      expiresAt,
      requestIp: input.requestIp?.trim() || null,
    },
  });

  return {
    challengeId: challenge.id,
    expiresAt: expiresAt.toISOString(),
    message: '인증번호를 이메일로 보냈습니다. 10분 이내에 입력해 주세요.',
  };
}

export async function consumeEmailVerificationChallenge(input: {
  purpose: EmailVerificationPurpose;
  challengeId: string;
  email: string;
  code: string;
}): Promise<Prisma.JsonValue> {
  const email = normalizeVerificationEmail(input.email);
  const challenge = await prisma.emailVerificationChallenge.findFirst({
    where: {
      id: input.challengeId,
      purpose: input.purpose,
      email,
      consumedAt: null,
    },
  });
  if (!challenge) {
    throw new EmailVerificationError('인증 요청을 찾을 수 없습니다. 인증번호를 다시 요청해 주세요.', 404);
  }
  if (challenge.expiresAt.getTime() < Date.now()) {
    throw new EmailVerificationError('인증번호가 만료되었습니다. 다시 요청해 주세요.', 400);
  }
  if (challenge.attempts >= MAX_ATTEMPTS) {
    throw new EmailVerificationError('인증 시도 횟수를 초과했습니다. 인증번호를 다시 요청해 주세요.', 429);
  }

  const codeOk = hashVerificationCode(input.code) === challenge.codeHash;
  if (!codeOk) {
    await prisma.emailVerificationChallenge.update({
      where: { id: challenge.id },
      data: { attempts: { increment: 1 } },
    });
    throw new EmailVerificationError('인증번호가 올바르지 않습니다.');
  }

  await prisma.emailVerificationChallenge.update({
    where: { id: challenge.id },
    data: { consumedAt: new Date() },
  });

  return challenge.payload;
}
