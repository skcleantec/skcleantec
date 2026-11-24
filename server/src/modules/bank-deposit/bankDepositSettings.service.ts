import { Prisma, type PrismaClient } from '@prisma/client';
import {
  applySettingsPatch,
  DEFAULT_BANK_DEPOSIT_SETTINGS,
  type BankDepositSettingsShape,
} from './bankDepositSettings.logic.js';

type Db = PrismaClient | Prisma.TransactionClient;

function amountsOf(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is number => typeof item === 'number' && Number.isInteger(item) && item > 0);
}

function toShape(row: {
  teamOpenAlertEnabled: boolean;
  teamBalanceAlertEnabled: boolean;
  teamAlertMinAmountWon: number;
  teamReminderIntervalMin: number;
  teamAlertStartHour: number;
  teamAlertEndHour: number;
  teamReminderMaxHours: number;
  depositAmountsMode: string;
  depositAmountsWon: unknown;
  staffToastEnabled: boolean;
  skipDayOffLeaders: boolean;
}): BankDepositSettingsShape {
  return {
    teamOpenAlertEnabled: row.teamOpenAlertEnabled,
    teamBalanceAlertEnabled: row.teamBalanceAlertEnabled,
    teamAlertMinAmountWon: row.teamAlertMinAmountWon,
    teamReminderIntervalMin: row.teamReminderIntervalMin,
    teamAlertStartHour: row.teamAlertStartHour,
    teamAlertEndHour: row.teamAlertEndHour,
    teamReminderMaxHours: row.teamReminderMaxHours,
    depositAmountsMode: row.depositAmountsMode === 'manual' ? 'manual' : 'auto',
    depositAmountsWon: amountsOf(row.depositAmountsWon),
    staffToastEnabled: row.staffToastEnabled,
    skipDayOffLeaders: row.skipDayOffLeaders,
  };
}

export async function readBankDepositSettings(db: Db, tenantId: string): Promise<BankDepositSettingsShape> {
  const row = await db.bankDepositSettings.findFirst({ where: { tenantId } });
  return row ? toShape(row) : { ...DEFAULT_BANK_DEPOSIT_SETTINGS, depositAmountsWon: [] };
}

export async function saveBankDepositSettings(db: Db, tenantId: string, patch: Record<string, unknown>) {
  const current = await readBankDepositSettings(db, tenantId);
  const applied = applySettingsPatch(current, patch);
  if (!applied.ok) return applied;
  const data = {
    ...applied.settings,
    depositAmountsWon: applied.settings.depositAmountsWon,
  };
  await db.bankDepositSettings.upsert({
    where: { tenantId },
    create: { tenantId, ...data },
    update: data,
  });
  return { ok: true as const, before: current, settings: applied.settings };
}

export type { BankDepositSettingsShape };
