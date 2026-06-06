import type { Prisma, PrismaClient, UserRole } from '@prisma/client';
import {
  assertOperatingCompanyInTenant,
  getDefaultOperatingCompanyId,
  OperatingCompanyNotFoundError,
  OperatingCompanyValidationError,
} from './operatingCompany.service.js';
import { getOperatingCompanyPolicy } from './operatingCompanyPolicy.js';

type Db = PrismaClient | Prisma.TransactionClient;

export class OperatingCompanyAccessError extends Error {
  constructor(message = '해당 영업 업체에 소속되어 있지 않습니다.') {
    super(message);
    this.name = 'OperatingCompanyAccessError';
  }
}

async function userPrimaryOperatingCompanyId(
  tx: Db,
  tenantId: string,
  userId: string,
): Promise<string | null> {
  const primary = await tx.userOperatingCompany.findFirst({
    where: { tenantId, userId, isPrimary: true },
    select: { operatingCompanyId: true },
  });
  if (primary) return primary.operatingCompanyId;
  const any = await tx.userOperatingCompany.findFirst({
    where: { tenantId, userId },
    select: { operatingCompanyId: true },
  });
  return any?.operatingCompanyId ?? null;
}

export async function resolveInquiryOperatingCompanyId(params: {
  tx: Db;
  tenantId: string;
  userId?: string | null;
  userRole?: UserRole;
  bodyOperatingCompanyId?: unknown;
  brandSlug?: string | null;
}): Promise<string> {
  const { tx, tenantId, userId, userRole, bodyOperatingCompanyId, brandSlug } = params;
  const isAdmin = userRole === 'ADMIN';

  if (bodyOperatingCompanyId != null && bodyOperatingCompanyId !== '') {
    const ocId = String(bodyOperatingCompanyId);
    await assertOperatingCompanyInTenant(tx, tenantId, ocId, { requireActive: !isAdmin });
    if (!isAdmin && userId) {
      const membership = await tx.userOperatingCompany.findFirst({
        where: { tenantId, userId, operatingCompanyId: ocId },
      });
      if (!membership) throw new OperatingCompanyAccessError();
    }
    return ocId;
  }

  const policy = await getOperatingCompanyPolicy(tx, tenantId);

  if (policy.inquiryDefaultMode === 'from_intake_url' && brandSlug?.trim()) {
    const slug = brandSlug.trim().toLowerCase();
    const bySlug = await tx.operatingCompany.findFirst({
      where: { tenantId, slug, isActive: true },
      select: { id: true },
    });
    if (bySlug) return bySlug.id;
  }

  if (userId && (policy.inquiryDefaultMode === 'user_primary' || policy.inquiryDefaultMode === 'creator_primary')) {
    const fromUser = await userPrimaryOperatingCompanyId(tx, tenantId, userId);
    if (fromUser) return fromUser;
  }

  return getDefaultOperatingCompanyId(tx, tenantId);
}

export async function validateInquiryOperatingCompanyChange(params: {
  tx: Db;
  tenantId: string;
  userId: string;
  userRole: UserRole;
  nextOperatingCompanyId: string;
}): Promise<void> {
  const { tx, tenantId, userId, userRole, nextOperatingCompanyId } = params;
  await assertOperatingCompanyInTenant(tx, tenantId, nextOperatingCompanyId);
  if (userRole === 'ADMIN') return;
  const membership = await tx.userOperatingCompany.findFirst({
    where: { tenantId, userId, operatingCompanyId: nextOperatingCompanyId },
  });
  if (!membership) throw new OperatingCompanyAccessError();
}

export function mapOperatingCompanyResolveError(err: unknown): { status: number; message: string } | null {
  if (err instanceof OperatingCompanyNotFoundError) {
    return { status: 404, message: err.message };
  }
  if (err instanceof OperatingCompanyAccessError || err instanceof OperatingCompanyValidationError) {
    return { status: 400, message: err.message };
  }
  return null;
}
