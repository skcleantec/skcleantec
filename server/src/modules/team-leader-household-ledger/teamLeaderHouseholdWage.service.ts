import type { Prisma, PrismaClient, TeamLeaderHouseholdWageMode as PrismaWageMode } from '@prisma/client';
import {
  TEAM_LEADER_HOUSEHOLD_DAILY_PAY_BASIS,
  TEAM_LEADER_HOUSEHOLD_WAGE_MODES,
  hiddenHouseholdPrefillKinds,
  householdWageDailyInquiryKey,
  householdWageDailyKey,
  householdWageMonthlyKey,
  type TeamLeaderHouseholdDailyPayBasis,
  type TeamLeaderHouseholdWageMode,
} from './teamLeaderHouseholdLedger.constants.js';
import { HouseholdLedgerValidationError } from './teamLeaderHouseholdLedger.errors.js';
import { parseOccurredOnYmd } from './teamLeaderHouseholdLedgerDateRange.js';
import { getEffectiveEnabledModules } from '../tenants/tenantFeatures.service.js';
import { isSoloOperatorTenant } from '../../lib/soloOperator.js';

export type HouseholdWageSettingDto = {
  wageMode: TeamLeaderHouseholdWageMode;
  balanceSharePercent: number;
  dailyAmountWon: number | null;
  monthlyAmountWon: number | null;
  dailyPayBasis: TeamLeaderHouseholdDailyPayBasis;
};

const DEFAULT_SETTING: HouseholdWageSettingDto = {
  wageMode: 'BALANCE_PCT',
  balanceSharePercent: 100,
  dailyAmountWon: null,
  monthlyAmountWon: null,
  dailyPayBasis: 'PER_DAY',
};

function parseSuppressedKeys(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((v): v is string => typeof v === 'string' && v.length > 0);
}

function serializeSetting(row: {
  wageMode: PrismaWageMode;
  balanceSharePercent: number;
  dailyAmountWon: number | null;
  monthlyAmountWon: number | null;
  dailyPayBasis: TeamLeaderHouseholdDailyPayBasis;
}): HouseholdWageSettingDto {
  return {
    wageMode: row.wageMode,
    balanceSharePercent: row.balanceSharePercent,
    dailyAmountWon: row.dailyAmountWon,
    monthlyAmountWon: row.monthlyAmountWon,
    dailyPayBasis: row.dailyPayBasis,
  };
}

export async function isHouseholdWageEditableByLeader(
  db: PrismaClient,
  tenantId: string,
): Promise<boolean> {
  const row = await db.tenant.findFirst({
    where: { id: tenantId },
    select: { teamLeaderHouseholdWageLeaderEditable: true },
  });
  return row?.teamLeaderHouseholdWageLeaderEditable !== false;
}

export async function setHouseholdWageEditableByLeader(
  db: PrismaClient,
  opts: { tenantId: string; leaderCanEdit: boolean },
): Promise<boolean> {
  const updated = await db.tenant.updateMany({
    where: { id: opts.tenantId },
    data: { teamLeaderHouseholdWageLeaderEditable: opts.leaderCanEdit },
  });
  if (updated.count !== 1) {
    throw new HouseholdLedgerValidationError('업체 설정을 저장하지 못했습니다.', 404);
  }
  return opts.leaderCanEdit;
}

export async function getHouseholdWageSetting(
  db: PrismaClient,
  opts: { tenantId: string; teamLeaderId: string },
): Promise<{ setting: HouseholdWageSettingDto; suppressedWageKeys: string[] }> {
  const row = await db.teamLeaderHouseholdWageSetting.findFirst({
    where: { tenantId: opts.tenantId, teamLeaderId: opts.teamLeaderId },
  });
  if (!row) return { setting: { ...DEFAULT_SETTING }, suppressedWageKeys: [] };
  return {
    setting: serializeSetting(row),
    suppressedWageKeys: parseSuppressedKeys(row.suppressedWageKeys),
  };
}

export async function upsertHouseholdWageSetting(
  db: PrismaClient,
  opts: {
    tenantId: string;
    teamLeaderId: string;
    body: Record<string, unknown>;
  },
): Promise<HouseholdWageSettingDto> {
  const wageMode = parseWageMode(opts.body.wageMode);
  const balanceSharePercent = parsePercent(opts.body.balanceSharePercent);
  const dailyAmountWon = parseOptionalWon(opts.body.dailyAmountWon);
  const monthlyAmountWon = parseOptionalWon(opts.body.monthlyAmountWon);
  const dailyPayBasis = parseDailyPayBasis(opts.body.dailyPayBasis);

  if (wageMode === 'DAILY' && (dailyAmountWon == null || dailyAmountWon < 1)) {
    throw new HouseholdLedgerValidationError('일급을 1원 이상 입력해 주세요.');
  }
  if (wageMode === 'MONTHLY' && (monthlyAmountWon == null || monthlyAmountWon < 1)) {
    throw new HouseholdLedgerValidationError('월급을 1원 이상 입력해 주세요.');
  }

  const existing = await db.teamLeaderHouseholdWageSetting.findFirst({
    where: { tenantId: opts.tenantId, teamLeaderId: opts.teamLeaderId },
    select: { id: true },
  });

  const data = {
    wageMode,
    balanceSharePercent,
    dailyAmountWon,
    monthlyAmountWon,
    dailyPayBasis,
    suppressedWageKeys: [],
  };

  const row = existing
    ? await db.teamLeaderHouseholdWageSetting.update({
        where: { id: existing.id },
        data,
      })
    : await db.teamLeaderHouseholdWageSetting.create({
        data: {
          tenantId: opts.tenantId,
          teamLeaderId: opts.teamLeaderId,
          ...data,
        },
      });

  await syncHouseholdWageEntries(db, {
    tenantId: opts.tenantId,
    teamLeaderId: opts.teamLeaderId,
    setting: serializeSetting(row),
    suppressedWageKeys: [],
  });

  return serializeSetting(row);
}

export async function suppressHouseholdWageKey(
  db: PrismaClient,
  opts: { tenantId: string; teamLeaderId: string; key: string },
): Promise<void> {
  const row = await db.teamLeaderHouseholdWageSetting.findFirst({
    where: { tenantId: opts.tenantId, teamLeaderId: opts.teamLeaderId },
    select: { id: true, suppressedWageKeys: true },
  });
  if (!row) return;
  const keys = new Set(parseSuppressedKeys(row.suppressedWageKeys));
  keys.add(opts.key);
  await db.teamLeaderHouseholdWageSetting.update({
    where: { id: row.id },
    data: { suppressedWageKeys: [...keys] },
  });
}

export async function syncHouseholdWageEntries(
  db: PrismaClient,
  opts: {
    tenantId: string;
    teamLeaderId: string;
    setting: HouseholdWageSettingDto;
    suppressedWageKeys: string[];
  },
): Promise<void> {
  const suppressed = new Set(opts.suppressedWageKeys);
  if (opts.setting.wageMode === 'DAILY') {
    await upsertDailyWageEntries(db, { ...opts, suppressed });
    return;
  }
  if (opts.setting.wageMode === 'MONTHLY') {
    await upsertMonthlyWageEntries(db, { ...opts, suppressed });
  }
}

type WorkJob = { inquiryId: string; ymd: string; customerName: string | null };

function ymdOfInquiry(inquiry: { preferredDate: Date | null; createdAt: Date }): string | null {
  const ymd = inquiry.preferredDate
    ? inquiry.preferredDate.toISOString().slice(0, 10)
    : inquiry.createdAt.toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(ymd) ? ymd : null;
}

async function listWorkJobs(
  db: PrismaClient,
  opts: { tenantId: string; teamLeaderId: string },
): Promise<WorkJob[]> {
  const subject = await db.user.findFirst({
    where: { id: opts.teamLeaderId, tenantId: opts.tenantId, isActive: true },
    select: { role: true },
  });
  if (subject?.role === 'ADMIN') {
    const enabled = await getEffectiveEnabledModules(opts.tenantId);
    if (isSoloOperatorTenant(enabled)) {
      const inquiries = await db.inquiry.findMany({
        where: {
          tenantId: opts.tenantId,
          deletedAt: null,
          status: { notIn: ['CANCELLED', 'ON_HOLD'] },
          assignments: { none: {} },
        },
        select: { id: true, preferredDate: true, createdAt: true, customerName: true },
      });
      const jobs: WorkJob[] = [];
      for (const inquiry of inquiries) {
        const ymd = ymdOfInquiry(inquiry);
        if (!ymd) continue;
        jobs.push({
          inquiryId: inquiry.id,
          ymd,
          customerName: inquiry.customerName?.trim() || null,
        });
      }
      return jobs.sort((a, b) => a.ymd.localeCompare(b.ymd) || a.inquiryId.localeCompare(b.inquiryId));
    }
  }

  const assignments = await db.assignment.findMany({
    where: {
      tenantId: opts.tenantId,
      teamLeaderId: opts.teamLeaderId,
      teamLeader: { role: 'TEAM_LEADER', tenantId: opts.tenantId },
      inquiry: {
        deletedAt: null,
        status: { notIn: ['CANCELLED', 'ON_HOLD'] },
      },
    },
    select: {
      inquiryId: true,
      inquiry: { select: { preferredDate: true, createdAt: true, customerName: true } },
    },
  });

  const byInquiry = new Map<string, WorkJob>();
  for (const row of assignments) {
    if (byInquiry.has(row.inquiryId)) continue;
    const ymd = ymdOfInquiry(row.inquiry);
    if (!ymd) continue;
    byInquiry.set(row.inquiryId, {
      inquiryId: row.inquiryId,
      ymd,
      customerName: row.inquiry.customerName?.trim() || null,
    });
  }
  return [...byInquiry.values()].sort(
    (a, b) => a.ymd.localeCompare(b.ymd) || a.inquiryId.localeCompare(b.inquiryId),
  );
}

function ymdKey(occurredOn: Date): string {
  return occurredOn.toISOString().slice(0, 10);
}

async function upsertDailyWageEntries(
  db: PrismaClient,
  opts: {
    tenantId: string;
    teamLeaderId: string;
    setting: HouseholdWageSettingDto;
    suppressed: Set<string>;
  },
): Promise<void> {
  const amount = opts.setting.dailyAmountWon;
  if (amount == null || amount < 1) return;

  const jobs = await listWorkJobs(db, opts);
  if (opts.setting.dailyPayBasis === 'PER_INQUIRY') {
    await upsertDailyWagePerInquiry(db, { ...opts, amount, jobs });
    return;
  }
  await upsertDailyWagePerDay(db, { ...opts, amount, jobs });
}

async function deleteUnlockedWageDaily(
  db: PrismaClient,
  opts: { tenantId: string; teamLeaderId: string; id: string },
): Promise<void> {
  await db.teamLeaderHouseholdLedgerEntry.deleteMany({
    where: {
      id: opts.id,
      tenantId: opts.tenantId,
      teamLeaderId: opts.teamLeaderId,
      amountLocked: false,
      prefillKind: 'wage_daily',
    },
  });
}

async function upsertDailyWagePerDay(
  db: PrismaClient,
  opts: {
    tenantId: string;
    teamLeaderId: string;
    amount: number;
    jobs: WorkJob[];
    suppressed: Set<string>;
  },
): Promise<void> {
  const workYmds = [...new Set(opts.jobs.map((job) => job.ymd))].sort();
  const workSet = new Set(workYmds);
  const existing = await db.teamLeaderHouseholdLedgerEntry.findMany({
    where: {
      tenantId: opts.tenantId,
      teamLeaderId: opts.teamLeaderId,
      prefillKind: 'wage_daily',
    },
    select: { id: true, occurredOn: true, amountLocked: true, inquiryId: true },
  });

  const lockedYmds = new Set<string>();
  const kept = new Map<string, (typeof existing)[number]>();
  for (const row of existing) {
    const ymd = ymdKey(row.occurredOn);
    if (row.amountLocked) {
      lockedYmds.add(ymd);
      continue;
    }
    const keep =
      row.inquiryId == null && workSet.has(ymd) && !opts.suppressed.has(householdWageDailyKey(ymd));
    if (!keep || kept.has(ymd)) {
      await deleteUnlockedWageDaily(db, { ...opts, id: row.id });
      continue;
    }
    kept.set(ymd, row);
  }

  for (const ymd of workYmds) {
    if (opts.suppressed.has(householdWageDailyKey(ymd)) || lockedYmds.has(ymd)) continue;
    const occurredOn = parseOccurredOnYmd(ymd);
    if (!occurredOn) continue;
    const found = kept.get(ymd);
    const data = {
      amount: opts.amount,
      category: '일당',
      direction: 'INCOME' as const,
      memo: `일당 · ${ymd}`,
      inquiryId: null,
      occurredOn,
    };
    if (found) {
      await db.teamLeaderHouseholdLedgerEntry.updateMany({
        where: { id: found.id, tenantId: opts.tenantId, teamLeaderId: opts.teamLeaderId, amountLocked: false },
        data,
      });
      continue;
    }
    await db.teamLeaderHouseholdLedgerEntry.create({
      data: {
        tenantId: opts.tenantId,
        teamLeaderId: opts.teamLeaderId,
        ...data,
        prefillKind: 'wage_daily',
      },
    });
  }
}

async function upsertDailyWagePerInquiry(
  db: PrismaClient,
  opts: {
    tenantId: string;
    teamLeaderId: string;
    amount: number;
    jobs: WorkJob[];
    suppressed: Set<string>;
  },
): Promise<void> {
  const jobById = new Map(opts.jobs.map((job) => [job.inquiryId, job]));
  const existing = await db.teamLeaderHouseholdLedgerEntry.findMany({
    where: {
      tenantId: opts.tenantId,
      teamLeaderId: opts.teamLeaderId,
      prefillKind: 'wage_daily',
    },
    select: { id: true, occurredOn: true, amountLocked: true, inquiryId: true },
  });

  const lockedInquiryIds = new Set<string>();
  const kept = new Map<string, (typeof existing)[number]>();
  for (const row of existing) {
    if (row.amountLocked) {
      if (row.inquiryId) lockedInquiryIds.add(row.inquiryId);
      continue;
    }
    const job = row.inquiryId ? jobById.get(row.inquiryId) : undefined;
    const keep = Boolean(job) && !opts.suppressed.has(householdWageDailyInquiryKey(row.inquiryId!));
    if (!keep || (row.inquiryId && kept.has(row.inquiryId))) {
      await deleteUnlockedWageDaily(db, { ...opts, id: row.id });
      continue;
    }
    if (row.inquiryId) kept.set(row.inquiryId, row);
  }

  for (const job of opts.jobs) {
    if (opts.suppressed.has(householdWageDailyInquiryKey(job.inquiryId)) || lockedInquiryIds.has(job.inquiryId)) {
      continue;
    }
    const occurredOn = parseOccurredOnYmd(job.ymd);
    if (!occurredOn) continue;
    const who = job.customerName ? job.customerName.slice(0, 40) : '현장';
    const data = {
      amount: opts.amount,
      category: '일당',
      direction: 'INCOME' as const,
      memo: `일당 · ${who} · ${job.ymd}`,
      inquiryId: job.inquiryId,
      occurredOn,
    };
    const found = kept.get(job.inquiryId);
    if (found) {
      await db.teamLeaderHouseholdLedgerEntry.updateMany({
        where: { id: found.id, tenantId: opts.tenantId, teamLeaderId: opts.teamLeaderId, amountLocked: false },
        data,
      });
      continue;
    }
    await db.teamLeaderHouseholdLedgerEntry.create({
      data: {
        tenantId: opts.tenantId,
        teamLeaderId: opts.teamLeaderId,
        ...data,
        prefillKind: 'wage_daily',
      },
    });
  }
}

async function upsertMonthlyWageEntries(
  db: PrismaClient,
  opts: {
    tenantId: string;
    teamLeaderId: string;
    setting: HouseholdWageSettingDto;
    suppressed: Set<string>;
  },
): Promise<void> {
  const amount = opts.setting.monthlyAmountWon;
  if (amount == null || amount < 1) return;

  const workYmds = [...new Set((await listWorkJobs(db, opts)).map((job) => job.ymd))].sort();
  const months = new Set(workYmds.map((ymd) => ymd.slice(0, 7)));
  const thisMonth = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 7);
  months.add(thisMonth);

  const existing = await db.teamLeaderHouseholdLedgerEntry.findMany({
    where: {
      tenantId: opts.tenantId,
      teamLeaderId: opts.teamLeaderId,
      prefillKind: 'wage_monthly',
    },
    select: { id: true, occurredOn: true, amountLocked: true },
  });

  for (const row of existing) {
    const ym = row.occurredOn.toISOString().slice(0, 7);
    if (months.has(ym) || row.amountLocked) continue;
    await db.teamLeaderHouseholdLedgerEntry.delete({ where: { id: row.id } });
  }

  for (const ym of months) {
    if (opts.suppressed.has(householdWageMonthlyKey(ym))) continue;
    const occurredOn = parseOccurredOnYmd(`${ym}-01`);
    if (!occurredOn) continue;
    const found = existing.find((row) => row.occurredOn.toISOString().slice(0, 7) === ym);
    if (found) {
      if (found.amountLocked) continue;
      await db.teamLeaderHouseholdLedgerEntry.update({
        where: { id: found.id },
        data: { amount, category: '월급', direction: 'INCOME', memo: `월급 · ${ym}` },
      });
      continue;
    }
    await db.teamLeaderHouseholdLedgerEntry.create({
      data: {
        tenantId: opts.tenantId,
        teamLeaderId: opts.teamLeaderId,
        direction: 'INCOME',
        occurredOn,
        category: '월급',
        amount,
        memo: `월급 · ${ym}`,
        prefillKind: 'wage_monthly',
      },
    });
  }
}

function parseDailyPayBasis(raw: unknown): TeamLeaderHouseholdDailyPayBasis {
  if (raw == null || raw === '') return 'PER_DAY';
  if (typeof raw === 'string' && (TEAM_LEADER_HOUSEHOLD_DAILY_PAY_BASIS as readonly string[]).includes(raw)) {
    return raw as TeamLeaderHouseholdDailyPayBasis;
  }
  throw new HouseholdLedgerValidationError('일당은 건마다 또는 하루 통합으로 선택해 주세요.');
}

function parseWageMode(raw: unknown): TeamLeaderHouseholdWageMode {
  if (typeof raw === 'string' && (TEAM_LEADER_HOUSEHOLD_WAGE_MODES as readonly string[]).includes(raw)) {
    return raw as TeamLeaderHouseholdWageMode;
  }
  throw new HouseholdLedgerValidationError('임금 방식을 선택해 주세요.');
}

function parsePercent(raw: unknown): number {
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN;
  if (!Number.isInteger(n) || n < 1 || n > 100) {
    throw new HouseholdLedgerValidationError('잔금 비율은 1~100%로 입력해 주세요.');
  }
  return n;
}

function parseOptionalWon(raw: unknown): number | null {
  if (raw == null || raw === '') return null;
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN;
  if (!Number.isInteger(n) || n < 0) {
    throw new HouseholdLedgerValidationError('금액은 정수로 입력해 주세요.');
  }
  return n;
}

export async function listAdminHouseholdWageOverview(
  db: PrismaClient,
  tenantId: string,
): Promise<{
  leaderCanEdit: boolean;
  items: Array<{
    teamLeader: { id: string; name: string | null; email: string | null };
    setting: HouseholdWageSettingDto;
  }>;
}> {
  const [leaderCanEdit, leaders, rows] = await Promise.all([
    isHouseholdWageEditableByLeader(db, tenantId),
    db.user.findMany({
      where: { tenantId, role: 'TEAM_LEADER', isActive: true },
      select: { id: true, name: true, email: true },
      orderBy: [{ name: 'asc' }, { email: 'asc' }],
    }),
    db.teamLeaderHouseholdWageSetting.findMany({
      where: { tenantId },
    }),
  ]);
  const byLeader = new Map(rows.map((row) => [row.teamLeaderId, row]));
  return {
    leaderCanEdit,
    items: leaders.map((leader) => {
      const row = byLeader.get(leader.id);
      return {
        teamLeader: leader,
        setting: row ? serializeSetting(row) : { ...DEFAULT_SETTING },
      };
    }),
  };
}

export function listWhereHidingWageKinds(
  mode: TeamLeaderHouseholdWageMode,
): Prisma.TeamLeaderHouseholdLedgerEntryWhereInput {
  const hidden = hiddenHouseholdPrefillKinds(mode);
  const visibleKind: Prisma.TeamLeaderHouseholdLedgerEntryWhereInput = {
    OR: [{ prefillKind: null }, { prefillKind: { notIn: hidden } }],
  };
  if (mode === 'DAILY' || mode === 'MONTHLY') {
    return { AND: [visibleKind, { category: { not: '잔금' } }] };
  }
  return visibleKind;
}
