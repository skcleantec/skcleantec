import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { authMiddleware, type AuthPayload } from '../auth/auth.middleware.js';
import { requireStaffPermission } from '../auth/marketerPermission.middleware.js';
import { getTenantIdFromAuth } from '../tenants/tenant.middleware.js';
import { requireFeature } from '../tenants/requireTenantFeature.js';
import { isAiProductConfigured } from '../ai/aiProvider.service.js';
import { kstTodayYmd } from '../inquiries/inquiryListDateRange.js';
import { loadDispatchDay } from './aiDispatchContext.service.js';
import { createAiDispatchDraft } from './aiDispatchDraft.service.js';
import { approveDraftProposals, updateDraftProposal } from './aiDispatchApprove.service.js';
import { clampSettings } from './aiDispatchRules.js';

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
  if (run) {
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
  res.json({
    date,
    aiConfigured: isAiProductConfigured('ai_dispatch'),
    settings: day.settings,
    leaders: day.leaders.map((leader) => ({
      id: leader.id,
      name: leader.name,
      jobsPerDay: leader.jobsPerDay,
      sizePolicy: leader.sizePolicy,
      band: leader.band,
      note: leader.note,
      usedJobs: leader.usedJobs,
      remainingJobs: leader.remainingJobs,
    })),
    jobs: day.jobs,
    run: run
      ? {
          id: run.id,
          status: run.status,
          summary: run.summary,
          createdAt: run.createdAt.toISOString(),
          proposals: run.proposals.map((row) => ({
            id: row.id,
            inquiryId: row.inquiryId,
            customerName: row.inquiry.customerName,
            teamLeaderId: row.teamLeaderId,
            teamLeaderName: row.teamLeader?.name ?? null,
            slot: row.slot,
            reason: row.reason,
            status: row.status,
          })),
        }
      : null,
  });
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
  });
  await prisma.tenantAiDispatchSettings.upsert({
    where: { tenantId },
    create: { tenantId, ...settings },
    update: settings,
  });
  res.json(settings);
});

export default router;
