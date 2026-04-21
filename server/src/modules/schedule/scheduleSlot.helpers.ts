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
