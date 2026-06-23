import { prisma } from '../../lib/prisma.js';
import { DbMarketplaceError } from './dbMarketplace.service.js';

export type DbMarketplaceBuyerContext =
  | { kind: 'PARTNER_TENANT'; tenantId: string; userId: string }
  | { kind: 'EXTERNAL_COMPANY'; tenantId: string; userId: string; externalCompanyId: string };

async function hasActivePartnership(sellerTenantId: string, buyerTenantId: string): Promise<boolean> {
  const row = await prisma.tenantPartnership.findFirst({
    where: {
      status: 'ACTIVE',
      OR: [
        { tenantLowId: sellerTenantId, tenantHighId: buyerTenantId },
        { tenantLowId: buyerTenantId, tenantHighId: sellerTenantId },
      ],
    },
    select: { id: true },
  });
  return Boolean(row);
}

async function isActiveExternalCompany(
  tenantId: string,
  externalCompanyId: string,
): Promise<boolean> {
  const row = await prisma.externalCompany.findFirst({
    where: { id: externalCompanyId, tenantId, isActive: true },
    select: { id: true },
  });
  return Boolean(row);
}

export async function assertBuyerCanViewListing(
  listing: {
    tenantId: string;
    status: string;
    visibility: string;
    platformSuspendedAt?: Date | null;
    audiences: Array<{
      audienceKind: string;
      partnerTenantId: string | null;
      externalCompanyId: string | null;
    }>;
  },
  buyer: DbMarketplaceBuyerContext,
): Promise<void> {
  if (listing.status !== 'OPEN') {
    throw new DbMarketplaceError('구매 신청할 수 없는 상태입니다.', 400);
  }
  if (listing.platformSuspendedAt) {
    throw new DbMarketplaceError('플랫폼에 의해 일시 중지된 건입니다.', 403);
  }

  if (buyer.kind === 'PARTNER_TENANT') {
    if (buyer.tenantId === listing.tenantId) {
      throw new DbMarketplaceError('자사 DB는 구매할 수 없습니다.', 400);
    }
    if (!(await hasActivePartnership(listing.tenantId, buyer.tenantId))) {
      throw new DbMarketplaceError('연결된 파트너만 구매할 수 있습니다.', 400);
    }
    if (listing.visibility === 'ALL') return;
    const allowed = listing.audiences.some(
      (a) => a.audienceKind === 'PARTNER_TENANT' && a.partnerTenantId === buyer.tenantId,
    );
    if (!allowed) throw new DbMarketplaceError('노출 대상에 포함되지 않은 업체입니다.', 403);
    return;
  }

  if (buyer.tenantId !== listing.tenantId) {
    throw new DbMarketplaceError('타업체는 자사 마켓 DB만 구매할 수 있습니다.', 403);
  }
  if (!(await isActiveExternalCompany(listing.tenantId, buyer.externalCompanyId))) {
    throw new DbMarketplaceError('등록된 타업체만 구매할 수 있습니다.', 403);
  }
  if (listing.visibility === 'ALL') return;
  const allowed = listing.audiences.some(
    (a) => a.audienceKind === 'EXTERNAL_COMPANY' && a.externalCompanyId === buyer.externalCompanyId,
  );
  if (!allowed) throw new DbMarketplaceError('노출 대상에 포함되지 않은 타업체입니다.', 403);
}
