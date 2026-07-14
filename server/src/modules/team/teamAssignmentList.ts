import type { Prisma, PrismaClient } from '@prisma/client';
import { InquiryStatus } from '@prisma/client';
import { createdAtRangeFromQuery, type DatePreset } from '../inquiries/inquiryListDateRange.js';
import { inquiryActiveOnlyWhere } from '../inquiries/inquiryTrash.helpers.js';

export type TeamAssignmentDateBasis = 'assignedAt' | 'createdAt' | 'preferredDate';

export type TeamAssignmentListQuery = {
  datePreset?: string;
  month?: string;
  day?: string;
  dateBasis?: string;
  status?: string;
  q?: string;
  limit?: number;
  offset?: number;
};

const VALID_STATUS = new Set<string>(Object.values(InquiryStatus));

export function parseTeamAssignmentDateBasis(raw: string | undefined): TeamAssignmentDateBasis {
  if (raw === 'createdAt' || raw === 'preferredDate') return raw;
  return 'assignedAt';
}

export function parseTeamAssignmentListQuery(query: Record<string, unknown>): TeamAssignmentListQuery {
  const limitRaw = typeof query.limit === 'string' ? parseInt(query.limit, 10) : NaN;
  const offsetRaw = typeof query.offset === 'string' ? parseInt(query.offset, 10) : 0;
  return {
    datePreset: typeof query.datePreset === 'string' ? query.datePreset.trim() : undefined,
    month: typeof query.month === 'string' ? query.month.trim() : undefined,
    day: typeof query.day === 'string' ? query.day.trim() : undefined,
    dateBasis: typeof query.dateBasis === 'string' ? query.dateBasis.trim() : undefined,
    status: typeof query.status === 'string' ? query.status.trim() : undefined,
    q: typeof query.q === 'string' ? query.q.trim() : undefined,
    limit: Number.isFinite(limitRaw) ? Math.min(100, Math.max(1, limitRaw)) : undefined,
    offset: Number.isFinite(offsetRaw) && offsetRaw >= 0 ? Math.floor(offsetRaw) : 0,
  };
}

function parseDatePreset(raw: string | undefined): DatePreset | 'all' {
  if (raw === 'today' || raw === 'month' || raw === 'day') return raw;
  return 'all';
}

function searchWhere(q: string): Prisma.InquiryWhereInput {
  const term = q.trim();
  if (!term) return {};
  return {
    OR: [
      { customerName: { contains: term, mode: 'insensitive' } },
      { customerPhone: { contains: term, mode: 'insensitive' } },
      { address: { contains: term, mode: 'insensitive' } },
      { addressDetail: { contains: term, mode: 'insensitive' } },
      { scheduleMemo: { contains: term, mode: 'insensitive' } },
      { inquiryNumber: { contains: term, mode: 'insensitive' } },
    ],
  };
}

function assignmentDateWhere(
  userId: string,
  range: { gte: Date; lte: Date } | null,
): Prisma.AssignmentWhereInput {
  if (!range) {
    return { teamLeaderId: userId };
  }
  return {
    teamLeaderId: userId,
    assignedAt: { gte: range.gte, lte: range.lte },
  };
}

function inquiryListWhere(
  userId: string,
  basis: TeamAssignmentDateBasis,
  range: { gte: Date; lte: Date } | null,
  status?: string,
  q?: string,
  extraInquiryWhere?: Prisma.InquiryWhereInput | null,
): Prisma.InquiryWhereInput {
  const parts: Prisma.InquiryWhereInput[] = [
    { assignments: { some: { teamLeaderId: userId } } },
    inquiryActiveOnlyWhere(),
  ];
  if (extraInquiryWhere) parts.push(extraInquiryWhere);
  if (status && VALID_STATUS.has(status)) {
    parts.push({ status: status as InquiryStatus });
  }
  if (q?.trim()) {
    parts.push(searchWhere(q));
  }
  if (range) {
    if (basis === 'createdAt') {
      parts.push({ createdAt: { gte: range.gte, lte: range.lte } });
    } else if (basis === 'preferredDate') {
      parts.push({
        preferredDate: { gte: range.gte, lte: range.lte },
      });
    }
  }
  return parts.length === 1 ? parts[0]! : { AND: parts };
}

/** 배정일 기준은 Assignment 행으로 페이징·정렬 */
export function shouldPaginateViaAssignment(basis: TeamAssignmentDateBasis): boolean {
  return basis === 'assignedAt';
}

export type TeamAssignmentListDeps = {
  teamInquiryInclude: Prisma.InquiryInclude;
  attachCrewMembers: <T extends { crewMemberNote: string | null }>(rows: T[]) => Promise<T[]>;
};

export async function listTeamAssignmentsPaginated(
  prisma: PrismaClient,
  userId: string,
  rawQuery: TeamAssignmentListQuery,
  deps: TeamAssignmentListDeps,
  extraInquiryWhere?: Prisma.InquiryWhereInput | null,
): Promise<{ items: Awaited<ReturnType<PrismaClient['inquiry']['findMany']>>; total: number }> {
  const basis = parseTeamAssignmentDateBasis(rawQuery.dateBasis);
  const preset = parseDatePreset(rawQuery.datePreset);
  const range =
    preset === 'all'
      ? null
      : createdAtRangeFromQuery({
          datePreset: preset,
          month: rawQuery.month,
          day: rawQuery.day,
        });
  const limit = rawQuery.limit ?? 30;
  const offset = rawQuery.offset ?? 0;
  const status = rawQuery.status?.trim() || undefined;
  const q = rawQuery.q?.trim() || undefined;

  if (shouldPaginateViaAssignment(basis)) {
    let assignmentWhere: Prisma.AssignmentWhereInput = assignmentDateWhere(userId, range);
    if (status && VALID_STATUS.has(status)) {
      assignmentWhere = {
        AND: [assignmentWhere, { inquiry: { status: status as InquiryStatus } }],
      };
    }
    if (q) {
      assignmentWhere = {
        AND: [assignmentWhere, { inquiry: searchWhere(q) }],
      };
    }
    if (extraInquiryWhere) {
      assignmentWhere = {
        AND: [assignmentWhere, { inquiry: extraInquiryWhere }],
      };
    }

    const [total, assignments] = await Promise.all([
      prisma.assignment.count({ where: assignmentWhere }),
      prisma.assignment.findMany({
        where: assignmentWhere,
        orderBy: [{ assignedAt: 'desc' }, { id: 'desc' }],
        skip: offset,
        take: limit,
        select: { inquiryId: true },
      }),
    ]);

    const ids = assignments.map((a) => a.inquiryId);
    if (ids.length === 0) {
      return { items: [], total };
    }

    const rows = await prisma.inquiry.findMany({
      where: { id: { in: ids } },
      include: deps.teamInquiryInclude,
    });
    const byId = new Map(rows.map((r) => [r.id, r]));
    const ordered = ids.map((id) => byId.get(id)).filter((r): r is NonNullable<typeof r> => r != null);
    const items = await deps.attachCrewMembers(ordered);
    return { items, total };
  }

  const where = inquiryListWhere(userId, basis, range, status, q, extraInquiryWhere);
  const orderBy: Prisma.InquiryOrderByWithRelationInput[] =
    basis === 'preferredDate'
      ? [{ preferredDate: 'asc' }, { preferredTime: 'asc' }, { id: 'asc' }]
      : [{ createdAt: 'desc' }, { id: 'desc' }];

  const [total, rows] = await Promise.all([
    prisma.inquiry.count({ where }),
    prisma.inquiry.findMany({
      where,
      orderBy,
      skip: offset,
      take: limit,
      include: deps.teamInquiryInclude,
    }),
  ]);
  const items = await deps.attachCrewMembers(rows);
  return { items, total };
}
