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

type DayTravel = { loop: number; between: number | null };

type LeaderStat = {
  workedDays: number;
  jobCount: number;
  restDays: number;
  sinceRest: boolean;
  extraJobs: number;
  loopAvg: number | null;
  betweenAvg: number | null;
  distanceSinceRestKm: number | null;
  largeJobs: number;
  soloJobs: number;
  crewScore: number;
  pyeongScore: number;
};

type FatigueDetail = {
  windowDays: number;
  workedDays: number;
  jobCount: number;
  restDays: number;
  sinceRest: boolean;
  normalWorkDays: number;
  normalJobs: number;
  loopKm: number | null;
  teamLoopKm: number | null;
  betweenDeltaKm: number | null;
  distanceSinceRestKm: number | null;
  largeJobs: number;
  soloJobs: number;
};

type FatigueRow = {
  band: AiDispatchFatigueBand;
  note: string;
  fatigue: number;
  detail: FatigueDetail;
};

const LOOKBACK_DAYS = 7;
const NORMAL_SCORE = 40;

/** 35평 미만·원룸은 0. 큰 집만 피로에 더한다. */
function largeHomePoints(job: Pick<PastJob, 'pyeong' | 'isOneRoom'>): number {
  if (job.isOneRoom || job.pyeong == null || job.pyeong < 35) return 0;
  if (job.pyeong < 45) return 4;
  return 8;
}

function isTwoRoom(job: PastJob, twoRoomMax: number): boolean {
  return !job.isOneRoom && job.pyeong != null && job.pyeong <= twoRoomMax;
}

/** 팀원 점수가 켜져 있을 때만. 원룸+팀원은 0. 투룸 혼자는 +6. 원룸 혼자는 기본이라 더하지 않는다. */
function jobHousePoints(
  job: PastJob,
  includeCrew: boolean,
  twoRoomMax: number,
): { pyeong: number; crew: number; twoRoomSolo: boolean } {
  if (includeCrew && job.isOneRoom && !job.noCrew) return { pyeong: 0, crew: 0, twoRoomSolo: false };
  const twoRoomSolo = includeCrew && isTwoRoom(job, twoRoomMax) && job.noCrew;
  return { pyeong: largeHomePoints(job), crew: twoRoomSolo ? 6 : 0, twoRoomSolo };
}

function bandOf(score: number): AiDispatchFatigueBand {
  if (score <= 30) return '좋음';
  if (score <= 60) return '보통';
  return '피로';
}

/** 정상 주 40점이 막대 40. 0 이하는 1. */
export function fatiguePercent(score: number): number {
  return Math.max(1, Math.min(100, Math.round(score)));
}

function dayTravel(dayJobs: PastJob[], home: { homeLat: number; homeLng: number }): DayTravel | null {
  const rank: Record<AiDispatchSlot, number> = { AM: 0, ALL_DAY: 1, PM: 2, HUMAN: 3 };
  const stops = dayJobs
    .filter((job) => job.lat != null && job.lng != null)
    .sort((a, b) => rank[a.slot] - rank[b.slot]);
  if (stops.length === 0) return null;
  let cursor = { lat: home.homeLat, lng: home.homeLng };
  let loop = 0;
  let between = 0;
  for (let i = 0; i < stops.length; i += 1) {
    const next = { lat: stops[i].lat as number, lng: stops[i].lng as number };
    const leg = haversineKm(cursor, next);
    loop += leg;
    if (i > 0) between += leg;
    cursor = next;
  }
  loop += haversineKm(cursor, { lat: home.homeLat, lng: home.homeLng });
  return { loop, between: stops.length >= 2 ? between : null };
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/**
 * 배정일 직전 7일. 휴무 달력(슬롯 조정 제외)이 있으면 그 다음 날부터 다시 센다.
 * 휴무 이후 하루 2건은 40점(보통). 휴무가 없으면 주간 정상 근무일·건수가 보통이다.
 */
export async function loadLeaderFatigue(
  db: Db,
  tenantId: string,
  workDate: string,
  leaders: Array<{ id: string; homeLat: number; homeLng: number }>,
  includeCrewInFatigue: boolean,
  normalWorkDays: number,
  normalJobs: number,
  twoRoomMax: number,
): Promise<Map<string, FatigueRow>> {
  const out = new Map<string, FatigueRow>();
  if (leaders.length === 0) return out;
  const from = addDaysToKstYmd(workDate, -LOOKBACK_DAYS);
  const to = addDaysToKstYmd(workDate, -1);
  const rangeFrom = kstDayRangeYmd(from);
  const rangeTo = kstDayRangeYmd(to);
  if (!rangeFrom || !rangeTo) return out;
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

  const offs = await db.userDayOff.findMany({
    where: {
      teamLeaderId: { in: leaders.map((leader) => leader.id) },
      adminSlotAdjust: false,
      date: { gte: rangeFrom.gte, lte: rangeTo.lte },
    },
    select: { teamLeaderId: true, date: true },
  });
  const restByLeader = new Map<string, string[]>();
  for (const off of offs) {
    const ymd = off.date.toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10);
    const list = restByLeader.get(off.teamLeaderId) ?? [];
    list.push(ymd);
    restByLeader.set(off.teamLeaderId, list);
  }

  const homeOf = new Map(leaders.map((leader) => [leader.id, leader]));
  const stats = new Map<string, LeaderStat>();
  for (const leader of leaders) {
    const allJobs = byLeader.get(leader.id) ?? [];
    const restYmds = (restByLeader.get(leader.id) ?? []).filter((ymd) => ymd >= from && ymd <= to).sort();
    const lastRest = restYmds.length > 0 ? restYmds[restYmds.length - 1] : null;
    const spanFrom = lastRest ? addDaysToKstYmd(lastRest, 1) : from;
    const jobs = allJobs.filter((job) => job.ymd >= spanFrom && job.ymd <= to);
    const worked = new Set(jobs.map((job) => job.ymd));
    const byDay = new Map<string, PastJob[]>();
    let pyeongScore = 0;
    let largeJobs = 0;
    let soloJobs = 0;
    let crewScore = 0;
    let extraJobs = 0;
    const countByDay = new Map<string, number>();
    for (const job of jobs) {
      const house = jobHousePoints(job, includeCrewInFatigue, twoRoomMax);
      pyeongScore += house.pyeong;
      crewScore += house.crew;
      if (house.pyeong > 0) largeJobs += 1;
      if (house.twoRoomSolo) soloJobs += 1;
      countByDay.set(job.ymd, (countByDay.get(job.ymd) ?? 0) + 1);
      const day = byDay.get(job.ymd) ?? [];
      day.push(job);
      byDay.set(job.ymd, day);
    }
    for (const count of countByDay.values()) extraJobs += Math.max(0, count - 2);
    const home = homeOf.get(leader.id);
    const loops: number[] = [];
    const betweens: number[] = [];
    if (home) {
      for (const dayJobs of byDay.values()) {
        const travel = dayTravel(dayJobs, home);
        if (!travel || travel.loop <= 0) continue;
        loops.push(travel.loop);
        if (travel.between != null) betweens.push(travel.between);
      }
    }
    stats.set(leader.id, {
      workedDays: worked.size,
      jobCount: jobs.length,
      restDays: restYmds.length,
      sinceRest: lastRest != null,
      extraJobs,
      loopAvg: loops.length > 0 ? mean(loops) : null,
      betweenAvg: betweens.length > 0 ? mean(betweens) : null,
      distanceSinceRestKm: loops.length > 0 ? Math.round(loops.reduce((sum, value) => sum + value, 0)) : null,
      largeJobs,
      soloJobs,
      crewScore,
      pyeongScore,
    });
  }

  const loopAvgs = [...stats.values()].map((row) => row.loopAvg).filter((value): value is number => value != null);
  const betweenAvgs = [...stats.values()].map((row) => row.betweenAvg).filter((value): value is number => value != null);
  const teamLoop = loopAvgs.length >= 2 ? mean(loopAvgs) : null;
  const teamBetween = betweenAvgs.length >= 2 ? mean(betweenAvgs) : null;

  for (const leader of leaders) {
    const row = stats.get(leader.id);
    if (!row) continue;
    let score = row.sinceRest && row.jobCount === 0 ? 18 : NORMAL_SCORE;
    if (row.sinceRest) score += row.extraJobs * 4;
    else {
      score += (row.workedDays - normalWorkDays) * 8;
      if (row.workedDays >= LOOKBACK_DAYS && normalWorkDays < LOOKBACK_DAYS) score += 6;
      score += Math.max(0, row.jobCount - normalJobs) * 3;
    }
    score += row.pyeongScore + row.crewScore;

    if (row.jobCount > 0) {
      if (row.loopAvg == null || teamLoop == null) score += 2;
      else if (row.loopAvg <= teamLoop) score += 2;
      else score += Math.min(20, Math.floor((row.loopAvg - teamLoop) / 4));

      if (row.betweenAvg != null && teamBetween != null && row.betweenAvg > teamBetween) {
        score += Math.min(30, Math.floor((row.betweenAvg - teamBetween) / 2));
      }
    }

    const noteParts = row.sinceRest
      ? [`휴무 이후 ${row.jobCount}건`, row.distanceSinceRestKm == null ? '거리 없음' : `누적 ${row.distanceSinceRestKm}km`]
      : [`휴무 없음 ${LOOKBACK_DAYS}일 ${row.workedDays}일`, `${row.jobCount}건`];
    if (row.jobCount > 0 && row.loopAvg == null) noteParts.push('하루 거리 없음');
    else if (row.jobCount > 0 && teamLoop == null) noteParts.push('비교할 평균 없음');
    else if (row.loopAvg != null && teamLoop != null) {
      noteParts.push(`팀 평균 ${Math.round(teamLoop)}km`);
      noteParts.push(`이 팀장 ${Math.round(row.loopAvg)}km`);
    }
    if (row.betweenAvg != null && teamBetween != null) {
      const delta = Math.round(row.betweenAvg - teamBetween);
      noteParts.push(`현장 사이 ${delta > 0 ? `+${delta}` : String(delta)}km`);
    }
    if (row.largeJobs > 0) noteParts.push(`큰 집 ${row.largeJobs}건`);
    if (row.soloJobs > 0) noteParts.push(`투룸 혼자 ${row.soloJobs}건`);
    const fatigue = fatiguePercent(score);
    const betweenDeltaKm =
      row.betweenAvg != null && teamBetween != null ? Math.round(row.betweenAvg - teamBetween) : null;
    out.set(leader.id, {
      band: bandOf(fatigue),
      fatigue,
      note: noteParts.join(' · '),
      detail: {
        windowDays: LOOKBACK_DAYS,
        workedDays: row.workedDays,
        jobCount: row.jobCount,
        restDays: row.restDays,
        sinceRest: row.sinceRest,
        normalWorkDays,
        normalJobs,
        loopKm: row.loopAvg == null ? null : Math.round(row.loopAvg),
        teamLoopKm: teamLoop == null ? null : Math.round(teamLoop),
        betweenDeltaKm,
        distanceSinceRestKm: row.distanceSinceRestKm,
        largeJobs: row.largeJobs,
        soloJobs: row.soloJobs,
      },
    });
  }
  return out;
}
