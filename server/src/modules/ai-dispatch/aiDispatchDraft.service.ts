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
import { haversineKm, slotJobWeight } from './aiDispatchRules.js';

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
  const leaderLines = leaders
    .filter((leader) => leader.remainingJobs > 0)
    .map((leader) => ({
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
    .filter((job) => !job.blockedReason && job.slot !== 'HUMAN')
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
- eligible에 있는 userId만 쓰세요. 없거나 비어 있으면 그 접수는 assignments에 넣지 말고 unassigned에 이유를 쓰세요.
- slot은 접수의 slot과 같아야 합니다.
- remainingJobs를 넘기지 마세요. ALL_DAY는 2건입니다.
- requiredLeaders만큼 서로 다른 팀장을 넣으세요. 못 채우면 unassigned로 두세요.
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

export async function createAiDispatchDraft(db: Db, tenantId: string, actorId: string, workDate: string) {
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
    const lines = day.jobs.map((job) => ({
      inquiryId: job.id,
      teamLeaderId: null,
      slot: job.slot,
      reason: job.blockedReason || (job.slot === 'HUMAN' ? '시간대가 오전·오후로 확정되지 않아 사람이 봐야 합니다.' : '배정할 팀장을 고르지 못했습니다.'),
      updatedAt: job.updatedAt,
    }));
    const run = await saveRun(db, tenantId, actorId, workDate, lines, '배정할 수 있는 오전·오후 건이 없습니다.', null);
    return { aiConfigured: true as const, run };
  }

  const user = buildPrompt(day.leaders, day.jobs, day.settings.twoRoomMaxPyeong);
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
  if (!parsed) {
    const lines = day.jobs.map((job) => ({
      inquiryId: job.id,
      teamLeaderId: null,
      slot: job.slot,
      reason: job.blockedReason || 'AI 제안을 확인하지 못해 팀장을 비워 두었습니다.',
      updatedAt: job.updatedAt,
    }));
    const run = await saveRun(db, tenantId, actorId, workDate, lines, 'AI 응답을 배정 규칙에 맞추지 못했습니다.', usage);
    return { aiConfigured: true as const, run };
  }
  const run = await saveRun(db, tenantId, actorId, workDate, parsed, 'AI가 하루 동선과 컨디션을 보고 제안했습니다. 승인 전에는 배정되지 않습니다.', usage);
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
