import { Prisma, type PrismaClient } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import {
  applyWorkFinish,
  canEditWorkEntry,
  canReadWorkEntry,
  EMPTY_WORK_ACTIONS,
  isStaleOpen,
  mergeWorkActions,
  normalizeWorkActions,
  resolveListUserId,
  retentionCutoffs,
  shouldRunPurge,
  staleOpenOutcome,
  type FinishInput,
  type WorkActions,
  type WorkSource,
} from './telecrmWorkHistory.logic.js';

type Db = PrismaClient | Prisma.TransactionClient;

const DRAFT_MAX_CHARS = 80_000;

let lastPurgeAt = 0;

export function resetWorkHistoryPurgeClock(): void {
  lastPurgeAt = 0;
}

function asJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export function parseDraft(raw: unknown): { ok: true; value: Prisma.InputJsonValue | null } | { ok: false; error: string } {
  if (raw == null) return { ok: true, value: null };
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: '적던 내용 형식이 올바르지 않아요.' };
  }
  const text = JSON.stringify(raw);
  if (text.length > DRAFT_MAX_CHARS) {
    return { ok: false, error: '적던 내용이 너무 길어요.' };
  }
  return { ok: true, value: asJson(raw) };
}

async function closeStaleOpen(db: Db, tenantId: string, userId: string | null, now: Date): Promise<void> {
  const rows = await db.telecrmWorkEntry.findMany({
    where: {
      tenantId,
      outcome: 'OPEN',
      ...(userId ? { userId } : {}),
      updatedAt: { lt: new Date(now.getTime() - 30 * 60 * 1000) },
    },
    select: { id: true, actions: true, updatedAt: true },
    take: 200,
  });
  for (const row of rows) {
    if (!isStaleOpen(row.updatedAt, now)) continue;
    const actions = normalizeWorkActions(row.actions);
    await db.telecrmWorkEntry.updateMany({
      where: { id: row.id, tenantId },
      data: {
        outcome: staleOpenOutcome(actions),
        leftBy: 'close',
        endedAt: now,
      },
    });
  }
}

export async function purgeWorkHistoryIfDue(db: Db = prisma, now = new Date()): Promise<void> {
  if (!shouldRunPurge(lastPurgeAt, now.getTime())) return;
  const { deleteBefore, clearDraftBefore } = retentionCutoffs(now);
  await db.telecrmWorkEntry.deleteMany({ where: { startedAt: { lt: deleteBefore } } });
  await db.telecrmWorkEntry.updateMany({
    where: { startedAt: { lt: clearDraftBefore }, NOT: { draft: { equals: Prisma.DbNull } } },
    data: { draft: Prisma.DbNull },
  });
  lastPurgeAt = now.getTime();
}

async function ownRow(db: Db, tenantId: string, id: string, actorId: string) {
  const row = await db.telecrmWorkEntry.findFirst({ where: { id, tenantId } });
  if (!row || !canEditWorkEntry(actorId, row.userId)) return null;
  return row;
}

export async function startWorkEntry(
  db: Db,
  params: {
    tenantId: string;
    userId: string;
    source: WorkSource;
    operatingCompanyId: string | null;
    nickname: string | null;
    customerName: string | null;
    contactPhone: string | null;
    safePhone: string | null;
    now?: Date;
  },
) {
  const now = params.now ?? new Date();
  await closeStaleOpen(db, params.tenantId, params.userId, now);
  const open = await db.telecrmWorkEntry.findMany({
    where: { tenantId: params.tenantId, userId: params.userId, outcome: 'OPEN' },
    select: { id: true, actions: true },
  });
  for (const row of open) {
    const actions = normalizeWorkActions(row.actions);
    await db.telecrmWorkEntry.updateMany({
      where: { id: row.id, tenantId: params.tenantId },
      data: { outcome: staleOpenOutcome(actions), leftBy: 'close', endedAt: now },
    });
  }
  const created = await db.telecrmWorkEntry.create({
    data: {
      tenantId: params.tenantId,
      userId: params.userId,
      operatingCompanyId: params.operatingCompanyId,
      source: params.source,
      nickname: params.nickname,
      customerName: params.customerName,
      contactPhone: params.contactPhone,
      safePhone: params.safePhone,
      actions: asJson(EMPTY_WORK_ACTIONS),
      outcome: 'OPEN',
      startedAt: now,
    },
    select: { id: true },
  });
  return created;
}

export async function patchWorkEntry(
  db: Db,
  params: {
    tenantId: string;
    actorId: string;
    id: string;
    identity?: {
      nickname?: string | null;
      customerName?: string | null;
      contactPhone?: string | null;
      safePhone?: string | null;
    };
    actions?: unknown;
    draft?: unknown;
    summary?: string | null;
    draftProvided: boolean;
  },
) {
  const row = await ownRow(db, params.tenantId, params.id, params.actorId);
  if (!row) return { error: '작업 기록을 찾지 못했어요.' as const };
  const data: Prisma.TelecrmWorkEntryUpdateInput = {};
  if (params.identity) {
    if ('nickname' in params.identity) data.nickname = params.identity.nickname ?? null;
    if ('customerName' in params.identity) data.customerName = params.identity.customerName ?? null;
    if ('contactPhone' in params.identity) data.contactPhone = params.identity.contactPhone ?? null;
    if ('safePhone' in params.identity) data.safePhone = params.identity.safePhone ?? null;
  }
  if (params.actions !== undefined) {
    data.actions = asJson(mergeWorkActions(normalizeWorkActions(row.actions), params.actions));
  }
  if (params.draftProvided) {
    const parsed = parseDraft(params.draft);
    if (!parsed.ok) return { error: parsed.error };
    data.draft = parsed.value === null ? Prisma.DbNull : parsed.value;
  }
  if (params.summary !== undefined) data.summary = params.summary;
  await db.telecrmWorkEntry.updateMany({ where: { id: row.id, tenantId: params.tenantId }, data });
  return { ok: true as const };
}

export async function finishWorkEntry(
  db: Db,
  params: { tenantId: string; actorId: string; id: string; input: FinishInput; now?: Date },
) {
  const row = await ownRow(db, params.tenantId, params.id, params.actorId);
  if (!row) return { error: '작업 기록을 찾지 못했어요.' as const };
  const now = params.now ?? new Date();
  const next = applyWorkFinish(params.input, now);
  const data: Prisma.TelecrmWorkEntryUpdateInput = {
    outcome: next.outcome,
    savedKind: next.savedKind,
    endedAt: next.endedAt,
  };
  if (next.leftBy !== undefined) data.leftBy = next.leftBy;
  if (next.followupId !== undefined) data.followupId = next.followupId;
  if (next.inquiryId !== undefined) data.inquiryId = next.inquiryId;
  if (next.summary !== undefined) data.summary = next.summary;
  if (next.draft === null) data.draft = Prisma.DbNull;
  else if (next.draft !== undefined) {
    const parsed = parseDraft(next.draft);
    if (!parsed.ok) return { error: parsed.error };
    data.draft = parsed.value === null ? Prisma.DbNull : parsed.value;
  }
  await db.telecrmWorkEntry.updateMany({ where: { id: row.id, tenantId: params.tenantId }, data });
  return { ok: true as const };
}

export async function dismissWorkEntry(db: Db, tenantId: string, actorId: string, id: string, now = new Date()) {
  const row = await ownRow(db, tenantId, id, actorId);
  if (!row) return { error: '작업 기록을 찾지 못했어요.' as const };
  await db.telecrmWorkEntry.updateMany({ where: { id: row.id, tenantId }, data: { dismissedAt: now } });
  return { ok: true as const };
}

export async function resumeWorkEntry(db: Db, tenantId: string, actorId: string, id: string, now = new Date()) {
  const row = await ownRow(db, tenantId, id, actorId);
  if (!row) return { error: '작업 기록을 찾지 못했어요.' as const };
  await db.telecrmWorkEntry.updateMany({ where: { id: row.id, tenantId }, data: { resumedAt: now } });
  return { ok: true as const, draft: row.draft ?? null };
}

function itemBase(row: {
  id: string;
  userId: string;
  user?: { name: string } | null;
  source: string;
  nickname: string | null;
  customerName: string | null;
  contactPhone: string | null;
  safePhone: string | null;
  actions: unknown;
  outcome: string;
  savedKind: string | null;
  leftBy: string | null;
  startedAt: Date;
  endedAt: Date | null;
  summary: string | null;
  dismissedAt: Date | null;
  resumedAt: Date | null;
  followupId: string | null;
  inquiryId: string | null;
  draft: unknown;
}) {
  return {
    id: row.id,
    userId: row.userId,
    userName: row.user?.name ?? '',
    source: row.source,
    nickname: row.nickname,
    customerName: row.customerName,
    contactPhone: row.contactPhone,
    safePhone: row.safePhone,
    actions: normalizeWorkActions(row.actions),
    outcome: row.outcome,
    savedKind: row.savedKind,
    leftBy: row.leftBy,
    startedAt: row.startedAt.toISOString(),
    endedAt: row.endedAt?.toISOString() ?? null,
    summary: row.summary,
    dismissedAt: row.dismissedAt?.toISOString() ?? null,
    resumedAt: row.resumedAt?.toISOString() ?? null,
    followupId: row.followupId,
    inquiryId: row.inquiryId,
    hasDraft: row.draft != null,
  };
}

export async function listWorkEntries(
  db: Db,
  params: {
    tenantId: string;
    isAdmin: boolean;
    actorId: string;
    requestedUserId: string | null;
    outcome: string | null;
    range: { gte: Date; lte: Date };
    limit: number;
    offset: number;
    now?: Date;
  },
) {
  const now = params.now ?? new Date();
  const userId = resolveListUserId(params.isAdmin, params.actorId, params.requestedUserId);
  await closeStaleOpen(db, params.tenantId, userId, now);
  await purgeWorkHistoryIfDue(db, now);
  const whereBase = {
    tenantId: params.tenantId,
    startedAt: { gte: params.range.gte, lte: params.range.lte },
    ...(userId ? { userId } : {}),
  };
  const [rows, grouped] = await Promise.all([
    db.telecrmWorkEntry.findMany({
      where: { ...whereBase, ...(params.outcome ? { outcome: params.outcome } : {}) },
      include: { user: { select: { name: true } } },
      orderBy: { startedAt: 'desc' },
      take: params.limit,
      skip: params.offset,
    }),
    db.telecrmWorkEntry.groupBy({
      by: ['outcome'],
      where: whereBase,
      _count: { _all: true },
    }),
  ]);
  const counts = { loaded: 0, saved: 0, unsaved: 0, viewed: 0 };
  for (const group of grouped) {
    const n = group._count._all;
    counts.loaded += n;
    if (group.outcome === 'SAVED') counts.saved += n;
    if (group.outcome === 'UNSAVED') counts.unsaved += n;
    if (group.outcome === 'VIEWED') counts.viewed += n;
  }
  return { items: rows.map(itemBase), counts };
}

export async function getWorkEntry(
  db: Db,
  params: { tenantId: string; isAdmin: boolean; actorId: string; id: string },
) {
  const row = await db.telecrmWorkEntry.findFirst({
    where: { id: params.id, tenantId: params.tenantId },
    include: { user: { select: { name: true } } },
  });
  if (!row || !canReadWorkEntry(params.isAdmin, params.actorId, row.userId)) return null;
  if (row.outcome === 'OPEN' && isStaleOpen(row.updatedAt, new Date())) {
    const now = new Date();
    const outcome = staleOpenOutcome(normalizeWorkActions(row.actions));
    await db.telecrmWorkEntry.updateMany({
      where: { id: row.id, tenantId: params.tenantId, outcome: 'OPEN' },
      data: { outcome, leftBy: 'close', endedAt: now },
    });
    row.outcome = outcome;
    row.leftBy = 'close';
    row.endedAt = now;
  }
  return { ...itemBase(row), draft: row.draft ?? null };
}

export async function countPendingUnsaved(db: Db, tenantId: string, userId: string, now = new Date()) {
  const since = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  return db.telecrmWorkEntry.count({
    where: {
      tenantId,
      userId,
      outcome: 'UNSAVED',
      dismissedAt: null,
      resumedAt: null,
      startedAt: { gte: since },
    },
  });
}

export async function summarizeWorkEntries(
  db: Db,
  params: { tenantId: string; range: { gte: Date; lte: Date }; now?: Date },
) {
  const now = params.now ?? new Date();
  await closeStaleOpen(db, params.tenantId, null, now);
  const rows = await db.telecrmWorkEntry.findMany({
    where: { tenantId: params.tenantId, startedAt: { gte: params.range.gte, lte: params.range.lte } },
    select: { userId: true, outcome: true, user: { select: { name: true } } },
  });
  const map = new Map<string, { userId: string; userName: string; loaded: number; saved: number; unsaved: number; viewed: number }>();
  for (const row of rows) {
    const bucket = map.get(row.userId) ?? {
      userId: row.userId,
      userName: row.user.name,
      loaded: 0,
      saved: 0,
      unsaved: 0,
      viewed: 0,
    };
    bucket.loaded += 1;
    if (row.outcome === 'SAVED') bucket.saved += 1;
    if (row.outcome === 'UNSAVED') bucket.unsaved += 1;
    if (row.outcome === 'VIEWED') bucket.viewed += 1;
    map.set(row.userId, bucket);
  }
  return [...map.values()].sort((a, b) => b.loaded - a.loaded);
}

export type { WorkActions };
