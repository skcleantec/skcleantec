import { PLATFORM_REFERRER_RESERVED_CODES } from './platformReferral.constants.js';
import { normalizeTenantSlug } from '../platform/tenantProvisioning.service.js';

const REFERRER_CODE_RE = /^[a-z0-9](?:[a-z0-9-]{0,46}[a-z0-9])?$/;

export function normalizeReferrerCode(raw: string): string {
  return normalizeTenantSlug(raw);
}

export function assertValidReferrerCode(code: string): void {
  if (!code || !REFERRER_CODE_RE.test(code)) {
    throw new Error('추천인 코드는 영문 소문자·숫자·하이픈(2~48자)만 사용할 수 있습니다.');
  }
  if ((PLATFORM_REFERRER_RESERVED_CODES as readonly string[]).includes(code)) {
    throw new Error('사용할 수 없는 추천인 코드입니다.');
  }
}

export function isReferrerCodeReserved(code: string): boolean {
  return (PLATFORM_REFERRER_RESERVED_CODES as readonly string[]).includes(code.trim().toLowerCase());
}
