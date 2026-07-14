import type { TenantStatus, TenantSuspendReason } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { DEFAULT_TENANT_SLUG, LEGACY_SK_TENANT_SLUG } from './tenant.constants.js';

export type TenantStaffAccessFields = {
  status: TenantStatus;
  suspendReason: TenantSuspendReason | null;
  billingAccessBlockedAt: Date | null;
};

export class TenantNotFoundError extends Error {
  constructor(message = '업체를 찾을 수 없습니다.') {
    super(message);
    this.name = 'TenantNotFoundError';
  }
}

export class TenantSuspendedError extends Error {
  constructor(message = '서비스가 중지된 업체입니다.') {
    super(message);
    this.name = 'TenantSuspendedError';
  }
}

export class TenantBillingAccessBlockedError extends Error {
  constructor(message = '이용료 미납으로 업무 접속이 제한되었습니다. 관리자에게 문의해 주세요.') {
    super(message);
    this.name = 'TenantBillingAccessBlockedError';
  }
}

export async function resolveTenantBySlug(slugRaw: string) {
  const slug = slugRaw.trim().toLowerCase();
  if (!slug || !/^[a-z0-9](?:[a-z0-9-]{0,46}[a-z0-9])?$/.test(slug)) {
    throw new TenantNotFoundError('업체 코드 형식이 올바르지 않습니다.');
  }
  let tenant = await prisma.tenant.findUnique({ where: { slug } });
  if (!tenant && slug === DEFAULT_TENANT_SLUG) {
    tenant = await prisma.tenant.findUnique({ where: { slug: LEGACY_SK_TENANT_SLUG } });
  }
  if (!tenant) throw new TenantNotFoundError('업체를 찾을 수 없습니다.');
  return tenant;
}

/** 플랫폼 수동 중지 — 공개 고객 링크 포함 전면 차단 */
export function isPlatformFullSuspend(t: TenantStaffAccessFields): boolean {
  return t.status === 'SUSPENDED' && (t.suspendReason === 'PLATFORM' || t.suspendReason == null);
}

/** 과금·체험 만료 — 스태프만 차단 */
export function isStaffBillingBlocked(t: TenantStaffAccessFields): boolean {
  return t.billingAccessBlockedAt != null;
}

export async function assertTenantStaffLoginAllowed(t: TenantStaffAccessFields) {
  if (isPlatformFullSuspend(t)) {
    throw new TenantSuspendedError();
  }
  if (isStaffBillingBlocked(t)) {
    throw new TenantBillingAccessBlockedError();
  }
}

/** @deprecated status만으로 판단 — 가능하면 assertTenantStaffLoginAllowed 사용 */
export async function assertTenantLoginAllowed(status: TenantStatus) {
  if (status === 'SUSPENDED') {
    throw new TenantSuspendedError();
  }
}

/** tenantSlug 미입력 시 로컬·레거시 호환 */
export function normalizeTenantSlugInput(raw: unknown): string {
  if (typeof raw === 'string' && raw.trim()) return raw.trim().toLowerCase();
  return DEFAULT_TENANT_SLUG;
}

export function tenantSummary(
  t: { id: string; slug: string; name: string; plan: string; status: TenantStatus },
  displayNameRaw?: string | null,
) {
  const displayName = (typeof displayNameRaw === 'string' && displayNameRaw.trim()) || t.name;
  return {
    id: t.id,
    slug: t.slug,
    name: t.name,
    displayName,
    plan: t.plan,
    status: t.status,
  };
}

export async function tenantIdForUserId(userId: string | null | undefined): Promise<string | null> {
  if (!userId) return null;
  const row = await prisma.user.findUnique({ where: { id: userId }, select: { tenantId: true } });
  return row?.tenantId ?? null;
}
