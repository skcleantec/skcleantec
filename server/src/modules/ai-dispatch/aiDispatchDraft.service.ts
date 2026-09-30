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

function buildPrompt(leaders: DispatchLeader[], jobs: DispatchJob[], twoRoomMax: number): string {
  const leaderLines = leaders.map((leader) => ({
    userId: leader.id,
    name: leader.name,
    jobsPerDay: leader.jobsPerDay,
    remainingJobs: leader.remainingJobs,
    sizePolicy: leader.sizePolicy,
    condition: leader.band,
    fatigue: leader.fatigue,
    conditionNote: leader.note,
  }));
  const jobLines = jobs
    .filter((job) => !job.blockedReason)
    .map((job) => {
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
        slot: job.slot,
        requiredLeaders: job.requiredLeaders,
        eligible,
      };
    });
  return JSON.stringify({ leaders: leaderLines, jobs: jobLines });
}

const SYSTEM = `당신은 입주청소 하루 배정 담당입니다. 집→현장→집으로 돌아오는 거리(roundTripKm)와 평수, 피로(fatigue 1~100)를 보고 하루를 나눕니다.
규칙:
- jobs에 있는 접수는 빠짐없이 assignments에 넣으세요. unassigned로 남기지 마세요.
- eligible에 있는 userId를 먼저 쓰세요. eligible이 비어 있으면 leaders 안에서 고르세요.
- slot은 접수의 slot과 같아야 합니다. HUMAN도 그대로 두세요.
- remainingJobs가 남은 팀장을 먼저 고르세요. 남은 자리가 없어도 피로가 낮고 가까운 팀장에게 넣으세요. 빈 일정으로 두지 마세요.
- ALL_DAY는 2건으로 세고, requiredLeaders만큼 서로 다른 팀장을 넣으세요.
- fatigue가 높으면 roundTripKm가 짧은 현장만 고르고, 오후 평수는 작게 잡으세요.
- fatigue가 낮으면 roundTripKm가 길어도 동선이 맞으면 가능합니다.
- 원룸은 같은 평수보다 더 지칩니다.
- 이유는 한국어 한 문장이고, 그 문장에 roundTripKm와 평수를 적으세요. 고객 이름·전화번호는 쓰지 마세요.
JSON만 반환:
{"assignments":[{"inquiryId":"","leaders":[{"userId":"","slot":"AM"}],"reason":""}],"unassigned":[{"inquiryId":"","reason":""}]}
slot은 AM, PM, ALL_DAY 중 하나입니다.`;

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
  return slot === 'ALL_DAY' ? 2 : 1;
}

function pickLeader(
  leaders: DispatchLeader[],
  job: DispatchJob,
  used: Map<string, number>,
  taken: Set<string>,
  twoRoomMax: number,
): DispatchLeader | null {
  const open = leaders.filter((leader) => !taken.has(leader.id));
  if (open.length === 0) return null;
  const preferred = leadersForJob(leaders, job, twoRoomMax).filter((leader) => !taken.has(leader.id));
  const pool = preferred.length > 0 ? preferred : open;
  return [...pool].sort((a, b) => {
    const aOver = (used.get(a.id) ?? 0) >= a.jobsPerDay ? 1 : 0;
    const bOver = (used.get(b.id) ?? 0) >= b.jobsPerDay ? 1 : 0;
    if (aOver !== bOver) return aOver - bOver;
    const aKm = oneWayKm(a, job) ?? 80;
    const bKm = oneWayKm(b, job) ?? 80;
    return a.fatigue + aKm - (b.fatigue + bKm);
  })[0] ?? null;
}

function fillReason(leader: DispatchLeader, job: DispatchJob, over: boolean, twoRoomMax: number): string {
  const km = roundTripKm(leader, job);
  const sizeOff = !sizePolicyAllows(leader.sizePolicy, { isOneRoom: job.isOneRoom, areaPyeong: job.pyeong }, twoRoomMax);
  const bits = [
    `${leader.name}에게 넣었습니다`,
    km != null ? `왕복 ${km}km` : '현장 좌표가 없어 거리는 재지 못했습니다',
    job.pyeong != null ? `${job.pyeong}평` : job.isOneRoom ? '원룸' : '',
    over ? '하루 건수는 이미 찼지만 빈 일정으로 두지 않았습니다' : '',
    sizeOff ? '집 크기 설정과 다른 팀장만 남아 넣었습니다' : '',
    job.slot === 'HUMAN' ? '시간대는 오전·오후로 아직 안 정해져 한 번 더 봐 주세요' : '',
  ].filter(Boolean);
  return bits.join('. ').slice(0, 300);
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
        reason: fillReason(leader, job, before >= leader.jobsPerDay, twoRoomMax),
        updatedAt: job.updatedAt,
      });
    }
    if (filled.length === 0) {
      next.push({
        inquiryId: job.id,
        teamLeaderId: null,
        slot: job.slot,
        reason: '배정할 팀장이 없습니다.',
        updatedAt: job.updatedAt,
      });
    } else {
      next.push(...filled);
    }
  }
  return next;
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
    const lines = fillOpenJobs([], day.jobs, day.leaders, day.settings.twoRoomMaxPyeong);
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
  setAiDispatchProgress(tenantId, workDate, 4, '빠진 일정에 팀장을 넣고 있습니다.');
  const lines = fillOpenJobs(parsed ?? [], day.jobs, day.leaders, day.settings.twoRoomMaxPyeong);
  const summary = parsed
    ? 'AI가 하루 동선과 컨디션을 보고 제안했습니다. 빈 일정은 집과의 거리와 피로로 채웠습니다. 승인 전에는 배정되지 않습니다.'
    : 'AI 응답을 규칙에 맞추지 못해, 집과의 거리와 피로로 팀장을 넣었습니다. 승인 전에는 배정되지 않습니다.';
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
