/**
 * 스케줄 슬롯: 사이청소·조율은 발주서 옵션으로만 존재하며,
 * 오전·오후와 별도 용량이 아니라 확정 시(`betweenScheduleSlot`) 해당 슬롯을 1건 소모한다.
 */

import { inquiryExcludedFromInternalToByDbListing } from '../../lib/dbMarketplaceSchedule.js';
import { isAllDayPreferredTime } from '../../lib/scheduleAllDayTime.js';
import {
  countsForCoordinationCalendarBadge,
  countsForSideCleaningCalendarBadge,
  isBetweenScheduleSlotConfirmed,
  isBetweenSlotPreferredTime,
  isCoordinationPreferredTime,
  isSideCleaningPreferredTime,
} from '../../lib/scheduleBetweenSlotTime.js';

export {
  countsForCoordinationCalendarBadge,
  countsForSideCleaningCalendarBadge,
  isBetweenScheduleSlotConfirmed,
  isBetweenSlotPreferredTime,
  isCoordinationPreferredTime,
  isSideCleaningPreferredTime,
  isSideCleaningScheduleSlotConfirmed,
} from '../../lib/scheduleBetweenSlotTime.js';

/** 희망 시간대 문자열이 없으면 오전/오후 슬롯을 구분할 수 없음 — 슬롯 소모에 포함하지 않음 */
function isPlainPreferredTimeUnset(preferredTime: string | null | undefined): boolean {
  return !String(preferredTime ?? '').trim();
}

/** 일반(비 사이·조율) 접수의 오전 슬롯 여부 — 기존 스케줄 통계와 동일 규칙 */
export function isPlainMorningSlot(t: string | null | undefined): boolean {
  const s = t || '';
  if (isAllDayPreferredTime(s)) return false;
  if (isBetweenSlotPreferredTime(s)) return false;
  if (s.includes('오전')) return true;
  if (s.includes('오후')) return false;
  const n = parseInt(s, 10);
  return !Number.isNaN(n) && n < 12;
}

export function consumesMorningSlot(inquiry: {
  preferredTime: string | null;
  betweenScheduleSlot: string | null;
}): boolean {
  if (isAllDayPreferredTime(inquiry.preferredTime)) return true;
  if (isBetweenSlotPreferredTime(inquiry.preferredTime)) {
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
  if (isAllDayPreferredTime(inquiry.preferredTime)) return true;
  if (isBetweenSlotPreferredTime(inquiry.preferredTime)) {
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

/** 송신 테넌트 — 파트너사로 넘긴(활성 연계) 접수 */
export function inquiryHasActivePartnerShareSource(
  share: { role: string; syncStatus: string } | null | undefined,
): boolean {
  return share?.role === 'SOURCE' && share?.syncStatus === 'ACTIVE';
}

/**
 * 캘린더 TO·팀원 수요·슬롯 점유 집계에 포함할 접수.
 * 타업체 전용 배정·파트너 연계(송신·ACTIVE)·정보공유(장바구니~확정)는 자사 용량과 무관하므로 제외.
 */
export function inquiryCountsForInternalToSlot(inv: {
  assignments: ReadonlyArray<{ teamLeader: { role: string } }>;
  tenantShare?: { role: string; syncStatus: string } | null;
  dbListing?: { status: string } | null;
}): boolean {
  if (inquiryHasActivePartnerShareSource(inv.tenantShare)) return false;
  if (inquiryExcludedFromInternalToByDbListing(inv.dbListing)) return false;
  return inquiryUsesInternalTeamLeaderSlot(inv);
}
