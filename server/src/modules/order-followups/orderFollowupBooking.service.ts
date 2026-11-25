import { randomUUID } from 'node:crypto';
import { Prisma, type PrismaClient } from '@prisma/client';
import {
  bookingNameKeys,
  buildInquiryBookingIndex,
  candidatesForFollowup,
  buildInquiryBookingIndexYielding,
  closedStatusForBookedInquiry,
  dawnSweepDryRun,
  isOpenCallStatus,
  parseAutoCloseLog,
  phoneTails,
  pickFollowupBooking,
  pickFollowupBookingNarrowed,
  pickFollowupBookingYielding,
  preferredYmd,
  tallySweep,
  type FollowupBooking,
  type FollowupMatchInput,
  type InquiryBookingIndex,
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
  updatedAt: true,
  source: true,
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
    completedAt: row.status === 'COMPLETED' ? row.updatedAt : null,
    source: row.source,
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
  leadSource: true,
  createdAt: true,
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
    createdAt: row.createdAt,
    leadSource: row.leadSource,
  };
}

const NAME_SQL = (column: string) => Prisma.sql`
  regexp_replace(
    regexp_replace(
      regexp_replace(COALESCE(${Prisma.raw(column)}, ''), '\\([^)]*\\)|（[^）]*）', '', 'g'),
      '님', '', 'g'
    ),
    '[[:space:]]', '', 'g'
  )
`;

const PHONE_TAIL_SQL = (column: string) =>
  Prisma.sql`right(regexp_replace(COALESCE(${Prisma.raw(column)}, ''), '[^0-9]', '', 'g'), 8)`;

function yieldEventLoop(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

type LookupKeys = {
  tails: string[];
  names: string[];
  ids: string[];
  dateAreas: { ymd: string; min: number; max: number }[];
  nameDates: { name: string; ymd: string }[];
};

function keysForFollowups(followups: FollowupMatchInput[]): LookupKeys {
  const tails = new Set<string>();
  const names = new Set<string>();
  const ids = new Set<string>();
  const dateAreas: LookupKeys['dateAreas'] = [];
  const nameDates: LookupKeys['nameDates'] = [];
  const seenNameDates = new Set<string>();
  for (const row of followups) {
    for (const tail of phoneTails(row.customerPhone, row.customerPhone2)) tails.add(tail);
    const ymd = preferredYmd(row.preferredMoveInCleaningDate);
    for (const key of bookingNameKeys(row.customerName, row.nickname, row.leadSource)) {
      names.add(key);
      if (!ymd) continue;
      const token = `${key}|${ymd}`;
      if (seenNameDates.has(token)) continue;
      seenNameDates.add(token);
      nameDates.push({ name: key, ymd });
    }
    if (row.inquiryId) ids.add(row.inquiryId);
    if (ymd && row.areaPyeong != null && Number.isFinite(row.areaPyeong)) {
      const rounded = Math.round(row.areaPyeong);
      const area = { ymd, min: rounded - 1.5, max: rounded + 1.5 };
      const token = `${area.ymd}|${area.min}|${area.max}`;
      if (!dateAreas.some((item) => `${item.ymd}|${item.min}|${item.max}` === token)) dateAreas.push(area);
    }
  }
  return { tails: [...tails], names: [...names], ids: [...ids], dateAreas: dateAreas.slice(0, 80), nameDates: nameDates.slice(0, 80) };
}

function keysForInquiry(inquiry: InquiryMatchInput): LookupKeys {
  const dateAreas: LookupKeys['dateAreas'] = [];
  const ymd = preferredYmd(inquiry.preferredDate);
  if (ymd && inquiry.areaPyeong != null && Number.isFinite(inquiry.areaPyeong)) {
    const rounded = Math.round(inquiry.areaPyeong);
    dateAreas.push({ ymd, min: rounded - 1.5, max: rounded + 1.5 });
  }
  const names = bookingNameKeys(inquiry.customerName, inquiry.nickname, inquiry.source);
  return {
    tails: phoneTails(inquiry.customerPhone, inquiry.customerPhone2),
    names,
    ids: [inquiry.id],
    dateAreas,
    nameDates: ymd ? names.map((name) => ({ name, ymd })) : [],
  };
}

function candidateOrSql(keys: LookupKeys, linkedColumn: 'id' | 'inquiry_id', dateColumn: 'preferred_date' | 'preferred_move_in_cleaning_date'): Prisma.Sql | null {
  const ors: Prisma.Sql[] = [];
  if (keys.tails.length > 0) {
    const list = Prisma.join(keys.tails);
    ors.push(Prisma.sql`${PHONE_TAIL_SQL('"customer_phone"')} IN (${list})`);
    ors.push(Prisma.sql`${PHONE_TAIL_SQL('"customer_phone_2"')} IN (${list})`);
  }
  if (keys.names.length > 0) {
    const list = Prisma.join(keys.names);
    ors.push(Prisma.sql`${NAME_SQL('"customer_name"')} IN (${list})`);
    ors.push(Prisma.sql`${NAME_SQL('"nickname"')} IN (${list})`);
  }
  for (const pair of keys.nameDates) {
    const onDate =
      dateColumn === 'preferred_date'
        ? Prisma.sql`to_char(preferred_date AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD') = ${pair.ymd}`
        : Prisma.sql`preferred_move_in_cleaning_date = ${pair.ymd}`;
    ors.push(Prisma.sql`(${NAME_SQL('"customer_name"')} = ${pair.name} AND ${onDate})`);
    ors.push(Prisma.sql`(${NAME_SQL('"nickname"')} = ${pair.name} AND ${onDate})`);
  }
  if (keys.ids.length > 0) {
    ors.push(Prisma.sql`${Prisma.raw(linkedColumn)}::text IN (${Prisma.join(keys.ids)})`);
  }
  for (const area of keys.dateAreas) {
    if (dateColumn === 'preferred_date') {
      ors.push(
        Prisma.sql`(to_char(preferred_date AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD') = ${area.ymd} AND area_pyeong BETWEEN ${area.min} AND ${area.max})`,
      );
    } else {
      ors.push(
        Prisma.sql`(preferred_move_in_cleaning_date = ${area.ymd} AND area_pyeong BETWEEN ${area.min} AND ${area.max})`,
      );
    }
  }
  if (ors.length === 0) return null;
  return Prisma.join(ors, ' OR ');
}

async function loadInquiryCandidates(
  db: Db,
  tenantId: string,
  followups: FollowupMatchInput[],
  now: Date,
): Promise<InquiryMatchInput[]> {
  const keys = keysForFollowups(followups);
  const whereOr = candidateOrSql(keys, 'id', 'preferred_date');
  if (!whereOr) return [];
  const since = new Date(now.getTime() - 120 * DAY_MS);
  const found = await db.$queryRaw<{ id: string }[]>`
    SELECT id FROM inquiries
    WHERE tenant_id = ${tenantId}
      AND deleted_at IS NULL
      AND status <> 'CANCELLED'
      AND created_at >= ${since}
      AND (${whereOr})
    LIMIT 4000
  `;
  if (found.length === 0) return [];
  if (found.length >= 4000) {
    console.warn('[order-followups] booking inquiry candidates hit 4000', tenantId);
  }
  const rows = await db.inquiry.findMany({
    where: { tenantId, id: { in: found.map((row) => row.id) } },
    select: inquirySelect,
  });
  return rows.map(toInquiry);
}

async function loadFollowupCandidates(db: Db, tenantId: string, inquiry: InquiryMatchInput): Promise<FollowupRow[]> {
  const keys = keysForInquiry(inquiry);
  const whereOr = candidateOrSql(keys, 'inquiry_id', 'preferred_move_in_cleaning_date');
  if (!whereOr) return [];
  const found = await db.$queryRaw<{ id: string }[]>`
    SELECT id FROM order_followups
    WHERE tenant_id = ${tenantId}
      AND status IN ('REQUESTED', 'ABSENT', 'ON_HOLD', 'DEPOSIT_PENDING')
      AND (${whereOr})
    LIMIT 4000
  `;
  if (found.length === 0) return [];
  if (found.length >= 4000) {
    console.warn('[order-followups] booking followup candidates hit 4000', tenantId);
  }
  return db.orderFollowup.findMany({
    where: { tenantId, id: { in: found.map((row) => row.id) } },
    select: followupSelect,
  });
}

export async function bookingsForFollowups(
  db: Db,
  tenantId: string,
  followups: FollowupMatchInput[],
  now = new Date(),
): Promise<Map<number, FollowupBooking | null>> {
  const out = new Map<number, FollowupBooking | null>();
  if (followups.length === 0) return out;
  const inquiries = await loadInquiryCandidates(db, tenantId, followups, now);
  const index = buildInquiryBookingIndex(inquiries);
  followups.forEach((row, indexNo) => out.set(indexNo, pickFollowupBookingNarrowed(row, index)));
  return out;
}

/** 응답을 막지 않도록 이번 요청이 끝난 뒤에 정리한다. */
export function scheduleFollowupBookingSync(
  db: Db,
  params: { tenantId: string; inquiryId: string; actorUserId?: string | null },
): void {
  setImmediate(() => {
    void syncFollowupsAfterInquiry(db, params).catch((error) => {
      console.error('[order-followups] scheduled booking sync failed', error instanceof Error ? error.message : error);
    });
  });
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
    const open = await loadFollowupCandidates(db, params.tenantId, inquiry);
    let changed = 0;
    let sliceStart = Date.now();
    for (const followup of open) {
      const booking = pickFollowupBooking(toFollowup(followup), [inquiry]);
      if (booking?.level === 'booked') {
        try {
          if (await closeOne(db, followup, inquiry, booking.reasons, params.actorUserId)) changed += 1;
        } catch (error) {
          console.error('[order-followups] booking close failed', error instanceof Error ? error.message : error);
        }
      }
      if (Date.now() - sliceStart >= 30) {
        await yieldEventLoop();
        sliceStart = Date.now();
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

async function loadOpenFollowups(db: Db, tenantId: string): Promise<FollowupRow[]> {
  return db.orderFollowup.findMany({
    where: { tenantId, status: { in: [...OPEN_STATUSES] } },
    select: followupSelect,
  });
}

async function loadSweepInquiries(db: Db, tenantId: string, now: Date): Promise<InquiryMatchInput[]> {
  const since = new Date(now.getTime() - 120 * DAY_MS);
  const rows = await db.inquiry.findMany({
    where: { tenantId, deletedAt: null, status: { not: 'CANCELLED' }, createdAt: { gte: since } },
    select: inquirySelect,
  });
  return rows.map(toInquiry);
}

export async function sweepOpenFollowupBookings(
  db: Db,
  tenantId: string,
  options: {
    dryRun?: boolean;
    actorUserId?: string | null;
    now?: Date;
    onProgress?: (done: number, total: number) => void;
  } = {},
): Promise<SweepPlan> {
  const now = options.now ?? new Date();
  const dryRun = options.dryRun !== false;
  const [open, inquiries] = await Promise.all([
    loadOpenFollowups(db, tenantId),
    loadSweepInquiries(db, tenantId, now),
  ]);
  const index: InquiryBookingIndex = await buildInquiryBookingIndexYielding(inquiries);
  const judged: {
    booking: FollowupBooking | null;
    open: boolean;
    sameBrandBooked: boolean;
    followupStatus: string;
  }[] = [];
  const closable: { row: FollowupRow; inquiryId: string; reasons: string[] }[] = [];
  let sliceStart = Date.now();
  for (let i = 0; i < open.length; i += 1) {
    const row = open[i]!;
    const followup = toFollowup(row);
    const booking = await pickFollowupBookingYielding(followup, candidatesForFollowup(index, followup));
    judged.push({
      booking,
      open: isOpenCallStatus(row.status),
      sameBrandBooked: booking?.level === 'booked',
      followupStatus: row.status,
    });
    if (!dryRun && booking?.level === 'booked') {
      closable.push({ row, inquiryId: booking.inquiryId, reasons: booking.reasons });
    }
    const done = i + 1;
    if (done % 200 === 0 || Date.now() - sliceStart >= 30) {
      options.onProgress?.(done, open.length);
      await yieldEventLoop();
      sliceStart = Date.now();
    }
  }
  options.onProgress?.(open.length, open.length);
  const plan = tallySweep(judged);
  if (dryRun) return plan;
  sliceStart = Date.now();
  for (const item of closable) {
    const inquiry = index.byId.get(item.inquiryId);
    if (!inquiry) continue;
    try {
      await closeOne(db, item.row, inquiry, item.reasons, options.actorUserId);
    } catch (error) {
      console.error('[order-followups] sweep close failed', error instanceof Error ? error.message : error);
    }
    if (Date.now() - sliceStart >= 30) {
      await yieldEventLoop();
      sliceStart = Date.now();
    }
  }
  return plan;
}

export type BookingSweepJob = {
  id: string;
  tenantId: string;
  dryRun: boolean;
  status: 'running' | 'done' | 'error';
  done: number;
  total: number;
  result: SweepPlan | null;
  error: string | null;
};

const sweepJobs = new Map<string, BookingSweepJob>();
const tenantSweepJob = new Map<string, string>();
const latestSweepSummary = new Map<string, SweepPlan>();

export function latestBookingSummary(tenantId: string): SweepPlan | null {
  return latestSweepSummary.get(tenantId) ?? null;
}

export function getBookingSweepJob(jobId: string): BookingSweepJob | null {
  return sweepJobs.get(jobId) ?? null;
}

function rememberSweep(tenantId: string, plan: SweepPlan): void {
  latestSweepSummary.set(tenantId, plan);
  console.log(
    '[order-followups] booking sweep summary',
    tenantId,
    JSON.stringify({
      wouldClose: plan.wouldClose,
      suspect: plan.suspect,
      otherBrand: plan.otherBrand,
      past: plan.past,
      conflictDowngraded: plan.conflictDowngraded,
      byInquiryStatus: plan.byInquiryStatus,
      byFollowupStatus: plan.byFollowupStatus,
      byReasonCombo: plan.byReasonCombo,
    }),
  );
}

export function startBookingSweepJob(
  db: PrismaClient,
  tenantId: string,
  options: { dryRun?: boolean; actorUserId?: string | null; now?: Date } = {},
): { jobId: string; dryRun: boolean; alreadyRunning: boolean } {
  const dryRun = options.dryRun !== false;
  const currentId = tenantSweepJob.get(tenantId);
  const current = currentId ? sweepJobs.get(currentId) : undefined;
  if (current && current.status === 'running') {
    return { jobId: current.id, dryRun: current.dryRun, alreadyRunning: true };
  }
  const job: BookingSweepJob = {
    id: randomUUID(),
    tenantId,
    dryRun,
    status: 'running',
    done: 0,
    total: 0,
    result: null,
    error: null,
  };
  sweepJobs.set(job.id, job);
  tenantSweepJob.set(tenantId, job.id);
  if (sweepJobs.size > 100) {
    for (const [id, stored] of sweepJobs) {
      if (stored.status === 'running' || tenantSweepJob.get(stored.tenantId) === id) continue;
      sweepJobs.delete(id);
      if (sweepJobs.size <= 80) break;
    }
  }
  setImmediate(() => {
    void sweepOpenFollowupBookings(db, tenantId, {
      dryRun,
      actorUserId: options.actorUserId,
      now: options.now,
      onProgress: (done, total) => {
        job.done = done;
        job.total = total;
      },
    })
      .then((plan) => {
        job.status = 'done';
        job.result = plan;
        rememberSweep(tenantId, plan);
      })
      .catch((error) => {
        job.status = 'error';
        job.error = error instanceof Error ? error.message : '정리에 실패했습니다.';
        console.error('[order-followups] sweep job failed', error instanceof Error ? error.message : error);
      });
  });
  return { jobId: job.id, dryRun, alreadyRunning: false };
}

export async function sweepAllTenantFollowupBookings(db: PrismaClient, now = new Date()): Promise<void> {
  const links = await db.orderFollowup.findMany({
    where: { status: { in: [...OPEN_STATUSES] } },
    distinct: ['tenantId'],
    select: { tenantId: true },
  });
  for (const link of links) {
    const runningId = tenantSweepJob.get(link.tenantId);
    const running = runningId ? sweepJobs.get(runningId) : undefined;
    if (running?.status === 'running') continue;
    try {
      const plan = await sweepOpenFollowupBookings(db, link.tenantId, { now, dryRun: dawnSweepDryRun() });
      rememberSweep(link.tenantId, plan);
    } catch (error) {
      console.error('[order-followups] daily sweep skipped', error instanceof Error ? error.message : error);
    }
    await yieldEventLoop();
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
