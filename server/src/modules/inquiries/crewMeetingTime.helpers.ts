/**
 * 오전 희망(스케줄과 동일 기준)일 때만 크루 미팅 시각을 둘 수 있다.
 * `client/src/utils/scheduleTimeBucket.ts` 의 getScheduleTimeBucket 과 동일 규칙.
 */
export function isMorningPreferenceForCrewMeeting(preferredTime: string | null, betweenScheduleSlot: string | null): boolean {
  const t = preferredTime || '';
  const bss =
    betweenScheduleSlot && String(betweenScheduleSlot).trim() !== ''
      ? String(betweenScheduleSlot).trim()
      : null;
  if (t.includes('사이청소')) {
    if (bss === '오전') return true;
    if (bss === '오후') return false;
    return false;
  }
  if (t.includes('오전')) return true;
  if (t.includes('오후')) return false;
  if (!t.trim()) return false;
  const n = parseInt(t, 10);
  if (!Number.isNaN(n) && n < 12) return true;
  return false;
}

/** KST `HH:mm` (DB·화면 문자열 형식 일치). */
export function isValidStoredCrewMeetingHhMm(s: string): boolean {
  const m = s.match(/^(\d{2}):(\d{2})$/);
  if (!m) return false;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  return hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59;
}

export function parseCrewMeetingTimeBody(
  raw: unknown
): { ok: true; value: string | null } | { ok: false; error: string } {
  if (raw === null || raw === undefined || raw === '') {
    return { ok: true, value: null };
  }
  const s = typeof raw === 'string' ? raw.trim() : String(raw).trim();
  if (!s) {
    return { ok: true, value: null };
  }
  if (!isValidStoredCrewMeetingHhMm(s)) {
    return { ok: false, error: '미팅 시각은 HH:mm 형식(00:00~23:59)으로 입력해 주세요.' };
  }
  return { ok: true, value: s };
}

export function validateCrewMeetingTimeForInquiry(
  preferredTime: string | null,
  betweenScheduleSlot: string | null,
  value: string | null
): { ok: true } | { ok: false; error: string } {
  if (value == null) {
    return { ok: true };
  }
  if (!isMorningPreferenceForCrewMeeting(preferredTime, betweenScheduleSlot)) {
    return { ok: false, error: '오전 희망 접수에만 미팅 시각을 지정할 수 있습니다.' };
  }
  return { ok: true };
}

/** 크루 일정 카드 노출 시: 저장값이 오전 접수와 맞지 않으면 노출 안 함 */
export function effectiveCrewMeetingTimeForDisplay(
  preferredTime: string | null,
  betweenScheduleSlot: string | null,
  stored: string | null
): string | null {
  if (!stored) return null;
  if (!isMorningPreferenceForCrewMeeting(preferredTime, betweenScheduleSlot)) return null;
  return stored;
}
