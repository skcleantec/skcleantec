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
    }) === 'morning' ||
    getScheduleTimeBucket({
      preferredTime: item.preferredTime ?? '',
      betweenScheduleSlot: item.betweenScheduleSlot ?? null,
    }) === 'allday'
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

/** `<input type="time">` value — 초·한 자리 시가 붙어도 브라우저가 빈 칸으로 그리지 않게 */
export function timeInputValueFromStored(raw: string | null | undefined): string {
  if (raw == null) return '';
  const t = raw.trim();
  if (!t) return '';
  return normalizeTimeInputToHhmm(t) ?? '';
}

export type CrewMeetingDraftMember = {
  teamMemberId: string | null;
  meetingTime?: string | null;
};

export function memberMeetingDraftsFromCrew(
  members: CrewMeetingDraftMember[] | undefined,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of members ?? []) {
    if (m.teamMemberId && m.meetingTime) {
      const v = timeInputValueFromStored(m.meetingTime);
      if (v) out[m.teamMemberId] = v;
    }
  }
  return out;
}

export function crewMembersMeetingSyncKey(members: CrewMeetingDraftMember[] | undefined): string {
  return (members ?? [])
    .map((m) => `${m.teamMemberId ?? ''}\t${m.meetingTime ?? ''}`)
    .join('|');
}

export function isCrewMeetingDraftDirty(params: {
  sharedDraft: boolean;
  sharedSaved: boolean;
  crewMeetingDraft: string;
  savedCrewMeetingTime: string | null | undefined;
  members: CrewMeetingDraftMember[];
  memberMeetingDrafts: Record<string, string>;
}): boolean {
  if (params.sharedDraft !== params.sharedSaved) return true;
  if (params.sharedDraft) {
    const savedRaw = (params.savedCrewMeetingTime ?? '').trim();
    const savedNorm = savedRaw === '' ? null : normalizeTimeInputToHhmm(savedRaw);
    const t = params.crewMeetingDraft.trim();
    if (t === '') return savedRaw !== '';
    const n = normalizeTimeInputToHhmm(t);
    if (n === null) return true;
    return n !== (savedNorm ?? null);
  }
  const matched = params.members.filter((m) => m.teamMemberId);
  for (const m of matched) {
    const id = m.teamMemberId!;
    const saved = (m.meetingTime ?? '').trim();
    const draft = (params.memberMeetingDrafts[id] ?? '').trim();
    const savedNorm = saved === '' ? null : normalizeTimeInputToHhmm(saved);
    const draftNorm = draft === '' ? null : normalizeTimeInputToHhmm(draft);
    if (savedNorm !== draftNorm) return true;
  }
  return false;
}
