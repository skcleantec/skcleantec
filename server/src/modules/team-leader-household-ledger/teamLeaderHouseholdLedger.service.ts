import type { Prisma, TeamLeaderHouseholdLedgerDirection } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import {
  TEAM_LEADER_HOUSEHOLD_EXPENSE_CATEGORIES,
  TEAM_LEADER_HOUSEHOLD_INCOME_CATEGORIES,
} from './teamLeaderHouseholdLedger.constants.js';
import {
  householdLedgerRangeFromQuery,
  parseHouseholdLedgerPaging,
  parseOccurredOnYmd,
} from './teamLeaderHouseholdLedgerDateRange.js';
import {
  isAllowedHouseholdCategory,
  serializeHouseholdLedgerEntry,
} from './teamLeaderHouseholdLedger.serialize.js';
import { assertTeamLeaderCanAccessInquiry } from './teamLeaderHouseholdLedgerPrefill.service.js';

const entryInclude = {
  inquiry: { select: { inquiryNumber: true, customerName: true } },
} as const;

export async function listHouseholdLedgerEntries(
  db: typeof prisma,
  opts: {
    tenantId: string;
    teamLeaderId: string;
    query: Record<string, unknown>;
  },
) {
  const range = householdLedgerRangeFromQuery({
    datePreset: typeof opts.query.datePreset === 'string' ? opts.query.datePreset : undefined,
    month: typeof opts.query.month === 'string' ? opts.query.month : undefined,
    day: typeof opts.query.day === 'string' ? opts.query.day : undefined,
  });
  const { limit, offset } = parseHouseholdLedgerPaging(opts.query);

  const where: Prisma.TeamLeaderHouseholdLedgerEntryWhereInput = {
    tenantId: opts.tenantId,
    teamLeaderId: opts.teamLeaderId,
    occurredOn: { gte: range.gte, lte: range.lte },
  };

  const [items, total, incomeAgg, expenseAgg] = await Promise.all([
    db.teamLeaderHouseholdLedgerEntry.findMany({
      where,
      include: entryInclude,
      orderBy: [{ occurredOn: 'desc' }, { createdAt: 'desc' }],
      take: limit,
      skip: offset,
    }),
    db.teamLeaderHouseholdLedgerEntry.count({ where }),
    db.teamLeaderHouseholdLedgerEntry.aggregate({
      where: { ...where, direction: 'INCOME' },
      _sum: { amount: true },
    }),
    db.teamLeaderHouseholdLedgerEntry.aggregate({
      where: { ...where, direction: 'EXPENSE' },
      _sum: { amount: true },
    }),
  ]);

  const incomeTotal = incomeAgg._sum.amount ?? 0;
  const expenseTotal = expenseAgg._sum.amount ?? 0;

  return {
    range: { loYmd: range.loYmd, hiYmd: range.hiYmd },
    summary: {
      incomeTotal,
      expenseTotal,
      netTotal: incomeTotal - expenseTotal,
    },
    items: items.map(serializeHouseholdLedgerEntry),
    total,
    limit,
    offset,
  };
}

export async function createHouseholdLedgerEntry(
  db: typeof prisma,
  opts: {
    tenantId: string;
    teamLeaderId: string;
    body: Record<string, unknown>;
  },
) {
  const direction = parseDirection(opts.body.direction);
  const category = typeof opts.body.category === 'string' ? opts.body.category.trim() : '';
  const amount = parseAmount(opts.body.amount);
  const occurredOn = parseOccurredOnYmd(opts.body.occurredOn) ?? new Date();
  const memo = typeof opts.body.memo === 'string' ? opts.body.memo.trim() || null : null;
  const inquiryId =
    typeof opts.body.inquiryId === 'string' && opts.body.inquiryId.trim()
      ? opts.body.inquiryId.trim()
      : null;
  const prefillKind =
    typeof opts.body.prefillKind === 'string' && opts.body.prefillKind.trim()
      ? opts.body.prefillKind.trim().slice(0, 32)
      : null;

  if (!isAllowedHouseholdCategory(direction, category)) {
    throw new HouseholdLedgerValidationError('카테고리를 확인해 주세요.');
  }

  if (inquiryId) {
    await assertTeamLeaderCanAccessInquiry(db, opts.tenantId, opts.teamLeaderId, inquiryId);
  }

  const created = await db.teamLeaderHouseholdLedgerEntry.create({
    data: {
      tenantId: opts.tenantId,
      teamLeaderId: opts.teamLeaderId,
      direction,
      occurredOn,
      category,
      amount,
      memo,
      inquiryId,
      prefillKind,
    },
    include: entryInclude,
  });

  return serializeHouseholdLedgerEntry(created);
}

export async function updateHouseholdLedgerEntry(
  db: typeof prisma,
  opts: {
    tenantId: string;
    teamLeaderId: string;
    entryId: string;
    body: Record<string, unknown>;
  },
) {
  const existing = await db.teamLeaderHouseholdLedgerEntry.findFirst({
    where: { id: opts.entryId, tenantId: opts.tenantId, teamLeaderId: opts.teamLeaderId },
  });
  if (!existing) throw new HouseholdLedgerValidationError('항목을 찾을 수 없습니다.', 404);

  const direction = opts.body.direction != null ? parseDirection(opts.body.direction) : existing.direction;
  const category =
    typeof opts.body.category === 'string' ? opts.body.category.trim() : existing.category;
  const amount = opts.body.amount != null ? parseAmount(opts.body.amount) : existing.amount;
  const occurredOn =
    opts.body.occurredOn != null
      ? (parseOccurredOnYmd(opts.body.occurredOn) ?? existing.occurredOn)
      : existing.occurredOn;
  const memo =
    opts.body.memo !== undefined
      ? typeof opts.body.memo === 'string'
        ? opts.body.memo.trim() || null
        : null
      : existing.memo;
  const inquiryId =
    opts.body.inquiryId !== undefined
      ? typeof opts.body.inquiryId === 'string' && opts.body.inquiryId.trim()
        ? opts.body.inquiryId.trim()
        : null
      : existing.inquiryId;

  if (!isAllowedHouseholdCategory(direction, category)) {
    throw new HouseholdLedgerValidationError('카테고리를 확인해 주세요.');
  }
  if (inquiryId) {
    await assertTeamLeaderCanAccessInquiry(db, opts.tenantId, opts.teamLeaderId, inquiryId);
  }

  const updated = await db.teamLeaderHouseholdLedgerEntry.update({
    where: { id: existing.id },
    data: { direction, category, amount, occurredOn, memo, inquiryId },
    include: entryInclude,
  });
  return serializeHouseholdLedgerEntry(updated);
}

export async function deleteHouseholdLedgerEntry(
  db: typeof prisma,
  opts: { tenantId: string; teamLeaderId: string; entryId: string },
) {
  const existing = await db.teamLeaderHouseholdLedgerEntry.findFirst({
    where: { id: opts.entryId, tenantId: opts.tenantId, teamLeaderId: opts.teamLeaderId },
    select: { id: true },
  });
  if (!existing) throw new HouseholdLedgerValidationError('항목을 찾을 수 없습니다.', 404);
  await db.teamLeaderHouseholdLedgerEntry.delete({ where: { id: existing.id } });
}

export function householdLedgerCategoriesResponse() {
  return {
    income: [...TEAM_LEADER_HOUSEHOLD_INCOME_CATEGORIES],
    expense: [...TEAM_LEADER_HOUSEHOLD_EXPENSE_CATEGORIES],
  };
}

export class HouseholdLedgerValidationError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = 'HouseholdLedgerValidationError';
  }
}

function parseDirection(raw: unknown): TeamLeaderHouseholdLedgerDirection {
  if (raw === 'INCOME' || raw === 'EXPENSE') return raw;
  throw new HouseholdLedgerValidationError('수입·지출 구분을 선택해 주세요.');
}

function parseAmount(raw: unknown): number {
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN;
  if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) {
    throw new HouseholdLedgerValidationError('금액은 1원 이상 정수로 입력해 주세요.');
  }
  return n;
}
