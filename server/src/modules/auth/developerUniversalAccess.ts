import bcrypt from 'bcryptjs';
import type { User } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { DEFAULT_TENANT_SLUG } from '../tenants/tenant.constants.js';

/**
 * 업체 코드와 무관하게 모든 테넌트 업무(/admin·/team) 로그인 허용 개발자 아이디.
 * Railway: UNIVERSAL_DEVELOPER_LOGIN_IDS=pyo,other
 */
export function universalDeveloperLoginIds(): Set<string> {
  const raw =
    process.env.UNIVERSAL_DEVELOPER_LOGIN_IDS ??
    process.env.TEAM_PREVIEW_ADMIN_EMAILS ??
    'pyo';
  return new Set(
    raw
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isUniversalDeveloperLoginId(loginId: string | undefined | null): boolean {
  if (!loginId?.trim()) return false;
  return universalDeveloperLoginIds().has(loginId.trim().toLowerCase());
}

/** 기준 계정 — DEFAULT 테넌트 pyo 우선, 없으면 테넌트 오너 ADMIN */
async function findCanonicalDeveloperUser(loginId: string): Promise<User | null> {
  const email = loginId.trim().toLowerCase();
  const defaultTenant = await prisma.tenant.findUnique({
    where: { slug: DEFAULT_TENANT_SLUG },
    select: { id: true },
  });
  if (defaultTenant) {
    const onDefault = await prisma.user.findUnique({
      where: { tenantId_email: { tenantId: defaultTenant.id, email } },
    });
    if (onDefault?.isActive) return onDefault;
  }
  return prisma.user.findFirst({
    where: {
      email,
      isActive: true,
      role: 'ADMIN',
      isTenantOwner: true,
      platformSupportAccessId: null,
    },
    orderBy: { createdAt: 'asc' },
  });
}

/** 대상 테넌트에 동일 아이디·비밀 ADMIN shadow — 최초 로그인 시 자동 생성 */
async function ensureDeveloperShadowUser(canonical: User, tenantId: string): Promise<User> {
  const email = canonical.email.trim().toLowerCase();
  if (canonical.tenantId === tenantId) return canonical;

  const existing = await prisma.user.findUnique({
    where: { tenantId_email: { tenantId, email } },
  });
  if (existing) {
    return prisma.user.update({
      where: { id: existing.id },
      data: {
        isActive: true,
        passwordHash: canonical.passwordHash,
        name: canonical.name,
        role: 'ADMIN',
        isTenantOwner: true,
      },
    });
  }

  return prisma.user.create({
    data: {
      tenantId,
      email,
      passwordHash: canonical.passwordHash,
      name: canonical.name,
      role: 'ADMIN',
      isTenantOwner: true,
      isActive: true,
    },
  });
}

export type DeveloperUniversalLoginResult =
  | { kind: 'not_applicable' }
  | { kind: 'wrong_password' }
  | { kind: 'no_canonical' }
  | { kind: 'ok'; user: User };

/**
 * 개발자 아이디 + 기준 테넌트 비밀번호로 임의 테넌트 업무 로그인.
 * TenantSupportAccess와 별도 — pyo 등 고정 개발 계정용.
 */
export async function tryDeveloperUniversalLogin(
  loginId: string,
  password: string,
  tenantId: string,
): Promise<DeveloperUniversalLoginResult> {
  if (!isUniversalDeveloperLoginId(loginId)) {
    return { kind: 'not_applicable' };
  }
  const canonical = await findCanonicalDeveloperUser(loginId);
  if (!canonical) {
    return { kind: 'no_canonical' };
  }
  const valid = await bcrypt.compare(password, canonical.passwordHash);
  if (!valid) {
    return { kind: 'wrong_password' };
  }
  const user = await ensureDeveloperShadowUser(canonical, tenantId);
  if (!user.isActive) {
    return { kind: 'no_canonical' };
  }
  return { kind: 'ok', user };
}
