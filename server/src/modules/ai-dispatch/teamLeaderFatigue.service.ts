import type { PrismaClient } from '@prisma/client';
import { addDaysToKstYmd, kstDayRangeYmd } from '../inquiries/inquiryListDateRange.js';
import type { AiDispatchFatigueBand, AiDispatchSlot } from './aiDispatch.constants.js';
import { fixedSlot, haversineKm } from './aiDispatchRules.js';

type Db = PrismaClient;

type PastJob = {
  ymd: string;
  pyeong: number | null;
  isOneRoom: boolean;
  noCrew: boolean;
  lat: number | null;
  lng: number | null;
  slot: AiDispatchSlot;
};

const LOOKBACK_DAYS = 14;
const SCORE_CAP = 70;

function weekdaySinceMonday(ymd: string): number {
  const label = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Seoul', weekday: 'short' }).format(
    new Date(`${ymd}T12:00:00+09:00`),
  );
  const index: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
  return index[label] ?? 0;
}

function weekMonday(ymd: string): string {
  return addDaysToKstYmd(ymd, -weekdaySinceMonday(ymd));
}

function ymdSpan(from: string, to: string): string[] {
  const out: string[] = [];
  let cursor = from;
  while (cursor <= to) {
    out.push(cursor);
    cursor = addDaysToKstYmd(cursor, 1);
  }
  return out;
}

/** 원룸은 평수와 별도. 표에 없는 평수는 가운데 값. */
export function pyeongPoints(job: Pick<PastJob, 'pyeong' | 'isOneRoom'>): number {
  if (job.isOneRoom) return 4;
  const p = job.pyeong;
  if (p == null) return 5;
  if (p < 15) return 3;
  if (p < 25) return 5;
  if (p < 35) return 7;
  if (p < 45) return 9;
  return 12;
}

/** 하루 왕복 km. 0이면 좌표가 없어 거리를 안 넣은 것. */
export function distancePoints(km: number): number {
  if (km <= 0) return 0;
  if (km < 15) return 1;
  if (km < 30) return 3;
  if (km < 50) return 6;
  if (km < 80) return 10;
  return 14;
}

function bandOf(score: number): AiDispatchFatigueBand {
  if (score <= 15) return '좋음';
  if (score <= 35) return '보통';
  return '피로';
}

/** 70점이 막대 100. 쉰 직후 0점은 1로 둔다. */
export function fatiguePercent(score: number): number {
  if (score <= 0) return 1;
  return Math.max(1, Math.min(100, Math.round((score / SCORE_CAP) * 100)));
}

function loopKm(dayJobs: PastJob[], home: { homeLat: number; homeLng: number }): number {
  const rank: Record<AiDispatchSlot, number> = { AM: 0, ALL_DAY: 1, PM: 2, HUMAN: 3 };
  const stops = dayJobs
    .filter((job) => job.lat != null && job.lng != null)
    .sort((a, b) => rank[a.slot] - rank[b.slot]);
  if (stops.length === 0) return 0;
  let cursor = { lat: home.homeLat, lng: home.homeLng };
  let km = 0;
  for (const stop of stops) {
    const next = { lat: stop.lat as number, lng: stop.lng as number };
    km += haversineKm(cursor, next);
    cursor = next;
  }
  km += haversineKm(cursor, { lat: home.homeLat, lng: home.homeLng });
  return km;
}

/**
 * 마지막 쉰 날 다음부터 쌓인 평수·왕복 거리.
 * 이틀 연속이거나 같은 주(월~일)에 두 번 쉬면 남은 점수의 50%만 쓴다.
 */
export async function loadLeaderFatigue(
  db: Db,
  tenantId: string,
  workDate: string,
  leaders: Array<{ id: string; homeLat: number; homeLng: number }>,
  includeCrewInFatigue: boolean,
): Promise<Map<string, { band: AiDispatchFatigueBand; note: string; fatigue: number }>> {
  const out = new Map<string, { band: AiDispatchFatigueBand; note: string; fatigue: number }>();
  if (leaders.length === 0) return out;
  const from = addDaysToKstYmd(workDate, -LOOKBACK_DAYS);
  const to = addDaysToKstYmd(workDate, -1);
  const rangeFrom = kstDayRangeYmd(from);
  const rangeTo = kstDayRangeYmd(to);
  if (!rangeFrom || !rangeTo) return out;
  const calendar = ymdSpan(from, to);
  const monday = weekMonday(workDate);
  const sunday = addDaysToKstYmd(monday, 6);

  const rows = await db.assignment.findMany({
    where: {
      tenantId,
      teamLeaderId: { in: leaders.map((leader) => leader.id) },
      inquiry: {
        tenantId,
        deletedAt: null,
        preferredDate: { gte: rangeFrom.gte, lte: rangeTo.lte },
        status: { notIn: ['CANCELLED', 'ON_HOLD'] },
      },
    },
    select: {
      teamLeaderId: true,
      noCrewMembers: true,
      inquiry: {
        select: {
          preferredDate: true,
          preferredTime: true,
          betweenScheduleSlot: true,
          areaPyeong: true,
          isOneRoom: true,
          addressGeoLat: true,
          addressGeoLng: true,
        },
      },
    },
  });

  const byLeader = new Map<string, PastJob[]>();
  for (const row of rows) {
    const date = row.inquiry.preferredDate;
    if (!date) continue;
    const ymd = date.toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10);
    const list = byLeader.get(row.teamLeaderId) ?? [];
    list.push({
      ymd,
      pyeong: row.inquiry.areaPyeong,
      isOneRoom: row.inquiry.isOneRoom,
      noCrew: row.noCrewMembers,
      lat: row.inquiry.addressGeoLat,
      lng: row.inquiry.addressGeoLng,
      slot: fixedSlot(row.inquiry.preferredTime, row.inquiry.betweenScheduleSlot),
    });
    byLeader.set(row.teamLeaderId, list);
  }

  const homeOf = new Map(leaders.map((leader) => [leader.id, leader]));
  for (const leader of leaders) {
    const jobs = byLeader.get(leader.id) ?? [];
    const worked = new Set(jobs.map((job) => job.ymd));
    const restDays = calendar.filter((ymd) => !worked.has(ymd));
    const lastRest = restDays.at(-1) ?? null;
    const counted = new Set(lastRest ? calendar.filter((ymd) => ymd > lastRest) : calendar);
    let streak = 0;
    if (lastRest) {
      let cursor = lastRest;
      while (cursor >= from && !worked.has(cursor)) {
        streak += 1;
        cursor = addDaysToKstYmd(cursor, -1);
      }
    }
    const restsThisWeek = restDays.filter((ymd) => ymd >= monday && ymd <= sunday).length;
    const halved = streak >= 2 || restsThisWeek >= 2;

    const byDay = new Map<string, PastJob[]>();
    for (const job of jobs) {
      if (!counted.has(job.ymd)) continue;
      const day = byDay.get(job.ymd) ?? [];
      day.push(job);
      byDay.set(job.ymd, day);
    }

    const home = homeOf.get(leader.id);
    let score = 0;
    let pyeongSum = 0;
    let travelKm = 0;
    let missingDistance = false;
    let soloJobs = 0;
    for (const dayJobs of byDay.values()) {
      for (const job of dayJobs) {
        pyeongSum += pyeongPoints(job);
        score += pyeongPoints(job);
        if (job.slot === 'ALL_DAY') score += 3;
        if (includeCrewInFatigue && job.noCrew) {
          score += 2;
          soloJobs += 1;
        }
      }
      if (!home) {
        missingDistance = true;
        continue;
      }
      const km = loopKm(dayJobs, home);
      if (km <= 0 && dayJobs.length > 0) missingDistance = true;
      travelKm += km;
      score += distancePoints(km);
    }
    if (halved) score = Math.round(score * 0.5);

    const workedAfterRest = byDay.size;
    const noteParts: string[] = [];
    if (!lastRest) noteParts.push(`${LOOKBACK_DAYS}일 계속`);
    else if (workedAfterRest === 0) noteParts.push('어제 쉼');
    else noteParts.push(`쉰 뒤 ${workedAfterRest}일`);
    noteParts.push(`평수 ${pyeongSum}`);
    if (travelKm > 0) noteParts.push(`이동 ${Math.round(travelKm)}km`);
    else if (missingDistance) noteParts.push('거리 없음');
    if (halved) noteParts.push('2일 쉼 50%');
    if (includeCrewInFatigue && soloJobs > 0) noteParts.push(`팀원 없음 ${soloJobs}건`);
    out.set(leader.id, { band: bandOf(score), fatigue: fatiguePercent(score), note: noteParts.join(' · ') });
  }
  return out;
}
