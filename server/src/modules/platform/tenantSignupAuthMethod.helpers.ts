import type { AuthIdentityProvider } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';

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

function normalizeAuthProvider(raw: unknown): AuthIdentityProvider | null {
  const v = String(raw ?? '').trim().toLowerCase();
  if (v === 'google' || v === 'kakao') return v;
  return null;
}

/** Tenant.config + (선택) owner SNS 연결로 셀프 가입 경로 표시 — `shared/tenantSignupAuthMethod.ts` 와 동기화 */
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

  const oauth = normalizeAuthProvider(authRaw);
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

export async function loadOwnerAuthProvidersByTenant(): Promise<Map<string, AuthIdentityProvider[]>> {
  const rows = await prisma.userAuthIdentity.findMany({
    where: { user: { isTenantOwner: true, role: 'ADMIN' } },
    select: { tenantId: true, provider: true },
  });
  const map = new Map<string, AuthIdentityProvider[]>();
  for (const row of rows) {
    const list = map.get(row.tenantId) ?? [];
    if (!list.includes(row.provider)) list.push(row.provider);
    map.set(row.tenantId, list);
  }
  return map;
}

export function resolveTenantSignupAuthMethodForPlatform(
  config: unknown,
  ownerAuthProvidersByTenant: Map<string, AuthIdentityProvider[]>,
  tenantId: string,
): TenantSignupAuthMethodInfo {
  const providers = ownerAuthProvidersByTenant.get(tenantId) ?? [];
  return resolveTenantSignupAuthMethod(config, providers);
}
