import type { PlatformBillingSettings } from '@prisma/client';
import type { TenantSmtpConfigStored } from '../modules/tenants/tenantConfig.schema.js';
import {
  isGlobalSmtpConfigured,
  resolveGlobalSmtpTransport,
  resolveStoredSmtpTransport,
  sendMailWithTransport,
  smtpPublicFromStored,
  type ResolvedSmtpTransport,
} from './tenantSmtp.service.js';
import {
  mergeSmtpConfigStored,
  smtpConfigStoredComplete,
  type SmtpConfigPatch,
} from './smtpConfigStored.js';
import { prisma } from './prisma.js';
import type { MailSendInput } from './mailer.js';

async function ensurePlatformBillingRow(): Promise<PlatformBillingSettings> {
  return prisma.platformBillingSettings.upsert({
    where: { id: 'default' },
    create: { id: 'default' },
    update: {},
  });
}

export type PlatformSmtpSettingsPublic = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  from: string;
  passwordConfigured: boolean;
  configured: boolean;
  envFallbackAvailable: boolean;
  effectiveConfigured: boolean;
};

function smtpStoredFromRow(row: PlatformBillingSettings): TenantSmtpConfigStored {
  return {
    host: row.smtpHost?.trim() || undefined,
    port: row.smtpPort ?? undefined,
    secure: row.smtpSecure === true ? true : row.smtpSecure === false ? false : undefined,
    user: row.smtpUser?.trim() || undefined,
    from: row.smtpFrom?.trim() || undefined,
    passEnc: row.smtpPassEnc?.trim() || undefined,
  };
}

function rowDataFromStored(stored: TenantSmtpConfigStored | undefined): {
  smtpHost: string | null;
  smtpPort: number | null;
  smtpSecure: boolean | null;
  smtpUser: string | null;
  smtpFrom: string | null;
  smtpPassEnc: string | null;
} {
  if (!stored) {
    return {
      smtpHost: null,
      smtpPort: null,
      smtpSecure: null,
      smtpUser: null,
      smtpFrom: null,
      smtpPassEnc: null,
    };
  }
  if (!smtpConfigStoredComplete(stored)) {
    return {
      smtpHost: stored.host?.trim() || null,
      smtpPort: stored.port ?? null,
      smtpSecure: stored.secure === true ? true : stored.secure === false ? false : null,
      smtpUser: stored.user?.trim() || null,
      smtpFrom: stored.from?.trim() || null,
      smtpPassEnc: stored.passEnc?.trim() || null,
    };
  }
  return {
    smtpHost: stored.host!.trim(),
    smtpPort: stored.port ?? 587,
    smtpSecure: stored.secure === true || (stored.port ?? 587) === 465,
    smtpUser: stored.user?.trim() || null,
    smtpFrom: stored.from!.trim(),
    smtpPassEnc: stored.passEnc!.trim(),
  };
}

export function buildPlatformSmtpPublic(row: PlatformBillingSettings): PlatformSmtpSettingsPublic {
  const stored = smtpStoredFromRow(row);
  const pub = smtpPublicFromStored(stored);
  const envFallbackAvailable = isGlobalSmtpConfigured();
  return {
    ...pub,
    envFallbackAvailable,
    effectiveConfigured: pub.configured || envFallbackAvailable,
  };
}

function validatePlatformSmtpPatch(
  patch: SmtpConfigPatch,
  existingStored: TenantSmtpConfigStored | undefined,
): void {
  const host = patch.host?.trim();
  const from = patch.from?.trim();
  const password = patch.password;
  const willHavePass =
    (typeof password === 'string' && password.length > 0) ||
    Boolean(existingStored?.passEnc?.trim());
  if (host && from && !willHavePass) {
    throw new Error('SMTP 비밀번호(앱 비밀번호)를 입력해 주세요.');
  }
}

export async function updatePlatformSmtpSettings(
  patch: SmtpConfigPatch | undefined,
): Promise<PlatformSmtpSettingsPublic> {
  if (!patch) {
    const row = await ensurePlatformBillingRow();
    return buildPlatformSmtpPublic(row);
  }
  const row = await ensurePlatformBillingRow();
  const existing = smtpStoredFromRow(row);
  validatePlatformSmtpPatch(patch, existing);
  const merged = mergeSmtpConfigStored(existing, patch);
  const data = rowDataFromStored(merged);
  const updated = await prisma.platformBillingSettings.update({
    where: { id: 'default' },
    data,
  });
  return buildPlatformSmtpPublic(updated);
}

export async function resolvePlatformSmtpTransport(): Promise<ResolvedSmtpTransport | null> {
  const row = await ensurePlatformBillingRow();
  const db = resolveStoredSmtpTransport(smtpStoredFromRow(row));
  if (db) return db;
  return resolveGlobalSmtpTransport();
}

export async function isPlatformSmtpConfigured(): Promise<boolean> {
  return (await resolvePlatformSmtpTransport()) != null;
}

export async function sendPlatformMail(input: MailSendInput): Promise<{ sent: boolean; reason?: string }> {
  const transport = await resolvePlatformSmtpTransport();
  if (!transport) {
    return { sent: false, reason: 'SMTP_NOT_CONFIGURED' };
  }
  await sendMailWithTransport(transport, input);
  return { sent: true };
}

export async function sendPlatformSmtpTestMail(to: string): Promise<void> {
  const email = to.trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('테스트 수신 이메일 형식을 확인해 주세요.');
  }
  const result = await sendPlatformMail({
    to: email,
    subject: '[청소비서] 플랫폼 SMTP 테스트',
    html: '<p>플랫폼 SMTP 설정으로 발송된 테스트 메일입니다.</p>',
    text: '플랫폼 SMTP 설정으로 발송된 테스트 메일입니다.',
  });
  if (!result.sent) {
    throw new Error('SMTP가 설정되지 않았습니다. 아래 항목을 저장하거나 서버 환경변수를 확인해 주세요.');
  }
}
