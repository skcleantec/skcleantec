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
import { normalizeReferrerCode } from '../platform-referrals/platformReferralCode.helpers.js';
import type { SignupBusinessInput } from '../auth-signup/signupBusiness.validation.js';
import {
  buildPlatformVerificationEmailHtml,
  buildPlatformVerificationEmailSubject,
  buildPlatformVerificationEmailText,
} from '../../lib/platformTransactionalEmail.js';
import { verifySignupOAuthToken, type SignupOAuthTokenPayload } from '../auth-signup/signupOAuthToken.service.js';
import type { SignupOAuthIdentityInput } from './tenantSignup.service.js';

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
  referrerCode?: string;
  referrerFromLink?: boolean;
  /** Phase 4 — Google/Kakao verify 후 발급 */
  signupToken?: string;
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
  opts: { requireTerms: boolean; signupOAuth?: SignupOAuthTokenPayload | null },
): SelfServeTenantSignupInput {
  if (opts.requireTerms && !body.memberTermsAgreed) {
    throw new EmailVerificationError('회원사 이용약관에 동의해 주세요.');
  }
  const contactPhone = normalizeSignupPhone(body.contactPhone);
  const contactEmail = normalizeVerificationEmail(body.contactEmail);
  assertValidTenantLoginId(body.adminLoginId);
  const password = body.adminPassword.trim();
  if (!opts.signupOAuth && password.length < 4) {
    throw new EmailVerificationError('비밀번호는 4자 이상 입력해 주세요.');
  }
  const selectedPlan = parseSignupPlan(body);
  return {
    slug: body.slug,
    name: body.name,
    adminLoginId: body.adminLoginId,
    adminPassword: opts.signupOAuth ? '' : password,
    adminName: body.adminName,
    contactEmail,
    contactPhone,
    memberTermsAgreed: opts.requireTerms,
    selectedPlan,
    referrerCode: normalizeReferrerCode(body.referrerCode ?? '') || undefined,
    referrerFromLink: Boolean(body.referrerFromLink),
  };
}

export async function sendTenantSignupVerificationCode(
  body: TenantSignupFormPayload,
  requestIp?: string | null,
) {
  const signupOAuth = body.signupToken?.trim()
    ? verifySignupOAuthToken(body.signupToken.trim())
    : null;
  const parsed = parseSignupFormFields(body, { requireTerms: false, signupOAuth });
  const slugCheck = await isTenantSlugAvailableForSignup(parsed.slug);
  if (!slugCheck.available) {
    throw new TenantSignupError(slugCheck.reason ?? '업체 코드를 사용할 수 없습니다.', 409);
  }

  const passwordHash = signupOAuth ? null : await bcrypt.hash(parsed.adminPassword, 10);
  const oauthPayload = signupOAuth
    ? {
        oauthProvider: signupOAuth.provider,
        oauthProviderSub: signupOAuth.providerSub,
        oauthProviderEmail: signupOAuth.providerEmail,
      }
    : {};
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
      referrerCode: parsed.referrerCode ?? null,
      referrerFromLink: parsed.referrerFromLink ?? false,
      ...oauthPayload,
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
  passwordHash: string | null;
  oauthProvider?: 'google' | 'kakao' | null;
  oauthProviderSub?: string | null;
  oauthProviderEmail?: string | null;
  memberTermsAgreedAt?: string | null;
  selectedPlan: string;
  signupIp: string | null;
  referrerCode?: string | null;
  referrerFromLink?: boolean;
};

function readOAuthIdentityFromPayload(payload: StoredSignupPayload): SignupOAuthIdentityInput | undefined {
  const provider = payload.oauthProvider;
  const providerSub = payload.oauthProviderSub?.trim();
  if ((provider !== 'google' && provider !== 'kakao') || !providerSub) return undefined;
  return {
    provider,
    providerSub,
    providerEmail: payload.oauthProviderEmail?.trim().toLowerCase() || null,
  };
}

export async function completeTenantSignupWithVerification(input: {
  challengeId: string;
  contactEmail: string;
  code: string;
  memberTermsAgreed: boolean;
  signupBusiness: SignupBusinessInput;
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
    signupBusiness: input.signupBusiness,
  });
  return result;
}

/** 인증 완료 payload — passwordHash 는 이미 bcrypt */
export async function provisionTenantSelfServeFromVerifiedPayload(
  payload: StoredSignupPayload,
  opts: { memberTermsAgreed: boolean; signupBusiness: SignupBusinessInput },
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
  const oauthIdentity = readOAuthIdentityFromPayload(payload);
  if (!payload.passwordHash && !oauthIdentity) {
    throw new TenantSignupError('가입 방식 정보가 올바르지 않습니다. 인증번호를 다시 받아 주세요.');
  }
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
    passwordHash: payload.passwordHash ?? undefined,
    emailVerifiedAt: agreedAt,
    selectedPlan,
    referrerCode: payload.referrerCode ?? null,
    referrerFromLink: Boolean(payload.referrerFromLink),
    signupBusiness: opts.signupBusiness,
    oauthIdentity,
  });
}
