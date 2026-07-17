import { prisma } from '../../lib/prisma.js';
import { kstDayRangeYmd } from '../inquiries/inquiryListDateRange.js';
import {
  classifyCallSessionStatus,
  TELECRM_CONNECTED_MIN_SEC,
  type TelecrmCallSessionSource,
  type TelecrmCallSessionStatus,
} from './telecrmCallSession.constants.js';

export type TelecrmCallDirection = 'OUTBOUND' | 'INBOUND';
export type TelecrmCustomerMatchKind = 'new' | 'existing' | 'pick' | 'unknown';

export type CreateTelecrmCallSessionInput = {
  phone: string;
  direction: TelecrmCallDirection;
  startedAt?: string | null;
  endedAt?: string | null;
  durationSec?: number | null;
  customerMatch?: TelecrmCustomerMatchKind | null;
  inquiryId?: string | null;
  memo?: string | null;
  androidCallLogId?: string | null;
  status?: TelecrmCallSessionStatus | null;
  source?: TelecrmCallSessionSource | null;
  connectedMinSec?: number | null;
};

export type SyncTelecrmCallSessionInput = {
  phone: string;
  direction: TelecrmCallDirection;
  androidCallLogId: string;
  startedAt: string;
  endedAt?: string | null;
  durationSec: number;
  customerMatch?: TelecrmCustomerMatchKind | null;
  inquiryId?: string | null;
  source?: TelecrmCallSessionSource | null;
  connectedMinSec?: number | null;
};

function parseOptionalDate(raw: string | null | undefined): Date | null {
  if (!raw || typeof raw !== 'string') return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 20);
}

function parseDirection(raw: unknown): TelecrmCallDirection | null {
  const v = typeof raw === 'string' ? raw.trim().toUpperCase() : '';
  if (v === 'OUTBOUND' || v === 'INBOUND') return v;
  return null;
}

function parseCustomerMatch(raw: unknown): TelecrmCustomerMatchKind | null {
  const v = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (v === 'new' || v === 'existing' || v === 'pick' || v === 'unknown') return v;
  return null;
}

function parseStatus(raw: unknown): TelecrmCallSessionStatus | null {
  const v = typeof raw === 'string' ? raw.trim().toUpperCase() : '';
  if (v === 'DIAL_ATTEMPT' || v === 'NO_ANSWER' || v === 'CONNECTED') return v;
  return null;
}

function parseSource(raw: unknown): TelecrmCallSessionSource | null {
  const v = typeof raw === 'string' ? raw.trim().toUpperCase() : '';
  if (v === 'APP_DIAL' || v === 'PC_DISPATCH' || v === 'CALLLOG_SYNC') return v;
  return null;
}

function sessionDayWhere(tenantId: string, userId: string, dayYmd: string) {
  const range = kstDayRangeYmd(dayYmd);
  if (!range) return { tenantId, userId, createdAt: { gte: new Date(0), lte: new Date() } };
  return {
    tenantId,
    userId,
    OR: [
      { startedAt: { gte: range.gte, lte: range.lte } },
      { startedAt: null, createdAt: { gte: range.gte, lte: range.lte } },
    ],
  };
}

function rangeWhere(tenantId: string, fromYmd: string, toYmd: string, userId?: string) {
  const fromRange = kstDayRangeYmd(fromYmd);
  const toRange = kstDayRangeYmd(toYmd);
  const gte = fromRange?.gte ?? new Date(`${fromYmd}T00:00:00+09:00`);
  const lte = toRange?.lte ?? new Date(`${toYmd}T23:59:59.999+09:00`);
  return {
    tenantId,
    ...(userId ? { userId } : {}),
    OR: [
      { startedAt: { gte, lte } },
      { startedAt: null, createdAt: { gte, lte } },
    ],
  };
}

export function parseCreateTelecrmCallSessionBody(body: unknown): CreateTelecrmCallSessionInput | { error: string } {
  if (!body || typeof body !== 'object') return { error: '요청 본문이 필요합니다.' };
  const b = body as Record<string, unknown>;
  const phoneRaw = typeof b.phone === 'string' ? b.phone.trim() : '';
  const phone = normalizePhone(phoneRaw);
  if (phone.length < 4) return { error: '전화번호(4자 이상)가 필요합니다.' };
  const direction = parseDirection(b.direction);
  if (!direction) return { error: 'direction은 OUTBOUND 또는 INBOUND 여야 합니다.' };
  let durationSec: number | null = null;
  if (typeof b.durationSec === 'number' && Number.isFinite(b.durationSec)) {
    durationSec = Math.max(0, Math.floor(b.durationSec));
  }
  const inquiryId = typeof b.inquiryId === 'string' && b.inquiryId.trim() ? b.inquiryId.trim() : null;
  const memo = typeof b.memo === 'string' ? b.memo.trim().slice(0, 4000) : null;
  const androidCallLogId =
    typeof b.androidCallLogId === 'string' && b.androidCallLogId.trim()
      ? b.androidCallLogId.trim().slice(0, 64)
      : null;
  const connectedMinSec =
    typeof b.connectedMinSec === 'number' && Number.isFinite(b.connectedMinSec)
      ? Math.max(30, Math.min(300, Math.floor(b.connectedMinSec)))
      : TELECRM_CONNECTED_MIN_SEC;
  const status =
    parseStatus(b.status) ??
    (durationSec != null && durationSec > 0
      ? classifyCallSessionStatus(durationSec, connectedMinSec)
      : 'DIAL_ATTEMPT');
  return {
    phone,
    direction,
    startedAt: typeof b.startedAt === 'string' ? b.startedAt : null,
    endedAt: typeof b.endedAt === 'string' ? b.endedAt : null,
    durationSec,
    customerMatch: parseCustomerMatch(b.customerMatch),
    inquiryId,
    memo: memo || null,
    androidCallLogId,
    status,
    source: parseSource(b.source),
    connectedMinSec,
  };
}

export function parseSyncTelecrmCallSessionBody(body: unknown): SyncTelecrmCallSessionInput | { error: string } {
  if (!body || typeof body !== 'object') return { error: '요청 본문이 필요합니다.' };
  const b = body as Record<string, unknown>;
  const phone = normalizePhone(typeof b.phone === 'string' ? b.phone : '');
  if (phone.length < 4) return { error: '전화번호(4자 이상)가 필요합니다.' };
  const direction = parseDirection(b.direction);
  if (!direction) return { error: 'direction은 OUTBOUND 또는 INBOUND 여야 합니다.' };
  const androidCallLogId =
    typeof b.androidCallLogId === 'string' && b.androidCallLogId.trim()
      ? b.androidCallLogId.trim().slice(0, 64)
      : '';
  if (!androidCallLogId) return { error: 'androidCallLogId가 필요합니다.' };
  const startedAt = typeof b.startedAt === 'string' ? b.startedAt.trim() : '';
  if (!startedAt || Number.isNaN(new Date(startedAt).getTime())) {
    return { error: 'startedAt(ISO)가 필요합니다.' };
  }
  let durationSec = 0;
  if (typeof b.durationSec === 'number' && Number.isFinite(b.durationSec)) {
    durationSec = Math.max(0, Math.floor(b.durationSec));
  }
  const connectedMinSec =
    typeof b.connectedMinSec === 'number' && Number.isFinite(b.connectedMinSec)
      ? Math.max(30, Math.min(300, Math.floor(b.connectedMinSec)))
      : TELECRM_CONNECTED_MIN_SEC;
  return {
    phone,
    direction,
    androidCallLogId,
    startedAt,
    endedAt: typeof b.endedAt === 'string' ? b.endedAt : null,
    durationSec,
    customerMatch: parseCustomerMatch(b.customerMatch),
    inquiryId: typeof b.inquiryId === 'string' && b.inquiryId.trim() ? b.inquiryId.trim() : null,
    source: parseSource(b.source) ?? 'CALLLOG_SYNC',
    connectedMinSec,
  };
}

async function assertInquiry(tenantId: string, inquiryId: string | null | undefined) {
  if (!inquiryId) return;
  const inquiry = await prisma.inquiry.findFirst({
    where: { id: inquiryId, tenantId },
    select: { id: true },
  });
  if (!inquiry) throw new Error('INQUIRY_NOT_FOUND');
}

function buildSessionData(
  input: CreateTelecrmCallSessionInput | SyncTelecrmCallSessionInput,
  opts: { verified: boolean },
) {
  const connectedMinSec = input.connectedMinSec ?? TELECRM_CONNECTED_MIN_SEC;
  const durationSec = input.durationSec ?? null;
  const status =
    'status' in input && input.status
      ? input.status
      : classifyCallSessionStatus(durationSec, connectedMinSec);
  const startedAt = parseOptionalDate(input.startedAt ?? null);
  const endedAt = parseOptionalDate(input.endedAt ?? null);
  return {
    phone: input.phone,
    direction: input.direction,
    startedAt,
    endedAt,
    durationSec,
    customerMatch: input.customerMatch ?? null,
    inquiryId: input.inquiryId ?? null,
    status,
    connectedMinSec,
    verifiedAt: opts.verified ? new Date() : null,
    source: input.source ?? null,
    androidCallLogId: 'androidCallLogId' in input ? input.androidCallLogId : null,
  };
}

export async function createTelecrmCallSession(
  tenantId: string,
  userId: string,
  input: CreateTelecrmCallSessionInput,
) {
  await assertInquiry(tenantId, input.inquiryId);

  if (input.androidCallLogId) {
    const existing = await prisma.telecrmCallSession.findFirst({
      where: { tenantId, userId, androidCallLogId: input.androidCallLogId },
      select: { id: true },
    });
    if (existing) {
      return prisma.telecrmCallSession.findUniqueOrThrow({ where: { id: existing.id } });
    }
  }

  const verified = Boolean(input.androidCallLogId) || (input.durationSec != null && input.durationSec > 0);
  return prisma.telecrmCallSession.create({
    data: {
      tenantId,
      userId,
      ...buildSessionData(input, { verified }),
    },
  });
}

/** CallLog 검증 동기화 — androidCallLogId dedupe · 최근 DIAL_ATTEMPT 병합 */
export async function syncTelecrmCallSession(
  tenantId: string,
  userId: string,
  input: SyncTelecrmCallSessionInput,
) {
  await assertInquiry(tenantId, input.inquiryId);

  const connectedMinSec = input.connectedMinSec ?? TELECRM_CONNECTED_MIN_SEC;
  const status = classifyCallSessionStatus(input.durationSec, connectedMinSec);
  const startedAt = parseOptionalDate(input.startedAt)!;
  const endedAt =
    parseOptionalDate(input.endedAt ?? null) ??
    new Date(startedAt.getTime() + input.durationSec * 1000);
  const data = {
    phone: input.phone,
    direction: input.direction,
    startedAt,
    endedAt,
    durationSec: input.durationSec,
    customerMatch: input.customerMatch ?? null,
    inquiryId: input.inquiryId ?? null,
    status,
    connectedMinSec,
    verifiedAt: new Date(),
    source: input.source ?? 'CALLLOG_SYNC',
    androidCallLogId: input.androidCallLogId,
  };

  const existing = await prisma.telecrmCallSession.findFirst({
    where: { tenantId, userId, androidCallLogId: input.androidCallLogId },
    select: { id: true },
  });
  if (existing) {
    return prisma.telecrmCallSession.update({
      where: { id: existing.id },
      data,
    });
  }

  const mergeWindowStart = new Date(Date.now() - 20 * 60 * 1000);
  const pending = await prisma.telecrmCallSession.findFirst({
    where: {
      tenantId,
      userId,
      phone: input.phone,
      status: 'DIAL_ATTEMPT',
      androidCallLogId: null,
      createdAt: { gte: mergeWindowStart },
    },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });
  if (pending) {
    return prisma.telecrmCallSession.update({
      where: { id: pending.id },
      data,
    });
  }

  return prisma.telecrmCallSession.create({
    data: { tenantId, userId, ...data },
  });
}

export type TelecrmCallSessionSummary = {
  day: string;
  connectedMinSec: number;
  connectedCount: number;
  noAnswerCount: number;
  dialAttemptCount: number;
  /** @deprecated connectedCount 사용 */
  callCount: number;
  connectedDurationSec: number;
  /** @deprecated connectedDurationSec 사용 */
  totalDurationSec: number;
  byCustomerMatch: Record<string, number>;
  lastConnectedAt: string | null;
};

function aggregateSummaryRows(
  dayYmd: string,
  rows: Array<{
    status: string;
    durationSec: number | null;
    customerMatch: string | null;
    startedAt: Date | null;
    createdAt: Date;
    connectedMinSec: number;
  }>,
): TelecrmCallSessionSummary {
  let connectedCount = 0;
  let noAnswerCount = 0;
  let dialAttemptCount = 0;
  let connectedDurationSec = 0;
  const byMatch: Record<string, number> = {};
  let lastConnectedAt: Date | null = null;

  for (const row of rows) {
    const status = row.status as TelecrmCallSessionStatus;
    if (status === 'CONNECTED') {
      connectedCount += 1;
      connectedDurationSec += row.durationSec ?? 0;
      const at = row.startedAt ?? row.createdAt;
      if (!lastConnectedAt || at > lastConnectedAt) lastConnectedAt = at;
      const key = row.customerMatch ?? 'unknown';
      byMatch[key] = (byMatch[key] ?? 0) + 1;
    } else if (status === 'NO_ANSWER') {
      noAnswerCount += 1;
    } else {
      dialAttemptCount += 1;
    }
  }

  return {
    day: dayYmd,
    connectedMinSec: rows[0]?.connectedMinSec ?? TELECRM_CONNECTED_MIN_SEC,
    connectedCount,
    noAnswerCount,
    dialAttemptCount,
    callCount: connectedCount,
    connectedDurationSec,
    totalDurationSec: connectedDurationSec,
    byCustomerMatch: byMatch,
    lastConnectedAt: lastConnectedAt?.toISOString() ?? null,
  };
}

export async function getTelecrmCallSessionSummary(
  tenantId: string,
  userId: string,
  dayYmd: string,
): Promise<TelecrmCallSessionSummary> {
  const rows = await prisma.telecrmCallSession.findMany({
    where: sessionDayWhere(tenantId, userId, dayYmd),
    select: {
      status: true,
      durationSec: true,
      customerMatch: true,
      startedAt: true,
      createdAt: true,
      connectedMinSec: true,
    },
  });
  return aggregateSummaryRows(dayYmd, rows);
}

export type TelecrmCallSessionListItem = {
  id: string;
  phone: string;
  direction: string;
  status: string;
  durationSec: number | null;
  startedAt: string | null;
  endedAt: string | null;
  customerMatch: string | null;
  inquiryId: string | null;
  source: string | null;
  createdAt: string;
  user?: { id: string; name: string | null; email: string | null };
};

export async function listTelecrmCallSessions(
  tenantId: string,
  opts: {
    userId?: string;
    fromYmd: string;
    toYmd: string;
    status?: TelecrmCallSessionStatus;
    limit: number;
    offset: number;
    includeUser?: boolean;
  },
): Promise<{ items: TelecrmCallSessionListItem[]; total: number }> {
  const where = {
    ...rangeWhere(tenantId, opts.fromYmd, opts.toYmd, opts.userId),
    ...(opts.status ? { status: opts.status } : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.telecrmCallSession.count({ where }),
    prisma.telecrmCallSession.findMany({
      where,
      orderBy: [{ startedAt: 'desc' }, { createdAt: 'desc' }],
      take: opts.limit,
      skip: opts.offset,
      select: {
        id: true,
        phone: true,
        direction: true,
        status: true,
        durationSec: true,
        startedAt: true,
        endedAt: true,
        customerMatch: true,
        inquiryId: true,
        source: true,
        createdAt: true,
        ...(opts.includeUser
          ? {
              user: { select: { id: true, name: true, email: true } },
            }
          : {}),
      },
    }),
  ]);

  return {
    total,
    items: rows.map((row) => ({
      id: row.id,
      phone: row.phone,
      direction: row.direction,
      status: row.status,
      durationSec: row.durationSec,
      startedAt: row.startedAt?.toISOString() ?? null,
      endedAt: row.endedAt?.toISOString() ?? null,
      customerMatch: row.customerMatch,
      inquiryId: row.inquiryId,
      source: row.source,
      createdAt: row.createdAt.toISOString(),
      ...(opts.includeUser && 'user' in row && row.user
        ? { user: row.user as { id: string; name: string | null; email: string | null } }
        : {}),
    })),
  };
}

export type TelecrmCallSessionTeamRow = {
  userId: string;
  userName: string | null;
  loginId: string | null;
  connectedCount: number;
  noAnswerCount: number;
  dialAttemptCount: number;
  connectedDurationSec: number;
  avgConnectedDurationSec: number;
  lastConnectedAt: string | null;
  avgGapMin: number | null;
};

function computeAvgGapMin(
  sessions: Array<{ startedAt: Date | null; endedAt: Date | null; createdAt: Date; durationSec: number | null }>,
): number | null {
  const points = sessions
    .map((s) => ({
      start: s.startedAt ?? s.createdAt,
      end: s.endedAt ?? new Date((s.startedAt ?? s.createdAt).getTime() + (s.durationSec ?? 0) * 1000),
    }))
    .sort((a, b) => a.start.getTime() - b.start.getTime());
  if (points.length < 2) return null;
  let totalGapMs = 0;
  let gaps = 0;
  for (let i = 1; i < points.length; i += 1) {
    const gap = points[i]!.start.getTime() - points[i - 1]!.end.getTime();
    if (gap > 0) {
      totalGapMs += gap;
      gaps += 1;
    }
  }
  if (gaps === 0) return null;
  return Math.round(totalGapMs / gaps / 60_000);
}

export async function getTelecrmCallSessionTeamSummary(
  tenantId: string,
  fromYmd: string,
  toYmd: string,
): Promise<{ from: string; to: string; connectedMinSec: number; items: TelecrmCallSessionTeamRow[] }> {
  const staff = await prisma.user.findMany({
    where: {
      tenantId,
      isActive: true,
      role: { in: ['MARKETER', 'ADMIN'] },
    },
    select: { id: true, name: true, email: true },
    orderBy: [{ name: 'asc' }, { email: 'asc' }],
  });

  const rows = await prisma.telecrmCallSession.findMany({
    where: rangeWhere(tenantId, fromYmd, toYmd),
    select: {
      userId: true,
      status: true,
      durationSec: true,
      startedAt: true,
      endedAt: true,
      createdAt: true,
      connectedMinSec: true,
    },
  });

  const byUser = new Map<string, typeof rows>();
  for (const row of rows) {
    const list = byUser.get(row.userId) ?? [];
    list.push(row);
    byUser.set(row.userId, list);
  }

  const items: TelecrmCallSessionTeamRow[] = staff.map((user) => {
    const userRows = byUser.get(user.id) ?? [];
    let connectedCount = 0;
    let noAnswerCount = 0;
    let dialAttemptCount = 0;
    let connectedDurationSec = 0;
    let lastConnectedAt: Date | null = null;
    const connectedSessions: typeof rows = [];

    for (const row of userRows) {
      if (row.status === 'CONNECTED') {
        connectedCount += 1;
        connectedDurationSec += row.durationSec ?? 0;
        connectedSessions.push(row);
        const at = row.startedAt ?? row.createdAt;
        if (!lastConnectedAt || at > lastConnectedAt) lastConnectedAt = at;
      } else if (row.status === 'NO_ANSWER') {
        noAnswerCount += 1;
      } else {
        dialAttemptCount += 1;
      }
    }

    return {
      userId: user.id,
      userName: user.name,
      loginId: user.email,
      connectedCount,
      noAnswerCount,
      dialAttemptCount,
      connectedDurationSec,
      avgConnectedDurationSec:
        connectedCount > 0 ? Math.round(connectedDurationSec / connectedCount) : 0,
      lastConnectedAt: lastConnectedAt?.toISOString() ?? null,
      avgGapMin: computeAvgGapMin(connectedSessions),
    };
  });

  return {
    from: fromYmd,
    to: toYmd,
    connectedMinSec: TELECRM_CONNECTED_MIN_SEC,
    items,
  };
}

export function serializeCallSessionRow(row: {
  id: string;
  phone: string;
  direction: string;
  status: string;
  durationSec: number | null;
  customerMatch: string | null;
  inquiryId: string | null;
  createdAt: Date;
  startedAt: Date | null;
  endedAt: Date | null;
  source: string | null;
}) {
  return {
    id: row.id,
    phone: row.phone,
    direction: row.direction,
    status: row.status,
    durationSec: row.durationSec,
    customerMatch: row.customerMatch,
    inquiryId: row.inquiryId,
    startedAt: row.startedAt?.toISOString() ?? null,
    endedAt: row.endedAt?.toISOString() ?? null,
    source: row.source,
    createdAt: row.createdAt.toISOString(),
  };
}
