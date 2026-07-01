import { prisma } from '../../lib/prisma.js';

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
  };
}

export async function createTelecrmCallSession(
  tenantId: string,
  userId: string,
  input: CreateTelecrmCallSessionInput,
) {
  if (input.inquiryId) {
    const inquiry = await prisma.inquiry.findFirst({
      where: { id: input.inquiryId, tenantId },
      select: { id: true },
    });
    if (!inquiry) {
      throw new Error('INQUIRY_NOT_FOUND');
    }
  }

  if (input.androidCallLogId) {
    const existing = await prisma.telecrmCallSession.findFirst({
      where: { tenantId, userId, androidCallLogId: input.androidCallLogId },
      select: { id: true },
    });
    if (existing) {
      return prisma.telecrmCallSession.findUniqueOrThrow({ where: { id: existing.id } });
    }
  }

  return prisma.telecrmCallSession.create({
    data: {
      tenantId,
      userId,
      phone: input.phone,
      direction: input.direction,
      startedAt: parseOptionalDate(input.startedAt ?? null),
      endedAt: parseOptionalDate(input.endedAt ?? null),
      durationSec: input.durationSec ?? null,
      customerMatch: input.customerMatch ?? null,
      inquiryId: input.inquiryId ?? null,
      memo: input.memo ?? null,
      androidCallLogId: input.androidCallLogId ?? null,
    },
  });
}

export async function getTelecrmCallSessionSummary(tenantId: string, userId: string, dayYmd: string) {
  const start = new Date(`${dayYmd}T00:00:00+09:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  const rows = await prisma.telecrmCallSession.findMany({
    where: {
      tenantId,
      userId,
      createdAt: { gte: start, lt: end },
    },
    select: {
      direction: true,
      durationSec: true,
      customerMatch: true,
    },
  });
  let totalDurationSec = 0;
  const byMatch: Record<string, number> = {};
  for (const row of rows) {
    totalDurationSec += row.durationSec ?? 0;
    const key = row.customerMatch ?? 'unknown';
    byMatch[key] = (byMatch[key] ?? 0) + 1;
  }
  return {
    day: dayYmd,
    callCount: rows.length,
    totalDurationSec,
    byCustomerMatch: byMatch,
  };
}
