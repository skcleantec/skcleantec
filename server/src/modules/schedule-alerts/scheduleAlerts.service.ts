import type { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import {
  parseLinesJson,
  resolveScheduleAlertKind,
  toChangeHistoryItemDto,
  type ScheduleAlertKind,
} from '../inquiry-change-logs/inquiryChangeLogs.helpers.js';

function scheduleAlertsSinceDate(): Date {
  const raw = process.env.SCHEDULE_ALERTS_SINCE?.trim();
  if (raw) {
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date('2026-07-31T00:00:00+09:00');
}

type Db = PrismaClient | Prisma.TransactionClient;

export type ScheduleAlertItemDto = {
  id: string;
  changeLogId: string;
  inquiryId: string | null;
  customerName: string;
  kind: ScheduleAlertKind;
  summaryLine: string;
  lines: string[];
  createdAt: string;
  actorName: string | null;
  preferredDate: string | null;
};

function staffAlertLogWhere(tenantId: string): Prisma.InquiryChangeLogWhereInput {
  return {
    scheduleAlertKind: { not: null },
    createdAt: { gte: scheduleAlertsSinceDate() },
    OR: [
      { inquiry: { tenantId } },
      { inquiryId: null, actor: { tenantId } },
    ],
  };
}

function teamLeaderAlertLogWhere(
  tenantId: string,
  teamLeaderId: string,
): Prisma.InquiryChangeLogWhereInput {
  return {
    AND: [
      staffAlertLogWhere(tenantId),
      {
        inquiry: {
          tenantId,
          assignments: { some: { teamLeaderId } },
        },
      },
    ],
  };
}

async function attachActorNames(rows: { actorId: string | null }[]): Promise<Map<string, string>> {
  const ids = [...new Set(rows.map((r) => r.actorId).filter(Boolean))] as string[];
  if (ids.length === 0) return new Map();
  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true },
  });
  return new Map(users.map((u) => [u.id, u.name]));
}

function pendingWhereForUser(
  tenantId: string,
  userId: string,
  teamLeaderOnly: boolean,
): Prisma.InquiryChangeLogWhereInput {
  const base = teamLeaderOnly
    ? teamLeaderAlertLogWhere(tenantId, userId)
    : staffAlertLogWhere(tenantId);
  return {
    AND: [
      base,
      { NOT: { actorId: userId } },
      { scheduleAlertAcks: { none: { userId } } },
    ],
  };
}

export async function countPendingScheduleAlerts(params: {
  tenantId: string;
  userId: string;
  teamLeaderOnly: boolean;
}): Promise<number> {
  return prisma.inquiryChangeLog.count({
    where: pendingWhereForUser(params.tenantId, params.userId, params.teamLeaderOnly),
  });
}

export async function listPendingScheduleAlerts(params: {
  tenantId: string;
  userId: string;
  teamLeaderOnly: boolean;
  limit?: number;
}): Promise<{ items: ScheduleAlertItemDto[]; total: number }> {
  const take = Math.min(100, Math.max(1, params.limit ?? 50));
  const where = pendingWhereForUser(params.tenantId, params.userId, params.teamLeaderOnly);
  const [rows, total] = await Promise.all([
    prisma.inquiryChangeLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take,
      include: {
        inquiry: { select: { customerName: true, preferredDate: true } },
      },
    }),
    prisma.inquiryChangeLog.count({ where }),
  ]);
  const actorMap = await attachActorNames(rows);
  const items: ScheduleAlertItemDto[] = rows.map((row) => {
    const lineArr = parseLinesJson(row.lines);
    const dto = toChangeHistoryItemDto(row, row.actorId ? actorMap.get(row.actorId) ?? null : null);
    const kind = (row.scheduleAlertKind ?? resolveScheduleAlertKind(lineArr) ?? 'date') as ScheduleAlertKind;
    return {
      id: row.id,
      changeLogId: row.id,
      inquiryId: row.inquiryId,
      customerName: row.customerName || row.inquiry?.customerName || '(삭제된 접수)',
      kind,
      summaryLine: dto.summaryLine,
      lines: dto.lines,
      createdAt: row.createdAt.toISOString(),
      actorName: dto.actorName,
      preferredDate: row.inquiry?.preferredDate
        ? row.inquiry.preferredDate.toISOString().slice(0, 10)
        : null,
    };
  });
  return { items, total };
}

export async function ackScheduleAlert(params: {
  tenantId: string;
  userId: string;
  changeLogId: string;
  teamLeaderOnly: boolean;
}): Promise<boolean> {
  const log = await prisma.inquiryChangeLog.findFirst({
    where: {
      id: params.changeLogId,
      ...(params.teamLeaderOnly
        ? teamLeaderAlertLogWhere(params.tenantId, params.userId)
        : staffAlertLogWhere(params.tenantId)),
    },
    select: { id: true },
  });
  if (!log) return false;
  await prisma.inquiryScheduleAlertAck.upsert({
    where: {
      userId_changeLogId: { userId: params.userId, changeLogId: params.changeLogId },
    },
    create: {
      tenantId: params.tenantId,
      userId: params.userId,
      changeLogId: params.changeLogId,
    },
    update: { acknowledgedAt: new Date() },
  });
  return true;
}

export async function ackAllScheduleAlerts(params: {
  tenantId: string;
  userId: string;
  teamLeaderOnly: boolean;
}): Promise<number> {
  const where = pendingWhereForUser(params.tenantId, params.userId, params.teamLeaderOnly);
  const rows = await prisma.inquiryChangeLog.findMany({
    where,
    select: { id: true },
    take: 500,
  });
  if (rows.length === 0) return 0;
  const now = new Date();
  await prisma.inquiryScheduleAlertAck.createMany({
    data: rows.map((r) => ({
      tenantId: params.tenantId,
      userId: params.userId,
      changeLogId: r.id,
      acknowledgedAt: now,
    })),
    skipDuplicates: true,
  });
  return rows.length;
}

/** changeLog 생성 시 scheduleAlertKind 백필(트랜잭션 내) */
export function scheduleAlertKindForLines(lines: string[]): ScheduleAlertKind | null {
  return resolveScheduleAlertKind(lines);
}

export async function backfillScheduleAlertKind(
  db: Db,
  changeLogId: string,
  lines: string[],
): Promise<ScheduleAlertKind | null> {
  const kind = resolveScheduleAlertKind(lines);
  if (!kind) return null;
  await db.inquiryChangeLog.update({
    where: { id: changeLogId },
    data: { scheduleAlertKind: kind },
  });
  return kind;
}
