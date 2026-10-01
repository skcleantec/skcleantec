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
import { matchSitePairs } from './aiDispatchPairing.js';
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

function fatigueHomeNote(leader: DispatchLeader, km: number | null, pool: DispatchLeader[]): string {
  if (km == null || pool.length < 2) return '';
  const bias = fatigueBias(leader, pool);
  if (bias >= 0.66) return '피로가 높아 집에서 가까운 현장을 맡습니다';
  if (bias <= 0.33) return '피로가 낮아 집에서 먼 현장을 맡습니다';
  return '';
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
    fatigueHomeNote(leader, km, pool),
    sizeFirstNote(leader),
    leader.jobsPerDay < 2 ? '하루 1건이라 집과의 거리만 봤습니다' : '',
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
    between != null ? `두 현장 ${between}km` : '현장 사이 거리를 재지 못했습니다',
    morning != null ? `오전은 집에서 ${morning}km` : '',
    fatigueHomeNote(leader, morning, pool),
    sizeFirstNote(leader),
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
    const pairedIds = new Set<string>();
    for (const pair of matchSitePairs(ams, pms)) {
      const options = poolLeaders.filter(
        (leader) => leader.jobsPerDay >= 2 && seatsLeft(leader, used) >= 2 && fitsSize(leader, [pair.am, pair.pm], twoRoomMax),
      );
      if (options.length === 0) continue;
      const withPinned = (leader: DispatchLeader): DispatchJob[] => [
        ...manualJobs
          .filter((row) => row.teamLeaderId === leader.id)
          .map(
            (row) =>
              ({
                id: row.id,
                customerName: row.customerName,
                areaLabel: row.areaLabel,
                lat: row.lat,
                lng: row.lng,
                pyeong: row.pyeong,
                isOneRoom: row.isOneRoom,
                tone: 'NORMAL',
                slot: row.slot,
                requiredLeaders: 1,
                updatedAt: '',
                preferredTime: null,
                blockedReason: null,
              }) satisfies DispatchJob,
          ),
        pair.am,
        pair.pm,
      ];
      options.sort((a, b) => assignmentCost(a, withPinned(a), poolLeaders) - assignmentCost(b, withPinned(b), poolLeaders));
      const leader = options[0];
      const reason = pairReason(leader, pair.am, pair.pm, poolLeaders);
      pushStop(pair.am, leader, reason);
      pushStop(pair.pm, leader, reason);
      pairedIds.add(pair.am.id);
      pairedIds.add(pair.pm.id);
    }
    const giveSingles = (pendingIn: DispatchJob[]) => {
      const pending = [...pendingIn];
      while (pending.length > 0) {
        let picked: { leader: DispatchLeader; job: DispatchJob; cost: number } | null = null;
        for (const leader of poolLeaders) {
          for (const job of pending) {
            const seatOk = seatsLeft(leader, used) >= seatWeight(job.slot) && (seatWeight(job.slot) < 2 || leader.jobsPerDay >= 2);
            if (!seatOk || !fitsSize(leader, [job], twoRoomMax)) continue;
            const held = jobs.filter((item) => tuned.some((line) => line.teamLeaderId === leader.id && line.inquiryId === item.id));
            const cost = assignmentCost(leader, [...held, job], poolLeaders);
            if (!picked || cost < picked.cost) picked = { leader, job, cost };
          }
        }
        if (!picked) break;
        pushStop(picked.job, picked.leader, fillReason(picked.leader, picked.job, poolLeaders));
        pending.splice(
          pending.findIndex((item) => item.id === picked.job.id),
          1,
        );
      }
      if (!explain) return;
      for (const job of pending) {
        const seated = poolLeaders.filter(
          (leader) => seatsLeft(leader, used) >= seatWeight(job.slot) && (seatWeight(job.slot) < 2 || leader.jobsPerDay >= 2),
        );
        const sized = seated.filter((leader) => fitsSize(leader, [job], twoRoomMax));
        tuned.push({
          inquiryId: job.id,
          teamLeaderId: null,
          slot: job.slot,
          reason: seated.length > 0 && sized.length === 0 ? sizeMismatchReason() : noSeatReason(leaders),
          updatedAt: job.updatedAt,
        });
      }
    };
    giveSingles([...ams, ...pms].filter((job) => !pairedIds.has(job.id)));
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

/** 아직 팀장이 없는 일정은 칸이 남은 팀장에게 넣습니다. 거리 때문에 빼지 않습니다. */
function assignLeftovers(
  lines: DraftLine[],
  jobs: DispatchJob[],
  leaders: DispatchLeader[],
  manualJobs: DispatchManualJob[],
  twoRoomMax: number,
): DraftLine[] {
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
      const smallJob = isSmallHome({ isOneRoom: job.isOneRoom, areaPyeong: job.pyeong }, twoRoomMax);
      const heldOf = (leader: DispatchLeader): DispatchJob[] => {
        const drafted = jobs.filter((item) => next.some((line) => line.teamLeaderId === leader.id && line.inquiryId === item.id));
        const pinned = manualJobs
          .filter((row) => row.teamLeaderId === leader.id)
          .map(
            (row) =>
              ({
                id: row.id,
                customerName: row.customerName,
                areaLabel: row.areaLabel,
                lat: row.lat,
                lng: row.lng,
                pyeong: row.pyeong,
                isOneRoom: row.isOneRoom,
                tone: 'NORMAL',
                slot: row.slot,
                requiredLeaders: 1,
                updatedAt: '',
                preferredTime: null,
                blockedReason: null,
              }) satisfies DispatchJob,
          );
        return [...pinned, ...drafted];
      };
      sized.sort((a, b) => {
        if (smallJob) {
          const rank = (leader: DispatchLeader) =>
            leader.sizePolicy === 'ONE_ROOM_ONLY' ? 0 : leader.sizePolicy === 'ONE_AND_TWO' ? 1 : 2;
          const diff = rank(a) - rank(b);
          if (diff !== 0) return diff;
        }
        const cost = (leader: DispatchLeader) => assignmentCost(leader, [...heldOf(leader), job], leaders);
        return cost(a) - cost(b);
      });
      const leader = sized[0];
      taken.add(leader.id);
      used.set(leader.id, (used.get(leader.id) ?? 0) + seatWeight(job.slot));
      next.push({
        inquiryId: job.id,
        teamLeaderId: leader.id,
        slot: job.slot,
        reason: fillReason(leader, job, leaders),
        updatedAt: job.updatedAt,
      });
    }
    if (!next.some((line) => line.inquiryId === job.id && line.teamLeaderId)) {
      next.push({
        inquiryId: job.id,
        teamLeaderId: null,
        slot: job.slot,
        reason: blockedBySize ? sizeMismatchReason() : noSeatReason(leaders),
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
