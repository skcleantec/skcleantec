import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { normalizeKrPhoneDigits } from '../cs/matchInquiryForCs.js';

function extractCrmRegionKey(address: string): string {
  const trimmed = address.trim();
  if (!trimmed) return '';
  const head = trimmed.split(/[,，·/|]/)[0]?.trim() ?? trimmed;
  const parts = head.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0]} ${parts[1]}`;
  return parts[0] ?? '';
}

const LOOKBACK_MS = 180 * 24 * 60 * 60 * 1000;
const ACTIVE_DISPATCH_MS = 5 * 60 * 1000;
const ACTIVE_CALL_MS = 3 * 60 * 1000;

function normalizePhone(raw: string): string {
  return normalizeKrPhoneDigits(raw).slice(0, 32);
}

function phonesMatch(a: string, b: string): boolean {
  const da = normalizePhone(a);
  const db = normalizePhone(b);
  if (!da || !db) return false;
  if (da === db) return true;
  if (da.length >= 4 && db.length >= 4 && da.slice(-4) === db.slice(-4)) {
    const lenDiff = Math.abs(da.length - db.length);
    return lenDiff <= 1 || da.endsWith(db) || db.endsWith(da);
  }
  return false;
}

function collectPhones(phoneRaw?: string, phone2Raw?: string): string[] {
  const out = new Set<string>();
  for (const raw of [phoneRaw ?? '', phone2Raw ?? '']) {
    const p = normalizePhone(raw);
    if (p.length >= 4) out.add(p);
  }
  return [...out];
}

function nameTokens(customerName: string, nickname: string): string[] {
  const out = new Set<string>();
  for (const raw of [customerName.trim(), nickname.trim()]) {
    if (raw.length >= 2) out.add(raw);
  }
  return [...out];
}

function buildNameOrFilter(tokens: string[]): Prisma.InquiryWhereInput[] {
  return tokens.flatMap((token) => [
    { customerName: { contains: token, mode: 'insensitive' as const } },
    { nickname: { contains: token, mode: 'insensitive' as const } },
  ]);
}

function followupNameOrFilter(tokens: string[]): Prisma.OrderFollowupWhereInput[] {
  return tokens.flatMap((token) => [
    { customerName: { contains: token, mode: 'insensitive' as const } },
    { nickname: { contains: token, mode: 'insensitive' as const } },
  ]);
}

function rowNameMatches(
  row: { customerName: string; nickname?: string | null },
  tokens: string[],
): boolean {
  if (tokens.length === 0) return false;
  return tokens.some(
    (token) =>
      row.customerName.toLowerCase().includes(token.toLowerCase()) ||
      (row.nickname?.toLowerCase().includes(token.toLowerCase()) ?? false),
  );
}

const FOLLOWUP_STATUS_LABEL: Record<string, string> = {
  REQUESTED: '요청',
  ABSENT: '부재',
  DEPOSIT_PENDING: '예약금 대기',
  ON_HOLD: '보류·고민',
  RESERVED: '입금 완료',
  FULFILLED: '처리 완료',
};

function callStatusTitle(status: string, direction: string): string {
  const dir = direction === 'INBOUND' ? '수신' : '발신';
  if (status === 'CONNECTED') return `전화 · ${dir} · 연결`;
  if (status === 'NO_ANSWER') return `전화 · ${dir} · 부재`;
  return `전화 · ${dir} · 시도`;
}

export type TelecrmContactTimelineItem = {
  id: string;
  kind: string;
  at: string;
  actorName: string | null;
  actorId: string | null;
  title: string;
  detail: string | null;
  active: boolean;
};

export type ContactTimelineSearch = {
  customerName?: string;
  nickname?: string;
  region?: string;
  address?: string;
  phone?: string;
  phone2?: string;
  operatingCompanyId?: string | null;
};

export async function listTelecrmContactTimeline(
  tenantId: string,
  search: ContactTimelineSearch,
  limit = 50,
): Promise<{ items: TelecrmContactTimelineItem[] }> {
  const customerName = search.customerName?.trim() ?? '';
  const nickname = search.nickname?.trim() ?? '';
  const region =
    (search.region?.trim() || extractCrmRegionKey(search.address?.trim() ?? '')).trim();
  const tokens = nameTokens(customerName, nickname);
  const phones = collectPhones(search.phone, search.phone2);

  if (tokens.length === 0 || region.length < 2) {
    return { items: [] };
  }

  const since = new Date(Date.now() - LOOKBACK_MS);
  const now = Date.now();
  const activeSince = new Date(now - ACTIVE_DISPATCH_MS);
  const activeCallSince = new Date(now - ACTIVE_CALL_MS);

  const inquiryWhere: Prisma.InquiryWhereInput = {
    tenantId,
    ...(search.operatingCompanyId ? { operatingCompanyId: search.operatingCompanyId } : {}),
    AND: [
      { OR: buildNameOrFilter(tokens) },
      { address: { contains: region, mode: 'insensitive' } },
    ],
  };

  const followupWhere: Prisma.OrderFollowupWhereInput = {
    tenantId,
    ...(search.operatingCompanyId ? { operatingCompanyId: search.operatingCompanyId } : {}),
    OR: followupNameOrFilter(tokens),
  };

  const csWhere: Prisma.CsReportWhereInput = {
    tenantId,
    createdAt: { gte: since },
    OR: tokens.map((token) => ({
      customerName: { contains: token, mode: 'insensitive' as const },
    })),
  };

  const [inquiryRows, followupRows, csRows] = await Promise.all([
    prisma.inquiry.findMany({
      where: inquiryWhere,
      orderBy: { updatedAt: 'desc' },
      take: 40,
      select: { id: true, customerName: true, nickname: true, address: true },
    }),
    prisma.orderFollowup.findMany({
      where: followupWhere,
      orderBy: { updatedAt: 'desc' },
      take: 40,
      select: {
        id: true,
        status: true,
        customerName: true,
        nickname: true,
        customerPhone: true,
        customerPhone2: true,
        memo: true,
        createdAt: true,
        updatedAt: true,
        inquiryId: true,
        createdBy: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.csReport.findMany({
      where: csWhere,
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        status: true,
        customerName: true,
        customerPhone: true,
        content: true,
        memo: true,
        createdAt: true,
      },
    }),
  ]);

  const matchedInquiryIds = inquiryRows.map((r) => r.id);
  const matchedFollowupIds = followupRows
    .filter((row) => rowNameMatches(row, tokens))
    .map((r) => r.id);

  const sessionOr: Prisma.TelecrmCallSessionWhereInput[] = [
    ...(matchedInquiryIds.length > 0 ? [{ inquiryId: { in: matchedInquiryIds } }] : []),
    ...(phones.length > 0 ? phones.map((p) => ({ phone: p })) : []),
  ];

  const noteOr: Prisma.TelecrmCallNoteWhereInput[] = [
    ...(phones.length > 0 ? phones.map((p) => ({ phone: p })) : []),
    ...(matchedInquiryIds.length > 0 ? [{ inquiryId: { in: matchedInquiryIds } }] : []),
  ];

  const [sessions, notes, dispatches, activeCalls] = await Promise.all([
    sessionOr.length > 0
      ? prisma.telecrmCallSession.findMany({
          where: {
            tenantId,
            createdAt: { gte: since },
            OR: sessionOr,
          },
          orderBy: [{ startedAt: 'desc' }, { createdAt: 'desc' }],
          take: 80,
          select: {
            id: true,
            phone: true,
            direction: true,
            status: true,
            durationSec: true,
            startedAt: true,
            endedAt: true,
            createdAt: true,
            memo: true,
            inquiryId: true,
            user: { select: { id: true, name: true, email: true } },
          },
        })
      : Promise.resolve([]),
    noteOr.length > 0
      ? prisma.telecrmCallNote.findMany({
          where: {
            tenantId,
            OR: noteOr,
          },
          orderBy: { createdAt: 'desc' },
          take: 40,
          select: {
            id: true,
            phone: true,
            body: true,
            inquiryId: true,
            createdAt: true,
            user: { select: { id: true, name: true, email: true } },
          },
        })
      : Promise.resolve([]),
    phones.length > 0
      ? prisma.telecrmMobileDispatchPending.findMany({
          where: {
            tenantId,
            createdAt: { gte: activeSince },
            OR: phones.map((p) => ({ phone: p })),
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            action: true,
            phone: true,
            createdAt: true,
            user: { select: { id: true, name: true, email: true } },
          },
        })
      : Promise.resolve([]),
    phones.length > 0
      ? prisma.telecrmCallSession.findMany({
          where: {
            tenantId,
            status: 'DIAL_ATTEMPT',
            endedAt: null,
            AND: [
              {
                OR: [
                  { startedAt: { gte: activeCallSince } },
                  { startedAt: null, createdAt: { gte: activeCallSince } },
                ],
              },
              { OR: phones.map((p) => ({ phone: p })) },
            ],
          },
          take: 5,
          select: {
            id: true,
            phone: true,
            direction: true,
            startedAt: true,
            createdAt: true,
            user: { select: { id: true, name: true, email: true } },
          },
        })
      : Promise.resolve([]),
  ]);

  const followupLogs =
    matchedFollowupIds.length > 0
      ? await prisma.orderFollowupLog.findMany({
          where: { followupId: { in: matchedFollowupIds }, createdAt: { gte: since } },
          orderBy: { createdAt: 'desc' },
          take: 40,
          select: {
            id: true,
            action: true,
            detail: true,
            createdAt: true,
            actor: { select: { id: true, name: true, email: true } },
          },
        })
      : [];

  const items: TelecrmContactTimelineItem[] = [];
  const actorLabel = (u: { name: string | null; email: string | null } | null | undefined) =>
    u?.name?.trim() || u?.email?.trim() || null;

  const sessionIncluded = (row: { inquiryId: string | null; phone: string }) =>
    (row.inquiryId != null && matchedInquiryIds.includes(row.inquiryId)) ||
    (phones.length > 0 && phones.some((p) => phonesMatch(row.phone, p)));

  for (const row of sessions.filter(sessionIncluded)) {
    const at = (row.startedAt ?? row.createdAt).toISOString();
    const dur =
      row.durationSec != null && row.durationSec > 0 ? `${Math.round(row.durationSec / 60)}분` : null;
    items.push({
      id: `call:${row.id}`,
      kind: 'call',
      at,
      actorId: row.user.id,
      actorName: actorLabel(row.user),
      title: callStatusTitle(row.status, row.direction),
      detail: [dur, row.memo?.trim()].filter(Boolean).join(' · ') || null,
      active: false,
    });
  }

  for (const row of notes) {
    items.push({
      id: `memo:${row.id}`,
      kind: 'memo',
      at: row.createdAt.toISOString(),
      actorId: row.user.id,
      actorName: actorLabel(row.user),
      title: '통화 메모',
      detail: row.body.trim() || null,
      active: false,
    });
  }

  for (const row of followupRows.filter((r) => rowNameMatches(r, tokens))) {
    const statusLabel = FOLLOWUP_STATUS_LABEL[row.status] ?? row.status;
    items.push({
      id: `followup:${row.id}`,
      kind: 'followup',
      at: row.updatedAt.toISOString(),
      actorId: row.createdBy.id,
      actorName: actorLabel(row.createdBy),
      title: `부재·보류 · ${statusLabel}`,
      detail: row.customerName?.trim() || row.nickname?.trim() || row.memo?.trim() || null,
      active: row.status === 'ABSENT' || row.status === 'ON_HOLD' || row.status === 'REQUESTED',
    });
  }

  for (const row of followupLogs) {
    items.push({
      id: `followup-log:${row.id}`,
      kind: 'followup_log',
      at: row.createdAt.toISOString(),
      actorId: row.actor.id,
      actorName: actorLabel(row.actor),
      title: `부재·보류 · ${row.action}`,
      detail: row.detail?.trim() || null,
      active: false,
    });
  }

  for (const row of csRows.filter((r) => rowNameMatches(r, tokens))) {
    items.push({
      id: `cs:${row.id}`,
      kind: 'cs',
      at: row.createdAt.toISOString(),
      actorId: null,
      actorName: null,
      title: `C/S · ${row.status}`,
      detail: row.content?.trim() || row.memo?.trim() || row.customerName?.trim() || null,
      active: false,
    });
  }

  for (const row of dispatches.filter((r) => phones.some((p) => phonesMatch(r.phone, p)))) {
    const isCall = row.action === 'call';
    items.push({
      id: `dispatch:${row.id}`,
      kind: isCall ? 'dispatch_call' : 'dispatch_sms',
      at: row.createdAt.toISOString(),
      actorId: row.user.id,
      actorName: actorLabel(row.user),
      title: isCall ? '접촉 중 · 전화' : '접촉 중 · 문자',
      detail: null,
      active: true,
    });
  }

  for (const row of activeCalls.filter((r) => phones.some((p) => phonesMatch(r.phone, p)))) {
    if (items.some((it) => it.active && it.actorId === row.user.id && it.kind === 'dispatch_call')) {
      continue;
    }
    items.push({
      id: `active-call:${row.id}`,
      kind: 'active_call',
      at: (row.startedAt ?? row.createdAt).toISOString(),
      actorId: row.user.id,
      actorName: actorLabel(row.user),
      title: '접촉 중 · 통화',
      detail: null,
      active: true,
    });
  }

  items.sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1;
    return b.at.localeCompare(a.at);
  });

  const seen = new Set<string>();
  const deduped: TelecrmContactTimelineItem[] = [];
  for (const it of items) {
    if (seen.has(it.id)) continue;
    seen.add(it.id);
    deduped.push(it);
    if (deduped.length >= limit) break;
  }

  return { items: deduped };
}
