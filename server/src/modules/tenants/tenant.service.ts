import type { TenantStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { DEFAULT_TENANT_SLUG } from './tenant.constants.js';

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

export async function resolveTenantBySlug(slugRaw: string) {
  const slug = slugRaw.trim().toLowerCase();
  if (!slug || !/^[a-z0-9](?:[a-z0-9-]{0,46}[a-z0-9])?$/.test(slug)) {
    throw new TenantNotFoundError('업체 코드 형식이 올바르지 않습니다.');
  }
  const tenant = await prisma.tenant.findUnique({ where: { slug } });
  if (!tenant) throw new TenantNotFoundError('업체를 찾을 수 없습니다.');
  return tenant;
}

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

export function tenantSummary(t: { id: string; slug: string; name: string; plan: string; status: TenantStatus }) {
  return {
    id: t.id,
    slug: t.slug,
    name: t.name,
    plan: t.plan,
    status: t.status,
  };
}

export async function tenantIdForUserId(userId: string | null | undefined): Promise<string | null> {
  if (!userId) return null;
  const row = await prisma.user.findUnique({ where: { id: userId }, select: { tenantId: true } });
  return row?.tenantId ?? null;
}
