import { getScheduleTimeBucket } from './scheduleTimeBucket';

/** 팀 모달·미팅 시간 — `ScheduleItem` 과 동일 규칙 */
export function isMorningBucketForTeamMeeting(item: {
  preferredTime: string | null;
  betweenScheduleSlot?: string | null;
}): boolean {
  return (
    getScheduleTimeBucket({
      preferredTime: item.preferredTime ?? '',
      betweenScheduleSlot: item.betweenScheduleSlot ?? null,
    }) === 'morning'
  );
}

/** 04:00 ~ 08:00 KST 30분 간격 */
export const MORNING_MEETING_TIME_OPTIONS_KST: string[] = (() => {
  const out: string[] = [];
  for (let mins = 4 * 60; mins <= 8 * 60; mins += 30) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    out.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
  }
  return out;
})();

export function formatMeetingTimeKoLabel(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return hhmm;
  return `오전 ${h}시${m === 0 ? '' : ` ${m}분`}`;
}

/** `<input type="time">` 값 → `HH:mm` (서버·허용 목록과 동일 형식) */
export function normalizeTimeInputToHhmm(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  const m = t.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min) || min < 0 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

export function isAllowedCrewMeetingHhmm(hhmm: string): boolean {
  return MORNING_MEETING_TIME_OPTIONS_KST.includes(hhmm);
}
