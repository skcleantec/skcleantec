import type { Prisma } from '@prisma/client';
import { prisma } from './prisma.js';
/** 타업체 정산 기준일 — 정보공유 인계 확정 건은 sellerConfirmedAt, 그 외는 예약일 */
export function resolveExternalSettlementEffectiveDate(
  preferredDate: Date | null,
  marketplaceSellerConfirmedAt: Date | null | undefined,
): Date | null {
  if (marketplaceSellerConfirmedAt) return marketplaceSellerConfirmedAt;
  return preferredDate ?? null;
}

export function kstYmdFromDate(d: Date): string {
  return d.toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10);
}

export function isInExternalSettlementPeriod(
  preferredDate: Date | null,
  marketplaceSellerConfirmedAt: Date | null | undefined,
  from: Date,
  to: Date,
): boolean {
  const effective = resolveExternalSettlementEffectiveDate(preferredDate, marketplaceSellerConfirmedAt);
  if (!effective) return false;
  return effective >= from && effective <= to;
}

export async function loadMarketplaceExternalConfirmAtMap(
  tenantId: string,
  opts?: { externalCompanyId?: string; inquiryIds?: string[] },
): Promise<Map<string, Date>> {
  const rows = await prisma.inquiryDbListing.findMany({
    where: {
      tenantId,
      status: 'CONFIRMED',
      buyerKind: 'EXTERNAL_COMPANY',
      sellerConfirmedAt: { not: null },
      ...(opts?.externalCompanyId ? { buyerExternalCompanyId: opts.externalCompanyId } : {}),
      ...(opts?.inquiryIds?.length ? { inquiryId: { in: opts.inquiryIds } } : {}),
    },
    select: { inquiryId: true, sellerConfirmedAt: true },
  });
  const map = new Map<string, Date>();
  for (const row of rows) {
    if (row.sellerConfirmedAt) map.set(row.inquiryId, row.sellerConfirmedAt);
  }
  return map;
}

export async function marketplaceInquiryIdsWithConfirmInRange(
  tenantId: string,
  externalCompanyId: string,
  from: Date,
  to: Date,
): Promise<string[]> {
  const rows = await prisma.inquiryDbListing.findMany({
    where: {
      tenantId,
      status: 'CONFIRMED',
      buyerKind: 'EXTERNAL_COMPANY',
      buyerExternalCompanyId: externalCompanyId,
      sellerConfirmedAt: { gte: from, lte: to },
    },
    select: { inquiryId: true },
  });
  return rows.map((r) => r.inquiryId);
}

export function externalSettlementPeriodOrClause(
  from: Date,
  to: Date,
  marketplaceInquiryIds: string[],
): Prisma.InquiryWhereInput[] {
  const or: Prisma.InquiryWhereInput[] = [{ preferredDate: { gte: from, lte: to } }];
  if (marketplaceInquiryIds.length > 0) {
    or.push({ id: { in: marketplaceInquiryIds } });
  }
  return or;
}

export function filterInquiriesByEffectiveSettlementDate<
  T extends { id: string; preferredDate: Date | null },
>(rows: T[], confirmAtMap: Map<string, Date>, from: Date, to: Date): T[] {
  return rows.filter((row) =>
    isInExternalSettlementPeriod(row.preferredDate, confirmAtMap.get(row.id), from, to),
  );
}

export function filterExternalSettlementItemsBySearch<
  T extends { customerName: string; inquiryNumber: string | null },
>(items: T[], search: string): T[] {
  const q = search.trim().toLowerCase();
  if (!q) return items;
  return items.filter(
    (it) =>
      it.customerName.toLowerCase().includes(q) ||
      (it.inquiryNumber?.toLowerCase().includes(q) ?? false),
  );
}

const inquirySettlementSelect = {
  id: true,
  inquiryNumber: true,
  customerName: true,
  address: true,
  addressDetail: true,
  preferredDate: true,
  status: true,
  externalTransferFee: true,
} as const;

const inquirySettlementAssignmentSelect = {
  ...inquirySettlementSelect,
  cancelFeeExternalCompanyId: true,
  assignments: {
    orderBy: { sortOrder: 'asc' as const },
    select: {
      teamLeader: {
        select: {
          id: true,
          name: true,
          role: true,
          externalCompanyId: true,
          externalCompany: { select: { id: true, name: true } },
        },
      },
    },
  },
} as const;

type SettlementInquiryRow = Prisma.InquiryGetPayload<{ select: typeof inquirySettlementSelect }>;
type SettlementInquiryRowWithAssignments = Prisma.InquiryGetPayload<{
  select: typeof inquirySettlementAssignmentSelect;
}>;

type FetchExternalSettlementPeriodBase = {
  tenantId: string;
  externalCompanyId: string;
  operatingCompanyId: string;
  from: Date;
  to: Date;
};

export async function fetchExternalSettlementInquiriesForCompanyPeriod(
  opts: FetchExternalSettlementPeriodBase & { includeAssignmentLabels?: false },
): Promise<{
  activeRows: SettlementInquiryRow[];
  cancelledRows: SettlementInquiryRow[];
  confirmAtMap: Map<string, Date>;
}>;
export async function fetchExternalSettlementInquiriesForCompanyPeriod(
  opts: FetchExternalSettlementPeriodBase & { includeAssignmentLabels: true },
): Promise<{
  activeRows: SettlementInquiryRowWithAssignments[];
  cancelledRows: SettlementInquiryRowWithAssignments[];
  confirmAtMap: Map<string, Date>;
}>;
export async function fetchExternalSettlementInquiriesForCompanyPeriod(
  opts: FetchExternalSettlementPeriodBase & { includeAssignmentLabels?: boolean },
): Promise<{
  activeRows: SettlementInquiryRow[] | SettlementInquiryRowWithAssignments[];
  cancelledRows: SettlementInquiryRow[] | SettlementInquiryRowWithAssignments[];
  confirmAtMap: Map<string, Date>;
}> {
  const marketplaceIds = await marketplaceInquiryIdsWithConfirmInRange(
    opts.tenantId,
    opts.externalCompanyId,
    opts.from,
    opts.to,
  );
  const periodOr = externalSettlementPeriodOrClause(opts.from, opts.to, marketplaceIds);
  const assignmentSome = {
    some: {
      teamLeader: { role: 'EXTERNAL_PARTNER' as const, externalCompanyId: opts.externalCompanyId },
    },
  };
  const rowSelect = opts.includeAssignmentLabels ? inquirySettlementAssignmentSelect : inquirySettlementSelect;

  const [activeRaw, cancelledRaw] = await Promise.all([
    prisma.inquiry.findMany({
      where: {
        tenantId: opts.tenantId,
        operatingCompanyId: opts.operatingCompanyId,
        externalTransferFee: { not: null },
        status: { notIn: ['CANCELLED', 'ON_HOLD'] },
        assignments: assignmentSome,
        OR: periodOr,
      },
      orderBy: [{ preferredDate: 'desc' }, { createdAt: 'desc' }],
      select: rowSelect,
    }),
    prisma.inquiry.findMany({
      where: {
        tenantId: opts.tenantId,
        operatingCompanyId: opts.operatingCompanyId,
        status: 'CANCELLED',
        externalTransferFee: { not: null },
        AND: [
          {
            OR: [
              { cancelFeeExternalCompanyId: opts.externalCompanyId },
              { assignments: assignmentSome },
            ],
          },
          { OR: periodOr },
        ],
      },
      orderBy: [{ preferredDate: 'desc' }, { createdAt: 'desc' }],
      select: rowSelect,
    }),
  ]);

  const allIds = [...activeRaw, ...cancelledRaw].map((r) => r.id);
  const confirmAtMap = await loadMarketplaceExternalConfirmAtMap(opts.tenantId, {
    externalCompanyId: opts.externalCompanyId,
    inquiryIds: allIds,
  });

  return {
    activeRows: filterInquiriesByEffectiveSettlementDate(activeRaw, confirmAtMap, opts.from, opts.to),
    cancelledRows: filterInquiriesByEffectiveSettlementDate(
      cancelledRaw,
      confirmAtMap,
      opts.from,
      opts.to,
    ),
    confirmAtMap,
  };
}

export async function computeSignedExternalFeeBeforeDate(opts: {
  tenantId: string;
  externalCompanyId: string;
  operatingCompanyId: string;
  before: Date;
}): Promise<number> {
  const confirmAtMap = await loadMarketplaceExternalConfirmAtMap(opts.tenantId, {
    externalCompanyId: opts.externalCompanyId,
  });
  const assignmentSome = {
    some: {
      teamLeader: { role: 'EXTERNAL_PARTNER' as const, externalCompanyId: opts.externalCompanyId },
    },
  };

  const [activeRows, cancelledRows] = await Promise.all([
    prisma.inquiry.findMany({
      where: {
        tenantId: opts.tenantId,
        operatingCompanyId: opts.operatingCompanyId,
        externalTransferFee: { not: null },
        status: { notIn: ['CANCELLED', 'ON_HOLD'] },
        assignments: assignmentSome,
      },
      select: { id: true, preferredDate: true, externalTransferFee: true },
    }),
    prisma.inquiry.findMany({
      where: {
        tenantId: opts.tenantId,
        operatingCompanyId: opts.operatingCompanyId,
        status: 'CANCELLED',
        externalTransferFee: { not: null },
        OR: [
          { cancelFeeExternalCompanyId: opts.externalCompanyId },
          { assignments: assignmentSome },
        ],
      },
      select: { id: true, preferredDate: true, externalTransferFee: true },
    }),
  ]);

  let signed = 0;
  for (const row of activeRows) {
    const effective = resolveExternalSettlementEffectiveDate(row.preferredDate, confirmAtMap.get(row.id));
    if (effective && effective < opts.before) signed += row.externalTransferFee ?? 0;
  }
  for (const row of cancelledRows) {
    const effective = resolveExternalSettlementEffectiveDate(row.preferredDate, confirmAtMap.get(row.id));
    if (effective && effective < opts.before) signed -= row.externalTransferFee ?? 0;
  }
  return signed;
}
