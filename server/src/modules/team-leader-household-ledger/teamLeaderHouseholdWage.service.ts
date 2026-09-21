import type { Prisma, PrismaClient, TeamLeaderHouseholdWageMode as PrismaWageMode } from '@prisma/client';
import {
  TEAM_LEADER_HOUSEHOLD_WAGE_MODES,
  hiddenHouseholdPrefillKinds,
  householdWageDailyKey,
  householdWageMonthlyKey,
  type TeamLeaderHouseholdWageMode,
} from './teamLeaderHouseholdLedger.constants.js';
import { HouseholdLedgerValidationError } from './teamLeaderHouseholdLedger.errors.js';
import { parseOccurredOnYmd } from './teamLeaderHouseholdLedgerDateRange.js';

export type HouseholdWageSettingDto = {
  wageMode: TeamLeaderHouseholdWageMode;
  balanceSharePercent: number;
  dailyAmountWon: number | null;
  monthlyAmountWon: number | null;
};

const DEFAULT_SETTING: HouseholdWageSettingDto = {
  wageMode: 'BALANCE_PCT',
  balanceSharePercent: 100,
  dailyAmountWon: null,
  monthlyAmountWon: null,
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
}): HouseholdWageSettingDto {
  return {
    wageMode: row.wageMode,
    balanceSharePercent: row.balanceSharePercent,
    dailyAmountWon: row.dailyAmountWon,
    monthlyAmountWon: row.monthlyAmountWon,
  };
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

async function listWorkYmds(
  db: PrismaClient,
  opts: { tenantId: string; teamLeaderId: string },
): Promise<string[]> {
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
      inquiry: { select: { preferredDate: true, createdAt: true } },
    },
  });

  const ymds = new Set<string>();
  for (const row of assignments) {
    const ymd = row.inquiry.preferredDate
      ? row.inquiry.preferredDate.toISOString().slice(0, 10)
      : row.inquiry.createdAt.toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(ymd)) ymds.add(ymd);
  }
  return [...ymds].sort();
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

  const workYmds = await listWorkYmds(db, opts);
  const workSet = new Set(workYmds);
  const existing = await db.teamLeaderHouseholdLedgerEntry.findMany({
    where: {
      tenantId: opts.tenantId,
      teamLeaderId: opts.teamLeaderId,
      prefillKind: 'wage_daily',
    },
    select: { id: true, occurredOn: true, amountLocked: true },
  });

  for (const row of existing) {
    const ymd = row.occurredOn.toISOString().slice(0, 10);
    if (workSet.has(ymd) || row.amountLocked) continue;
    await db.teamLeaderHouseholdLedgerEntry.delete({ where: { id: row.id } });
  }

  for (const ymd of workYmds) {
    if (opts.suppressed.has(householdWageDailyKey(ymd))) continue;
    const occurredOn = parseOccurredOnYmd(ymd);
    if (!occurredOn) continue;
    const found = existing.find((row) => row.occurredOn.toISOString().slice(0, 10) === ymd);
    if (found) {
      if (found.amountLocked) continue;
      await db.teamLeaderHouseholdLedgerEntry.update({
        where: { id: found.id },
        data: { amount, category: '일당', direction: 'INCOME', memo: `일당 · ${ymd}` },
      });
      continue;
    }
    await db.teamLeaderHouseholdLedgerEntry.create({
      data: {
        tenantId: opts.tenantId,
        teamLeaderId: opts.teamLeaderId,
        direction: 'INCOME',
        occurredOn,
        category: '일당',
        amount,
        memo: `일당 · ${ymd}`,
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

  const workYmds = await listWorkYmds(db, opts);
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
