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
import { normalizeSignupPlanId } from './tenantSignup.constants.js';
import { assertValidTenantLoginId } from '../auth/tenantLoginId.js';
import type { TenantPlanId } from '../tenants/tenantFeatureCatalog.js';
import {
  buildPlatformVerificationEmailHtml,
  buildPlatformVerificationEmailSubject,
  buildPlatformVerificationEmailText,
} from '../../lib/platformTransactionalEmail.js';

export type TenantSignupFormPayload = {
  slug: string;
  name: string;
  adminLoginId: string;
  adminPassword: string;
  adminName?: string;
  contactEmail: string;
  contactPhone: string;
  memberTermsAgreed: boolean;
  selectedPlan: string;
};

function parseSignupPlan(body: TenantSignupFormPayload): TenantPlanId {
  try {
    return normalizeSignupPlanId(body.selectedPlan);
  } catch {
    throw new EmailVerificationError('올바른 이용 플랜을 선택해 주세요.');
  }
}

function parseSignupFormFields(
  body: TenantSignupFormPayload,
  opts: { requireTerms: boolean },
): SelfServeTenantSignupInput {
  if (opts.requireTerms && !body.memberTermsAgreed) {
    throw new EmailVerificationError('회원사 이용약관에 동의해 주세요.');
  }
  const contactPhone = normalizeSignupPhone(body.contactPhone);
  const contactEmail = normalizeVerificationEmail(body.contactEmail);
  assertValidTenantLoginId(body.adminLoginId);
  const password = body.adminPassword.trim();
  if (password.length < 4) {
    throw new EmailVerificationError('비밀번호는 4자 이상 입력해 주세요.');
  }
  const selectedPlan = parseSignupPlan(body);
  return {
    slug: body.slug,
    name: body.name,
    adminLoginId: body.adminLoginId,
    adminPassword: password,
    adminName: body.adminName,
    contactEmail,
    contactPhone,
    memberTermsAgreed: opts.requireTerms,
    selectedPlan,
  };
}

/** 인증번호 발송 — 약관 동의는 최종 가입 시에만 확인 */
function parseSignupFormForVerificationSend(body: TenantSignupFormPayload): SelfServeTenantSignupInput {
  return parseSignupFormFields(body, { requireTerms: false });
}

export async function sendTenantSignupVerificationCode(
  body: TenantSignupFormPayload,
  requestIp?: string | null,
) {
  const parsed = parseSignupFormForVerificationSend(body);
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
      selectedPlan: parsed.selectedPlan,
      signupIp: requestIp?.trim() || null,
    },
    mailSubject: buildPlatformVerificationEmailSubject('TENANT_SIGNUP'),
    mailHtml: (code) =>
      buildPlatformVerificationEmailHtml({
        kind: 'TENANT_SIGNUP',
        code,
        companyName: parsed.name.trim(),
        tenantSlug: slugCheck.slug,
      }),
    mailText: (code) =>
      buildPlatformVerificationEmailText({
        kind: 'TENANT_SIGNUP',
        code,
        companyName: parsed.name.trim(),
        tenantSlug: slugCheck.slug,
      }),
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
  memberTermsAgreedAt?: string | null;
  selectedPlan: string;
  signupIp: string | null;
};

export async function completeTenantSignupWithVerification(input: {
  challengeId: string;
  contactEmail: string;
  code: string;
  memberTermsAgreed: boolean;
}) {
  if (!input.memberTermsAgreed) {
    throw new EmailVerificationError('회원사 이용약관에 동의해 주세요.');
  }
  const payload = (await consumeEmailVerificationChallenge({
    purpose: 'TENANT_SIGNUP',
    challengeId: input.challengeId,
    email: input.contactEmail,
    code: input.code,
  })) as StoredSignupPayload;

  const result = await provisionTenantSelfServeFromVerifiedPayload(payload, {
    memberTermsAgreed: true,
  });
  return result;
}

/** 인증 완료 payload — passwordHash 는 이미 bcrypt */
export async function provisionTenantSelfServeFromVerifiedPayload(
  payload: StoredSignupPayload,
  opts: { memberTermsAgreed: boolean },
) {
  if (!opts.memberTermsAgreed) {
    throw new TenantSignupError('회원사 이용약관에 동의해 주세요.');
  }
  let selectedPlan: TenantPlanId;
  try {
    selectedPlan = normalizeSignupPlanId(payload.selectedPlan);
  } catch {
    throw new TenantSignupError('올바른 이용 플랜을 선택해 주세요.');
  }
  const agreedAt = new Date().toISOString();
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
    emailVerifiedAt: agreedAt,
    selectedPlan,
  });
}
