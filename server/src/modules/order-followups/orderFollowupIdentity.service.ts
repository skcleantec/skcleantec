import type { OrderFollowupStatus, Prisma, PrismaClient } from '@prisma/client';
import { normalizeKrPhoneDigits } from '../cs/matchInquiryForCs.js';
import { formatKrPhoneDisplay, isKrMobile010, isKrSafeNumber050 } from './customerPhoneRelink.service.js';
import {
  collectFollowupPhoneDigits,
  followupPhonesOverlap,
  OPEN_FOLLOWUP_MERGE_STATUSES,
  type FollowupWithRelations,
} from './orderFollowups.service.js';

/** 목록·상세에 붙이는 「다른 브랜드에도 있음」 */
export type FollowupOtherBrand = {
  operatingCompanyId: string;
  brandName: string;
  followupId: string;
  status: OrderFollowupStatus;
};

/** 같은 고객 후보·중복 묶음 한 줄 */
export type FollowupCandidateItem = {
  id: string;
  customerName: string;
  nickname: string | null;
  customerPhone: string;
  customerPhone2: string | null;
  status: OrderFollowupStatus;
  deferCount: number;
  handlerName: string | null;
  createdAt: string;
  memoPreview: string | null;
};

const OPEN_STATUSES = OPEN_FOLLOWUP_MERGE_STATUSES;

type PhoneSlot = { mobile: string | null; safe: string | null; other: string | null };

function slotsOf(phone: string | null | undefined, phone2: string | null | undefined): PhoneSlot {
  const list = [phone, phone2].map((raw) => (raw ?? '').trim()).filter(Boolean);
  return {
    mobile: list.find((item) => isKrMobile010(item)) ?? null,
    safe: list.find((item) => isKrSafeNumber050(item)) ?? null,
    other: list.find((item) => !isKrMobile010(item) && !isKrSafeNumber050(item)) ?? null,
  };
}

/**
 * 지정한 부재·보류에 덮어쓸 때 연락처.
 * 새 요청에 번호가 있으면 그 종류(휴대폰·안심번호)만 바꾸고, 없는 종류는 둔다.
 * 요청 번호가 전부 비어 있으면 기존 번호를 지우지 않는다.
 * 같은 종류의 옛 번호를 연락처2로 되살리지 않는다.
 */
export function replacePhonesForTargetSave(params: {
  prevPhone: string | null | undefined;
  prevPhone2: string | null | undefined;
  nextPhone: string | null | undefined;
  nextPhone2: string | null | undefined;
}): { customerPhone: string; customerPhone2: string | null } {
  const nextList = [params.nextPhone, params.nextPhone2].map((raw) => (raw ?? '').trim()).filter(Boolean);
  if (nextList.length === 0) {
    return {
      customerPhone: (params.prevPhone ?? '').trim(),
      customerPhone2: (params.prevPhone2 ?? '').trim() || null,
    };
  }
  const prev = slotsOf(params.prevPhone, params.prevPhone2);
  const next = slotsOf(params.nextPhone, params.nextPhone2);
  const mobile = next.mobile ?? (next.other ? null : prev.mobile);
  const safe = next.safe ?? prev.safe;
  const phone1 = mobile ?? next.other ?? prev.mobile ?? prev.other ?? '';
  const phone2 = safe && normalizeKrPhoneDigits(safe) !== normalizeKrPhoneDigits(phone1) ? safe : null;
  return { customerPhone: phone1, customerPhone2: phone2 };
}

export function targetFollowupRejectReason(row: {
  operatingCompanyId: string;
  status: OrderFollowupStatus;
} | null, operatingCompanyId: string): string | null {
  if (!row || row.operatingCompanyId !== operatingCompanyId) {
    return '이 브랜드에서 이어 쓸 부재·보류를 찾지 못했어요.';
  }
  if (row.status === 'FULFILLED') return '이미 처리 완료된 건이라 이어 저장할 수 없어요.';
  return null;
}

/** 상태는 내리지 않는다. */
export function preferHigherFollowupStatus(
  requested: OrderFollowupStatus,
  current: OrderFollowupStatus,
): OrderFollowupStatus {
  const rank = (st: OrderFollowupStatus) => {
    if (st === 'DEPOSIT_PENDING') return 2;
    if (st === 'RESERVED') return 3;
    if (st === 'FULFILLED') return 4;
    return 1;
  };
  return rank(requested) < rank(current) ? current : requested;
}

export function similarNameMode(customerName: string, nickname: string | null | undefined): 'none' | 'nickname' | 'either' {
  const nick = (nickname ?? '').trim();
  const name = customerName.trim();
  const nameUsable = name.length >= 2 && name !== '고객';
  if (!nameUsable && !nick) return 'none';
  if (!nameUsable) return 'nickname';
  return 'either';
}

export function rowMatchesSimilarCandidate(
  row: {
    customerName: string;
    nickname: string | null;
    leadSource: string | null;
    customerPhone: string;
    customerPhone2: string | null;
  },
  query: {
    customerName: string;
    nickname: string | null;
    leadSource: string | null;
    customerPhone: string;
    customerPhone2: string | null;
  },
): boolean {
  const mode = similarNameMode(query.customerName, query.nickname);
  if (mode === 'none') return false;
  if (
    followupPhonesOverlap(query.customerPhone, query.customerPhone2, row.customerPhone, row.customerPhone2)
  ) {
    return false;
  }
  const nick = (query.nickname ?? '').trim();
  if (nick && (row.nickname ?? '').trim() === nick) return true;
  if (mode === 'nickname') return false;
  const lead = (query.leadSource ?? '').trim();
  return row.customerName.trim() === query.customerName.trim() && (row.leadSource ?? '').trim() === lead;
}

function memoPreview(memo: string | null | undefined): string | null {
  const text = (memo ?? '').trim();
  if (!text) return null;
  return text.slice(0, 60);
}

function handlerName(row: {
  handledBy?: { name: string } | null;
  createdBy?: { name: string } | null;
}): string | null {
  return row.handledBy?.name?.trim() || row.createdBy?.name?.trim() || null;
}

export function toFollowupCandidate(row: {
  id: string;
  customerName: string;
  nickname: string | null;
  customerPhone: string;
  customerPhone2: string | null;
  status: OrderFollowupStatus;
  deferCount: number;
  memo: string | null;
  createdAt: Date;
  handledBy?: { name: string } | null;
  createdBy?: { name: string } | null;
}): FollowupCandidateItem {
  return {
    id: row.id,
    customerName: row.customerName,
    nickname: row.nickname,
    customerPhone: formatKrPhoneDisplay(row.customerPhone),
    customerPhone2: row.customerPhone2 ? formatKrPhoneDisplay(row.customerPhone2) : null,
    status: row.status,
    deferCount: row.deferCount,
    handlerName: handlerName(row),
    createdAt: row.createdAt.toISOString(),
    memoPreview: memoPreview(row.memo),
  };
}

const candidateSelect = {
  id: true,
  customerName: true,
  nickname: true,
  customerPhone: true,
  customerPhone2: true,
  status: true,
  deferCount: true,
  memo: true,
  createdAt: true,
  leadSource: true,
  operatingCompanyId: true,
  handledBy: { select: { name: true } },
  createdBy: { select: { name: true } },
} satisfies Prisma.OrderFollowupSelect;

export async function listSimilarFollowups(
  db: PrismaClient | Prisma.TransactionClient,
  params: {
    tenantId: string;
    operatingCompanyId: string;
    customerName: string;
    nickname: string | null;
    leadSource: string | null;
    customerPhone: string;
    customerPhone2: string | null;
    now?: Date;
  },
): Promise<FollowupCandidateItem[]> {
  const mode = similarNameMode(params.customerName, params.nickname);
  if (mode === 'none') return [];
  const since = new Date((params.now ?? new Date()).getTime() - 30 * 24 * 60 * 60 * 1000);
  const nick = (params.nickname ?? '').trim();
  const name = params.customerName.trim();
  const or: Prisma.OrderFollowupWhereInput[] = [];
  if (nick) or.push({ nickname: nick });
  if (mode === 'either') or.push({ customerName: name });
  const rows = await db.orderFollowup.findMany({
    where: {
      tenantId: params.tenantId,
      operatingCompanyId: params.operatingCompanyId,
      status: { in: [...OPEN_STATUSES] },
      createdAt: { gte: since },
      OR: or,
    },
    select: candidateSelect,
    orderBy: { createdAt: 'desc' },
    take: 40,
  });
  return rows
    .filter((row) =>
      rowMatchesSimilarCandidate(row, {
        customerName: params.customerName,
        nickname: params.nickname,
        leadSource: params.leadSource,
        customerPhone: params.customerPhone,
        customerPhone2: params.customerPhone2,
      }),
    )
    .slice(0, 5)
    .map(toFollowupCandidate);
}

type BrandSource = {
  id: string;
  operatingCompanyId: string;
  customerName: string;
  nickname: string | null;
  customerPhone: string;
  customerPhone2: string | null;
};

function phoneTails(phone: string, phone2: string | null | undefined): string[] {
  return [
    ...new Set(
      collectFollowupPhoneDigits(phone, phone2)
        .map((digits) => (digits.length >= 10 ? digits.slice(-10) : digits))
        .filter((tail) => tail.length >= 4),
    ),
  ];
}

/** 한 번의 조회로, 페이지 행마다 다른 브랜드의 열린 건을 붙인다. */
export async function loadOtherBrandHints(
  db: PrismaClient | Prisma.TransactionClient,
  tenantId: string,
  rows: BrandSource[],
): Promise<Map<string, FollowupOtherBrand[]>> {
  const out = new Map<string, FollowupOtherBrand[]>();
  if (rows.length === 0) return out;
  const tails = [...new Set(rows.flatMap((row) => phoneTails(row.customerPhone, row.customerPhone2)))];
  const namePairs = rows
    .map((row) => ({ name: row.customerName.trim(), nick: (row.nickname ?? '').trim() }))
    .filter((pair) => pair.name && pair.nick);
  const or: Prisma.OrderFollowupWhereInput[] = [
    ...tails.flatMap((tail) => [{ customerPhone: { contains: tail } }, { customerPhone2: { contains: tail } }]),
    ...namePairs.map((pair) => ({ customerName: pair.name, nickname: pair.nick })),
  ];
  if (or.length === 0) return out;
  const others = await db.orderFollowup.findMany({
    where: {
      tenantId,
      status: { in: [...OPEN_STATUSES] },
      id: { notIn: rows.map((row) => row.id) },
      OR: or,
    },
    select: {
      id: true,
      operatingCompanyId: true,
      status: true,
      customerName: true,
      nickname: true,
      customerPhone: true,
      customerPhone2: true,
      operatingCompany: { select: { name: true } },
    },
    take: 400,
  });
  for (const row of rows) {
    const hits: FollowupOtherBrand[] = [];
    for (const other of others) {
      if (other.operatingCompanyId === row.operatingCompanyId) continue;
      const samePerson =
        followupPhonesOverlap(row.customerPhone, row.customerPhone2, other.customerPhone, other.customerPhone2) ||
        ((row.nickname ?? '').trim() !== '' &&
          (row.nickname ?? '').trim() === (other.nickname ?? '').trim() &&
          row.customerName.trim() === other.customerName.trim());
      if (!samePerson) continue;
      hits.push({
        operatingCompanyId: other.operatingCompanyId,
        brandName: other.operatingCompany.name,
        followupId: other.id,
        status: other.status,
      });
      if (hits.length >= 5) break;
    }
    out.set(row.id, hits);
  }
  return out;
}

export async function attachOtherBrands<T extends { id: string }>(
  db: PrismaClient | Prisma.TransactionClient,
  tenantId: string,
  rows: BrandSource[],
  items: T[],
): Promise<Array<T & { otherBrands: FollowupOtherBrand[] }>> {
  const map = await loadOtherBrandHints(db, tenantId, rows);
  return items.map((item) => ({ ...item, otherBrands: map.get(item.id) ?? [] }));
}

type DuplicateRow = {
  id: string;
  operatingCompanyId: string;
  customerName: string;
  nickname: string | null;
  customerPhone: string;
  customerPhone2: string | null;
  status: OrderFollowupStatus;
  deferCount: number;
  memo: string | null;
  createdAt: Date;
  inquiryId: string | null;
  goldDb: boolean;
  preferredMoveInCleaningDate: string | null;
  address: string | null;
  areaPyeong: number | null;
  roomCount: number | null;
  bathroomCount: number | null;
  balconyCount: number | null;
  isOneRoom: boolean;
  oneRoomLoft: boolean | null;
  oneRoomSlidingPartition: boolean | null;
  structureBalconyNonExpanded: boolean | null;
  structurePartitionWall: boolean | null;
  structureOutdoorTerrace: boolean | null;
  leadSource: string | null;
  nextContactAt: Date | null;
  depositReceivedAt: Date | null;
  handledBy?: { name: string } | null;
  createdBy?: { name: string } | null;
};

export function groupDuplicateFollowups(rows: DuplicateRow[]): DuplicateRow[][] {
  const parent = rows.map((_, index) => index);
  const find = (index: number): number => {
    let cursor = index;
    while (parent[cursor] !== cursor) cursor = parent[cursor]!;
    return cursor;
  };
  const union = (left: number, right: number) => {
    const a = find(left);
    const b = find(right);
    if (a !== b) parent[b] = a;
  };
  const byName = new Map<string, number>();
  const byPhone = new Map<string, number>();
  rows.forEach((row, index) => {
    const nameKey = `${row.customerName.trim()}\n${(row.nickname ?? '').trim()}`;
    const named = byName.get(nameKey);
    if (named == null) byName.set(nameKey, index);
    else union(named, index);
    for (const key of phoneTails(row.customerPhone, row.customerPhone2)) {
      const hit = byPhone.get(key);
      if (hit == null) byPhone.set(key, index);
      else union(hit, index);
    }
  });
  const groups = new Map<number, DuplicateRow[]>();
  rows.forEach((row, index) => {
    const root = find(index);
    const list = groups.get(root) ?? [];
    list.push(row);
    groups.set(root, list);
  });
  return [...groups.values()]
    .filter((group) => group.length >= 2)
    .map((group) => group.slice().sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()))
    .sort((a, b) => (b[0]?.createdAt.getTime() ?? 0) - (a[0]?.createdAt.getTime() ?? 0));
}

export async function listDuplicateFollowupGroups(
  db: PrismaClient | Prisma.TransactionClient,
  params: { tenantId: string; operatingCompanyId: string; limit: number; offset: number },
) {
  const rows = await db.orderFollowup.findMany({
    where: {
      tenantId: params.tenantId,
      operatingCompanyId: params.operatingCompanyId,
      status: { in: [...OPEN_STATUSES] },
    },
    select: {
      ...candidateSelect,
      inquiryId: true,
      goldDb: true,
      preferredMoveInCleaningDate: true,
      address: true,
      areaPyeong: true,
      roomCount: true,
      bathroomCount: true,
      balconyCount: true,
      isOneRoom: true,
      oneRoomLoft: true,
      oneRoomSlidingPartition: true,
      structureBalconyNonExpanded: true,
      structurePartitionWall: true,
      structureOutdoorTerrace: true,
      nextContactAt: true,
      depositReceivedAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 800,
  });
  const groups = groupDuplicateFollowups(rows);
  const page = groups.slice(params.offset, params.offset + params.limit);
  return {
    total: groups.length,
    items: page.map((group) => ({ rows: group.map(toFollowupCandidate) })),
  };
}

export function mergeInquiryConflict(rows: { inquiryId: string | null }[]): boolean {
  const ids = new Set(rows.map((row) => row.inquiryId).filter((id): id is string => Boolean(id)));
  return ids.size > 1;
}

function blank(value: string | null | undefined): boolean {
  return !(value ?? '').trim();
}

/** keep 가 비어 있는 칸만 등록일이 빠른 쪽부터 채운다. 연락처는 휴대폰·안심번호 자리만 빈 곳을 채운다. */
export function buildMergedFollowupData(keep: DuplicateRow, others: DuplicateRow[]) {
  const ordered = [keep, ...others].slice().sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const memos: string[] = [];
  for (const row of ordered) {
    const text = (row.memo ?? '').trim();
    if (!text || memos.includes(text)) continue;
    memos.push(text);
  }
  const fillText = (current: string | null, pick: (row: DuplicateRow) => string | null) => {
    if (!blank(current)) return current;
    for (const row of ordered) {
      const value = (pick(row) ?? '').trim();
      if (value) return value;
    }
    return current;
  };
  const fillNum = (current: number | null, pick: (row: DuplicateRow) => number | null) => {
    if (current != null) return current;
    for (const row of ordered) {
      const value = pick(row);
      if (value != null) return value;
    }
    return null;
  };
  const fillDate = (current: Date | null, pick: (row: DuplicateRow) => Date | null) => {
    if (current) return current;
    for (const row of ordered) {
      const value = pick(row);
      if (value) return value;
    }
    return null;
  };
  const fillBool = (current: boolean | null, pick: (row: DuplicateRow) => boolean | null) => {
    if (current != null) return current;
    for (const row of ordered) {
      const value = pick(row);
      if (value != null) return value;
    }
    return null;
  };
  const keepSlots = slotsOf(keep.customerPhone, keep.customerPhone2);
  let mobile = keepSlots.mobile;
  let safe = keepSlots.safe;
  let other = keepSlots.other;
  for (const row of others) {
    const slots = slotsOf(row.customerPhone, row.customerPhone2);
    if (!mobile && slots.mobile) mobile = slots.mobile;
    if (!safe && slots.safe) safe = slots.safe;
    if (!other && slots.other) other = slots.other;
  }
  const phone1 = mobile ?? other ?? (keep.customerPhone ?? '').trim();
  const phone2 = safe && normalizeKrPhoneDigits(safe) !== normalizeKrPhoneDigits(phone1) ? safe : null;
  const inquiryId = keep.inquiryId ?? ordered.find((row) => row.inquiryId)?.inquiryId ?? null;
  return {
    memo: memos.length ? memos.join('\n') : null,
    deferCount: ordered.reduce((sum, row) => sum + row.deferCount, 0),
    goldDb: ordered.some((row) => row.goldDb),
    nickname: fillText(keep.nickname, (row) => row.nickname),
    preferredMoveInCleaningDate: fillText(keep.preferredMoveInCleaningDate, (row) => row.preferredMoveInCleaningDate),
    address: fillText(keep.address, (row) => row.address),
    leadSource: fillText(keep.leadSource, (row) => row.leadSource),
    areaPyeong: fillNum(keep.areaPyeong, (row) => row.areaPyeong),
    roomCount: fillNum(keep.roomCount, (row) => row.roomCount),
    bathroomCount: fillNum(keep.bathroomCount, (row) => row.bathroomCount),
    balconyCount: fillNum(keep.balconyCount, (row) => row.balconyCount),
    isOneRoom: keep.isOneRoom || others.some((row) => row.isOneRoom),
    oneRoomLoft: fillBool(keep.oneRoomLoft, (row) => row.oneRoomLoft),
    oneRoomSlidingPartition: fillBool(keep.oneRoomSlidingPartition, (row) => row.oneRoomSlidingPartition),
    structureBalconyNonExpanded: fillBool(keep.structureBalconyNonExpanded, (row) => row.structureBalconyNonExpanded),
    structurePartitionWall: fillBool(keep.structurePartitionWall, (row) => row.structurePartitionWall),
    structureOutdoorTerrace: fillBool(keep.structureOutdoorTerrace, (row) => row.structureOutdoorTerrace),
    nextContactAt: fillDate(keep.nextContactAt, (row) => row.nextContactAt),
    depositReceivedAt: fillDate(keep.depositReceivedAt, (row) => row.depositReceivedAt),
    customerPhone: phone1,
    customerPhone2: phone2,
    inquiryId,
  };
}

type HotMarkRow = { id: string; followupId: string; userId: string; contactTries: number };

/** 합치기 트랜잭션에서 자식 행의 followupId 를 keep 으로 옮긴다. */
export type FollowupMergeWriter = {
  orderFollowupLog: {
    updateMany: (args: { where: { followupId: { in: string[] } }; data: { followupId: string } }) => Promise<unknown>;
    create: (args: {
      data: { followupId: string; actorId: string; action: string; detail: string | null };
    }) => Promise<unknown>;
  };
  orderFollowupHotMark: {
    findMany: (args: { where: { followupId: string | { in: string[] } } }) => Promise<HotMarkRow[]>;
    update: (args: { where: { id: string }; data: { followupId?: string; contactTries?: number } }) => Promise<unknown>;
    delete: (args: { where: { id: string } }) => Promise<unknown>;
  };
  telecrmConsultationQuote: {
    updateMany: (args: { where: { followupId: { in: string[] } }; data: { followupId: string } }) => Promise<unknown>;
  };
  orderFollowup: {
    update: (args: { where: { id: string }; data: Record<string, unknown> }) => Promise<unknown>;
    deleteMany: (args: { where: { id: { in: string[] }; tenantId: string } }) => Promise<unknown>;
  };
};

/**
 * OrderFollowup 을 가리키는 관계:
 * - OrderFollowupLog.followupId (삭제 시 같이 사라지므로 먼저 옮김)
 * - OrderFollowupHotMark.followupId (같은 사람 표시가 있으면 횟수만 더하고 중복은 삭제)
 * - TelecrmConsultationQuote.followupId (견적. 삭제 시 null 이 되므로 먼저 옮김)
 * TelecrmCallNote 는 전화번호·접수만 가리키고 followupId 가 없다.
 * TelecrmAiQuoteCorrection 은 견적 id 에 매달려 견적을 옮기면 따라온다.
 */
export async function applyFollowupMerge(
  db: FollowupMergeWriter,
  params: {
    tenantId: string;
    actorId: string;
    keep: DuplicateRow;
    merges: DuplicateRow[];
  },
): Promise<void> {
  const rows = [params.keep, ...params.merges];
  if (mergeInquiryConflict(rows)) {
    throw new Error('서로 다른 접수에 연결된 건은 합칠 수 없어요.');
  }
  const data = buildMergedFollowupData(params.keep, params.merges);
  const mergeIds = params.merges.map((row) => row.id);
  await db.orderFollowup.update({ where: { id: params.keep.id }, data });
  await db.orderFollowupLog.updateMany({
    where: { followupId: { in: mergeIds } },
    data: { followupId: params.keep.id },
  });
  await db.telecrmConsultationQuote.updateMany({
    where: { followupId: { in: mergeIds } },
    data: { followupId: params.keep.id },
  });
  const [incomingMarks, keepMarks] = await Promise.all([
    db.orderFollowupHotMark.findMany({ where: { followupId: { in: mergeIds } } }),
    db.orderFollowupHotMark.findMany({ where: { followupId: params.keep.id } }),
  ]);
  const keepByUser = new Map(keepMarks.map((mark) => [mark.userId, mark]));
  for (const mark of incomingMarks) {
    const clash = keepByUser.get(mark.userId);
    if (clash) {
      await db.orderFollowupHotMark.update({
        where: { id: clash.id },
        data: { contactTries: clash.contactTries + mark.contactTries },
      });
      await db.orderFollowupHotMark.delete({ where: { id: mark.id } });
    } else {
      await db.orderFollowupHotMark.update({ where: { id: mark.id }, data: { followupId: params.keep.id } });
      keepByUser.set(mark.userId, { ...mark, followupId: params.keep.id });
    }
  }
  await db.orderFollowup.deleteMany({ where: { id: { in: mergeIds }, tenantId: params.tenantId } });
  await db.orderFollowupLog.create({
    data: {
      followupId: params.keep.id,
      actorId: params.actorId,
      action: 'MERGE',
      detail: JSON.stringify({
        mergedIds: mergeIds,
        from: params.merges.map((row) => ({
          id: row.id,
          status: row.status,
          customerName: row.customerName,
          customerPhone: row.customerPhone,
          customerPhone2: row.customerPhone2,
          deferCount: row.deferCount,
          createdAt: row.createdAt.toISOString(),
        })),
      }),
    },
  });
}

const mergeRowSelect = {
  ...candidateSelect,
  inquiryId: true,
  goldDb: true,
  preferredMoveInCleaningDate: true,
  address: true,
  areaPyeong: true,
  roomCount: true,
  bathroomCount: true,
  balconyCount: true,
  isOneRoom: true,
  oneRoomLoft: true,
  oneRoomSlidingPartition: true,
  structureBalconyNonExpanded: true,
  structurePartitionWall: true,
  structureOutdoorTerrace: true,
  nextContactAt: true,
  depositReceivedAt: true,
  tenantId: true,
} satisfies Prisma.OrderFollowupSelect;

export async function mergeFollowupsForAdmin(
  db: PrismaClient,
  params: { tenantId: string; actorId: string; keepId: string; mergeIds: string[] },
) {
  const ids = [...new Set([params.keepId, ...params.mergeIds])];
  const rows = await db.orderFollowup.findMany({
    where: { tenantId: params.tenantId, id: { in: ids } },
    select: mergeRowSelect,
  });
  if (rows.length !== ids.length) throw new Error('합칠 부재·보류를 찾지 못했어요.');
  const keep = rows.find((row) => row.id === params.keepId);
  const merges = rows.filter((row) => row.id !== params.keepId);
  if (!keep || merges.length === 0) throw new Error('남길 건과 합칠 건을 모두 지정해 주세요.');
  const brand = keep.operatingCompanyId;
  if (rows.some((row) => row.operatingCompanyId !== brand)) {
    throw new Error('같은 브랜드의 건만 합칠 수 있어요.');
  }
  const open = new Set<string>(OPEN_STATUSES);
  if (rows.some((row) => !open.has(row.status))) {
    throw new Error('열린 부재·보류만 합칠 수 있어요.');
  }
  if (mergeInquiryConflict(rows)) throw new Error('서로 다른 접수에 연결된 건은 합칠 수 없어요.');
  await db.$transaction(async (tx) => {
    await applyFollowupMerge(tx as unknown as FollowupMergeWriter, {
      tenantId: params.tenantId,
      actorId: params.actorId,
      keep,
      merges,
    });
  });
  return keep.id;
}
