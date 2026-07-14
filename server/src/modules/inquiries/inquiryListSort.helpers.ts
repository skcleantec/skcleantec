/**
 * 서비스접수 목록 pin·페이지네이션 — tier 정렬은 `lib/inquiryListSort.ts` (shared 동기화).
 */
import type { Prisma } from '@prisma/client';
import type { prisma } from '../../lib/prisma.js';
import {
  isInquiryListPinnedPreReceive,
  isInquiryOrderFormPendingSubmit,
  sortInquiryListRows,
  type InquiryListSortOptions,
  DEFAULT_INQUIRY_LIST_SORT,
} from '../../lib/inquiryListSort.js';

export type InquiryListSortable = {
  status: string;
  createdAt: Date;
  preferredDate: Date | null;
  happyCallCompletedAt: Date | null;
  orderForm: { submittedAt: Date | null; createdAt: Date } | null;
};

export { isInquiryListPinnedPreReceive, isInquiryOrderFormPendingSubmit };

function sortInquiryListSortables<T extends InquiryListSortable>(
  rows: T[],
  sort: InquiryListSortOptions,
): T[] {
  return sortInquiryListRows(rows, sort);
}

/** 발주서 미제출 — Prisma where (레거시 OR 포함) */
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

/** 처리 전 4종 — Prisma where (목록 상단 pin·필터 OR 용) */
export function whereInquiryListPinnedPreReceive(): Prisma.InquiryWhereInput {
  return {
    status: {
      in: ['ORDER_FORM_PENDING', 'PENDING', 'DEPOSIT_PENDING', 'DEPOSIT_COMPLETED'],
    },
  };
}

const inquiryListSortSelect = {
  id: true,
  status: true,
  createdAt: true,
  preferredDate: true,
  happyCallCompletedAt: true,
  orderForm: { select: { submittedAt: true, createdAt: true } },
} as const;

type SortRow = Prisma.InquiryGetPayload<{ select: typeof inquiryListSortSelect }>;

function prismaOrderByForInquiryList(
  sort: InquiryListSortOptions,
): Prisma.InquiryOrderByWithRelationInput[] {
  if (sort.field === 'createdAt') {
    return [{ createdAt: sort.dir }];
  }
  if (sort.field === 'preferredDate') {
    return [{ preferredDate: { sort: sort.dir, nulls: 'last' } }, { createdAt: 'desc' }];
  }
  return [{ status: sort.dir }, { createdAt: 'desc' }];
}

async function fetchFilteredInquiryPageIds(
  db: PrismaClient,
  filteredWhere: Prisma.InquiryWhereInput,
  sort: InquiryListSortOptions,
  skip: number,
  take: number,
): Promise<string[]> {
  if (take <= 0) return [];
  const rows = await db.inquiry.findMany({
    where: filteredWhere,
    select: { id: true },
    orderBy: prismaOrderByForInquiryList(sort),
    skip: Math.max(0, skip),
    take,
  });
  return rows.map((r) => r.id);
}

type PrismaClient = typeof prisma;

/**
 * 필터 결과 + (선택) 날짜·상태와 무관한 처리 전(pin) 행을 합친 뒤 tier 정렬·페이지 slice.
 * `pinPreReceiveWhere` 가 있으면 tier 0~3을 **항상 목록 최상단**에 두고, 이어서 `where` 필터 결과를 붙인다.
 */
export async function fetchInquiryListPageSorted<TInclude extends Prisma.InquiryInclude>(
  db: PrismaClient,
  args: {
    where: Prisma.InquiryWhereInput;
    /** 설정 시 접수일·예약일·상태 등 `where` 와 무관하게 처리 전 4종을 목록에 포함·최상단 고정 */
    pinPreReceiveWhere?: Prisma.InquiryWhereInput | null;
    /** @deprecated pinPreReceiveWhere 사용 */
    pinPendingWhere?: Prisma.InquiryWhereInput | null;
    include: TInclude;
    take: number;
    skip: number;
    sort?: InquiryListSortOptions;
  },
): Promise<{ items: Prisma.InquiryGetPayload<{ include: TInclude }>[]; total: number }> {
  const sort = args.sort ?? DEFAULT_INQUIRY_LIST_SORT;
  const pinWhere = args.pinPreReceiveWhere ?? args.pinPendingWhere ?? null;

  let pendingSorted: SortRow[] = [];
  if (pinWhere) {
    const pendingSortRows = await db.inquiry.findMany({
      where: pinWhere,
      select: inquiryListSortSelect,
    });
    pendingSorted = sortInquiryListSortables(
      pendingSortRows.filter((r) => isInquiryListPinnedPreReceive(r)),
      sort,
    );
  }

  const pendingIds = pendingSorted.map((r) => r.id);
  const filteredWhere: Prisma.InquiryWhereInput =
    pendingIds.length > 0 ? { AND: [args.where, { id: { notIn: pendingIds } }] } : args.where;

  const filteredCount = await db.inquiry.count({ where: filteredWhere });
  const pendingCount = pendingSorted.length;
  const total = pendingCount + filteredCount;

  let pageIds: string[] = [];
  if (args.skip < pendingCount) {
    pageIds = pendingSorted.slice(args.skip, args.skip + args.take).map((r) => r.id);
    const need = args.take - pageIds.length;
    if (need > 0) {
      const tailIds = await fetchFilteredInquiryPageIds(db, filteredWhere, sort, 0, need);
      pageIds = [...pageIds, ...tailIds];
    }
  } else {
    pageIds = await fetchFilteredInquiryPageIds(
      db,
      filteredWhere,
      sort,
      args.skip - pendingCount,
      args.take,
    );
  }

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
