/** 팀장 입금 알림·주인 없는 잔금·회사 입금 대기. DB 없이 판정한다. */

import { normalizeDepositorName, type DepositKind } from './bankDepositMatch.js';

const MISMATCH = new Set(['EXTRA_INCLUDED', 'PARTIAL', 'OTHER']);
const HOUR_MS = 60 * 60 * 1000;
const REMIND_MS = 10 * 60 * 1000;
const STOP_MS = 48 * HOUR_MS;

export function formatDepositWon(amountWon: number): string {
  return `${Math.trunc(amountWon).toLocaleString('ko-KR')}원`;
}

export function balancePushBody(customerName: string, amountWon: number): string {
  const name = customerName.trim() || '고객';
  return `${name} 고객 ${formatDepositWon(amountWon)}`;
}

export function openPushBody(depositorName: string, amountWon: number): string {
  const name = depositorName.trim() || '입금';
  return `${name} ${formatDepositWon(amountWon)}`;
}

export function kstHour(now: Date): number {
  const hour = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    hour: '2-digit',
    hourCycle: 'h23',
  }).format(now);
  return Number(hour);
}

/** 계약금으로 쓰인 금액이면 팀장에게 묻지 않는다. 0은 모음에 넣지 않는다. */
export function contractDepositAmounts(values: Array<number | null | undefined>): Set<number> {
  const set = new Set<number>();
  for (const value of values) {
    if (value != null && value > 0) set.add(value);
  }
  return set;
}

export function isOpenBalanceDeposit(amountWon: number, contractAmounts: Set<number>): boolean {
  return amountWon > 0 && !contractAmounts.has(amountWon);
}

export function canRemindOpenDeposit(input: {
  now: Date;
  depositedAt: Date;
  lastRemindedAt: Date | null;
}): boolean {
  if (input.now.getTime() - input.depositedAt.getTime() >= STOP_MS) return false;
  const hour = kstHour(input.now);
  if (hour < 8 || hour >= 21) return false;
  if (input.lastRemindedAt && input.now.getTime() - input.lastRemindedAt.getTime() < REMIND_MS) return false;
  return true;
}

export function allLeadersDeclined(declinedCount: number, leaderCount: number): boolean {
  return leaderCount > 0 && declinedCount >= leaderCount;
}

export function notifiesTeamLeader(kind: string | null): kind is 'BALANCE' | 'TOTAL' {
  return kind === 'BALANCE' || kind === 'TOTAL';
}

export function claimDecision(input: {
  assigned: boolean;
  kind: string;
  amountWon: number;
  balanceWon: number | null;
  mismatchReason: string | null;
}): 'ok' | 'forbidden' | 'bad_kind' | 'mismatch' {
  if (!input.assigned) return 'forbidden';
  if (input.kind !== 'BALANCE' && input.kind !== 'TOTAL') return 'bad_kind';
  const same = input.balanceWon != null && input.balanceWon === input.amountWon;
  if (!same && !MISMATCH.has(input.mismatchReason ?? '')) return 'mismatch';
  return 'ok';
}

export function customerBalanceWon(input: {
  serviceBalanceAmount: number | null;
  serviceTotalAmount: number | null;
  serviceDepositAmount: number | null;
  companyDepositExtraWon: number;
}): number | null {
  let base: number | null = null;
  if (input.serviceBalanceAmount != null) base = input.serviceBalanceAmount;
  else if (input.serviceTotalAmount != null && input.serviceTotalAmount > 0) {
    base = Math.max(0, input.serviceTotalAmount - (input.serviceDepositAmount ?? 0));
  }
  if (base == null && input.companyDepositExtraWon <= 0) return null;
  return (base ?? 0) + input.companyDepositExtraWon;
}

/** 라벨에 「입금자」가 있는 발주서 칸의 답. */
export function orderFormDepositorNames(
  fields: Array<{ fieldKey: string; label: string }>,
  bags: unknown[],
): string[] {
  const keys = new Set(fields.filter((field) => field.label.includes('입금자')).map((field) => field.fieldKey));
  const names: string[] = [];
  for (const bag of bags) {
    if (!bag || typeof bag !== 'object' || Array.isArray(bag)) continue;
    for (const [key, value] of Object.entries(bag as Record<string, unknown>)) {
      if (!keys.has(key) || typeof value !== 'string') continue;
      const text = value.trim();
      if (text && !names.includes(text)) names.push(text);
    }
  }
  return names;
}

export function soleByNameAndAmount<T extends { depositorName: string; amountWon: number }>(
  rows: T[],
  depositorName: string,
  amountWon: number,
): T | null {
  const needle = normalizeDepositorName(depositorName);
  if (!needle) return null;
  const hits = rows.filter(
    (row) => row.amountWon === amountWon && normalizeDepositorName(row.depositorName) === needle,
  );
  return hits.length === 1 ? hits[0] : null;
}

export function teamBalanceEvent(input: {
  depositId: string;
  inquiryId: string;
  customerName: string;
  amountWon: number;
  kind: DepositKind;
  depositorName: string;
  depositedAt: string;
}) {
  return { type: 'bank_deposit:team' as const, v: 1 as const, event: 'balance_received' as const, ...input };
}

export function teamOpenEvent(input: {
  depositId: string;
  amountWon: number;
  depositorName: string;
  depositedAt: string;
  operatingCompanyName: string | null;
}) {
  return { type: 'bank_deposit:team' as const, v: 1 as const, event: 'open_new' as const, ...input };
}

export function teamResolvedEvent(input: { depositId: string; resolvedByName: string | null }) {
  return { type: 'bank_deposit:team' as const, v: 1 as const, event: 'open_resolved' as const, ...input };
}

export function teamExpectationEvent(input: {
  inquiryId: string;
  depositId: string;
  customerName: string;
  amountWon: number;
}) {
  return { type: 'bank_deposit:team' as const, v: 1 as const, event: 'expectation_matched' as const, ...input };
}

const SCAN_PUSH_MS = 24 * HOUR_MS;

/** 점검으로 들어온 입금이 하루보다 오래됐으면 휴대폰 알림은 보내지 않는다. 화면 알림은 그대로다. */
export function teamMobilePushAllowed(input: { source: string; depositedAt: Date; now: Date }): boolean {
  if (input.source !== 'scan') return true;
  return input.now.getTime() - input.depositedAt.getTime() <= SCAN_PUSH_MS;
}
