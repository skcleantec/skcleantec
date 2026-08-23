import { normalizeAuthIdentityProvider, type AuthIdentityProvider } from './authSignup';

/** 클라이언트용 — 서버는 `server/src/modules/platform/tenantSignupAuthMethod.helpers.ts` 와 동기화 */

export const TENANT_SIGNUP_AUTH_METHODS = [
  'password',
  'google',
  'kakao',
  'platform',
  'unknown',
] as const;

export type TenantSignupAuthMethod = (typeof TENANT_SIGNUP_AUTH_METHODS)[number];

export type TenantSignupAuthCategory = 'simple' | 'standard' | 'platform' | 'unknown';

export type TenantSignupAuthMethodInfo = {
  method: TenantSignupAuthMethod;
  label: string;
  category: TenantSignupAuthCategory;
};

function readSignupConfig(config: unknown): Record<string, unknown> | null {
  if (!config || typeof config !== 'object') return null;
  const signup = (config as Record<string, unknown>).signup;
  if (!signup || typeof signup !== 'object') return null;
  return signup as Record<string, unknown>;
}

/** Tenant.config + (선택) owner SNS 연결로 셀프 가입 경로 표시 */
export function resolveTenantSignupAuthMethod(
  config: unknown,
  ownerAuthProviders: readonly AuthIdentityProvider[] = [],
): TenantSignupAuthMethodInfo {
  const signup = readSignupConfig(config);
  const source = String(signup?.source ?? '').trim();

  if (source === 'platform_provision') {
    return { method: 'platform', label: '플랫폼 개설', category: 'platform' };
  }

  const authRaw = signup?.authMethod;
  if (authRaw === 'password') {
    return { method: 'password', label: '일반가입', category: 'standard' };
  }

  const oauth = normalizeAuthIdentityProvider(authRaw);
  if (oauth === 'google') {
    return { method: 'google', label: 'Google 간편가입', category: 'simple' };
  }
  if (oauth === 'kakao') {
    return { method: 'kakao', label: '카카오 간편가입', category: 'simple' };
  }

  if (ownerAuthProviders.includes('google')) {
    return { method: 'google', label: 'Google 간편가입', category: 'simple' };
  }
  if (ownerAuthProviders.includes('kakao')) {
    return { method: 'kakao', label: '카카오 간편가입', category: 'simple' };
  }

  if (source === 'self_serve') {
    return { method: 'password', label: '일반가입', category: 'standard' };
  }

  return { method: 'unknown', label: '미확인', category: 'unknown' };
}

export function tenantSignupAuthCategoryLabel(category: TenantSignupAuthCategory): string {
  switch (category) {
    case 'simple':
      return '간편가입';
    case 'standard':
      return '일반가입';
    case 'platform':
      return '플랫폼';
    default:
      return '미확인';
  }
}
