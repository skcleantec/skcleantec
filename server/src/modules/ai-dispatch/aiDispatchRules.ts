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

export function fromHomeKm(
  home: { homeLat: number; homeLng: number },
  site: { lat: number | null; lng: number | null },
): number | null {
  if (site.lat == null || site.lng == null) return null;
  return Math.round(haversineKm({ lat: home.homeLat, lng: home.homeLng }, { lat: site.lat, lng: site.lng }) * 10) / 10;
}

const LOOP_RANK: Record<AiDispatchSlot, number> = { AM: 0, ALL_DAY: 1, PM: 2, HUMAN: 3 };

/** 팀장 집 좌표에서 출발해 현장들을 거쳐 집으로 돌아오는 직선거리 설명. */
export function homeLoopText(
  leaderName: string,
  home: { homeLat: number; homeLng: number },
  stops: Array<{ slot: AiDispatchSlot; label: string; lat: number | null; lng: number | null }>,
): string | null {
  const points = stops
    .filter((stop) => stop.lat != null && stop.lng != null)
    .sort((a, b) => LOOP_RANK[a.slot] - LOOP_RANK[b.slot]);
  if (points.length === 0) return null;
  let cursor = { lat: home.homeLat, lng: home.homeLng };
  const parts: string[] = [];
  let total = 0;
  for (const stop of points) {
    const next = { lat: stop.lat as number, lng: stop.lng as number };
    const km = Math.round(haversineKm(cursor, next) * 10) / 10;
    total += km;
    const from = parts.length === 0 ? '집' : '이전 현장';
    parts.push(`${from}에서 ${stop.label} ${km}km`);
    cursor = next;
  }
  const back = Math.round(haversineKm(cursor, { lat: home.homeLat, lng: home.homeLng }) * 10) / 10;
  total = Math.round((total + back) * 10) / 10;
  parts.push(`현장에서 집 ${back}km`);
  return `${leaderName}: ${parts.join(', ')}. 합계 ${total}km`;
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
  includeCrewInFatigue?: boolean;
}): {
  extraLeaderMinPyeong: number;
  extraLeaderCount: number;
  twoRoomMaxPyeong: number;
  includeCrewInFatigue: boolean;
} {
  const minP = Number(input.extraLeaderMinPyeong ?? AI_DISPATCH_DEFAULTS.extraLeaderMinPyeong);
  const count = Number(input.extraLeaderCount ?? AI_DISPATCH_DEFAULTS.extraLeaderCount);
  const two = Number(input.twoRoomMaxPyeong ?? AI_DISPATCH_DEFAULTS.twoRoomMaxPyeong);
  return {
    extraLeaderMinPyeong: Number.isFinite(minP) ? Math.max(10, Math.min(200, Math.round(minP))) : 40,
    extraLeaderCount: Number.isFinite(count) ? Math.max(1, Math.min(4, Math.round(count))) : 2,
    twoRoomMaxPyeong: Number.isFinite(two) ? Math.max(5, Math.min(40, Math.round(two))) : 15,
    includeCrewInFatigue: input.includeCrewInFatigue === true,
  };
}
