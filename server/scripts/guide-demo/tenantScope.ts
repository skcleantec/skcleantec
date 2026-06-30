import bcrypt from 'bcryptjs';
import type { PrismaClient } from '@prisma/client';
import { LEGACY_SK_TENANT_SLUG } from '../../src/modules/tenants/tenant.constants.js';
import { GUIDE_DEMO_MARKETER_EMAIL } from './constants.js';

let cachedTenantId: string | null = null;
let cachedTenantSlug: string | null = null;
let cachedTeamLeaderEmail: string | null = null;

/** 시드 대상 테넌트 slug — 기본 sk. cbiseo.com 운영은 `cbiseo` */
export function guideDemoTenantSlugFromEnv(): string {
  return process.env.GUIDE_DEMO_TENANT_SLUG?.trim().toLowerCase() || LEGACY_SK_TENANT_SLUG;
}

export async function initGuideDemoTenantScope(prisma: PrismaClient): Promise<{
  tenantId: string;
  slug: string;
  teamLeaderEmail: string;
}> {
  const slug = guideDemoTenantSlugFromEnv();
  const tenant = await prisma.tenant.findFirst({
    where: { slug },
    select: { id: true, slug: true, status: true },
  });
  if (!tenant) {
    throw new Error(`가이드 데모 테넌트를 찾을 수 없습니다 (slug: ${slug}). GUIDE_DEMO_TENANT_SLUG 확인.`);
  }

  const cbiseoUser = await prisma.user.findFirst({
    where: { tenantId: tenant.id, email: 'cbiseo' },
    select: { role: true },
  });
  /** 운영 cbiseo 테넌트: cbiseo=ADMIN 유지, 팀 데모는 cbiseo-team */
  const teamLeaderEmail =
    cbiseoUser?.role === 'ADMIN' ? 'cbiseo-team' : 'cbiseo';

  cachedTenantId = tenant.id;
  cachedTenantSlug = tenant.slug;
  cachedTeamLeaderEmail = teamLeaderEmail;

  return { tenantId: tenant.id, slug: tenant.slug, teamLeaderEmail };
}

export function guideDemoTenantId(): string {
  if (!cachedTenantId) {
    throw new Error('initGuideDemoTenantScope()를 먼저 호출하세요.');
  }
  return cachedTenantId;
}

export function guideDemoTeamLeaderEmail(): string {
  if (!cachedTeamLeaderEmail) {
    throw new Error('initGuideDemoTenantScope()를 먼저 호출하세요.');
  }
  return cachedTeamLeaderEmail;
}

export function resetGuideDemoTenantScopeForTests(): void {
  cachedTenantId = null;
  cachedTenantSlug = null;
  cachedTeamLeaderEmail = null;
}

/** 시나리오의 `cbiseo` → 실제 팀장 로그인 ID(cbiseo 또는 cbiseo-team) */
export function resolveGuideDemoLeaderEmail(email: string): string {
  if (email === 'cbiseo') return guideDemoTeamLeaderEmail();
  return email;
}

/** 마케터·추가 팀장 — cbiseo 테넌트 등 최소 계정만 있을 때 보강 */
export async function ensureGuideDemoStaffUsers(
  prisma: PrismaClient,
  tenantId: string,
  password = '1234',
): Promise<void> {
  const hash = await bcrypt.hash(password, 10);
  const rows = [
    { email: GUIDE_DEMO_MARKETER_EMAIL, role: 'MARKETER' as const, name: '홍마케터' },
    { email: 'team1@skcleanteck.com', role: 'TEAM_LEADER' as const, name: '팀장1(데모)' },
    { email: 'team2@skcleanteck.com', role: 'TEAM_LEADER' as const, name: '팀장2(데모)' },
    { email: 'team3@skcleanteck.com', role: 'TEAM_LEADER' as const, name: '팀장3(데모)' },
  ];
  for (const row of rows) {
    await prisma.user.upsert({
      where: { tenantId_email: { tenantId, email: row.email } },
      update: { isActive: true, role: row.role, name: row.name },
      create: {
        tenantId,
        email: row.email,
        passwordHash: hash,
        role: row.role,
        name: row.name,
        isActive: true,
      },
    });
  }
}
