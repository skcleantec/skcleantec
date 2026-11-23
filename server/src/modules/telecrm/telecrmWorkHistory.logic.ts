/** 작업 기록 판정. DB 없이 테스트한다. */

export const WORK_SOURCES = ['soomgo', 'miso', 'followup', 'lookup', 'manual', 'incoming_call'] as const;
export const WORK_FINISH_OUTCOMES = ['SAVED', 'UNSAVED', 'VIEWED'] as const;
export const WORK_LEFT_BY = ['switch', 'reset', 'close', 'session_end'] as const;
export const WORK_SAVED_KINDS = ['requested', 'absent', 'hold', 'deposit', 'reserved', 'received'] as const;

export const STALE_OPEN_MS = 30 * 60 * 1000;
export const WORK_RETAIN_MS = 30 * 24 * 60 * 60 * 1000;
export const DRAFT_RETAIN_MS = 14 * 24 * 60 * 60 * 1000;
export const PURGE_INTERVAL_MS = 24 * 60 * 60 * 1000;

export type WorkSource = (typeof WORK_SOURCES)[number];
export type WorkFinishOutcome = (typeof WORK_FINISH_OUTCOMES)[number];
export type WorkLeftBy = (typeof WORK_LEFT_BY)[number];

export type WorkActions = {
  callCount: number;
  quoteSent: boolean;
  quoteAmountWon: number | null;
  smsCount: number;
  soomgoMessageCount: number;
  misoMessageCount: number;
  memoEdited: boolean;
  fieldsEdited: boolean;
};

export const EMPTY_WORK_ACTIONS: WorkActions = {
  callCount: 0,
  quoteSent: false,
  quoteAmountWon: null,
  smsCount: 0,
  soomgoMessageCount: 0,
  misoMessageCount: 0,
  memoEdited: false,
  fieldsEdited: false,
};

const ACTION_KEYS = Object.keys(EMPTY_WORK_ACTIONS) as (keyof WorkActions)[];

export function isWorkSource(value: string): value is WorkSource {
  return (WORK_SOURCES as readonly string[]).includes(value);
}

export function isFinishOutcome(value: string): value is WorkFinishOutcome {
  return (WORK_FINISH_OUTCOMES as readonly string[]).includes(value);
}

export function isLeftBy(value: string): value is WorkLeftBy {
  return (WORK_LEFT_BY as readonly string[]).includes(value);
}

export function isSavedKind(value: string): boolean {
  return (WORK_SAVED_KINDS as readonly string[]).includes(value);
}

function nonNegInt(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(0, Math.floor(value));
}

export function normalizeWorkActions(raw: unknown): WorkActions {
  const src = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    callCount: nonNegInt(src.callCount, 0),
    quoteSent: src.quoteSent === true,
    quoteAmountWon:
      src.quoteAmountWon == null ? null : nonNegInt(src.quoteAmountWon, 0),
    smsCount: nonNegInt(src.smsCount, 0),
    soomgoMessageCount: nonNegInt(src.soomgoMessageCount, 0),
    misoMessageCount: nonNegInt(src.misoMessageCount, 0),
    memoEdited: src.memoEdited === true,
    fieldsEdited: src.fieldsEdited === true,
  };
}

/** 보낸 키만 덮어쓴다. 숫자는 클라이언트가 이미 더한 값이다. */
export function mergeWorkActions(prev: WorkActions, patch: unknown): WorkActions {
  const src = patch && typeof patch === 'object' ? (patch as Record<string, unknown>) : {};
  const next = { ...prev };
  for (const key of ACTION_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(src, key)) continue;
    const merged = normalizeWorkActions({ ...next, [key]: src[key] });
    (next as Record<string, unknown>)[key] = merged[key];
  }
  return next;
}

/** 통화·견적·문자·메모·칸 수정 중 하나라도 있으면 작업한 것이다. */
export function workEntryDidSomething(actions: WorkActions): boolean {
  return (
    actions.callCount > 0 ||
    actions.quoteSent ||
    (actions.quoteAmountWon ?? 0) > 0 ||
    actions.smsCount > 0 ||
    actions.soomgoMessageCount > 0 ||
    actions.misoMessageCount > 0 ||
    actions.memoEdited ||
    actions.fieldsEdited
  );
}

export function isStaleOpen(updatedAt: Date, now: Date): boolean {
  return now.getTime() - updatedAt.getTime() >= STALE_OPEN_MS;
}

export function staleOpenOutcome(actions: WorkActions): 'UNSAVED' | 'VIEWED' {
  return workEntryDidSomething(actions) ? 'UNSAVED' : 'VIEWED';
}

export type FinishInput = {
  outcome: WorkFinishOutcome;
  savedKind?: string | null;
  leftBy?: string | null;
  followupId?: string | null;
  inquiryId?: string | null;
  draft?: unknown;
  summary?: string | null;
};

export function applyWorkFinish(input: FinishInput, now: Date) {
  return {
    outcome: input.outcome,
    savedKind: input.outcome === 'SAVED' ? input.savedKind ?? null : null,
    leftBy: input.leftBy,
    followupId: input.followupId,
    inquiryId: input.inquiryId,
    draft: input.outcome === 'SAVED' ? null : input.draft,
    summary: input.summary,
    endedAt: now,
  };
}

export function countsAsPendingUnsaved(
  row: { outcome: string; dismissedAt: Date | null; resumedAt: Date | null; startedAt: Date },
  now: Date,
): boolean {
  if (row.outcome !== 'UNSAVED' || row.dismissedAt || row.resumedAt) return false;
  return row.startedAt.getTime() >= now.getTime() - DRAFT_RETAIN_MS;
}

/** 마케터는 항상 본인. 관리자는 지정한 마케터 또는 전체(null). */
export function resolveListUserId(isAdmin: boolean, actorId: string, requestedUserId: string | null): string | null {
  if (!isAdmin) return actorId;
  return requestedUserId;
}

export function canReadWorkEntry(isAdmin: boolean, actorId: string, ownerId: string): boolean {
  return isAdmin || actorId === ownerId;
}

export function canEditWorkEntry(actorId: string, ownerId: string): boolean {
  return actorId === ownerId;
}

export function retentionCutoffs(now: Date): { deleteBefore: Date; clearDraftBefore: Date } {
  return {
    deleteBefore: new Date(now.getTime() - WORK_RETAIN_MS),
    clearDraftBefore: new Date(now.getTime() - DRAFT_RETAIN_MS),
  };
}

export function shouldRunPurge(lastRunAt: number, nowMs: number): boolean {
  return nowMs - lastRunAt >= PURGE_INTERVAL_MS;
}
