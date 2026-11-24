/** 입금 알림 설정·직접 추가·삭제 뒤 재수신. DB 없이 판정한다. */

import { isOpenBalanceDeposit } from './bankDepositTeam.logic.js';

const INTERVALS = new Set([10, 20, 30, 60]);
const MAX_HOURS = new Set([3, 6, 12, 24, 48]);
const DAY_MS = 24 * 60 * 60 * 1000;

export type DepositAmountsMode = 'auto' | 'manual';

export type BankDepositSettingsShape = {
  teamOpenAlertEnabled: boolean;
  teamBalanceAlertEnabled: boolean;
  teamAlertMinAmountWon: number;
  teamReminderIntervalMin: number;
  teamAlertStartHour: number;
  teamAlertEndHour: number;
  teamReminderMaxHours: number;
  depositAmountsMode: DepositAmountsMode;
  depositAmountsWon: number[];
  staffToastEnabled: boolean;
  skipDayOffLeaders: boolean;
};

export const DEFAULT_BANK_DEPOSIT_SETTINGS: BankDepositSettingsShape = {
  teamOpenAlertEnabled: true,
  teamBalanceAlertEnabled: true,
  teamAlertMinAmountWon: 50000,
  teamReminderIntervalMin: 10,
  teamAlertStartHour: 8,
  teamAlertEndHour: 21,
  teamReminderMaxHours: 48,
  depositAmountsMode: 'auto',
  depositAmountsWon: [],
  staffToastEnabled: true,
  skipDayOffLeaders: true,
};

function asInt(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) ? value : null;
}

function cleanAmounts(value: unknown): number[] | null {
  if (!Array.isArray(value)) return null;
  const out: number[] = [];
  for (const item of value) {
    const n = asInt(item);
    if (n == null || n < 1 || n > 100_000_000) return null;
    if (!out.includes(n)) out.push(n);
  }
  return out;
}

/** 일부 필드만 와도 된다. 벗어난 값은 사람이 읽는 이유. */
export function applySettingsPatch(
  current: BankDepositSettingsShape,
  patch: Record<string, unknown>,
): { ok: true; settings: BankDepositSettingsShape } | { ok: false; error: string } {
  const next: BankDepositSettingsShape = { ...current, depositAmountsWon: [...current.depositAmountsWon] };
  if ('teamOpenAlertEnabled' in patch) {
    if (typeof patch.teamOpenAlertEnabled !== 'boolean') return { ok: false, error: '주인 없는 입금 알림은 켜기 또는 끄기로 보내 주세요.' };
    next.teamOpenAlertEnabled = patch.teamOpenAlertEnabled;
  }
  if ('teamBalanceAlertEnabled' in patch) {
    if (typeof patch.teamBalanceAlertEnabled !== 'boolean') return { ok: false, error: '잔금 알림은 켜기 또는 끄기로 보내 주세요.' };
    next.teamBalanceAlertEnabled = patch.teamBalanceAlertEnabled;
  }
  if ('staffToastEnabled' in patch) {
    if (typeof patch.staffToastEnabled !== 'boolean') return { ok: false, error: '사무실 화면 알림은 켜기 또는 끄기로 보내 주세요.' };
    next.staffToastEnabled = patch.staffToastEnabled;
  }
  if ('skipDayOffLeaders' in patch) {
    if (typeof patch.skipDayOffLeaders !== 'boolean') return { ok: false, error: '휴무 팀장 제외는 켜기 또는 끄기로 보내 주세요.' };
    next.skipDayOffLeaders = patch.skipDayOffLeaders;
  }
  if ('teamAlertMinAmountWon' in patch) {
    const n = asInt(patch.teamAlertMinAmountWon);
    if (n == null || n < 0 || n > 100_000_000) return { ok: false, error: '최소 금액은 0원부터 1억원까지예요.' };
    next.teamAlertMinAmountWon = n;
  }
  if ('teamReminderIntervalMin' in patch) {
    const n = asInt(patch.teamReminderIntervalMin);
    if (n == null || !INTERVALS.has(n)) return { ok: false, error: '다시 알리는 간격은 10분, 20분, 30분, 60분 중 하나예요.' };
    next.teamReminderIntervalMin = n;
  }
  if ('teamAlertStartHour' in patch || 'teamAlertEndHour' in patch) {
    const start = 'teamAlertStartHour' in patch ? asInt(patch.teamAlertStartHour) : next.teamAlertStartHour;
    const end = 'teamAlertEndHour' in patch ? asInt(patch.teamAlertEndHour) : next.teamAlertEndHour;
    if (start == null || end == null || start < 0 || start > 24 || end < 0 || end > 24 || start >= end) {
      return { ok: false, error: '알림 시간은 0시부터 24시 사이이고, 시작이 끝보다 빨라야 해요.' };
    }
    next.teamAlertStartHour = start;
    next.teamAlertEndHour = end;
  }
  if ('teamReminderMaxHours' in patch) {
    const n = asInt(patch.teamReminderMaxHours);
    if (n == null || !MAX_HOURS.has(n)) return { ok: false, error: '다시 알리는 기간은 3, 6, 12, 24, 48시간 중 하나예요.' };
    next.teamReminderMaxHours = n;
  }
  if ('depositAmountsMode' in patch) {
    if (patch.depositAmountsMode !== 'auto' && patch.depositAmountsMode !== 'manual') {
      return { ok: false, error: '계약금 금액은 자동 또는 직접 정하기만 가능해요.' };
    }
    next.depositAmountsMode = patch.depositAmountsMode;
  }
  if ('depositAmountsWon' in patch) {
    const amounts = cleanAmounts(patch.depositAmountsWon);
    if (!amounts || amounts.length > 10) return { ok: false, error: '계약금 금액은 1원부터 1억원까지, 10개 이하로 넣어 주세요.' };
    next.depositAmountsWon = amounts;
  }
  if (next.depositAmountsMode === 'manual' && next.depositAmountsWon.length < 1) {
    return { ok: false, error: '직접 정하면 계약금 금액을 1개 이상 넣어 주세요.' };
  }
  return { ok: true, settings: next };
}

export function withinAlertHours(now: Date, startHour: number, endHour: number, hour = 0): boolean {
  return hour >= startHour && hour < endHour;
}

/** 팀장에게 묻는 대상. 시간대는 보지 않는다. 시간 밖이면 알림만 다음 시작으로 미룬다. */
export function isTeamAskDeposit(input: {
  status: string;
  amountWon: number;
  depositedAt: Date;
  now: Date;
  settings: BankDepositSettingsShape;
  contractAmounts: Set<number>;
  stopped: boolean;
  noOwner: boolean;
}): boolean {
  if (input.status !== 'NEEDS_REVIEW' || input.stopped || input.noOwner) return false;
  if (!input.settings.teamOpenAlertEnabled) return false;
  if (input.amountWon < input.settings.teamAlertMinAmountWon) return false;
  if (!isOpenBalanceDeposit(input.amountWon, input.contractAmounts)) return false;
  const maxMs = input.settings.teamReminderMaxHours * 60 * 60 * 1000;
  return input.now.getTime() - input.depositedAt.getTime() < maxMs;
}

export function openAlertDrift(input: { wasAsked: boolean; nowAsked: boolean; wasNotified: boolean; stopped: boolean; noOwner: boolean }): 'resolve' | 'reopen' | 'keep' {
  if (input.noOwner) return 'keep';
  if (input.wasAsked && input.wasNotified && !input.nowAsked && !input.stopped) return 'resolve';
  if (!input.wasAsked && input.nowAsked && input.stopped) return 'reopen';
  return 'keep';
}

export function manualDepositProblems(input: {
  amountWon: number;
  depositorName: string;
  depositedAt: Date;
  now: Date;
}): string | null {
  if (!Number.isInteger(input.amountWon) || input.amountWon < 1 || input.amountWon > 100_000_000) {
    return '금액은 1원부터 1억원까지예요.';
  }
  const name = input.depositorName.trim();
  if (name.length < 1 || name.length > 40) return '입금자명은 1자부터 40자까지예요.';
  if (Number.isNaN(input.depositedAt.getTime())) return '입금 시각이 올바르지 않아요.';
  if (input.depositedAt.getTime() > input.now.getTime() + 2 * 60 * 1000) return '입금 시각은 지금보다 뒤일 수 없어요.';
  if (input.now.getTime() - input.depositedAt.getTime() > 60 * DAY_MS) return '입금 시각은 최근 60일 안이어야 해요.';
  return null;
}

/** 지운 문자의 재수신은 막는다. 사람이 직접 넣는 입금은 막지 않는다. */
export function tombstoneBlocks(source: string, matched: boolean): boolean {
  if (source === 'manual') return false;
  return matched;
}
