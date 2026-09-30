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

function buildPrompt(leaders: DispatchLeader[], jobs: DispatchJob[], twoRoomMax: number): string {
  const leaderLines = leaders.map((leader) => ({
    userId: leader.id,
    name: leader.name,
    jobsPerDay: leader.jobsPerDay,
    remainingJobs: leader.remainingJobs,
    sizePolicy: leader.sizePolicy,
    condition: leader.band,
    conditionNote: leader.note,
  }));
  const jobLines = jobs
    .filter((job) => !job.blockedReason && job.slot !== 'HUMAN')
    .map((job) => {
      const eligible = leadersForJob(leaders, job, twoRoomMax).map((leader) => ({
        userId: leader.id,
        oneWayKm: oneWayKm(leader, job),
        condition: leader.band,
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

const SYSTEM = `당신은 입주청소 하루 배정 담당입니다. 집→오전 현장→오후 현장→집으로 돌아오는 동선과 팀장 컨디션을 함께 보고, 하루 전체를 한 번에 나눕니다.
규칙:
- eligible에 없는 팀장에게 일을 주지 마세요.
- slot은 접수의 slot과 같아야 합니다. ALL_DAY는 그날 그 팀장의 다른 일과 겹치면 안 됩니다.
- remainingJobs와 jobsPerDay를 넘기지 마세요. ALL_DAY는 2건으로 칩니다.
- requiredLeaders만큼 서로 다른 팀장을 넣으세요. 못 채우면 그 접수는 unassigned로 두세요.
- condition이 피로이면 집에서 가까운 짧은 동선을 우선하고, 오후 평수는 크게 잡지 마세요.
- condition이 좋음이면 동선이 효율적이면 먼 현장도 가능합니다. 왕복(집으로 복귀) 거리도 피로에 포함하세요.
- 원룸은 같은 평수보다 더 지칩니다.
- 이유를 한국어 한 문장으로 쓰세요. 고객 이름·전화번호는 쓰지 마세요.
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
    if (!raw || typeof raw !== 'object') return null;
    const row = raw as { inquiryId?: unknown; leaders?: unknown; reason?: unknown };
    const inquiryId = typeof row.inquiryId === 'string' ? row.inquiryId : '';
    const job = jobById.get(inquiryId);
    if (!job || job.blockedReason || seenInquiry.has(inquiryId)) return null;
    if (!Array.isArray(row.leaders) || row.leaders.length !== job.requiredLeaders) return null;
    const reason = typeof row.reason === 'string' && row.reason.trim() ? row.reason.trim().slice(0, 300) : '';
    if (!reason) return null;
    const picked = new Set<string>();
    const weight = slotJobWeight(job.slot);
    const eligible = new Set(leadersForJob(leaders, job, twoRoomMax).map((leader) => leader.id));
    for (const leaderRaw of row.leaders) {
      if (!leaderRaw || typeof leaderRaw !== 'object') return null;
      const leaderRow = leaderRaw as { userId?: unknown; slot?: unknown };
      const userId = typeof leaderRow.userId === 'string' ? leaderRow.userId : '';
      const slot = leaderRow.slot === 'AM' || leaderRow.slot === 'PM' || leaderRow.slot === 'ALL_DAY' ? leaderRow.slot : '';
      if (!userId || slot !== job.slot || !eligible.has(userId) || picked.has(userId)) return null;
      const nextUsed = (used.get(userId) ?? 0) + weight;
      const leader = leaders.find((item) => item.id === userId);
      if (!leader || nextUsed > leader.jobsPerDay) return null;
      used.set(userId, nextUsed);
      picked.add(userId);
      lines.push({
        inquiryId,
        teamLeaderId: userId,
        slot,
        reason,
        updatedAt: job.updatedAt,
      });
    }
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
      slot: 'HUMAN',
      reason: (job.blockedReason || modelReason || '사람 판단이 필요합니다.').slice(0, 300),
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
      slot: 'HUMAN' as const,
      reason: job.blockedReason || '사람 판단이 필요합니다.',
      updatedAt: job.updatedAt,
    }));
    const run = await saveRun(db, tenantId, actorId, workDate, lines, '배정할 수 있는 오전·오후 건이 없어 사람 판단으로 두었습니다.', null);
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
      slot: 'HUMAN' as const,
      reason: job.blockedReason || 'AI 제안을 확인하지 못해 사람 판단으로 두었습니다.',
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
