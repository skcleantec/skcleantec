/** 입금 문자 중복·해석 실패 판정. 잔액 숫자는 반환하지 않는다. */

import { looksLikeNonDeposit, stripBalance, stripWebPrefix } from './bankDepositParse.js';

export type DepositSource = 'sms' | 'scan' | 'notification';

export type DepositKeyRow = {
  id: string;
  dedupeKey: string;
  contentHash: string | null;
  fingerprint: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function normalizeContentHash(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const hex = value.trim().toLowerCase();
  return /^[0-9a-f]{64}$/.test(hex) ? hex : null;
}

export function normalizeDepositSource(value: unknown): DepositSource {
  return value === 'scan' || value === 'notification' ? value : 'sms';
}

export function kstMinuteKey(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const pick = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  const hour = pick('hour') === '24' ? '00' : pick('hour').padStart(2, '0');
  return `${pick('year')}-${pick('month')}-${pick('day')} ${hour}:${pick('minute').padStart(2, '0')}`;
}

/** 계좌+금액+입금자명+입금 시각(분, 한국 시간). 마이그레이션 SQL과 같은 모양이다. */
export function depositFingerprint(input: {
  accountMask: string;
  amountWon: number;
  depositorName: string;
  depositedAt: Date;
}): string {
  return `${input.accountMask}|${input.amountWon}|${input.depositorName.trim()}|${kstMinuteKey(input.depositedAt)}`;
}

export function compactDepositorName(name: string): string {
  return name.replace(/\s/g, '');
}

/** 그 입금 시각이 속한 한국 시간 1분. */
export function kstMinuteWindow(date: Date): { gte: Date; lt: Date } | null {
  const key = kstMinuteKey(date);
  const start = new Date(`${key.replace(' ', 'T')}:00+09:00`);
  if (Number.isNaN(start.getTime())) return null;
  return { gte: start, lt: new Date(start.getTime() + 60_000) };
}

/** 직접 넣은 줄과 나중에 온 문자가 같은 입금이면 그 줄에 해시를 채운다. */
export function mergeIntoManualRow(
  manuals: Array<{ id: string; contentHash: string | null; depositorName: string }>,
  incoming: { contentHash: string | null; depositorName: string },
): { fillId: string } | null {
  const name = compactDepositorName(incoming.depositorName);
  const same = manuals.filter((row) => compactDepositorName(row.depositorName) === name);
  const open = same.find((row) => row.contentHash == null || row.contentHash === incoming.contentHash);
  return open ? { fillId: open.id } : null;
}

/**
 * 1) dedupeKey 2) contentHash 3) 해시 없는 옛 줄의 fingerprint.
 * 해시가 둘 다 있고 다르면 fingerprint가 같아도 새 입금이다.
 */
export function pickDuplicate(
  incoming: { dedupeKey: string; contentHash: string | null; fingerprint: string },
  rows: DepositKeyRow[],
): { duplicate: true; fillHashOnId: string | null } | { duplicate: false } {
  if (rows.some((row) => row.dedupeKey === incoming.dedupeKey)) {
    return { duplicate: true, fillHashOnId: null };
  }
  if (incoming.contentHash && rows.some((row) => row.contentHash === incoming.contentHash)) {
    return { duplicate: true, fillHashOnId: null };
  }
  const bare = rows.find((row) => row.contentHash == null && row.fingerprint === incoming.fingerprint);
  if (bare) return { duplicate: true, fillHashOnId: incoming.contentHash ? bare.id : null };
  return { duplicate: false };
}

export type UnparsedKeep =
  | { keep: false }
  | { keep: true; text: string | null; reason: 'balance_remains' | 'unparsed' };

/** 농협 입금인데 해석이 안 된 문자만 남긴다. 잔액이 지워지지 않으면 본문은 비운다. */
export function unparsedRecord(raw: string): UnparsedKeep {
  const stripped = stripBalance(stripWebPrefix(raw));
  if (!stripped || !/농협/.test(stripped) || !/입금/.test(stripped)) return { keep: false };
  if (looksLikeNonDeposit(stripped)) return { keep: false };
  if (stripped.includes('잔액')) return { keep: true, text: null, reason: 'balance_remains' };
  return { keep: true, text: stripped.slice(0, 4000), reason: 'unparsed' };
}

export function unparsedListSince(now: Date): Date {
  return new Date(now.getTime() - 14 * DAY_MS);
}

export function resolveUnparsedWhere(tenantId: string, id: string) {
  return { id, tenantId };
}

export function rescanBody(consumed: boolean): { rescan: true; sinceHours: 48 } | Record<string, never> {
  return consumed ? { rescan: true, sinceHours: 48 } : {};
}
