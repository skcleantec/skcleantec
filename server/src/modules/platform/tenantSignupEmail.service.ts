import bcrypt from 'bcryptjs';
import {
  consumeEmailVerificationChallenge,
  EmailVerificationError,
  normalizeSignupPhone,
  normalizeVerificationEmail,
  sendEmailVerificationCode,
} from './emailVerification.service.js';
import {
  isTenantSlugAvailableForSignup,
  provisionTenantSelfServe,
  TenantSignupError,
  type SelfServeTenantSignupInput,
} from './tenantSignup.service.js';
import { assertValidTenantLoginId } from '../auth/tenantLoginId.js';

export type TenantSignupFormPayload = {
  slug: string;
  name: string;
  adminLoginId: string;
  adminPassword: string;
  adminName?: string;
  contactEmail: string;
  contactPhone: string;
  memberTermsAgreed: boolean;
};

function parseSignupForm(body: TenantSignupFormPayload): SelfServeTenantSignupInput {
  if (!body.memberTermsAgreed) {
    throw new EmailVerificationError('회원사 이용약관에 동의해 주세요.');
  }
  const contactPhone = normalizeSignupPhone(body.contactPhone);
  const contactEmail = normalizeVerificationEmail(body.contactEmail);
  assertValidTenantLoginId(body.adminLoginId);
  const password = body.adminPassword.trim();
  if (password.length < 4) {
    throw new EmailVerificationError('비밀번호는 4자 이상 입력해 주세요.');
  }
  return {
    slug: body.slug,
    name: body.name,
    adminLoginId: body.adminLoginId,
    adminPassword: password,
    adminName: body.adminName,
    contactEmail,
    contactPhone,
    memberTermsAgreed: true,
  };
}

export async function sendTenantSignupVerificationCode(
  body: TenantSignupFormPayload,
  requestIp?: string | null,
) {
  const parsed = parseSignupForm(body);
  const slugCheck = await isTenantSlugAvailableForSignup(parsed.slug);
  if (!slugCheck.available) {
    throw new TenantSignupError(slugCheck.reason ?? '업체 코드를 사용할 수 없습니다.', 409);
  }

  const passwordHash = await bcrypt.hash(parsed.adminPassword, 10);
  return sendEmailVerificationCode({
    purpose: 'TENANT_SIGNUP',
    email: parsed.contactEmail,
    requestIp,
    payload: {
      slug: slugCheck.slug,
      name: parsed.name.trim(),
      adminLoginId: parsed.adminLoginId,
      adminName: (parsed.adminName?.trim() || '관리자').slice(0, 64),
      contactEmail: parsed.contactEmail,
      contactPhone: parsed.contactPhone,
      passwordHash,
      memberTermsAgreedAt: new Date().toISOString(),
      signupIp: requestIp?.trim() || null,
    },
    mailSubject: '[청소비서] 업체 개설 이메일 인증번호',
    mailHtml: (code) =>
      `<p>청소비서 업체 개설을 위한 인증번호입니다.</p><p style="font-size:24px;font-weight:bold;letter-spacing:4px">${code}</p><p>10분 이내에 가입 화면에 입력해 주세요.</p>`,
    mailText: (code) => `청소비서 업체 개설 인증번호: ${code} (10분 유효)`,
  });
}

type StoredSignupPayload = {
  slug: string;
  name: string;
  adminLoginId: string;
  adminName: string;
  contactEmail: string;
  contactPhone: string;
  passwordHash: string;
  memberTermsAgreedAt: string;
  signupIp: string | null;
};

export async function completeTenantSignupWithVerification(input: {
  challengeId: string;
  contactEmail: string;
  code: string;
}) {
  const payload = (await consumeEmailVerificationChallenge({
    purpose: 'TENANT_SIGNUP',
    challengeId: input.challengeId,
    email: input.contactEmail,
    code: input.code,
  })) as StoredSignupPayload;

  const result = await provisionTenantSelfServeFromVerifiedPayload(payload);
  return result;
}

/** 인증 완료 payload — passwordHash 는 이미 bcrypt */
export async function provisionTenantSelfServeFromVerifiedPayload(payload: StoredSignupPayload) {
  return provisionTenantSelfServe({
    slug: payload.slug,
    name: payload.name,
    adminLoginId: payload.adminLoginId,
    adminPassword: '__verified_hash__',
    adminName: payload.adminName,
    contactEmail: payload.contactEmail,
    contactPhone: payload.contactPhone,
    memberTermsAgreed: true,
    signupIp: payload.signupIp,
    passwordHash: payload.passwordHash,
    emailVerifiedAt: payload.memberTermsAgreedAt,
  });
}
