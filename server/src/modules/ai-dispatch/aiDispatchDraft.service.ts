import { randomUUID } from 'crypto';
import type { PrismaClient } from '@prisma/client';
import { callOpenAiJson, isAiProductConfigured } from '../ai/aiProvider.service.js';
import type { AiDispatchSlot } from './aiDispatch.constants.js';
import {
  leadersForJob,
  loadDispatchDay,
  type DispatchJob,
  type DispatchLeader,
} from './aiDispatchContext.service.js';
import { setAiDispatchProgress } from './aiDispatchProgress.js';
import { haversineKm, sizePolicyAllows, slotJobWeight } from './aiDispatchRules.js';

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

function roundTripKm(leader: DispatchLeader, job: DispatchJob): number | null {
  const one = oneWayKm(leader, job);
  if (one == null) return null;
  return Math.round(one * 2 * 10) / 10;
}

function betweenKm(a: DispatchJob, b: DispatchJob): number | null {
  if (a.lat == null || a.lng == null || b.lat == null || b.lng == null) return null;
  return Math.round(haversineKm({ lat: a.lat, lng: a.lng }, { lat: b.lat, lng: b.lng }) * 10) / 10;
}

function nearestOpposite(job: DispatchJob, jobs: DispatchJob[]) {
  const opposite = job.slot === 'AM' ? 'PM' : job.slot === 'PM' ? 'AM' : null;
  if (!opposite) return [];
  return jobs
    .filter((other) => other.id !== job.id && other.slot === opposite && !other.blockedReason)
    .map((other) => ({ inquiryId: other.id, betweenKm: betweenKm(job, other) }))
    .sort((a, b) => (a.betweenKm ?? 999) - (b.betweenKm ?? 999))
    .slice(0, 5);
}

function buildPrompt(leaders: DispatchLeader[], jobs: DispatchJob[], twoRoomMax: number): string {
  const leaderLines = leaders.map((leader) => ({
    userId: leader.id,
    name: leader.name,
    jobsPerDay: leader.jobsPerDay,
    remainingJobs: leader.remainingJobs,
    sizePolicy: leader.sizePolicy,
    condition: leader.band,
    fatigue: leader.fatigue,
    recentLoopKm: leader.detail.loopKm,
    teamAverageLoopKm: leader.detail.teamLoopKm,
    conditionNote: leader.note,
  }));
  const open = jobs.filter((job) => !job.blockedReason);
  const jobLines = open.map((job) => {
    const eligible = leadersForJob(leaders, job, twoRoomMax).map((leader) => ({
      userId: leader.id,
      roundTripKm: roundTripKm(leader, job),
      fatigue: leader.fatigue,
      pyeong: job.pyeong,
    }));
    return {
      inquiryId: job.id,
      area: job.areaLabel,
      pyeong: job.pyeong,
      oneRoom: job.isOneRoom,
      tone: job.tone,
      slot: job.slot,
      requiredLeaders: job.requiredLeaders,
      nearestOpposite: nearestOpposite(job, open),
      eligible,
    };
  });
  return JSON.stringify({ leaders: leaderLines, jobs: jobLines });
}

const SYSTEM = `당신은 입주청소 하루 배정 담당입니다. 목표는 팀장 불만이 없게 컨디션을 조절하는 것입니다.
가장 중요한 목표: 같은 팀장의 오전 현장과 오후 현장은 nearestOpposite.betweenKm가 작게 붙이세요.
그 다음:
- 하루 1건인 팀장은 집에서 가까운지만 보세요. 오전·오후를 묶지 마세요.
- 하루 2건인 팀장만 오전과 오후를 가깝게 묶으세요.
- fatigue 숫자가 더 높으면 집과도 가깝고 오전·오후도 가까운 하루를 주세요. 숫자가 더 낮으면 조금 먼 하루를 주세요. 휴무 직후는 0에 가깝고, 2주간 휴무가 없으면 매우 나쁨입니다.
- 고객 표시는 좋은 고객을 먼저, 그다음 보통, 어르신, 악성, 극악 순입니다. 표시 때문에 하루 동선이 도시를 가로지르게 하지 마세요.
- remainingJobs를 넘기지 마세요. 자리가 없으면 unassigned에 「모든 팀장이 배정된 상태입니다」라고 쓰세요.
- 팀장이 없으면 「넣을 팀장이 없습니다」라고 쓰세요.
- ALL_DAY는 2건입니다. requiredLeaders만큼 서로 다른 팀장을 넣으세요.
- 이유는 한국어 한 문장이고, 오전·오후 사이 km와 집에서 다녀오는 거리, 평수를 적으세요. 고객 이름·전화번호는 쓰지 마세요.
JSON만 반환:
{"assignments":[{"inquiryId":"","leaders":[{"userId":"","slot":"AM"}],"reason":""}],"unassigned":[{"inquiryId":"","reason":""}]}
slot은 AM, PM, ALL_DAY, HUMAN 중 접수와 같은 값입니다.`;

function parseLines(
  json: Record<string, unknown> | null,
  jobs: DispatchJob[],
  leaders: DispatchLeader[],
  twoRoomMax: number,
): DraftLine[] | null {
  if (!json || !Array.isArray(json.assignments)) return null;
  const jobById = new Map(jobs.map((job) => [job.id, job]));
  const used = new Map(leaders.map((leader) => [leader.id, leader.usedJobs]));
  const lines: DraftLine[] = [];
  const seenInquiry = new Set<string>();

  for (const raw of json.assignments) {
    if (!raw || typeof raw !== 'object') continue;
    const row = raw as { inquiryId?: unknown; leaders?: unknown; reason?: unknown };
    const inquiryId = typeof row.inquiryId === 'string' ? row.inquiryId : '';
    const job = jobById.get(inquiryId);
    if (!job || job.blockedReason || seenInquiry.has(inquiryId)) continue;
    if (!Array.isArray(row.leaders) || row.leaders.length !== job.requiredLeaders) continue;
    const reason = typeof row.reason === 'string' && row.reason.trim() ? row.reason.trim().slice(0, 300) : '';
    if (!reason) continue;
    const picked = new Set<string>();
    const weight = slotJobWeight(job.slot);
    const eligible = new Set(leadersForJob(leaders, job, twoRoomMax).map((leader) => leader.id));
    const accepted: DraftLine[] = [];
    let ok = true;
    for (const leaderRaw of row.leaders) {
      if (!leaderRaw || typeof leaderRaw !== 'object') {
        ok = false;
        break;
      }
      const leaderRow = leaderRaw as { userId?: unknown; slot?: unknown };
      const userId = typeof leaderRow.userId === 'string' ? leaderRow.userId : '';
      const slot = leaderRow.slot === 'AM' || leaderRow.slot === 'PM' || leaderRow.slot === 'ALL_DAY' ? leaderRow.slot : '';
      if (!userId || slot !== job.slot || !eligible.has(userId) || picked.has(userId)) {
        ok = false;
        break;
      }
      const nextUsed = (used.get(userId) ?? 0) + weight;
      const leader = leaders.find((item) => item.id === userId);
      if (!leader || nextUsed > leader.jobsPerDay) {
        ok = false;
        break;
      }
      used.set(userId, nextUsed);
      picked.add(userId);
      accepted.push({
        inquiryId,
        teamLeaderId: userId,
        slot,
        reason,
        updatedAt: job.updatedAt,
      });
    }
    if (!ok) {
      for (const line of accepted) {
        const leader = leaders.find((item) => item.id === line.teamLeaderId);
        if (leader) used.set(leader.id, Math.max(0, (used.get(leader.id) ?? 0) - weight));
      }
      continue;
    }
    lines.push(...accepted);
    seenInquiry.add(inquiryId);
  }

  for (const job of jobs) {
    if (seenInquiry.has(job.id)) continue;
    const fromModel = Array.isArray(json.unassigned)
      ? json.unassigned.find((item) => item && typeof item === 'object' && (item as { inquiryId?: string }).inquiryId === job.id)
      : null;
    const modelReason =
      fromModel && typeof (fromModel as { reason?: unknown }).reason === 'string'
        ? String((fromModel as { reason: string }).reason).trim()
        : '';
    lines.push({
      inquiryId: job.id,
      teamLeaderId: null,
      slot: job.slot,
      reason: (job.blockedReason || modelReason || '남은 자리보다 건이 많아 이번 초안에서 빠졌습니다.').slice(0, 300),
      updatedAt: job.updatedAt,
    });
  }
  return lines;
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
  const pool = preferred.length > 0 ? preferred : open;
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

function fillReason(leader: DispatchLeader, job: DispatchJob, pool: DispatchLeader[]): string {
  const km = oneWayKm(leader, job);
  const bits = [
    km != null ? `집에서 편도 ${km}km` : '현장 좌표가 없어 거리는 재지 못했습니다',
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
        reason: noSeatReason(leaders),
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
  const loop = homeLoopKm(leader, [am, pm]);
  const bits = [
    between != null ? `오전·오후 ${between}km` : '현장 사이 거리를 재지 못했습니다',
    loop != null ? `총 ${loop}km` : '',
    easeLine(leader, pool),
  ].filter(Boolean);
  return bits.join(' · ').slice(0, 160);
}

function tuneMorningAfternoon(
  lines: DraftLine[],
  jobs: DispatchJob[],
  leaders: DispatchLeader[],
  twoRoomMax: number,
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

  const ams = jobs.filter((job) => movable.has(job.id) && job.slot === 'AM');
  const pms = jobs.filter((job) => movable.has(job.id) && job.slot === 'PM');
  const candidates: Array<{ am: DispatchJob; pm: DispatchJob; score: number }> = [];
  for (const am of ams) {
    for (const pm of pms) {
      const between = betweenKm(am, pm) ?? 999;
      candidates.push({ am, pm, score: between + (tonePenalty(am) + tonePenalty(pm)) * 0.45 });
    }
  }
  candidates.sort((a, b) => a.score - b.score);
  const usedAm = new Set<string>();
  const usedPm = new Set<string>();
  const pairs: Array<{ am: DispatchJob; pm: DispatchJob }> = [];
  for (const candidate of candidates) {
    if (usedAm.has(candidate.am.id) || usedPm.has(candidate.pm.id)) continue;
    usedAm.add(candidate.am.id);
    usedPm.add(candidate.pm.id);
    pairs.push({ am: candidate.am, pm: candidate.pm });
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

  const pairPool = [...pairs];
  const tiredFirst = [...leaders].sort((a, b) => b.fatigue - a.fatigue || a.name.localeCompare(b.name, 'ko'));
  for (const leader of tiredFirst) {
    if (seatsLeft(leader, used) < 2 || leader.jobsPerDay < 2 || pairPool.length === 0) continue;
    const sized = pairPool.filter((pair) => fitsSize(leader, [pair.am, pair.pm], twoRoomMax));
    const pool = sized.length > 0 ? sized : pairPool;
    pool.sort((a, b) => {
      const aHard = (betweenKm(a.am, a.pm) ?? 40) + (homeLoopKm(leader, [a.am, a.pm]) ?? 80);
      const bHard = (betweenKm(b.am, b.pm) ?? 40) + (homeLoopKm(leader, [b.am, b.pm]) ?? 80);
      return aHard - bHard;
    });
    const picked = pool[0];
    const index = pairPool.findIndex((pair) => pair.am.id === picked.am.id && pair.pm.id === picked.pm.id);
    if (index >= 0) pairPool.splice(index, 1);
    const reason = pairReason(leader, picked.am, picked.pm, leaders);
    pushStop(picked.am, leader, reason);
    pushStop(picked.pm, leader, reason);
  }
  for (const pair of pairPool) {
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
        const choices = pending.filter(
          (job) => seatsLeft(leader, used) >= seatWeight(job.slot) && (seatWeight(job.slot) < 2 || leader.jobsPerDay >= 2),
        );
        if (choices.length === 0) continue;
        const sized = choices.filter((job) => fitsSize(leader, [job], twoRoomMax));
        const pool = (sized.length > 0 ? sized : choices)
          .slice()
          .sort((a, b) => (oneWayKm(leader, a) ?? 999) - (oneWayKm(leader, b) ?? 999) || tonePenalty(a) - tonePenalty(b));
        const job = pool[0];
        pushStop(job, leader, fillReason(leader, job, leaders));
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
    for (const job of pending) {
      tuned.push({
        inquiryId: job.id,
        teamLeaderId: null,
        slot: job.slot,
        reason: noSeatReason(leaders),
        updatedAt: job.updatedAt,
      });
    }
  };

  giveSingles(
    [...ams, ...pms].filter((job) => !(job.slot === 'AM' && usedAm.has(job.id)) && !(job.slot === 'PM' && usedPm.has(job.id))),
  );
  giveSingles(loose);
  return tuned;
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
  const user = buildPrompt(day.leaders, day.jobs, day.settings.twoRoomMaxPyeong);
  setAiDispatchProgress(tenantId, workDate, 3, 'AI가 동선과 평수를 보고 있습니다.');
  let parsed: DraftLine[] | null = null;
  let usage: { model: string; promptTokens: number; completionTokens: number } | null = null;
  for (let attempt = 0; attempt < 2 && !parsed; attempt += 1) {
    const result = await callOpenAiJson({
      product: 'ai_dispatch',
      system: SYSTEM,
      user,
      temperature: 0.2,
    });
    usage = result.usage;
    parsed = parseLines(result.json, day.jobs, day.leaders, day.settings.twoRoomMaxPyeong);
  }
  setAiDispatchProgress(tenantId, workDate, 4, '오전·오후를 가깝게 묶고 피로에 맞춰 넣고 있습니다.');
  const filled = fillOpenJobs(parsed ?? [], day.jobs, day.leaders, day.settings.twoRoomMaxPyeong);
  const lines = clampDailyCap(
    tuneMorningAfternoon(filled, day.jobs, day.leaders, day.settings.twoRoomMaxPyeong),
    day.jobs,
    day.leaders,
  );
  const summary = parsed
    ? '피로 점수가 높은 팀장에게 가까운 하루를 넣었습니다. 하루 1건은 집과의 거리만 봤습니다. 자리가 찬 일정은 위에 모아 두었습니다. 승인 전에는 배정되지 않습니다.'
    : 'AI 응답을 규칙에 맞추지 못해, 오전·오후 거리와 피로로 팀장을 넣었습니다. 승인 전에는 배정되지 않습니다.';
  setAiDispatchProgress(tenantId, workDate, 5, '초안을 저장하고 있습니다.');
  const run = await saveRun(db, tenantId, actorId, workDate, lines, summary, usage);
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
