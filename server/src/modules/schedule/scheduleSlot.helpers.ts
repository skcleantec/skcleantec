/**
 * 스케줄 슬롯: 사이청소는 발주서 옵션으로만 존재하며,
 * 오전·오후와 별도 용량이 아니라 확정 시(`betweenScheduleSlot`) 해당 슬롯을 1건 소모한다.
 */

export function isSideCleaningPreferredTime(t: string | null | undefined): boolean {
  return (t || '').includes('사이청소');
}

/** 희망 시간대 문자열이 없으면 오전/오후 슬롯을 구분할 수 없음 — 슬롯 소모에 포함하지 않음 */
function isPlainPreferredTimeUnset(preferredTime: string | null | undefined): boolean {
  return !String(preferredTime ?? '').trim();
}

/** 일반(비사이) 접수의 오전 슬롯 여부 — 기존 스케줄 통계와 동일 규칙 */
export function isPlainMorningSlot(t: string | null | undefined): boolean {
  const s = t || '';
  if (s.includes('사이청소')) return false;
  if (s.includes('오전')) return true;
  if (s.includes('오후')) return false;
  const n = parseInt(s, 10);
  return !Number.isNaN(n) && n < 12;
}

export function consumesMorningSlot(inquiry: {
  preferredTime: string | null;
  betweenScheduleSlot: string | null;
}): boolean {
  if (isSideCleaningPreferredTime(inquiry.preferredTime)) {
    return inquiry.betweenScheduleSlot === '오전';
  }
  if (isPlainPreferredTimeUnset(inquiry.preferredTime)) {
    return false;
  }
  return isPlainMorningSlot(inquiry.preferredTime);
}

export function consumesAfternoonSlot(inquiry: {
  preferredTime: string | null;
  betweenScheduleSlot: string | null;
}): boolean {
  if (isSideCleaningPreferredTime(inquiry.preferredTime)) {
    return inquiry.betweenScheduleSlot === '오후';
  }
  if (isPlainPreferredTimeUnset(inquiry.preferredTime)) {
    return false;
  }
  return !isPlainMorningSlot(inquiry.preferredTime);
}

/**
 * 자사 팀장 슬롯·TO 집계에 포함할 접수인지.
 * 타업체(EXTERNAL_PARTNER) 팀장만 배정된 건은 우리 팀장 가용과 무관하므로 제외.
 * 미배정은 집계에 포함(true).
 */
export function inquiryUsesInternalTeamLeaderSlot(inv: {
  assignments: ReadonlyArray<{ teamLeader: { role: string } }>;
}): boolean {
  const list = inv.assignments;
  if (list.length === 0) return true;
  return list.some((a) => a.teamLeader.role === 'TEAM_LEADER');
}

/** 사이청소 오전·오후 확정 여부 — 확정 시 해당 슬롯 1건 소모, ⚡ 배지는 표시하지 않음 */
export function isSideCleaningScheduleSlotConfirmed(betweenScheduleSlot: string | null | undefined): boolean {
  const s = String(betweenScheduleSlot ?? '').trim();
  return s === '오전' || s === '오후';
}

/**
 * 관리 스케쥴 캘린더 ⚡ 사이청소 배지·통계에 포함할 접수.
 * 미배정이면서 오전·오후가 아직 확정되지 않은 사이청소만 포함한다.
 * 오전/오후 확정 후에는 해당 슬롯 잔여·미배정 숫자로만 표시한다.
 * 팀장·타업체·관리자 등 담당자가 한 명이라도 배정되면 배지에서 제외한다.
 */
export function countsForSideCleaningCalendarBadge(inv: {
  preferredTime: string | null;
  betweenScheduleSlot?: string | null;
  assignments: ReadonlyArray<unknown>;
}): boolean {
  if (!isSideCleaningPreferredTime(inv.preferredTime)) return false;
  if (inv.assignments.length > 0) return false;
  if (isSideCleaningScheduleSlotConfirmed(inv.betweenScheduleSlot)) return false;
  return true;
}
