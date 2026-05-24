import type { TenantStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import {
  assertTenantLoginAllowed,
  resolveTenantBySlug,
  TenantNotFoundError,
  TenantSuspendedError,
} from './tenant.service.js';

export class PublicTenantAccessError extends Error {
  constructor(
    message: string,
    readonly code: 'tenant_mismatch' | 'tenant_suspended' | 'tenant_not_found' = 'tenant_mismatch',
  ) {
    super(message);
    this.name = 'PublicTenantAccessError';
  }
}

/** 공개 링크(발주서·전자계약) — 테넌트 운영 중인지 확인 */
export async function assertTenantAllowsPublicService(tenantId: string): Promise<void> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, status: true },
  });
  if (!tenant) {
    throw new PublicTenantAccessError('업체를 찾을 수 없습니다.', 'tenant_not_found');
  }
  try {
    await assertTenantLoginAllowed(tenant.status as TenantStatus);
  } catch (e) {
    if (e instanceof TenantSuspendedError) {
      throw new PublicTenantAccessError(e.message, 'tenant_suspended');
    }
    throw e;
  }
}

/**
 * 선택 쿼리 `tenantSlug`가 있으면 발주서·계약의 tenant와 일치해야 한다.
 * slug 없으면 token만으로 조회(레거시 링크 호환).
 */
export async function validateOptionalPublicTenantSlug(
  tenantId: string,
  slugRaw: string | undefined,
): Promise<void> {
  if (!slugRaw?.trim()) return;
  let resolved;
  try {
    resolved = await resolveTenantBySlug(slugRaw);
  } catch (e) {
    if (e instanceof TenantNotFoundError) {
      throw new PublicTenantAccessError('업체 코드가 올바르지 않습니다.', 'tenant_not_found');
    }
    throw e;
  }
  if (resolved.id !== tenantId) {
    throw new PublicTenantAccessError('이 링크는 해당 업체 발주서가 아닙니다.', 'tenant_mismatch');
  }
  await assertTenantAllowsPublicService(tenantId);
}

export function publicTenantAccessHttpStatus(code: PublicTenantAccessError['code']): number {
  if (code === 'tenant_not_found' || code === 'tenant_mismatch') return 404;
  if (code === 'tenant_suspended') return 403;
  return 400;
}
