import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { notifyChangeLogToStaff } from '../realtime/changeLogNotify.js';
import { notifyInboxRefresh } from '../realtime/inboxNotify.js';
import {
  inquiryTrashDaysRemaining,
  inquiryTrashPurgeAtKst,
  inquiryTrashPurgeCutoffDate,
  withActiveInquiryScope,
  withTrashedInquiryScope,
} from './inquiryTrash.helpers.js';
import { inquiryTrashRetentionDays } from '../../lib/inquiryTrashRetention.js';

function formatInquiryLabel(customerName: string, inquiryNumber: string | null, id: string): string {
  return `${customerName} (${inquiryNumber ?? id})`;
}

async function teamLeaderIdsForInquiry(inquiryId: string): Promise<string[]> {
  const rows = await prisma.assignment.findMany({
    where: { inquiryId },
    select: { teamLeaderId: true },
  });
  return [...new Set(rows.map((r) => r.teamLeaderId))];
}

async function notifyInquiryTrashChange(
  tenantId: string,
  inquiryId: string,
  customerName: string,
  lines: string[],
): Promise<void> {
  notifyChangeLogToStaff({ tenantId, customerName, inquiryId, lines });
  const leaderIds = await teamLeaderIdsForInquiry(inquiryId);
  if (leaderIds.length > 0) {
    notifyInboxRefresh(leaderIds);
  }
}

export async function permanentlyDeleteInquiryRecord(
  tx: Prisma.TransactionClient,
  row: { id: string; customerName: string; inquiryNumber: string | null },
  actorId: string | null,
  logLine: string,
): Promise<void> {
  await tx.inquiryChangeLog.create({
    data: {
      inquiryId: row.id,
      customerName: row.customerName,
      actorId,
      lines: [logLine],
    },
  });
  await tx.inquiry.delete({ where: { id: row.id } });
}

export async function softDeleteInquiry(
  tenantId: string,
  inquiryId: string,
  actorId: string | null,
): Promise<void> {
  const existing = await prisma.inquiry.findFirst({
    where: withActiveInquiryScope(tenantId, { id: inquiryId }),
  });
  if (!existing) {
    throw new Error('NOT_FOUND');
  }
  const label = formatInquiryLabel(existing.customerName, existing.inquiryNumber, existing.id);
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.inquiry.update({
      where: { id: existing.id },
      data: { deletedAt: now, deletedById: actorId },
    });
    await tx.inquiryChangeLog.create({
      data: {
        inquiryId: existing.id,
        customerName: existing.customerName,
        actorId,
        lines: [`접수 휴지통 이동: ${label}`],
      },
    });
  });
  await notifyInquiryTrashChange(tenantId, existing.id, existing.customerName, [
    `접수 휴지통 이동: ${label}`,
  ]);
}

export async function softDeleteInquiriesByWhere(
  tenantId: string,
  where: Prisma.InquiryWhereInput,
  actorId: string | null,
): Promise<number> {
  const rows = await prisma.inquiry.findMany({
    where: withActiveInquiryScope(tenantId, where),
    select: { id: true, customerName: true, inquiryNumber: true },
  });
  if (rows.length === 0) return 0;
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    for (const row of rows) {
      const label = formatInquiryLabel(row.customerName, row.inquiryNumber, row.id);
      await tx.inquiry.update({
        where: { id: row.id },
        data: { deletedAt: now, deletedById: actorId },
      });
      await tx.inquiryChangeLog.create({
        data: {
          inquiryId: row.id,
          customerName: row.customerName,
          actorId,
          lines: [`접수 휴지통 이동: ${label}`],
        },
      });
    }
  });
  for (const row of rows) {
    const label = formatInquiryLabel(row.customerName, row.inquiryNumber, row.id);
    await notifyInquiryTrashChange(tenantId, row.id, row.customerName, [
      `접수 휴지통 이동: ${label}`,
    ]);
  }
  return rows.length;
}

export async function restoreInquiryFromTrash(
  tenantId: string,
  inquiryId: string,
  actorId: string | null,
): Promise<void> {
  const existing = await prisma.inquiry.findFirst({
    where: withTrashedInquiryScope(tenantId, { id: inquiryId }),
  });
  if (!existing) {
    throw new Error('NOT_FOUND');
  }
  const label = formatInquiryLabel(existing.customerName, existing.inquiryNumber, existing.id);
  await prisma.$transaction(async (tx) => {
    await tx.inquiry.update({
      where: { id: existing.id },
      data: { deletedAt: null, deletedById: null },
    });
    await tx.inquiryChangeLog.create({
      data: {
        inquiryId: existing.id,
        customerName: existing.customerName,
        actorId,
        lines: [`접수 복구: ${label}`],
      },
    });
  });
  await notifyInquiryTrashChange(tenantId, existing.id, existing.customerName, [
    `접수 복구: ${label}`,
  ]);
}

export async function purgeInquiryFromTrashNow(
  tenantId: string,
  inquiryId: string,
  actorId: string | null,
): Promise<void> {
  const existing = await prisma.inquiry.findFirst({
    where: withTrashedInquiryScope(tenantId, { id: inquiryId }),
  });
  if (!existing) {
    throw new Error('NOT_FOUND');
  }
  const label = formatInquiryLabel(existing.customerName, existing.inquiryNumber, existing.id);
  await prisma.$transaction(async (tx) => {
    await permanentlyDeleteInquiryRecord(
      tx,
      existing,
      actorId,
      `접수 영구 삭제(휴지통): ${label}`,
    );
  });
  notifyChangeLogToStaff({
    tenantId,
    customerName: existing.customerName,
    inquiryId: null,
    lines: [`접수 영구 삭제(휴지통): ${label}`],
  });
}

export type InquiryTrashPurgeResult = {
  scanned: number;
  purged: number;
  retentionDays: number;
  cutoffIso: string;
};

export async function purgeExpiredInquiryTrash(options?: {
  retentionDays?: number;
  batchSize?: number;
  dryRun?: boolean;
}): Promise<InquiryTrashPurgeResult> {
  const retentionDays = options?.retentionDays ?? inquiryTrashRetentionDays();
  const batchSize = Math.max(1, Math.min(200, options?.batchSize ?? 50));
  const cutoff = inquiryTrashPurgeCutoffDate(retentionDays);
  const candidates = await prisma.inquiry.findMany({
    where: { deletedAt: { not: null, lte: cutoff } },
    orderBy: { deletedAt: 'asc' },
    take: batchSize,
    select: { id: true, tenantId: true, customerName: true, inquiryNumber: true },
  });
  const result: InquiryTrashPurgeResult = {
    scanned: candidates.length,
    purged: 0,
    retentionDays,
    cutoffIso: cutoff.toISOString(),
  };
  if (options?.dryRun || candidates.length === 0) {
    return result;
  }
  for (const row of candidates) {
    const label = formatInquiryLabel(row.customerName, row.inquiryNumber, row.id);
    await prisma.$transaction(async (tx) => {
      await permanentlyDeleteInquiryRecord(
        tx,
        row,
        null,
        `접수 영구 삭제(보관 만료): ${label}`,
      );
    });
    notifyChangeLogToStaff({
      tenantId: row.tenantId,
      customerName: row.customerName,
      inquiryId: null,
      lines: [`접수 영구 삭제(보관 만료): ${label}`],
    });
    result.purged += 1;
  }
  return result;
}

export function mapInquiryTrashListMeta(deletedAt: Date) {
  const retentionDays = inquiryTrashRetentionDays();
  return {
    purgeAt: inquiryTrashPurgeAtKst(deletedAt, retentionDays),
    daysRemaining: inquiryTrashDaysRemaining(deletedAt, retentionDays),
    retentionDays,
  };
}
