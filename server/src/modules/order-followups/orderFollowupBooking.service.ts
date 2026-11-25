import { Prisma, type PrismaClient } from '@prisma/client';
import {
  closedStatusForBookedInquiry,
  isOpenCallStatus,
  parseAutoCloseLog,
  pickFollowupBooking,
  statusAfterSweep,
  tallySweep,
  type FollowupBooking,
  type FollowupMatchInput,
  type InquiryMatchInput,
  type SweepPlan,
} from './orderFollowupBooking.logic.js';

type Db = PrismaClient | Prisma.TransactionClient;

const OPEN_STATUSES = ['REQUESTED', 'ABSENT', 'ON_HOLD', 'DEPOSIT_PENDING'] as const;
const DAY_MS = 24 * 60 * 60 * 1000;

const inquirySelect = {
  id: true,
  inquiryNumber: true,
  status: true,
  operatingCompanyId: true,
  customerName: true,
  nickname: true,
  customerPhone: true,
  customerPhone2: true,
  address: true,
  addressDetail: true,
  buildingType: true,
  propertyType: true,
  memo: true,
  areaPyeong: true,
  roomCount: true,
  bathroomCount: true,
  isOneRoom: true,
  preferredDate: true,
  createdAt: true,
  operatingCompany: { select: { name: true } },
  createdBy: { select: { name: true } },
} satisfies Prisma.InquirySelect;

type InquiryRow = Prisma.InquiryGetPayload<{ select: typeof inquirySelect }>;

function toInquiry(row: InquiryRow): InquiryMatchInput {
  const address = [row.address, row.addressDetail].filter(Boolean).join(' ');
  return {
    id: row.id,
    inquiryNumber: row.inquiryNumber,
    status: row.status,
    operatingCompanyId: row.operatingCompanyId,
    operatingCompanyName: row.operatingCompany?.name ?? null,
    marketerName: row.createdBy?.name ?? null,
    customerName: row.customerName,
    nickname: row.nickname,
    customerPhone: row.customerPhone,
    customerPhone2: row.customerPhone2,
    address,
    buildingType: row.buildingType,
    propertyType: row.propertyType,
    memo: row.memo,
    areaPyeong: row.areaPyeong,
    roomCount: row.roomCount,
    bathroomCount: row.bathroomCount,
    isOneRoom: row.isOneRoom,
    preferredDate: row.preferredDate,
    createdAt: row.createdAt,
  };
}

const followupSelect = {
  id: true,
  status: true,
  inquiryId: true,
  operatingCompanyId: true,
  customerName: true,
  nickname: true,
  customerPhone: true,
  customerPhone2: true,
  address: true,
  memo: true,
  areaPyeong: true,
  roomCount: true,
  bathroomCount: true,
  isOneRoom: true,
  preferredMoveInCleaningDate: true,
  createdById: true,
  handledById: true,
  depositReceivedAt: true,
} satisfies Prisma.OrderFollowupSelect;

type FollowupRow = Prisma.OrderFollowupGetPayload<{ select: typeof followupSelect }>;

function toFollowup(row: FollowupRow): FollowupMatchInput {
  return {
    inquiryId: row.inquiryId,
    customerName: row.customerName,
    nickname: row.nickname,
    customerPhone: row.customerPhone,
    customerPhone2: row.customerPhone2,
    address: row.address,
    memo: row.memo,
    areaPyeong: row.areaPyeong,
    roomCount: row.roomCount,
    bathroomCount: row.bathroomCount,
    isOneRoom: row.isOneRoom,
    preferredMoveInCleaningDate: row.preferredMoveInCleaningDate,
    operatingCompanyId: row.operatingCompanyId,
    status: row.status,
  };
}

export async function loadRecentBookingInquiries(db: Db, tenantId: string, now = new Date()): Promise<InquiryMatchInput[]> {
  const since = new Date(now.getTime() - 120 * DAY_MS);
  const rows = await db.inquiry.findMany({
    where: { tenantId, deletedAt: null, status: { not: 'CANCELLED' }, createdAt: { gte: since } },
    select: inquirySelect,
  });
  return rows.map(toInquiry);
}

export async function bookingsForFollowups(
  db: Db,
  tenantId: string,
  followups: FollowupMatchInput[],
  now = new Date(),
): Promise<Map<number, FollowupBooking | null>> {
  const inquiries = followups.length === 0 ? [] : await loadRecentBookingInquiries(db, tenantId, now);
  const out = new Map<number, FollowupBooking | null>();
  followups.forEach((row, index) => out.set(index, pickFollowupBooking(row, inquiries)));
  return out;
}

async function closeOne(
  db: Db,
  row: FollowupRow,
  inquiry: InquiryMatchInput,
  reasons: string[],
  actorUserId?: string | null,
): Promise<boolean> {
  const next = closedStatusForBookedInquiry(inquiry.status);
  if (!next || !isOpenCallStatus(row.status) || row.status === next) return false;
  const actorId = actorUserId || row.handledById || row.createdById;
  const data: Prisma.OrderFollowupUncheckedUpdateInput = { status: next };
  const linkedBefore = Boolean(row.inquiryId);
  if (!row.inquiryId) data.inquiryId = inquiry.id;
  if (next === 'RESERVED' && !row.depositReceivedAt) data.depositReceivedAt = new Date();
  await db.orderFollowup.update({ where: { id: row.id }, data });
  await db.orderFollowupLog.create({
    data: {
      followupId: row.id,
      actorId,
      action: 'STATUS',
      detail: JSON.stringify({
        from: row.status,
        to: next,
        auto: true,
        reasons,
        inquiryId: inquiry.id,
        linkedBefore,
        note: '이미 접수된 고객이라 부재·보류 목록에서 내렸습니다.',
      }),
    },
  });
  if (!linkedBefore) {
    await db.orderFollowupLog.create({
      data: {
        followupId: row.id,
        actorId,
        action: 'INQUIRY_LINK',
        detail: JSON.stringify({ from: null, to: inquiry.id, auto: true, reasons }),
      },
    });
  }
  return true;
}

/** 접수 생성·상태 변경 뒤. 실패해도 호출한 일은 그대로 둔다. */
export async function syncFollowupsAfterInquiry(
  db: Db,
  params: { tenantId: string; inquiryId: string; actorUserId?: string | null },
  now = new Date(),
): Promise<number> {
  try {
    const row = await db.inquiry.findFirst({
      where: { id: params.inquiryId, tenantId: params.tenantId, deletedAt: null },
      select: inquirySelect,
    });
    if (!row) return 0;
    const inquiry = toInquiry(row);
    if (inquiry.status === 'CANCELLED') return restoreFollowupsClosedByInquiry(db, params);
    const open = await db.orderFollowup.findMany({
      where: { tenantId: params.tenantId, status: { in: [...OPEN_STATUSES] } },
      select: followupSelect,
    });
    let changed = 0;
    for (const followup of open) {
      const booking = pickFollowupBooking(toFollowup(followup), [inquiry]);
      if (!booking || booking.level !== 'booked') continue;
      try {
        if (await closeOne(db, followup, inquiry, booking.reasons, params.actorUserId)) changed += 1;
      } catch (error) {
        console.error('[order-followups] booking close failed', error instanceof Error ? error.message : error);
      }
    }
    return changed;
  } catch (error) {
    console.error('[order-followups] syncFollowupsAfterInquiry failed', error instanceof Error ? error.message : error);
    return 0;
  }
}

export async function restoreFollowupsClosedByInquiry(
  db: Db,
  params: { tenantId: string; inquiryId: string; actorUserId?: string | null },
): Promise<number> {
  const rows = await db.orderFollowup.findMany({
    where: { tenantId: params.tenantId, inquiryId: params.inquiryId },
    select: { ...followupSelect, logs: { orderBy: { createdAt: 'desc' }, take: 30, select: { action: true, detail: true } } },
  });
  let changed = 0;
  for (const row of rows) {
    const log = row.logs.find((item) => {
      if (item.action !== 'STATUS') return false;
      const parsed = parseAutoCloseLog(item.detail);
      return parsed?.inquiryId === params.inquiryId && parsed.to === row.status;
    });
    const parsed = log ? parseAutoCloseLog(log.detail) : null;
    if (!parsed?.from) continue;
    const actorId = params.actorUserId || row.handledById || row.createdById;
    await db.orderFollowup.update({
      where: { id: row.id },
      data: {
        status: parsed.from as FollowupRow['status'],
        ...(parsed.linkedBefore ? {} : { inquiryId: null }),
      },
    });
    await db.orderFollowupLog.create({
      data: {
        followupId: row.id,
        actorId,
        action: 'STATUS',
        detail: JSON.stringify({
          from: row.status,
          to: parsed.from,
          auto: true,
          restored: true,
          inquiryId: params.inquiryId,
          note: '접수가 취소되어 부재·보류를 닫기 전 상태로 되돌렸습니다.',
        }),
      },
    });
    changed += 1;
  }
  return changed;
}

export async function sweepOpenFollowupBookings(
  db: Db,
  tenantId: string,
  options: { dryRun?: boolean; actorUserId?: string | null; now?: Date } = {},
): Promise<SweepPlan> {
  const now = options.now ?? new Date();
  const [open, inquiries] = await Promise.all([
    db.orderFollowup.findMany({
      where: { tenantId, status: { in: [...OPEN_STATUSES] } },
      select: followupSelect,
    }),
    loadRecentBookingInquiries(db, tenantId, now),
  ]);
  const judged = open.map((row) => {
    const booking = pickFollowupBooking(toFollowup(row), inquiries);
    return { row, booking, open: isOpenCallStatus(row.status), sameBrandBooked: booking?.level === 'booked' };
  });
  const plan = tallySweep(judged);
  if (options.dryRun) {
    judged.forEach((item) => {
      statusAfterSweep(item.row.status, item.sameBrandBooked ? closedStatusForBookedInquiry(item.booking?.status ?? '') : null, true);
    });
    return plan;
  }
  for (const item of judged) {
    if (!item.sameBrandBooked || !item.booking) continue;
    const inquiry = inquiries.find((candidate) => candidate.id === item.booking?.inquiryId);
    if (!inquiry) continue;
    try {
      await closeOne(db, item.row, inquiry, item.booking.reasons, options.actorUserId);
    } catch (error) {
      console.error('[order-followups] sweep close failed', error instanceof Error ? error.message : error);
    }
  }
  return plan;
}

export async function sweepAllTenantFollowupBookings(db: PrismaClient, now = new Date()): Promise<void> {
  const links = await db.orderFollowup.findMany({
    where: { status: { in: [...OPEN_STATUSES] } },
    distinct: ['tenantId'],
    select: { tenantId: true },
  });
  for (const link of links) {
    try {
      await sweepOpenFollowupBookings(db, link.tenantId, { now });
    } catch (error) {
      console.error('[order-followups] daily sweep skipped', error instanceof Error ? error.message : error);
    }
  }
}

let sweepTimer: ReturnType<typeof setInterval> | null = null;
let sweptYmd = '';

function kstYmd(now: Date): string {
  return new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function kstHour(now: Date): number {
  return new Date(now.getTime() + 9 * 60 * 60 * 1000).getUTCHours();
}

/** 한국 시간 새벽 4시에 하루 한 번. 여러 서버가 돌아도 이미 닫힌 행은 다시 닫지 않는다. */
export function startOrderFollowupBookingSweep(db: PrismaClient): void {
  if (sweepTimer) return;
  const tick = () => {
    const now = new Date();
    if (kstHour(now) !== 4) return;
    const ymd = kstYmd(now);
    if (sweptYmd === ymd) return;
    sweptYmd = ymd;
    void sweepAllTenantFollowupBookings(db, now).catch((error) => {
      console.error('[order-followups] daily sweep failed', error instanceof Error ? error.message : error);
    });
  };
  sweepTimer = setInterval(tick, 60 * 1000);
  sweepTimer.unref();
}
