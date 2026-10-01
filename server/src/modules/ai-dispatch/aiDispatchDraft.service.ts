import { randomUUID } from 'crypto';
import type { PrismaClient } from '@prisma/client';
import { isAiProductConfigured } from '../ai/aiProvider.service.js';
import { reviewDispatchBoard } from './aiDispatchReview.js';
import { ensureDispatchHistoryLessons, loadDispatchLessons } from './aiDispatchLessons.js';
import type { AiDispatchSlot } from './aiDispatch.constants.js';
import {
  leadersForJob,
  loadDispatchDay,
  type DispatchJob,
  type DispatchLeader,
  type DispatchManualJob,
} from './aiDispatchContext.service.js';
import { setAiDispatchProgress } from './aiDispatchProgress.js';
import { haversineKm, isSmallHome, sizePolicyAllows, slotJobWeight } from './aiDispatchRules.js';

type Db = PrismaClient;

type DraftLine = {
  inquiryId: string;
  teamLeaderId: string | null;
  slot: AiDispatchSlot;
  reason: string;
  updatedAt: string;
};

function oneWayKm(leader: DispatchLeader, job: DispatchJob): number | null {
  if (job.lat == null || job.lng == null) return null;
  return Math.round(haversineKm({ lat: leader.homeLat, lng: leader.homeLng }, { lat: job.lat, lng: job.lng }) * 10) / 10;
}

function betweenKm(a: { lat: number | null; lng: number | null }, b: { lat: number | null; lng: number | null }): number | null {
  if (a.lat == null || a.lng == null || b.lat == null || b.lng == null) return null;
  return Math.round(haversineKm({ lat: a.lat, lng: a.lng }, { lat: b.lat, lng: b.lng }) * 10) / 10;
}

/** 이 편도 안이면 집에서 가까운 오전입니다. 피로가 높은 팀장에게 먼저 줍니다. */
const CLOSE_HOME_KM = 25;
/** 피로가 낮아도 집에서 이 편도를 넘기면 넣지 않습니다. */
const MAX_HOME_KM = 70;

function homeCapKm(leader: DispatchLeader, pool: DispatchLeader[]): number {
  return fatigueBias(leader, pool) >= 0.66 ? CLOSE_HOME_KM : MAX_HOME_KM;
}

function homeTooFar(leader: DispatchLeader, job: DispatchJob, pool: DispatchLeader[]): boolean {
  const km = oneWayKm(leader, job);
  if (km == null) return false;
  return km > homeCapKm(leader, pool);
}

function medianKm(values: number[]): number {
  if (values.length === 0) return 12;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** 그날 가장 가까운 오전·오후를 기준으로, 그보다 훨씬 먼 이동만 거른다. */
function clusterHopKm(ams: Array<{ lat: number | null; lng: number | null }>, pms: Array<{ lat: number | null; lng: number | null }>): number {
  const nearest: number[] = [];
  const closest = (job: { lat: number | null; lng: number | null }, others: Array<{ lat: number | null; lng: number | null }>) => {
    let best: number | null = null;
    for (const other of others) {
      const km = betweenKm(job, other);
      if (km == null) continue;
      if (best == null || km < best) best = km;
    }
    if (best != null) nearest.push(best);
  };
  for (const am of ams) closest(am, pms);
  for (const pm of pms) closest(pm, ams);
  const cap = Math.max(medianKm(nearest) * 3, 10);
  return Math.round(Math.min(cap, 55) * 10) / 10;
}

function sitesTooFar(stops: Array<{ lat: number | null; lng: number | null }>, job: DispatchJob, hopKm: number): boolean {
  if (stops.length === 0) return false;
  if (job.lat == null || job.lng == null) return true;
  return stops.some((stop) => {
    const km = betweenKm(stop, job);
    return km == null || km > hopKm;
  });
}

function tooFarReason(): string {
  return '그날 붙어 있는 일정끼리 먼저 묶었습니다. 이 건은 그 동선보다 멀어 따로 두었습니다.';
}

function preferLeaderForMorning(am: DispatchJob) {
  return (a: DispatchLeader, b: DispatchLeader) => {
    const aKm = oneWayKm(a, am) ?? 999;
    const bKm = oneWayKm(b, am) ?? 999;
    const aFar = aKm > CLOSE_HOME_KM;
    const bFar = bKm > CLOSE_HOME_KM;
    if (aFar && bFar) return a.fatigue - b.fatigue || aKm - bKm;
    if (!aFar && !bFar) return b.fatigue - a.fatigue || aKm - bKm;
    return aKm - bKm;
  };
}


function seatWeight(slot: AiDispatchSlot): number {
  return slotJobWeight(slot);
}

function pickLeader(
  leaders: DispatchLeader[],
  job: DispatchJob,
  used: Map<string, number>,
  taken: Set<string>,
  twoRoomMax: number,
): DispatchLeader | null {
  const open = leaders.filter((leader) => !taken.has(leader.id) && seatsLeft(leader, used) >= seatWeight(job.slot));
  if (open.length === 0) return null;
  const openIds = new Set(open.map((leader) => leader.id));
  const preferred = leadersForJob(leaders, job, twoRoomMax).filter((leader) => openIds.has(leader.id));
  if (preferred.length === 0) return null;
  const small = isSmallHome({ isOneRoom: job.isOneRoom, areaPyeong: job.pyeong }, twoRoomMax);
  const oneOnly = preferred.filter((leader) => leader.sizePolicy === 'ONE_ROOM_ONLY');
  const oneAndTwo = preferred.filter((leader) => leader.sizePolicy === 'ONE_AND_TWO');
  const pool =
    small && job.isOneRoom && oneOnly.length > 0 ? oneOnly : small && oneAndTwo.length > 0 ? oneAndTwo : preferred;
  return [...pool].sort((a, b) => compareLeaders(a, b, [job], used, 1, leaders))[0] ?? null;
}

function fatigueBias(leader: DispatchLeader, pool: DispatchLeader[]): number {
  if (pool.length === 0) return 0.5;
  const scores = pool.map((item) => item.fatigue);
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  if (max - min < 1) return 0.5;
  return (leader.fatigue - min) / (max - min);
}

function easeLine(leader: DispatchLeader, pool: DispatchLeader[]): string {
  const scores = pool.map((item) => item.fatigue);
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  if (max - min < 5) return '';
  if (leader.fatigue >= min + (max - min) * 0.66) return '피로 점수가 더 높아 가까운 일정입니다';
  if (leader.fatigue <= min + (max - min) * 0.33) return '피로 점수가 더 낮아 조금 먼 일정입니다';
  return '';
}

function homeLoopKm(leader: DispatchLeader, stops: DispatchJob[]): number | null {
  const ordered = [...stops]
    .filter((job) => job.lat != null && job.lng != null)
    .sort((a, b) => (a.slot === 'PM' ? 1 : 0) - (b.slot === 'PM' ? 1 : 0));
  if (ordered.length === 0) return null;
  const home = { lat: leader.homeLat, lng: leader.homeLng };
  let total = haversineKm(home, { lat: ordered[0].lat as number, lng: ordered[0].lng as number });
  for (let i = 1; i < ordered.length; i += 1) {
    total += haversineKm(
      { lat: ordered[i - 1].lat as number, lng: ordered[i - 1].lng as number },
      { lat: ordered[i].lat as number, lng: ordered[i].lng as number },
    );
  }
  const last = ordered[ordered.length - 1];
  total += haversineKm({ lat: last.lat as number, lng: last.lng as number }, home);
  return Math.round(total * 10) / 10;
}

function tonePenalty(job: DispatchJob): number {
  if (job.tone === 'GOOD') return 0;
  if (job.tone === 'ELDERLY') return 14;
  if (job.tone === 'BAD') return 28;
  if (job.tone === 'SEVERE') return 46;
  return 6;
}

function seatsLeft(leader: DispatchLeader, used: Map<string, number>): number {
  return Math.max(0, leader.jobsPerDay - (used.get(leader.id) ?? 0));
}

function noSeatReason(leaders: DispatchLeader[]): string {
  return leaders.length === 0 ? '넣을 팀장이 없습니다.' : '모든 팀장이 배정된 상태입니다.';
}

function sizeMismatchReason(): string {
  return '집 크기가 맞는 팀장이 없습니다.';
}

function assignmentCost(leader: DispatchLeader, stops: DispatchJob[], pool: DispatchLeader[]): number {
  const bias = fatigueBias(leader, pool);
  const tone = stops.reduce((sum, job) => sum + tonePenalty(job), 0) * 0.15;
  const loop = homeLoopKm(leader, stops) ?? 45;
  if (stops.length < 2) {
    const km = oneWayKm(leader, stops[0]) ?? loop / 2;
    return bias * Math.max(0, km - 8) + (1 - bias) * Math.max(0, 18 - km) + tone;
  }
  const between = betweenKm(stops[0], stops[1]) ?? 25;
  const hard = Math.max(0, between - 6) + Math.max(0, loop - 20);
  const easy = Math.max(0, 10 - between) + Math.max(0, 28 - loop);
  return bias * hard + (1 - bias) * easy + tone;
}

function compareLeaders(
  a: DispatchLeader,
  b: DispatchLeader,
  stops: DispatchJob[],
  used: Map<string, number>,
  weight: number,
  pool: DispatchLeader[],
): number {
  const aOver = (used.get(a.id) ?? 0) + weight > a.jobsPerDay ? 1 : 0;
  const bOver = (used.get(b.id) ?? 0) + weight > b.jobsPerDay ? 1 : 0;
  if (aOver !== bOver) return aOver - bOver;
  const aNarrow = weight >= 2 && a.jobsPerDay < 2 ? 1 : 0;
  const bNarrow = weight >= 2 && b.jobsPerDay < 2 ? 1 : 0;
  if (aNarrow !== bNarrow) return aNarrow - bNarrow;
  return assignmentCost(a, stops, pool) - assignmentCost(b, stops, pool);
}

function sizeFirstNote(leader: DispatchLeader): string {
  if (leader.sizePolicy === 'ONE_ROOM_ONLY') return '원룸만 받는 팀장이라 원룸을 먼저 넣었습니다';
  if (leader.sizePolicy === 'ONE_AND_TWO') return '원룸·투룸만 받는 팀장이라 이 크기를 먼저 넣었습니다';
  return '';
}

function fillReason(leader: DispatchLeader, job: DispatchJob, pool: DispatchLeader[]): string {
  const km = oneWayKm(leader, job);
  const bits = [
    km != null ? `집에서 편도 ${km}km` : '현장 좌표가 없어 거리는 재지 못했습니다',
    sizeFirstNote(leader),
    leader.jobsPerDay < 2 ? '하루 1건이라 집과의 거리만 봤습니다' : '',
    easeLine(leader, pool),
    job.slot === 'HUMAN' ? '시간대는 한 번 더 봐 주세요' : '',
  ].filter(Boolean);
  return bits.join(' · ').slice(0, 160);
}

function fillOpenJobs(
  lines: DraftLine[],
  jobs: DispatchJob[],
  leaders: DispatchLeader[],
  twoRoomMax: number,
): DraftLine[] {
  const used = new Map(leaders.map((leader) => [leader.id, leader.usedJobs]));
  for (const line of lines) {
    if (!line.teamLeaderId) continue;
    const job = jobs.find((item) => item.id === line.inquiryId);
    used.set(line.teamLeaderId, (used.get(line.teamLeaderId) ?? 0) + seatWeight(job?.slot ?? 'AM'));
  }
  const next: DraftLine[] = [];
  for (const job of jobs) {
    if (job.blockedReason) {
      next.push({
        inquiryId: job.id,
        teamLeaderId: null,
        slot: job.slot,
        reason: job.blockedReason,
        updatedAt: job.updatedAt,
      });
      continue;
    }
    const kept = lines.filter((line) => line.inquiryId === job.id && line.teamLeaderId);
    const taken = new Set(kept.map((line) => line.teamLeaderId as string));
    const filled = [...kept];
    while (filled.length < job.requiredLeaders && leaders.length > 0) {
      const leader = pickLeader(leaders, job, used, taken, twoRoomMax);
      if (!leader) break;
      const before = used.get(leader.id) ?? 0;
      taken.add(leader.id);
      used.set(leader.id, before + seatWeight(job.slot));
      filled.push({
        inquiryId: job.id,
        teamLeaderId: leader.id,
        slot: job.slot,
        reason: fillReason(leader, job, leaders),
        updatedAt: job.updatedAt,
      });
    }
    if (filled.length === 0) {
      next.push({
        inquiryId: job.id,
        teamLeaderId: null,
        slot: job.slot,
        reason:
          leaders.some(
            (leader) =>
              seatsLeft(leader, used) >= seatWeight(job.slot) &&
              (seatWeight(job.slot) < 2 || leader.jobsPerDay >= 2) &&
              !fitsSize(leader, [job], twoRoomMax),
          ) && leadersForJob(leaders, job, twoRoomMax).length === 0
            ? sizeMismatchReason()
            : noSeatReason(leaders),
        updatedAt: job.updatedAt,
      });
    } else {
      next.push(...filled);
    }
  }
  return next;
}

function movableDayJob(job: DispatchJob): boolean {
  return !job.blockedReason && job.requiredLeaders <= 1 && (job.slot === 'AM' || job.slot === 'PM');
}

function fitsSize(leader: DispatchLeader, jobs: DispatchJob[], twoRoomMax: number): boolean {
  return jobs.every((job) => sizePolicyAllows(leader.sizePolicy, { isOneRoom: job.isOneRoom, areaPyeong: job.pyeong }, twoRoomMax));
}

function pairReason(leader: DispatchLeader, am: DispatchJob, pm: DispatchJob, pool: DispatchLeader[]): string {
  const between = betweenKm(am, pm);
  const morning = oneWayKm(leader, am);
  const bits = [
    between != null ? `두 곳 ${between}km` : '현장 사이 거리를 재지 못했습니다',
    morning != null ? `오전은 집에서 ${morning}km` : '',
    sizeFirstNote(leader),
    easeLine(leader, pool),
  ].filter(Boolean);
  return bits.join(' · ').slice(0, 160);
}

function tuneMorningAfternoon(
  lines: DraftLine[],
  jobs: DispatchJob[],
  leaders: DispatchLeader[],
  twoRoomMax: number,
  manualJobs: DispatchManualJob[],
): DraftLine[] {
  const movable = new Set(jobs.filter(movableDayJob).map((job) => job.id));
  const loose = jobs.filter(
    (job) => !job.blockedReason && job.requiredLeaders <= 1 && (job.slot === 'ALL_DAY' || job.slot === 'HUMAN'),
  );
  const looseIds = new Set(loose.map((job) => job.id));
  const kept = lines.filter((line) => !movable.has(line.inquiryId) && !looseIds.has(line.inquiryId));
  const used = new Map(leaders.map((leader) => [leader.id, leader.usedJobs]));
  for (const line of kept) {
    if (!line.teamLeaderId) continue;
    const job = jobs.find((item) => item.id === line.inquiryId);
    used.set(line.teamLeaderId, (used.get(line.teamLeaderId) ?? 0) + seatWeight(job?.slot ?? 'AM'));
  }

  const stopsNow = (leaderId: string, extra: DraftLine[] = tuned): Array<{ lat: number | null; lng: number | null }> => {
    const pinned = manualJobs
      .filter((job) => job.teamLeaderId === leaderId)
      .map((job) => ({ lat: job.lat, lng: job.lng }));
    const drafted = extra
      .filter((line) => line.teamLeaderId === leaderId)
      .map((line) => jobs.find((job) => job.id === line.inquiryId))
      .filter((job): job is DispatchJob => job != null)
      .map((job) => ({ lat: job.lat, lng: job.lng }));
    return [...pinned, ...drafted];
  };
  const tuned: DraftLine[] = [...kept];
  const pushStop = (job: DispatchJob, leader: DispatchLeader, reason: string) => {
    const before = used.get(leader.id) ?? 0;
    used.set(leader.id, before + seatWeight(job.slot));
    tuned.push({
      inquiryId: job.id,
      teamLeaderId: leader.id,
      slot: job.slot,
      reason,
      updatedAt: job.updatedAt,
    });
  };
  const placedIds = () => new Set(tuned.filter((line) => line.teamLeaderId).map((line) => line.inquiryId));

  const placeAmong = (poolJobs: DispatchJob[], poolLeaders: DispatchLeader[], explain: boolean) => {
    const openJobs = poolJobs.filter((job) => !placedIds().has(job.id));
    if (poolLeaders.length === 0) {
      if (!explain) return;
      for (const job of openJobs) {
        tuned.push({
          inquiryId: job.id,
          teamLeaderId: null,
          slot: job.slot,
          reason: noSeatReason(leaders),
          updatedAt: job.updatedAt,
        });
      }
      return;
    }
    const ams = openJobs.filter((job) => job.slot === 'AM');
    const pms = openJobs.filter((job) => job.slot === 'PM');
    const openLoose = openJobs.filter((job) => job.slot === 'ALL_DAY' || job.slot === 'HUMAN');
    const hopKm = clusterHopKm(ams, pms);
    const candidates: Array<{ am: DispatchJob; pm: DispatchJob; between: number }> = [];
    for (const am of ams) {
      for (const pm of pms) {
        const between = betweenKm(am, pm);
        if (between == null || between > hopKm) continue;
        candidates.push({ am, pm, between });
      }
    }
    candidates.sort((a, b) => a.between - b.between);
    const usedAm = new Set<string>();
    const usedPm = new Set<string>();
    const pairs: Array<{ am: DispatchJob; pm: DispatchJob }> = [];
    for (const candidate of candidates) {
      if (usedAm.has(candidate.am.id) || usedPm.has(candidate.pm.id)) continue;
      usedAm.add(candidate.am.id);
      usedPm.add(candidate.pm.id);
      pairs.push({ am: candidate.am, pm: candidate.pm });
    }
    const tiredFirst = [...poolLeaders].sort((a, b) => b.fatigue - a.fatigue || a.name.localeCompare(b.name, 'ko'));
    const stillOpen: Array<{ am: DispatchJob; pm: DispatchJob }> = [];
    for (const pair of pairs) {
      const options = tiredFirst.filter(
        (leader) =>
          leader.jobsPerDay >= 2 &&
          seatsLeft(leader, used) >= 2 &&
          fitsSize(leader, [pair.am, pair.pm], twoRoomMax) &&
          !homeTooFar(leader, pair.am, poolLeaders) &&
          !sitesTooFar(stopsNow(leader.id), pair.am, hopKm) &&
          !sitesTooFar([...stopsNow(leader.id), pair.am], pair.pm, hopKm),
      );
      if (options.length === 0) {
        stillOpen.push(pair);
        continue;
      }
      options.sort(preferLeaderForMorning(pair.am));
      const leader = options[0];
      const reason = pairReason(leader, pair.am, pair.pm, poolLeaders);
      pushStop(pair.am, leader, reason);
      pushStop(pair.pm, leader, reason);
    }
    for (const pair of stillOpen) {
      usedAm.delete(pair.am.id);
      usedPm.delete(pair.pm.id);
    }
    const giveSingles = (pendingIn: DispatchJob[]) => {
      const pending = [...pendingIn];
      let cursor = 0;
      while (pending.length > 0) {
        let placed = false;
        for (let step = 0; step < tiredFirst.length; step += 1) {
          const leader = tiredFirst[(cursor + step) % tiredFirst.length];
          const seatOk = (job: DispatchJob) =>
            seatsLeft(leader, used) >= seatWeight(job.slot) && (seatWeight(job.slot) < 2 || leader.jobsPerDay >= 2);
          const choices = pending.filter(
            (job) =>
              seatOk(job) &&
              fitsSize(leader, [job], twoRoomMax) &&
              !homeTooFar(leader, job, poolLeaders) &&
              !sitesTooFar(stopsNow(leader.id), job, hopKm),
          );
          if (choices.length === 0) continue;
          const pool = choices.slice().sort((a, b) => (oneWayKm(leader, a) ?? 999) - (oneWayKm(leader, b) ?? 999));
          const job = pool[0];
          pushStop(job, leader, fillReason(leader, job, poolLeaders));
          pending.splice(
            pending.findIndex((item) => item.id === job.id),
            1,
          );
          cursor = (cursor + step + 1) % tiredFirst.length;
          placed = true;
          break;
        }
        if (!placed) break;
      }
      if (!explain) return;
      for (const job of pending) {
        const seated = tiredFirst.filter(
          (leader) => seatsLeft(leader, used) >= seatWeight(job.slot) && (seatWeight(job.slot) < 2 || leader.jobsPerDay >= 2),
        );
        const sized = seated.filter((leader) => fitsSize(leader, [job], twoRoomMax));
        tuned.push({
          inquiryId: job.id,
          teamLeaderId: null,
          slot: job.slot,
          reason:
            seated.length > 0 && sized.length === 0 ? sizeMismatchReason() : sized.length > 0 ? tooFarReason() : noSeatReason(leaders),
          updatedAt: job.updatedAt,
        });
      }
    };
    giveSingles(
      [...ams, ...pms].filter((job) => !(job.slot === 'AM' && usedAm.has(job.id)) && !(job.slot === 'PM' && usedPm.has(job.id))),
    );
    giveSingles(openLoose);
  };

  const dayJobs = jobs.filter((job) => movable.has(job.id) || looseIds.has(job.id));
  const checkedRoom = (job: DispatchJob) => job.isOneRoom;
  placeAmong(
    dayJobs.filter(checkedRoom),
    leaders.filter((leader) => leader.sizePolicy === 'ONE_ROOM_ONLY'),
    false,
  );
  placeAmong(
    dayJobs.filter(checkedRoom),
    leaders.filter((leader) => leader.sizePolicy === 'ONE_AND_TWO'),
    false,
  );
  placeAmong(
    dayJobs,
    leaders.filter((leader) => leader.sizePolicy === 'UNRESTRICTED' || leader.sizePolicy === 'EXCLUDE_ONE_AND_TWO'),
    true,
  );
  return tuned;
}

/** 칸이 남은 팀장에게만 넣되, 그날 가까운 동선보다 훨씬 먼 현장은 붙이지 않는다. */
function assignLeftovers(
  lines: DraftLine[],
  jobs: DispatchJob[],
  leaders: DispatchLeader[],
  manualJobs: DispatchManualJob[],
  twoRoomMax: number,
): DraftLine[] {
  const hopKm = clusterHopKm(
    jobs.filter((job) => !job.blockedReason && job.slot === 'AM'),
    jobs.filter((job) => !job.blockedReason && job.slot === 'PM'),
  );
  const used = new Map(leaders.map((leader) => [leader.id, leader.usedJobs]));
  const next: DraftLine[] = [];
  for (const line of lines) {
    if (!line.teamLeaderId) continue;
    next.push(line);
    const job = jobs.find((item) => item.id === line.inquiryId);
    used.set(line.teamLeaderId, (used.get(line.teamLeaderId) ?? 0) + seatWeight(job?.slot ?? line.slot));
  }
  for (const job of jobs) {
    if (job.blockedReason) {
      if (!next.some((line) => line.inquiryId === job.id)) {
        next.push({
          inquiryId: job.id,
          teamLeaderId: null,
          slot: job.slot,
          reason: job.blockedReason,
          updatedAt: job.updatedAt,
        });
      }
      continue;
    }
    const taken = new Set(
      next.filter((line) => line.inquiryId === job.id && line.teamLeaderId).map((line) => line.teamLeaderId as string),
    );
    let blockedByDistance = false;
    let blockedBySize = false;
    while (taken.size < job.requiredLeaders) {
      const open = leaders.filter(
        (leader) =>
          !taken.has(leader.id) &&
          seatsLeft(leader, used) >= seatWeight(job.slot) &&
          (seatWeight(job.slot) < 2 || leader.jobsPerDay >= 2),
      );
      if (open.length === 0) break;
      const sized = open.filter((leader) => fitsSize(leader, [job], twoRoomMax));
      if (sized.length === 0) {
        blockedBySize = true;
        break;
      }
      const near = sized.filter((leader) => {
        const pinned = manualJobs.filter((row) => row.teamLeaderId === leader.id);
        const drafted = next
          .filter((line) => line.teamLeaderId === leader.id)
          .map((line) => jobs.find((item) => item.id === line.inquiryId))
          .filter((item): item is DispatchJob => item != null);
        return !homeTooFar(leader, job, leaders) && !sitesTooFar([...pinned, ...drafted], job, hopKm);
      });
      if (near.length === 0) {
        blockedByDistance = true;
        break;
      }
      const smallJob = isSmallHome({ isOneRoom: job.isOneRoom, areaPyeong: job.pyeong }, twoRoomMax);
      near.sort((a, b) => {
        if (smallJob) {
          const rank = (leader: DispatchLeader) =>
            leader.sizePolicy === 'ONE_ROOM_ONLY' ? 0 : leader.sizePolicy === 'ONE_AND_TWO' ? 1 : 2;
          const diff = rank(a) - rank(b);
          if (diff !== 0) return diff;
        }
        return preferLeaderForMorning(job)(a, b);
      });
      const leader = near[0];
      taken.add(leader.id);
      used.set(leader.id, (used.get(leader.id) ?? 0) + seatWeight(job.slot));
      const paired = job.slot === 'AM' || job.slot === 'PM' ? '가까운 현장만 남긴 한 건입니다' : '';
      next.push({
        inquiryId: job.id,
        teamLeaderId: leader.id,
        slot: job.slot,
        reason: [fillReason(leader, job, leaders), paired].filter(Boolean).join(' · ').slice(0, 160),
        updatedAt: job.updatedAt,
      });
    }
    if (!next.some((line) => line.inquiryId === job.id && line.teamLeaderId)) {
      next.push({
        inquiryId: job.id,
        teamLeaderId: null,
        slot: job.slot,
        reason: blockedBySize ? sizeMismatchReason() : blockedByDistance ? tooFarReason() : noSeatReason(leaders),
        updatedAt: job.updatedAt,
      });
    }
  }
  return next;
}

function clampDailyCap(lines: DraftLine[], jobs: DispatchJob[], leaders: DispatchLeader[]): DraftLine[] {
  const jobById = new Map(jobs.map((job) => [job.id, job]));
  const cap = new Map(leaders.map((leader) => [leader.id, leader.jobsPerDay]));
  const used = new Map(leaders.map((leader) => [leader.id, leader.usedJobs]));
  const kept: DraftLine[] = [];
  const dropped: DraftLine[] = [];
  for (const line of lines) {
    if (!line.teamLeaderId) {
      kept.push(line);
      continue;
    }
    const job = jobById.get(line.inquiryId);
    const weight = seatWeight(job?.slot ?? line.slot);
    const limit = cap.get(line.teamLeaderId) ?? 2;
    const next = (used.get(line.teamLeaderId) ?? 0) + weight;
    if (next > limit) {
      dropped.push(line);
      continue;
    }
    used.set(line.teamLeaderId, next);
    kept.push(line);
  }
  const seen = new Set(kept.filter((line) => line.teamLeaderId).map((line) => line.inquiryId));
  for (const line of dropped) {
    if (seen.has(line.inquiryId)) continue;
    seen.add(line.inquiryId);
    kept.push({
      ...line,
      teamLeaderId: null,
      reason: noSeatReason(leaders),
    });
  }
  return kept;
}

export async function createAiDispatchDraft(db: Db, tenantId: string, actorId: string, workDate: string) {
  setAiDispatchProgress(tenantId, workDate, 1, '날짜의 일정을 모으고 있습니다.');
  const day = await loadDispatchDay(db, tenantId, workDate);
  if (!day) return { error: '날짜 형식이 올바르지 않습니다.' as const };
  const openJobs = day.jobs.filter((job) => !job.blockedReason);
  if (day.jobs.length === 0) {
    return { error: '이 날짜에 아직 배정되지 않은 예약완료 건이 없습니다.' as const };
  }
  if (!isAiProductConfigured('ai_dispatch')) {
    return {
      aiConfigured: false as const,
      message: 'AI 미설정',
      settings: day.settings,
      leaders: day.leaders,
      jobs: day.jobs,
    };
  }
  if (openJobs.length === 0) {
    const lines = clampDailyCap(fillOpenJobs([], day.jobs, day.leaders, day.settings.twoRoomMaxPyeong), day.jobs, day.leaders);
    const run = await saveRun(db, tenantId, actorId, workDate, lines, '집 주소가 있는 팀장이 없어 넣지 못했습니다.', null);
    return { aiConfigured: true as const, run };
  }

  setAiDispatchProgress(tenantId, workDate, 2, '팀장 집과 피로를 계산하고 있습니다.');
  setAiDispatchProgress(tenantId, workDate, 3, '붙어 있는 오전·오후를 먼저 묶고 있습니다.');
  const filled = fillOpenJobs([], day.jobs, day.leaders, day.settings.twoRoomMaxPyeong);
  const drafted = clampDailyCap(
    assignLeftovers(
      tuneMorningAfternoon(filled, day.jobs, day.leaders, day.settings.twoRoomMaxPyeong, day.manualJobs),
      day.jobs,
      day.leaders,
      day.manualJobs,
      day.settings.twoRoomMaxPyeong,
    ),
    day.jobs,
    day.leaders,
  );
  let lessons: string[] = [];
  try {
    await ensureDispatchHistoryLessons(db, tenantId);
    lessons = await loadDispatchLessons(db, tenantId);
  } catch (e) {
    console.error('[ai-dispatch] lessons', e instanceof Error ? e.message : 'unknown');
  }
  setAiDispatchProgress(
    tenantId,
    workDate,
    4,
    lessons.length > 0 ? 'AI가 지난 배정과 수정을 보고 있습니다.' : 'AI가 하루 배정을 다시 보고 있습니다.',
  );
  const reviewed = await reviewDispatchBoard({
    lines: drafted,
    jobs: day.jobs,
    leaders: day.leaders,
    manualJobs: day.manualJobs,
    twoRoomMax: day.settings.twoRoomMaxPyeong,
    lessons,
  });
  const lines = clampDailyCap(reviewed.lines, day.jobs, day.leaders);
  const learned = lessons.length > 0 ? '지난 배정과 관리자 수정을 반영했습니다. ' : '';
  const summary = reviewed.reviewed
    ? reviewed.changed > 0
      ? `${learned}AI가 하루 전체를 다시 보고 ${reviewed.changed}건의 팀장을 고쳤습니다. 승인 전에는 배정되지 않습니다.`
      : `${learned}AI가 하루 전체를 다시 보고 이 배정을 그대로 두었습니다. 승인 전에는 배정되지 않습니다.`
    : '붙어 있는 오전·오후를 먼저 묶었습니다. AI 검토가 끝나지 않아 그 초안을 그대로 둡니다. 승인 전에는 배정되지 않습니다.';
  setAiDispatchProgress(tenantId, workDate, 5, '초안을 저장하고 있습니다.');
  const run = await saveRun(db, tenantId, actorId, workDate, lines, summary, reviewed.usage);
  return { aiConfigured: true as const, run };
}

async function saveRun(
  db: Db,
  tenantId: string,
  actorId: string,
  workDate: string,
  lines: DraftLine[],
  summary: string,
  usage: { model: string; promptTokens: number; completionTokens: number } | null,
) {
  const work = new Date(`${workDate}T12:00:00+09:00`);
  return db.$transaction(async (tx) => {
    const previous = await tx.aiDispatchRun.findMany({
      where: { tenantId, workDate: work, status: 'DRAFT' },
      select: { id: true },
    });
    if (previous.length > 0) {
      await tx.aiDispatchProposal.updateMany({
        where: { tenantId, status: 'DRAFT', runId: { in: previous.map((row) => row.id) } },
        data: { status: 'SKIPPED' },
      });
      await tx.aiDispatchRun.updateMany({
        where: { id: { in: previous.map((row) => row.id) }, tenantId },
        data: { status: 'SUPERSEDED' },
      });
    }
    return tx.aiDispatchRun.create({
      data: {
        id: randomUUID(),
        tenantId,
        workDate: work,
        status: 'DRAFT',
        createdById: actorId,
        summary,
        model: usage?.model ?? null,
        promptTokens: usage?.promptTokens ?? 0,
        completionTokens: usage?.completionTokens ?? 0,
        proposals: {
          create: lines.map((line, index) => ({
            id: randomUUID(),
            tenantId,
            inquiryId: line.inquiryId,
            teamLeaderId: line.teamLeaderId,
            aiTeamLeaderId: line.teamLeaderId,
            slot: line.slot,
            reason: line.reason,
            status: 'DRAFT',
            inquiryUpdatedAt: new Date(line.updatedAt),
            sortOrder: index,
          })),
        },
      },
      include: {
        proposals: { orderBy: { sortOrder: 'asc' } },
      },
    });
  });
}
