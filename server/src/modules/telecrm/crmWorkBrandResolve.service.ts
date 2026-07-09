import type { Prisma, PrismaClient, UserRole } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import {
  mapOperatingCompanyResolveError,
  OperatingCompanyAccessError,
  resolveInquiryOperatingCompanyId,
} from '../operating-companies/operatingCompanyResolve.service.js';
import { OperatingCompanyNotFoundError } from '../operating-companies/operatingCompany.service.js';

type Db = PrismaClient | Prisma.TransactionClient;

export type CrmWorkBrandInput = {
  workBrandSlug?: string | null;
  operatingCompanyId?: string | null;
};

export function readCrmWorkBrandInput(
  query: Record<string, unknown>,
  body?: Record<string, unknown>,
): CrmWorkBrandInput {
  const fromQuerySlug = typeof query.workBrand === 'string' ? query.workBrand.trim() : '';
  const fromBodySlug = typeof body?.workBrand === 'string' ? body.workBrand.trim() : '';
  const fromQueryId =
    typeof query.operatingCompanyId === 'string' ? query.operatingCompanyId.trim() : '';
  const fromBodyId =
    typeof body?.operatingCompanyId === 'string' ? body.operatingCompanyId.trim() : '';
  return {
    ...(fromQueryId || fromBodyId ? { operatingCompanyId: fromQueryId || fromBodyId } : {}),
    ...(fromQuerySlug || fromBodySlug ? { workBrandSlug: fromQuerySlug || fromBodySlug } : {}),
  };
}

export async function resolveCrmWorkOperatingCompanyId(params: {
  tx?: Db;
  tenantId: string;
  userId: string;
  userRole: UserRole;
  isStaffAdmin?: boolean;
  workBrandSlug?: string | null;
  operatingCompanyId?: string | null;
}): Promise<string> {
  const db = params.tx ?? prisma;
  const { tenantId, userId, userRole } = params;
  const isAdmin = params.isStaffAdmin === true || userRole === 'ADMIN';

  if (params.operatingCompanyId?.trim()) {
    return resolveInquiryOperatingCompanyId({
      tx: db,
      tenantId,
      userId,
      userRole: isAdmin ? 'ADMIN' : userRole,
      bodyOperatingCompanyId: params.operatingCompanyId.trim(),
    });
  }

  if (params.workBrandSlug?.trim()) {
    const slug = params.workBrandSlug.trim().toLowerCase();
    const bySlug = await db.operatingCompany.findFirst({
      where: { tenantId, slug, isActive: true },
      select: { id: true },
    });
    if (!bySlug) throw new OperatingCompanyNotFoundError('작업 브랜드를 찾을 수 없습니다.');
    if (!isAdmin) {
      const membership = await db.userOperatingCompany.findFirst({
        where: { tenantId, userId, operatingCompanyId: bySlug.id },
      });
      if (!membership) throw new OperatingCompanyAccessError();
    }
    return bySlug.id;
  }

  return resolveInquiryOperatingCompanyId({
    tx: db,
    tenantId,
    userId,
    userRole,
  });
}

export { mapOperatingCompanyResolveError };
