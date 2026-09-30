import type { TeamLeaderSizePolicy } from '@prisma/client';
import { isAllDayPreferredTime } from '../../lib/scheduleAllDayTime.js';
import { isBetweenSlotPreferredTime } from '../../lib/scheduleBetweenSlotTime.js';
import { AI_DISPATCH_DEFAULTS, type AiDispatchSlot } from './aiDispatch.constants.js';

export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const rad = (n: number) => (n * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** 스케줄과 같은 시간대. 사이청소·조율은 오전/오후가 확정된 건만 슬롯에 넣는다. */
export function fixedSlot(
  preferredTime: string | null | undefined,
  betweenScheduleSlot?: string | null,
): AiDispatchSlot {
  const t = (preferredTime ?? '').trim();
  if (isBetweenSlotPreferredTime(t)) {
    const confirmed = (betweenScheduleSlot ?? '').trim();
    if (confirmed === '오전') return 'AM';
    if (confirmed === '오후') return 'PM';
    return 'HUMAN';
  }
  if (isAllDayPreferredTime(t)) return 'ALL_DAY';
  if (!t) return 'HUMAN';
  if (t.includes('오후') && !t.includes('오전')) return 'PM';
  if (t.includes('오전')) return 'AM';
  return 'HUMAN';
}

export function slotJobWeight(slot: AiDispatchSlot): number {
  if (slot === 'ALL_DAY') return 2;
  if (slot === 'HUMAN') return 0;
  return 1;
}

export function isSmallHome(
  input: { isOneRoom: boolean; areaPyeong: number | null },
  twoRoomMaxPyeong: number,
): boolean {
  if (input.isOneRoom) return true;
  return input.areaPyeong != null && input.areaPyeong <= twoRoomMaxPyeong;
}

export function sizePolicyAllows(
  policy: TeamLeaderSizePolicy | string,
  input: { isOneRoom: boolean; areaPyeong: number | null },
  twoRoomMaxPyeong: number,
): boolean {
  const small = isSmallHome(input, twoRoomMaxPyeong);
  if (policy === 'ONE_ROOM_ONLY') return input.isOneRoom;
  if (policy === 'ONE_AND_TWO') return small;
  if (policy === 'EXCLUDE_ONE_AND_TWO') return !small;
  return true;
}

export function requiredLeaderCount(
  areaPyeong: number | null,
  settings: { extraLeaderMinPyeong: number; extraLeaderCount: number },
): number {
  if (areaPyeong != null && areaPyeong >= settings.extraLeaderMinPyeong) {
    return Math.max(1, Math.min(4, settings.extraLeaderCount));
  }
  return 1;
}

export function areaLabel(address: string): string {
  const parts = address.split(/\s+/).filter(Boolean).slice(0, 3);
  const text = parts.join(' ');
  return text.length > 40 ? `${text.slice(0, 40)}…` : text || '주소';
}

export function clampSettings(input: {
  extraLeaderMinPyeong?: number;
  extraLeaderCount?: number;
  twoRoomMaxPyeong?: number;
}): { extraLeaderMinPyeong: number; extraLeaderCount: number; twoRoomMaxPyeong: number } {
  const minP = Number(input.extraLeaderMinPyeong ?? AI_DISPATCH_DEFAULTS.extraLeaderMinPyeong);
  const count = Number(input.extraLeaderCount ?? AI_DISPATCH_DEFAULTS.extraLeaderCount);
  const two = Number(input.twoRoomMaxPyeong ?? AI_DISPATCH_DEFAULTS.twoRoomMaxPyeong);
  return {
    extraLeaderMinPyeong: Number.isFinite(minP) ? Math.max(10, Math.min(200, Math.round(minP))) : 40,
    extraLeaderCount: Number.isFinite(count) ? Math.max(1, Math.min(4, Math.round(count))) : 2,
    twoRoomMaxPyeong: Number.isFinite(two) ? Math.max(5, Math.min(40, Math.round(two))) : 15,
  };
}
