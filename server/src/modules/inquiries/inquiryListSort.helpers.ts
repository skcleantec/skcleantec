/**
 * 서비스접수 목록 정렬 — `shared/inquiryListSort.ts` 와 동기화 유지.
 * (server rootDir=src 이므로 shared 를 런타임에서 직접 import 하지 않음)
 */
import type { Prisma } from '@prisma/client';
import type { prisma } from '../../lib/prisma.js';

export type InquiryListSortable = {
  status: string;
  createdAt: Date;
  happyCallCompletedAt: Date | null;
  orderForm: { submittedAt: Date | null; createdAt: Date } | null;
};

export function isInquiryOrderFormPendingSubmit(row: InquiryListSortable): boolean {
  if (row.status === 'ORDER_FORM_PENDING') return true;
  return Boolean(
    row.orderForm &&
      !row.orderForm.submittedAt &&
      (row.status === 'PENDING' || row.status === 'DEPOSIT_COMPLETED'),
  );
}

export function isInquiryCancelUnconfirmed(row: InquiryListSortable): boolean {
  return row.status === 'CANCELLED' && !row.happyCallCompletedAt;
}

export function inquiryListSortTier(row: InquiryListSortable): number {
  if (isInquiryOrderFormPendingSubmit(row)) return 0;
  if (isInquiryCancelUnconfirmed(row)) return 1;
  if (row.status !== 'RECEIVED') return 2;
  return 3;
}

export function compareInquiryListSortable(a: InquiryListSortable, b: InquiryListSortable): number {
  const tierA = inquiryListSortTier(a);
  const tierB = inquiryListSortTier(b);
  if (tierA !== tierB) return tierA - tierB;
  return b.createdAt.getTime() - a.createdAt.getTime();
}

export function sortInquiryListSortables<T extends InquiryListSortable>(rows: T[]): T[] {
  return rows
    .map((row, idx) => ({ row, idx }))
    .sort((a, b) => {
      const cmp = compareInquiryListSortable(a.row, b.row);
      return cmp !== 0 ? cmp : a.idx - b.idx;
    })
    .map((x) => x.row);
}

/** 발주서 미제출 — Prisma where (목록 상단 고정·필터 OR 용) */
export function whereInquiryOrderFormPendingSubmit(): Prisma.InquiryWhereInput {
  return {
    OR: [
      { status: 'ORDER_FORM_PENDING' },
      {
        status: { in: ['PENDING', 'DEPOSIT_COMPLETED'] },
        orderForm: { is: { submittedAt: null } },
      },
    ],
  };
}

const inquiryListSortSelect = {
  id: true,
  status: true,
  createdAt: true,
  happyCallCompletedAt: true,
  orderForm: { select: { submittedAt: true, createdAt: true } },
} as const;

/** 미제출 tier — 최신순(접수일) */
function sortPinnedPendingRows<T extends InquiryListSortable>(rows: T[]): T[] {
  return [...rows].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

type PrismaClient = typeof prisma;

/**
 * 필터 결과 + (선택) 날짜·상태와 무관한 미제출 고정 행을 합친 뒤 tier 정렬·페이지 slice.
 * `pinPendingWhere` 가 있으면 해당 미제출은 **항상 목록 최상단**에 두고, 이어서 `where` 필터 결과를 붙인다.
 */
export async function fetchInquiryListPageSorted<TInclude extends Prisma.InquiryInclude>(
  db: PrismaClient,
  args: {
    where: Prisma.InquiryWhereInput;
    /** 설정 시 접수일·예약일·상태 등 `where` 와 무관하게 미제출을 목록에 포함·최상단 고정 */
    pinPendingWhere?: Prisma.InquiryWhereInput | null;
    include: TInclude;
    take: number;
    skip: number;
  },
): Promise<{ items: Prisma.InquiryGetPayload<{ include: TInclude }>[]; total: number }> {
  const [pendingSortRows, filteredSortRows] = await Promise.all([
    args.pinPendingWhere
      ? db.inquiry.findMany({ where: args.pinPendingWhere, select: inquiryListSortSelect })
      : Promise.resolve([]),
    db.inquiry.findMany({ where: args.where, select: inquiryListSortSelect }),
  ]);

  const pendingIdSet = new Set(pendingSortRows.map((r) => r.id));
  const pendingSorted = sortPinnedPendingRows(
    pendingSortRows.filter((r) => isInquiryOrderFormPendingSubmit(r)),
  );
  const filteredOnly = filteredSortRows.filter((r) => !pendingIdSet.has(r.id));
  const filteredSorted = sortInquiryListSortables(filteredOnly);

  const merged = [...pendingSorted, ...filteredSorted];
  const total = merged.length;
  const pageIds = merged.slice(args.skip, args.skip + args.take).map((r) => r.id);
  if (pageIds.length === 0) {
    return { items: [], total };
  }
  const itemsUnordered = await db.inquiry.findMany({
    where: { id: { in: pageIds } },
    include: args.include,
  });
  const byId = new Map(itemsUnordered.map((r) => [r.id, r]));
  const items = pageIds
    .map((id) => byId.get(id))
    .filter((r): r is Prisma.InquiryGetPayload<{ include: TInclude }> => r != null);
  return { items, total };
}
