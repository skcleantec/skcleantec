import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { createdAtRangeFromQuery } from '../inquiries/inquiryListDateRange.js';
import { buildChangeLogSearchFilter } from './inquiryChangeLogQuery.helpers.js';
import { toChangeHistoryItemDto } from './inquiryChangeLogs.helpers.js';

const logInclude = {
  inquiry: { select: { customerName: true } },
} as const;

export function tenantChangeLogWhere(tenantId: string): Prisma.InquiryChangeLogWhereInput {
  return {
    OR: [
      { inquiry: { tenantId } },
      { inquiryId: null, actor: { tenantId } },
    ],
  };
}

async function attachActorNames<T extends { actorId: string | null }>(
  rows: T[],
): Promise<Map<string, string>> {
  const ids = [...new Set(rows.map((r) => r.actorId).filter(Boolean))] as string[];
  if (ids.length === 0) return new Map();
  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true },
  });
  return new Map(users.map((u) => [u.id, u.name]));
}

export type ChangeLogListQuery = {
  search?: string;
  customerName?: string;
  limit?: number;
  offset?: number;
  datePreset?: string;
  month?: string;
  day?: string;
};

export async function fetchInquiryChangeLogListPage(
  tenantId: string,
  query: ChangeLogListQuery,
): Promise<{ items: ReturnType<typeof toChangeHistoryItemDto>[]; total: number }> {
  const take = Math.min(500, Math.max(1, query.limit ?? 100));
  const skip = Math.max(0, query.offset ?? 0);

  const searchText =
    typeof query.search === 'string' && query.search.trim()
      ? query.search.trim()
      : typeof query.customerName === 'string' && query.customerName.trim()
        ? query.customerName.trim()
        : '';

  const searchFilter = buildChangeLogSearchFilter(tenantId, searchText);
  const createdRange = createdAtRangeFromQuery({
    datePreset: query.datePreset,
    month: query.month,
    day: query.day,
  });

  const andParts: Prisma.InquiryChangeLogWhereInput[] = [tenantChangeLogWhere(tenantId)];
  if (searchFilter) andParts.push(searchFilter);
  if (createdRange) {
    andParts.push({ createdAt: { gte: createdRange.gte, lte: createdRange.lte } });
  }

  const where: Prisma.InquiryChangeLogWhereInput = { AND: andParts };

  const [rows, total] = await Promise.all([
    prisma.inquiryChangeLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take,
      skip,
      include: logInclude,
    }),
    prisma.inquiryChangeLog.count({ where }),
  ]);

  const actorMap = await attachActorNames(rows);
  const items = rows.map((r) =>
    toChangeHistoryItemDto(r, r.actorId ? actorMap.get(r.actorId) ?? null : null),
  );
  return { items, total };
}

export async function fetchRecentInquiryChangeLogs(
  tenantId: string,
  limit: number,
): Promise<ReturnType<typeof toChangeHistoryItemDto>[]> {
  const take = Math.min(50, Math.max(1, limit));
  const rows = await prisma.inquiryChangeLog.findMany({
    where: tenantChangeLogWhere(tenantId),
    orderBy: { createdAt: 'desc' },
    take,
    include: logInclude,
  });
  const actorMap = await attachActorNames(rows);
  return rows.map((r) =>
    toChangeHistoryItemDto(r, r.actorId ? actorMap.get(r.actorId) ?? null : null),
  );
}
