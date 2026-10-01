import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { authMiddleware, type AuthPayload } from '../auth/auth.middleware.js';
import { requireStaffPermission } from '../auth/marketerPermission.middleware.js';
import { getTenantIdFromAuth } from '../tenants/tenant.middleware.js';
import { requireFeature } from '../tenants/requireTenantFeature.js';
import { isAiProductConfigured } from '../ai/aiProvider.service.js';
import { kstTodayYmd } from '../inquiries/inquiryListDateRange.js';
import { loadDispatchDay, type DispatchJob, type DispatchLeader } from './aiDispatchContext.service.js';
import { createAiDispatchDraft } from './aiDispatchDraft.service.js';
import { approveDraftProposals, updateDraftProposal } from './aiDispatchApprove.service.js';
import type { AiDispatchSlot } from './aiDispatch.constants.js';
import { clampSettings, fromHomeKm, homeLoopText } from './aiDispatchRules.js';
import { readAiDispatchProgress } from './aiDispatchProgress.js';
import {
  parseDispatchProfileInput,
  prepareTeamLeaderHomeData,
  TeamLeaderHomeError,
  upsertTeamLeaderDispatchProfile,
} from '../team-leaders/teamLeaderHome.service.js';

const router = Router();

router.use(authMiddleware);
router.use(requireFeature('mod_ai_dispatch'));
router.use(requireStaffPermission('inquiry.edit.assignment'));

function tenantOf(req: { user?: AuthPayload }): string | null {
  return getTenantIdFromAuth(req.user);
}

router.get('/board', async (req, res) => {
  const tenantId = tenantOf(req as { user?: AuthPayload });
  if (!tenantId) {
    res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
    return;
  }
  const date = typeof req.query.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date) ? req.query.date : kstTodayYmd();
  const day = await loadDispatchDay(prisma, tenantId, date);
  if (!day) {
    res.status(400).json({ error: '날짜 형식이 올바르지 않습니다.' });
    return;
  }
  const work = new Date(`${date}T12:00:00+09:00`);
  const run = await prisma.aiDispatchRun.findFirst({
    where: { tenantId, workDate: work, status: { in: ['DRAFT', 'APPROVED'] } },
    orderBy: { createdAt: 'desc' },
    include: {
      proposals: {
        orderBy: { sortOrder: 'asc' },
        include: { teamLeader: { select: { id: true, name: true } }, inquiry: { select: { updatedAt: true, customerName: true } } },
      },
    },
  });
  const jobById = new Map(day.jobs.map((job) => [job.id, job]));
  const leaderById = new Map(day.leaders.map((leader) => [leader.id, leader]));
  if (run) {
    const slotFixes = run.proposals.filter((row) => {
      const job = jobById.get(row.inquiryId);
      return Boolean(job && row.status === 'DRAFT' && row.slot === 'HUMAN' && job.slot !== 'HUMAN');
    });
    await Promise.all(
      slotFixes.map((row) => {
        const job = jobById.get(row.inquiryId);
        if (!job) return Promise.resolve();
        row.slot = job.slot;
        return prisma.aiDispatchProposal.updateMany({
          where: { id: row.id, tenantId, slot: 'HUMAN' },
          data: { slot: job.slot },
        });
      }),
    );
    const staleIds = run.proposals
      .filter((row) => row.status === 'DRAFT' && row.inquiry.updatedAt > row.inquiryUpdatedAt)
      .map((row) => row.id);
    if (staleIds.length > 0) {
      await prisma.aiDispatchProposal.updateMany({
        where: { tenantId, id: { in: staleIds } },
        data: { status: 'STALE' },
      });
      for (const row of run.proposals) {
        if (staleIds.includes(row.id)) row.status = 'STALE';
      }
    }
  }
  const loops = run ? homeLoops(run.proposals, jobById, leaderById) : [];
  res.json({
    date,
    aiConfigured: isAiProductConfigured('ai_dispatch'),
    settings: day.settings,
    leaders: day.leaders.map((leader) => ({
      id: leader.id,
      name: leader.name,
      jobsPerDay: leader.jobsPerDay,
      sizePolicy: leader.sizePolicy,
      homeAddress: leader.homeAddress,
      homeAddressDetail: leader.homeAddressDetail,
      homeLat: leader.homeLat,
      homeLng: leader.homeLng,
      band: leader.band,
      fatigue: leader.fatigue,
      note: leader.note,
      usedJobs: leader.usedJobs,
      remainingJobs: leader.remainingJobs,
      detail: leader.detail,
    })),
    manualJobs: day.manualJobs.map((job) => ({
      id: job.id,
      customerName: job.customerName,
      areaLabel: job.areaLabel,
      pyeong: job.pyeong,
      isOneRoom: job.isOneRoom,
      lat: job.lat,
      lng: job.lng,
      slot: job.slot,
      teamLeaderId: job.teamLeaderId,
      teamLeaderName: job.teamLeaderName,
    })),
    jobs: day.jobs.map((job) => ({
      id: job.id,
      customerName: job.customerName,
      areaLabel: job.areaLabel,
      pyeong: job.pyeong,
      isOneRoom: job.isOneRoom,
      tone: job.tone,
      lat: job.lat,
      lng: job.lng,
      slot: job.slot,
      requiredLeaders: job.requiredLeaders,
      preferredTime: job.preferredTime,
      blockedReason: job.blockedReason,
    })),
    run: run
      ? {
          id: run.id,
          status: run.status,
          summary: run.summary,
          createdAt: run.createdAt.toISOString(),
          loops,
          proposals: run.proposals.map((row) => {
            const job = jobById.get(row.inquiryId);
            const leader = row.teamLeaderId ? leaderById.get(row.teamLeaderId) : undefined;
            return {
              id: row.id,
              inquiryId: row.inquiryId,
              customerName: row.inquiry.customerName,
              teamLeaderId: row.teamLeaderId,
              teamLeaderName: row.teamLeader?.name ?? null,
              slot: job && job.slot !== 'HUMAN' ? job.slot : row.slot,
              reason: row.reason,
              status: row.status,
              fromHomeKm: leader && job ? fromHomeKm(leader, job) : null,
            };
          }),
        }
      : null,
  });
});

function homeLoops(
  proposals: Array<{ inquiryId: string; teamLeaderId: string | null; teamLeader: { name: string } | null; slot: string }>,
  jobById: Map<string, DispatchJob>,
  leaderById: Map<string, DispatchLeader>,
): string[] {
  const byLeader = new Map<string, typeof proposals>();
  for (const row of proposals) {
    if (!row.teamLeaderId) continue;
    const list = byLeader.get(row.teamLeaderId) ?? [];
    list.push(row);
    byLeader.set(row.teamLeaderId, list);
  }
  const texts: string[] = [];
  for (const [leaderId, rows] of byLeader) {
    const leader = leaderById.get(leaderId);
    if (!leader) continue;
    const text = homeLoopText(
      rows[0]?.teamLeader?.name || leader.name,
      leader,
      rows.map((row) => {
        const job = jobById.get(row.inquiryId);
        const slot = (job?.slot && job.slot !== 'HUMAN' ? job.slot : row.slot) as AiDispatchSlot;
        const place = slot === 'AM' ? '오전 현장' : slot === 'PM' ? '오후 현장' : slot === 'ALL_DAY' ? '종일 현장' : '현장';
        return {
          slot,
          label: job?.customerName ? `${place} ${job.customerName}` : place,
          lat: job?.lat ?? null,
          lng: job?.lng ?? null,
        };
      }),
    );
    if (text) texts.push(text);
  }
  return texts;
}

router.get('/progress', async (req, res) => {
  const tenantId = tenantOf(req as { user?: AuthPayload });
  if (!tenantId) {
    res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
    return;
  }
  const date = typeof req.query.date === 'string' ? req.query.date : '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    res.status(400).json({ error: '날짜를 선택해 주세요.' });
    return;
  }
  const progress = readAiDispatchProgress(tenantId, date);
  res.json({ step: progress?.step ?? 1, message: progress?.message ?? '날짜의 일정을 모으고 있습니다.' });
});

router.patch('/leaders/:userId', async (req, res) => {
  const tenantId = tenantOf(req as { user?: AuthPayload });
  if (!tenantId) {
    res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
    return;
  }
  const user = await prisma.user.findFirst({
    where: { id: req.params.userId, tenantId, role: 'TEAM_LEADER' },
    select: {
      id: true,
      homeAddress: true,
      homeAddressDetail: true,
      homeGeoLat: true,
      homeGeoLng: true,
      homeGeoQuery: true,
    },
  });
  if (!user) {
    res.status(404).json({ error: '팀장을 찾지 못했습니다.' });
    return;
  }
  const parsed = parseDispatchProfileInput({
    jobsPerDay: req.body?.jobsPerDay,
    sizePolicy: req.body?.sizePolicy,
  });
  if (!parsed || 'error' in parsed) {
    res.status(400).json({ error: parsed && 'error' in parsed ? parsed.error : '하루 건수와 집 크기를 선택해 주세요.' });
    return;
  }
  try {
    const homePatch = await prepareTeamLeaderHomeData({
      existing: user,
      homeAddress: req.body?.homeAddress,
      homeAddressDetail: req.body?.homeAddressDetail,
      requireReady: false,
    });
    if (Object.keys(homePatch).length > 0) {
      await prisma.user.updateMany({ where: { id: user.id, tenantId }, data: homePatch });
    }
  } catch (e) {
    if (e instanceof TeamLeaderHomeError) {
      res.status(400).json({ error: e.message });
      return;
    }
    throw e;
  }
  await upsertTeamLeaderDispatchProfile(prisma, {
    tenantId,
    userId: user.id,
    jobsPerDay: parsed.jobsPerDay,
    sizePolicy: parsed.sizePolicy,
  });
  res.json({ ok: true });
});

router.post('/runs', async (req, res) => {
  const tenantId = tenantOf(req as { user?: AuthPayload });
  const user = (req as { user?: AuthPayload }).user;
  if (!tenantId || !user) {
    res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
    return;
  }
  const date = typeof req.body?.date === 'string' ? req.body.date : '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    res.status(400).json({ error: '날짜를 선택해 주세요.' });
    return;
  }
  const result = await createAiDispatchDraft(prisma, tenantId, user.userId, date);
  if ('error' in result && result.error) {
    res.status(400).json({ error: result.error });
    return;
  }
  if ('aiConfigured' in result && result.aiConfigured === false) {
    res.status(200).json({ aiConfigured: false, message: 'AI 미설정' });
    return;
  }
  res.status(201).json({ aiConfigured: true, runId: 'run' in result ? result.run.id : null });
});

router.patch('/proposals/:id', async (req, res) => {
  const tenantId = tenantOf(req as { user?: AuthPayload });
  if (!tenantId) {
    res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
    return;
  }
  const teamLeaderId = req.body?.teamLeaderId == null || req.body.teamLeaderId === '' ? null : String(req.body.teamLeaderId);
  const result = await updateDraftProposal(prisma, tenantId, req.params.id, {
    teamLeaderId,
    slot: typeof req.body?.slot === 'string' ? req.body.slot : undefined,
  });
  if ('error' in result && result.error) {
    res.status(400).json({ error: result.error });
    return;
  }
  res.json({ ok: true });
});

router.post('/approve', async (req, res) => {
  const tenantId = tenantOf(req as { user?: AuthPayload });
  const user = (req as { user?: AuthPayload }).user;
  if (!tenantId || !user) {
    res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
    return;
  }
  const ids = Array.isArray(req.body?.proposalIds) ? req.body.proposalIds.map((id: unknown) => String(id)) : [];
  const result = await approveDraftProposals(prisma, tenantId, user.userId, ids);
  if ('error' in result && result.error) {
    res.status(400).json({ error: result.error });
    return;
  }
  res.json(result);
});

router.patch('/settings', async (req, res) => {
  const tenantId = tenantOf(req as { user?: AuthPayload });
  if (!tenantId) {
    res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
    return;
  }
  const settings = clampSettings({
    extraLeaderMinPyeong: Number(req.body?.extraLeaderMinPyeong),
    extraLeaderCount: Number(req.body?.extraLeaderCount),
    twoRoomMaxPyeong: Number(req.body?.twoRoomMaxPyeong),
    includeCrewInFatigue: req.body?.includeCrewInFatigue === true,
    normalWorkDaysPerWeek: Number(req.body?.normalWorkDaysPerWeek),
    normalJobsPerWeek: Number(req.body?.normalJobsPerWeek),
  });
  await prisma.tenantAiDispatchSettings.upsert({
    where: { tenantId },
    create: { tenantId, ...settings },
    update: settings,
  });
  res.json(settings);
});

export default router;
