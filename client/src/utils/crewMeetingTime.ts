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

export function formatMeetingTimeKoLabel(hhmm: string): string {
  const [hs, ms] = hhmm.split(':');
  const h = Number(hs);
  const m = Number(ms);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return hhmm;
  if (h === 0) {
    return m === 0 ? '오전 12시' : `오전 12시 ${m}분`;
  }
  if (h < 12) {
    return m === 0 ? `오전 ${h}시` : `오전 ${h}시 ${m}분`;
  }
  if (h === 12) {
    return m === 0 ? '오후 12시' : `오후 12시 ${m}분`;
  }
  const h12 = h - 12;
  return m === 0 ? `오후 ${h12}시` : `오후 ${h12}시 ${m}분`;
}

/** `<input type="time">` 값 → `HH:mm` (브라우저가 초 `:ss` 를 붙이는 경우 포함) */
export function normalizeTimeInputToHhmm(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  const m = t.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min) || min < 0 || min > 59) return null;
  const sec = m[3] != null ? Number(m[3]) : 0;
  if (m[3] != null && (!Number.isFinite(sec) || sec < 0 || sec > 59)) return null;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

/** 저장·표시용 `HH:mm` (00:00~23:59) */
export function isValidCrewMeetingHhmm(hhmm: string): boolean {
  const m = hhmm.match(/^(\d{2}):(\d{2})$/);
  if (!m) return false;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h >= 0 && h <= 23 && min >= 0 && min <= 59;
}
