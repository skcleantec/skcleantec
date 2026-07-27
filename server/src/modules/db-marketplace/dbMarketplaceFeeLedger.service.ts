import type { InquiryDbListing, Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { prisma } from '../../lib/prisma.js';

export async function accrueDbMarketplaceFeeLedgerInTx(
  tx: Prisma.TransactionClient,
  opts: {
    listing: Pick<
      InquiryDbListing,
      | 'id'
      | 'tenantId'
      | 'hopIndex'
      | 'listingFee'
      | 'buyerKind'
      | 'buyerTenantId'
      | 'buyerExternalCompanyId'
    >;
    customerName: string;
    actorUserId: string;
    operatingCompanyId: string | null;
    confirmedAt: Date;
  },
) {
  const feeAmount = opts.listing.listingFee;
  if (!Number.isFinite(feeAmount) || feeAmount <= 0) return null;

  const ledger = await tx.inquiryDbListingFeeLedger.create({
    data: {
      id: randomUUID(),
      tenantId: opts.listing.tenantId,
      listingId: opts.listing.id,
      hopIndex: opts.listing.hopIndex,
      sellerTenantId: opts.listing.tenantId,
      buyerTenantId:
        opts.listing.buyerKind === 'PARTNER_TENANT' ? opts.listing.buyerTenantId : null,
      buyerExternalCompanyId:
        opts.listing.buyerKind === 'EXTERNAL_COMPANY'
          ? opts.listing.buyerExternalCompanyId
          : null,
      feeAmount,
      confirmedAt: opts.confirmedAt,
    },
  });

  return ledger;
}

export async function reverseDbMarketplaceFeeLedgerInTx(
  tx: Prisma.TransactionClient,
  opts: {
    listingId: string;
    customerName: string;
    actorUserId: string;
    operatingCompanyId: string | null;
    reversedAt: Date;
  },
): Promise<number> {
  const ledgers = await tx.inquiryDbListingFeeLedger.findMany({
    where: { listingId: opts.listingId, status: 'ACTIVE' },
  });
  if (ledgers.length === 0) return 0;

  let totalReversed = 0;
  for (const ledger of ledgers) {
    totalReversed += ledger.feeAmount;
    await tx.inquiryDbListingFeeLedger.update({
      where: { id: ledger.id },
      data: {
        status: 'REVERSED',
        reversedAt: opts.reversedAt,
        reversedByUserId: opts.actorUserId,
      },
    });
  }
  return totalReversed;
}

/** 기존 CONFIRMED listing 백필용 — share 기준 원장만 생성(결제 없음) */
export async function backfillFeeLedgersForConfirmedListings(limit = 500): Promise<number> {
  const rows = await prisma.inquiryDbListing.findMany({
    where: {
      status: 'CONFIRMED',
      feeLedgers: { none: {} },
      listingFee: { gt: 0 },
    },
    take: limit,
    select: {
      id: true,
      tenantId: true,
      hopIndex: true,
      listingFee: true,
      buyerKind: true,
      buyerTenantId: true,
      buyerExternalCompanyId: true,
      sellerConfirmedAt: true,
      confirmedAt: true,
    },
  });
  if (rows.length === 0) return 0;

  await prisma.$transaction(async (tx) => {
    for (const row of rows) {
      const confirmedAt = row.sellerConfirmedAt ?? row.confirmedAt ?? new Date();
      await tx.inquiryDbListingFeeLedger.create({
        data: {
          id: randomUUID(),
          tenantId: row.tenantId,
          listingId: row.id,
          hopIndex: row.hopIndex,
          sellerTenantId: row.tenantId,
          buyerTenantId: row.buyerKind === 'PARTNER_TENANT' ? row.buyerTenantId : null,
          buyerExternalCompanyId:
            row.buyerKind === 'EXTERNAL_COMPANY' ? row.buyerExternalCompanyId : null,
          feeAmount: row.listingFee,
          confirmedAt,
        },
      });
    }
  });
  return rows.length;
}
