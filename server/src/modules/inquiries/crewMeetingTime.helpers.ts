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

export type CrewMeetingPatchShared = {
  mode: 'shared';
  crewMeetingTime: string | null;
};

export type CrewMeetingPatchIndividual = {
  mode: 'individual';
  memberTimes: Array<{ teamMemberId: string; meetingTime: string }>;
};

export type CrewMeetingPatchInput = CrewMeetingPatchShared | CrewMeetingPatchIndividual;

export function parseCrewMeetingPatchBody(
  body: unknown,
): { ok: true; value: CrewMeetingPatchInput } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: '요청 본문이 올바르지 않습니다.' };
  }
  const b = body as Record<string, unknown>;

  // 레거시: { crewMeetingTime } 만 전송
  if (!('shared' in b) && 'crewMeetingTime' in b) {
    const parsed = parseCrewMeetingTimeBody(b.crewMeetingTime);
    if (!parsed.ok) return parsed;
    return { ok: true, value: { mode: 'shared', crewMeetingTime: parsed.value } };
  }

  const sharedRaw = b.shared;
  const shared =
    sharedRaw === true ||
    sharedRaw === 'true' ||
    sharedRaw === 1 ||
    sharedRaw === '1';

  if (shared) {
    const parsed = parseCrewMeetingTimeBody(b.crewMeetingTime);
    if (!parsed.ok) return parsed;
    return { ok: true, value: { mode: 'shared', crewMeetingTime: parsed.value } };
  }

  const rawList = b.memberTimes;
  if (!Array.isArray(rawList)) {
    return { ok: false, error: '개별 미팅 시각 목록(memberTimes)이 필요합니다.' };
  }
  const memberTimes: Array<{ teamMemberId: string; meetingTime: string }> = [];
  const seen = new Set<string>();
  for (const x of rawList) {
    if (!x || typeof x !== 'object') {
      return { ok: false, error: '개별 미팅 시각 형식이 올바르지 않습니다.' };
    }
    const row = x as { teamMemberId?: unknown; meetingTime?: unknown };
    const teamMemberId = typeof row.teamMemberId === 'string' ? row.teamMemberId.trim() : '';
    if (!teamMemberId) {
      return { ok: false, error: '팀원 id(teamMemberId)가 필요합니다.' };
    }
    if (seen.has(teamMemberId)) continue;
    seen.add(teamMemberId);
    const parsed = parseCrewMeetingTimeBody(row.meetingTime);
    if (!parsed.ok) return parsed;
    if (parsed.value == null) {
      return { ok: false, error: '투입 팀원마다 미팅 시각을 모두 입력해 주세요.' };
    }
    memberTimes.push({ teamMemberId, meetingTime: parsed.value });
  }
  return { ok: true, value: { mode: 'individual', memberTimes } };
}
