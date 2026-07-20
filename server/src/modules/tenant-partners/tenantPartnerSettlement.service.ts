import type { InquiryStatus, Prisma, TenantPartnerSettlementRole } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { resolveExternalSettlementPaidAt } from '../../lib/externalSettlementPaidAt.js';
import {
  loadMarketplaceConfirmedShareIdSet,
  loadMarketplaceShareConfirmAtMap,
  resolvePartnerShareSettlementEffectiveDate,
} from '../db-marketplace/dbMarketplaceSettlementMeta.js';
import { signedExternalSettlementFee } from '../../lib/externalSettlementSignedFee.js';

export class TenantPartnerSettlementError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = 'TenantPartnerSettlementError';
  }
}

const YMD = /^\d{4}-\d{2}-\d{2}$/;
const YM = /^\d{4}-\d{2}$/;

function kstYmd(d: Date): string {
  return d.toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10);
}

function monthEndYmd(month: string): string {
  const [y, m] = month.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  return `${month}-${String(last).padStart(2, '0')}`;
}

function enumerateMonths(fromMonth: string, toMonth: string): string[] {
  const [fy, fm] = fromMonth.split('-').map(Number);
  const [ty, tm] = toMonth.split('-').map(Number);
  const out: string[] = [];
  let y = fy;
  let m = fm;
  while (y < ty || (y === ty && m <= tm)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

async function loadShareSettlementEffectiveDate(
  shares: ShareAccrualRow[],
): Promise<(s: ShareAccrualRow) => Date | null> {
  const shareIds = shares.map((s) => s.id);
  const marketplaceConfirmAtMap = await loadMarketplaceShareConfirmAtMap(shareIds);
  return (s) =>
    resolvePartnerShareSettlementEffectiveDate(
      s.sourceInquiry.preferredDate,
      marketplaceConfirmAtMap.get(s.id),
    );
}

type ShareAccrualRow = {
  id: string;
  partnershipId: string;
  sourceTenantId: string;
  targetTenantId: string;
  transferFee: number | null;
  direction: 'LOW_TO_HIGH' | 'HIGH_TO_LOW';
  cancelFeeDirection: 'LOW_TO_HIGH' | 'HIGH_TO_LOW' | null;
  syncStatus: 'ACTIVE' | 'PAUSED' | 'REVOKED';
  sourceInquiry: {
    id: string;
    inquiryNumber: string | null;
    customerName: string;
    preferredDate: Date | null;
    status: InquiryStatus;
  };
  targetInquiry: { status: InquiryStatus };
};

const shareAccrualSelect = {
  id: true,
  partnershipId: true,
  sourceTenantId: true,
  targetTenantId: true,
  transferFee: true,
  direction: true,
  cancelFeeDirection: true,
  syncStatus: true,
  sourceInquiry: {
    select: {
      id: true,
      inquiryNumber: true,
      customerName: true,
      preferredDate: true,
      status: true,
    },
  },
  targetInquiry: { select: { status: true } },
} as const;

/** 예약일 기준 순수수료 — 활성 +, 취소·보류 0 (취소는 −수수료로 미수에 반영하지 않음) */
export function signedShareTransferFee(share: ShareAccrualRow): number {
  const fee = share.transferFee ?? 0;
  if (fee === 0 || share.syncStatus === 'REVOKED') return 0;
  const src = share.sourceInquiry.status;
  const tgt = share.targetInquiry.status;
  if (src === 'ON_HOLD') return 0;
  const isCancelled = src === 'CANCELLED' || tgt === 'CANCELLED';
  return signedExternalSettlementFee(fee, isCancelled);
}

export async function stampTenantShareCancelFeeDirection(
  tx: Prisma.TransactionClient,
  inquiryId: string,
): Promise<void> {
  const asSource = await tx.tenantInquiryShare.findUnique({
    where: { sourceInquiryId: inquiryId },
    select: { id: true, direction: true, cancelFeeDirection: true },
  });
  if (asSource && !asSource.cancelFeeDirection) {
    await tx.tenantInquiryShare.update({
      where: { id: asSource.id },
      data: { cancelFeeDirection: asSource.direction },
    });
    return;
  }
  const asTarget = await tx.tenantInquiryShare.findUnique({
    where: { targetInquiryId: inquiryId },
    select: { id: true, direction: true, cancelFeeDirection: true },
  });
  if (asTarget && !asTarget.cancelFeeDirection) {
    await tx.tenantInquiryShare.update({
      where: { id: asTarget.id },
      data: { cancelFeeDirection: asTarget.direction },
    });
  }
}

async function loadPartnerMeta(viewerTenantId: string) {
  const partnerships = await prisma.tenantPartnership.findMany({
    where: {
      status: 'ACTIVE',
      OR: [{ tenantLowId: viewerTenantId }, { tenantHighId: viewerTenantId }],
    },
    include: {
      tenantLow: { select: { id: true, slug: true, name: true } },
      tenantHigh: { select: { id: true, slug: true, name: true } },
    },
  });
  const partnerById = new Map<
    string,
    { partnershipId: string; partnerTenantId: string; partnerName: string; partnerSlug: string }
  >();
  for (const p of partnerships) {
    const iAmLow = p.tenantLowId === viewerTenantId;
    const partner = iAmLow ? p.tenantHigh : p.tenantLow;
    partnerById.set(partner.id, {
      partnershipId: p.id,
      partnerTenantId: partner.id,
      partnerName: partner.name,
      partnerSlug: partner.slug,
    });
  }
  return partnerById;
}

async function assertPartnerInTenant(
  viewerTenantId: string,
  partnerTenantId: string,
): Promise<{ partnershipId: string; partnerName: string; partnerSlug: string }> {
  const partnership = await prisma.tenantPartnership.findFirst({
    where: {
      status: 'ACTIVE',
      OR: [
        { tenantLowId: viewerTenantId, tenantHighId: partnerTenantId },
        { tenantHighId: viewerTenantId, tenantLowId: partnerTenantId },
      ],
    },
    include: {
      tenantLow: { select: { id: true, name: true, slug: true } },
      tenantHigh: { select: { id: true, name: true, slug: true } },
    },
  });
  if (!partnership) {
    throw new TenantPartnerSettlementError('파트너 업체를 찾을 수 없습니다.', 404);
  }
  const partner =
    partnership.tenantLowId === partnerTenantId ? partnership.tenantLow : partnership.tenantHigh;
  return { partnershipId: partnership.id, partnerName: partner.name, partnerSlug: partner.slug };
}

async function loadSharesForRole(viewerTenantId: string, role: TenantPartnerSettlementRole) {
  const where =
    role === 'SELLER'
      ? {
          sourceTenantId: viewerTenantId,
          transferFee: { not: null },
          settlementMode: 'PARTNER_NATIVE' as const,
        }
      : {
          targetTenantId: viewerTenantId,
          transferFee: { not: null },
          settlementMode: 'PARTNER_NATIVE' as const,
        };
  return prisma.tenantInquiryShare.findMany({
    where,
    select: shareAccrualSelect,
  });
}

function partnerIdForShare(share: ShareAccrualRow, role: TenantPartnerSettlementRole, viewerTenantId: string) {
  return role === 'SELLER' ? share.targetTenantId : share.sourceTenantId;
}

export type SettlementOverviewRow = {
  partnerTenantId: string;
  partnerName: string;
  partnerSlug: string;
  partnershipId: string;
  accruedAmount: number;
  paidAmount: number;
  remainingAmount: number;
};

export async function getSettlementOverview(
  viewerTenantId: string,
  role: TenantPartnerSettlementRole,
): Promise<{ items: SettlementOverviewRow[] }> {
  const partnerMeta = await loadPartnerMeta(viewerTenantId);
  const shares = await loadSharesForRole(viewerTenantId, role);
  const shareSettlementEffectiveDate = await loadShareSettlementEffectiveDate(shares);
  const accruedByPartner = new Map<string, number>();
  for (const pid of partnerMeta.keys()) accruedByPartner.set(pid, 0);

  for (const share of shares) {
    const effective = shareSettlementEffectiveDate(share);
    if (!effective) continue;
    const pid = partnerIdForShare(share, role, viewerTenantId);
    if (!partnerMeta.has(pid)) continue;
    const signed = signedShareTransferFee(share);
    accruedByPartner.set(pid, (accruedByPartner.get(pid) ?? 0) + signed);
  }

  const paidRows = await prisma.tenantPartnerSettlementPayment.groupBy({
    by: ['partnerTenantId'],
    where: { tenantId: viewerTenantId, role },
    _sum: { amount: true },
  });
  const paidByPartner = new Map<string, number>();
  for (const r of paidRows) paidByPartner.set(r.partnerTenantId, r._sum.amount ?? 0);

  const items: SettlementOverviewRow[] = [];
  for (const [partnerTenantId, meta] of partnerMeta) {
    const accruedAmount = accruedByPartner.get(partnerTenantId) ?? 0;
    const paidAmount = paidByPartner.get(partnerTenantId) ?? 0;
    if (accruedAmount === 0 && paidAmount === 0) continue;
    items.push({
      partnerTenantId,
      partnerName: meta.partnerName,
      partnerSlug: meta.partnerSlug,
      partnershipId: meta.partnershipId,
      accruedAmount,
      paidAmount,
      remainingAmount: accruedAmount - paidAmount,
    });
  }
  items.sort((a, b) => b.remainingAmount - a.remainingAmount || a.partnerName.localeCompare(b.partnerName, 'ko-KR'));
  return { items };
}

export async function getSettlementPartnerDetail(opts: {
  viewerTenantId: string;
  role: TenantPartnerSettlementRole;
  partnerTenantId: string;
  from?: string;
  to?: string;
}) {
  const { viewerTenantId, role, partnerTenantId } = opts;
  const partner = await assertPartnerInTenant(viewerTenantId, partnerTenantId);

  const now = new Date();
  const fallbackMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const fallbackFrom = `${fallbackMonth}-01`;
  const fromYmd = opts.from && YMD.test(opts.from) ? opts.from : fallbackFrom;
  const toYmd =
    opts.to && YMD.test(opts.to)
      ? opts.to
      : (() => {
          const [y, m] = fallbackMonth.split('-').map(Number);
          const last = new Date(y, m, 0).getDate();
          return `${fallbackMonth}-${String(last).padStart(2, '0')}`;
        })();
  const loYmd = fromYmd <= toYmd ? fromYmd : toYmd;
  const hiYmd = fromYmd <= toYmd ? toYmd : fromYmd;
  const from = new Date(`${loYmd}T00:00:00+09:00`);
  const to = new Date(`${hiYmd}T23:59:59.999+09:00`);

  const shares = await loadSharesForRole(viewerTenantId, role);
  const shareIds = shares.map((s) => s.id);
  const [marketplaceShareIds, shareSettlementEffectiveDate] = await Promise.all([
    loadMarketplaceConfirmedShareIdSet(shareIds),
    loadShareSettlementEffectiveDate(shares),
  ]);

  const periodItems = shares
    .filter((s) => partnerIdForShare(s, role, viewerTenantId) === partnerTenantId)
    .filter((s) => {
      const effective = shareSettlementEffectiveDate(s);
      if (!effective) return false;
      return effective >= from && effective <= to;
    })
    .map((s) => {
      const signed = signedShareTransferFee(s);
      const effective = shareSettlementEffectiveDate(s);
      const viaMarketplace = marketplaceShareIds.has(s.id);
      return {
        shareId: s.id,
        inquiryId: s.sourceInquiry.id,
        inquiryNumber: s.sourceInquiry.inquiryNumber,
        customerName: s.sourceInquiry.customerName,
        preferredDate: s.sourceInquiry.preferredDate?.toISOString() ?? null,
        settlementEffectiveDate: effective?.toISOString() ?? null,
        status: s.sourceInquiry.status,
        isCancelled: s.sourceInquiry.status === 'CANCELLED' || s.targetInquiry.status === 'CANCELLED',
        feeAmount: s.transferFee ?? 0,
        signedFeeAmount: signed,
        viaMarketplace,
      };
    })
    .sort((a, b) =>
      (b.settlementEffectiveDate ?? b.preferredDate ?? '').localeCompare(
        a.settlementEffectiveDate ?? a.preferredDate ?? '',
      ),
    );

  const totalFee = periodItems.reduce((sum, it) => sum + it.signedFeeAmount, 0);

  const carryShares = shares.filter((s) => {
    if (partnerIdForShare(s, role, viewerTenantId) !== partnerTenantId) return false;
    const effective = shareSettlementEffectiveDate(s);
    return effective != null && effective < from;
  });
  const carryOverAmount = carryShares.reduce((sum, s) => sum + signedShareTransferFee(s), 0);

  const paidBeforeAgg = await prisma.tenantPartnerSettlementPayment.aggregate({
    where: {
      tenantId: viewerTenantId,
      partnerTenantId,
      role,
      paidAt: { lt: from },
    },
    _sum: { amount: true },
  });
  const paidBeforeRange = paidBeforeAgg._sum.amount ?? 0;

  const paymentRows = await prisma.tenantPartnerSettlementPayment.findMany({
    where: {
      tenantId: viewerTenantId,
      partnerTenantId,
      role,
      paidAt: { gte: from, lte: to },
    },
    orderBy: { paidAt: 'desc' },
    select: {
      id: true,
      amount: true,
      paidAt: true,
      memo: true,
      actor: { select: { name: true, role: true } },
    },
  });
  const periodPaidAmount = paymentRows.reduce((s, r) => s + r.amount, 0);
  const payableAmount = carryOverAmount - paidBeforeRange + totalFee;
  const remainingAmount = payableAmount - periodPaidAmount;

  return {
    role,
    month: hiYmd.slice(0, 7),
    from: loYmd,
    to: hiYmd,
    partnerTenantId,
    partnerName: partner.partnerName,
    partnerSlug: partner.partnerSlug,
    partnershipId: partner.partnershipId,
    inquiryCount: periodItems.filter((i) => !i.isCancelled).length,
    cancelledInquiryCount: periodItems.filter((i) => i.isCancelled).length,
    totalFee,
    carryOverAmount: carryOverAmount - paidBeforeRange,
    payableAmount,
    accruedAmount: payableAmount,
    periodPaidAmount,
    paidAmount: periodPaidAmount,
    remainingAmount,
    payments: paymentRows.map((r) => ({
      id: r.id,
      amount: r.amount,
      paidAt: r.paidAt.toISOString(),
      memo: r.memo ?? null,
      actorName: r.actor?.name ?? null,
      actorRole: r.actor?.role ?? null,
    })),
    items: periodItems,
  };
}

/** 파트너 정산 지급·수금 이력만 (접수 스캔 없음) */
export async function getPartnerSettlementPayments(opts: {
  viewerTenantId: string;
  role: TenantPartnerSettlementRole;
  partnerTenantId: string;
  from?: string;
  to?: string;
  limit?: number;
}) {
  const partner = await assertPartnerInTenant(opts.viewerTenantId, opts.partnerTenantId);
  const limit = Number.isFinite(opts.limit)
    ? Math.min(500, Math.max(1, Math.trunc(opts.limit!)))
    : 300;

  const paidAtWhere: { gte?: Date; lte?: Date } = {};
  if (opts.from && YMD.test(opts.from)) {
    paidAtWhere.gte = new Date(`${opts.from}T00:00:00+09:00`);
  }
  if (opts.to && YMD.test(opts.to)) {
    paidAtWhere.lte = new Date(`${opts.to}T23:59:59.999+09:00`);
  }

  const paymentRows = await prisma.tenantPartnerSettlementPayment.findMany({
    where: {
      tenantId: opts.viewerTenantId,
      partnerTenantId: opts.partnerTenantId,
      role: opts.role,
      ...(Object.keys(paidAtWhere).length > 0 ? { paidAt: paidAtWhere } : {}),
    },
    orderBy: [{ paidAt: 'desc' }],
    take: limit,
    select: {
      id: true,
      amount: true,
      paidAt: true,
      memo: true,
      actor: { select: { name: true, role: true } },
    },
  });

  return {
    role: opts.role,
    partnerTenantId: opts.partnerTenantId,
    partnerName: partner.partnerName,
    partnerSlug: partner.partnerSlug,
    from: opts.from && YMD.test(opts.from) ? opts.from : null,
    to: opts.to && YMD.test(opts.to) ? opts.to : null,
    payments: paymentRows.map((r) => ({
      id: r.id,
      amount: r.amount,
      paidAt: r.paidAt.toISOString(),
      memo: r.memo ?? null,
      actorName: r.actor?.name ?? null,
      actorRole: r.actor?.role ?? null,
    })),
  };
}

/** 파트너 월별 정산 요약 (기간별정산 모달용) */
export async function getPartnerSettlementMonthlyOverview(opts: {
  viewerTenantId: string;
  role: TenantPartnerSettlementRole;
  partnerTenantId: string;
  fromMonth: string;
  toMonth: string;
}) {
  const partner = await assertPartnerInTenant(opts.viewerTenantId, opts.partnerTenantId);
  const loMonth = opts.fromMonth <= opts.toMonth ? opts.fromMonth : opts.toMonth;
  const hiMonth = opts.fromMonth <= opts.toMonth ? opts.toMonth : opts.fromMonth;
  if (!YM.test(loMonth) || !YM.test(hiMonth)) {
    throw new TenantPartnerSettlementError('fromMonth·toMonth는 YYYY-MM 형식이어야 합니다.');
  }

  const startDate = new Date(`${loMonth}-01T00:00:00+09:00`);
  const endDate = new Date(`${monthEndYmd(hiMonth)}T23:59:59.999+09:00`);

  const shares = await loadSharesForRole(opts.viewerTenantId, opts.role);
  const shareSettlementEffectiveDate = await loadShareSettlementEffectiveDate(shares);
  const partnerShares = shares.filter(
    (s) => partnerIdForShare(s, opts.role, opts.viewerTenantId) === opts.partnerTenantId,
  );

  const payableByMonth = new Map<string, number>();
  for (const share of partnerShares) {
    const effective = shareSettlementEffectiveDate(share);
    if (!effective || effective < startDate || effective > endDate) continue;
    const monthKey = kstYmd(effective).slice(0, 7);
    const signed = signedShareTransferFee(share);
    payableByMonth.set(monthKey, (payableByMonth.get(monthKey) ?? 0) + signed);
  }

  const paymentRows = await prisma.tenantPartnerSettlementPayment.findMany({
    where: {
      tenantId: opts.viewerTenantId,
      partnerTenantId: opts.partnerTenantId,
      role: opts.role,
      paidAt: { gte: startDate, lte: endDate },
    },
    select: { amount: true, paidAt: true },
  });
  const paidByMonth = new Map<string, number>();
  for (const p of paymentRows) {
    const monthKey = kstYmd(p.paidAt).slice(0, 7);
    paidByMonth.set(monthKey, (paidByMonth.get(monthKey) ?? 0) + p.amount);
  }

  const carryFeeBefore = partnerShares.reduce((sum, s) => {
    const effective = shareSettlementEffectiveDate(s);
    if (!effective || effective >= startDate) return sum;
    return sum + signedShareTransferFee(s);
  }, 0);
  const paidBeforeAgg = await prisma.tenantPartnerSettlementPayment.aggregate({
    where: {
      tenantId: opts.viewerTenantId,
      partnerTenantId: opts.partnerTenantId,
      role: opts.role,
      paidAt: { lt: startDate },
    },
    _sum: { amount: true },
  });
  let cumulativeRemaining = carryFeeBefore - (paidBeforeAgg._sum.amount ?? 0);

  const monthKeys = enumerateMonths(loMonth, hiMonth);
  const months = monthKeys.map((month) => {
    const payableAmount = payableByMonth.get(month) ?? 0;
    const paidAmount = paidByMonth.get(month) ?? 0;
    const remainingAmount = payableAmount - paidAmount;
    cumulativeRemaining += remainingAmount;
    return {
      month,
      payableAmount,
      paidAmount,
      remainingAmount,
      cumulativeRemaining,
    };
  });

  const overallPayable = months.reduce((s, r) => s + r.payableAmount, 0);
  const overallPaid = months.reduce((s, r) => s + r.paidAmount, 0);

  return {
    role: opts.role,
    partnerTenantId: opts.partnerTenantId,
    partnerName: partner.partnerName,
    partnerSlug: partner.partnerSlug,
    fromMonth: loMonth,
    toMonth: hiMonth,
    months,
    overall: {
      payableAmount: overallPayable,
      paidAmount: overallPaid,
      remainingAmount: overallPayable - overallPaid,
    },
  };
}

export async function recordSettlementPayment(opts: {
  viewerTenantId: string;
  viewerUserId: string;
  partnerTenantId: string;
  role: TenantPartnerSettlementRole;
  amount: number;
  memo?: string;
  paidDate?: string;
}) {
  const paidResolved = resolveExternalSettlementPaidAt(opts.paidDate);
  if (!paidResolved.ok) {
    throw new TenantPartnerSettlementError(paidResolved.error);
  }
  if (!Number.isFinite(opts.amount) || opts.amount === 0) {
    throw new TenantPartnerSettlementError(
      '정산 금액은 0이 아닌 정수여야 합니다. 과납·오기입 보정은 마이너스 금액으로 입력할 수 있습니다.',
    );
  }
  const partner = await assertPartnerInTenant(opts.viewerTenantId, opts.partnerTenantId);
  const amountInt = Math.trunc(opts.amount);
  const row = await prisma.tenantPartnerSettlementPayment.create({
    data: {
      tenantId: opts.viewerTenantId,
      partnerTenantId: opts.partnerTenantId,
      partnershipId: partner.partnershipId,
      role: opts.role,
      amount: amountInt,
      memo: opts.memo?.trim() || null,
      actorId: opts.viewerUserId,
      paidAt: paidResolved.paidAt,
    },
    select: { id: true, amount: true, paidAt: true },
  });
  return {
    payment: {
      id: row.id,
      amount: row.amount,
      paidAt: row.paidAt.toISOString(),
    },
  };
}

function csvEscapeCell(v: string | number | null | undefined): string {
  const s = v == null ? '' : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function formatKstYmd(d: Date | null): string {
  if (!d) return '';
  return d.toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10);
}

/** 파트너별 정산 내역 CSV (UTF-8 BOM 포함) */
export async function buildSettlementExportCsv(opts: {
  viewerTenantId: string;
  role: TenantPartnerSettlementRole;
  partnerTenantId: string;
  from?: string;
  to?: string;
}): Promise<string> {
  const detail = await getSettlementPartnerDetail(opts);
  const roleLabel = opts.role === 'SELLER' ? '판매' : '구매';
  const header = [
    '역할',
    '파트너',
    '기간시작',
    '기간종료',
    '접수번호',
    '고객명',
    '예약일',
    '정산기준일',
    '상태',
    '수수료',
    '부호수수료',
    '취소여부',
    '정보공유',
  ];
  const rows = detail.items.map((it) =>
    [
      roleLabel,
      detail.partnerName,
      detail.from,
      detail.to,
      it.inquiryNumber ?? '',
      it.customerName,
      it.preferredDate ? formatKstYmd(new Date(it.preferredDate)) : '',
      it.settlementEffectiveDate ? formatKstYmd(new Date(it.settlementEffectiveDate)) : '',
      it.status,
      it.feeAmount,
      it.signedFeeAmount,
      it.isCancelled ? 'Y' : 'N',
      it.viaMarketplace ? 'Y' : 'N',
    ]
      .map(csvEscapeCell)
      .join(','),
  );
  const summary = [
    '',
    csvEscapeCell(`합계(${detail.partnerName})`),
    detail.from,
    detail.to,
    '',
    '',
    '',
    '',
    '',
    detail.totalFee,
    '',
    '',
    '',
  ].join(',');
  return `\uFEFF${header.join(',')}\n${rows.join('\n')}\n${summary}\n`;
}

export async function resetSettlementAccrual(opts: {
  viewerTenantId: string;
  viewerUserId: string;
  partnerTenantId: string;
  role: TenantPartnerSettlementRole;
}) {
  const partner = await assertPartnerInTenant(opts.viewerTenantId, opts.partnerTenantId);
  await prisma.tenantPartnerSettlementReset.create({
    data: {
      tenantId: opts.viewerTenantId,
      partnerTenantId: opts.partnerTenantId,
      partnershipId: partner.partnershipId,
      role: opts.role,
      actorId: opts.viewerUserId,
    },
  });
  return { ok: true as const };
}
