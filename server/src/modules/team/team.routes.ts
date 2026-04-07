import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { teamAuthMiddleware } from '../auth/auth.middleware.team.js';
import type { AuthPayload } from '../auth/auth.middleware.js';
import { happyCallDeadlineEnd, isHappyCallEligible } from '../inquiries/happyCall.helpers.js';
import inquiryCleaningPhotosTeamRoutes from '../inquiry-cleaning-photos/inquiryCleaningPhotos.team.routes.js';
import { csReportFullInclude } from '../cs/csReport.include.js';
import { buildCsReportUpdateData } from '../cs/csReport.patch.js';

const router = Router();

router.use(teamAuthMiddleware);

router.use('/inquiries/:inquiryId/cleaning-photos', inquiryCleaningPhotosTeamRoutes);

/** 담당 접수와 연결된 C/S만 (배정 팀장 본인) */
router.get('/cs', async (req, res) => {
  const { userId } = (req as unknown as { user: AuthPayload }).user;
  const items = await prisma.csReport.findMany({
    where: {
      inquiryId: { not: null },
      inquiry: {
        assignments: { some: { teamLeaderId: userId } },
      },
    },
    orderBy: { createdAt: 'desc' },
    include: csReportFullInclude,
  });
  res.json({ items });
});

/** 담당 C/S 수정 — 접수·처리중·완료만 (RECEIVED로는 변경 불가) */
router.patch('/cs/:id', async (req, res) => {
  const { userId } = (req as unknown as { user: AuthPayload }).user;
  const user = (req as unknown as { user: AuthPayload }).user;
  const { id } = req.params;
  const body = req.body as { status?: string; memo?: string | null; completionMethod?: string | null };

  const report = await prisma.csReport.findFirst({
    where: {
      id,
      inquiryId: { not: null },
      inquiry: {
        assignments: { some: { teamLeaderId: userId } },
      },
    },
  });
  if (!report) {
    res.status(404).json({ error: '담당 C/S를 찾을 수 없습니다.' });
    return;
  }

  if (
    body.status != null &&
    body.status !== 'PROCESSING' &&
    body.status !== 'DONE' &&
    body.status !== report.status
  ) {
    res.status(400).json({ error: '팀장은 상태를 처리중·완료로만 바꿀 수 있습니다.' });
    return;
  }

  const built = buildCsReportUpdateData({ status: report.status }, body, user);
  if (!built.ok) {
    res.status(400).json({ error: built.error });
    return;
  }
  const updated = await prisma.csReport.update({
    where: { id },
    data: built.data,
    include: csReportFullInclude,
  });
  res.json(updated);
});

/** 해피콜 미완 건수 (마감 전 / 마감 후) — 팀장 본인 배정만 */
router.get('/happy-call-stats', async (req, res) => {
  const { userId } = (req as unknown as { user: AuthPayload }).user;
  const rows = await prisma.inquiry.findMany({
    where: {
      preferredDate: { not: null },
      happyCallCompletedAt: null,
      status: { notIn: ['CANCELLED', 'PENDING'] },
      assignments: { some: { teamLeaderId: userId } },
    },
    select: { preferredDate: true },
  });
  const now = new Date();
  let overdueCount = 0;
  let pendingBeforeDeadlineCount = 0;
  for (const r of rows) {
    if (!r.preferredDate) continue;
    if (now > happyCallDeadlineEnd(r.preferredDate)) overdueCount++;
    else pendingBeforeDeadlineCount++;
  }
  res.json({ overdueCount, pendingBeforeDeadlineCount });
});

/** 팀장만 — 담당 접수에 대해 해피콜 완료 처리 */
router.post('/inquiries/:id/happy-call-complete', async (req, res) => {
  const { userId } = (req as unknown as { user: AuthPayload }).user;
  const { id } = req.params;
  const inquiry = await prisma.inquiry.findFirst({
    where: {
      id,
      assignments: { some: { teamLeaderId: userId } },
    },
  });
  if (!inquiry) {
    res.status(404).json({ error: '담당 접수를 찾을 수 없습니다.' });
    return;
  }
  if (!isHappyCallEligible(inquiry.status, inquiry.preferredDate)) {
    res.status(400).json({ error: '해피콜을 등록할 수 없는 접수입니다.' });
    return;
  }
  if (inquiry.happyCallCompletedAt) {
    res.json({ ok: true, alreadyCompleted: true });
    return;
  }
  await prisma.inquiry.update({
    where: { id },
    data: { happyCallCompletedAt: new Date() },
  });
  res.json({ ok: true });
});

router.get('/inquiries', async (req, res) => {
  const { userId } = (req as unknown as { user: AuthPayload }).user;
  const items = await prisma.inquiry.findMany({
    where: {
      assignments: {
        some: { teamLeaderId: userId },
      },
    },
    orderBy: { preferredDate: 'asc' },
    include: {
      assignments: {
        orderBy: { sortOrder: 'asc' },
        include: { teamLeader: { select: { id: true, name: true } } },
      },
    },
  });
  res.json({ items });
});

router.get('/schedule', async (req, res) => {
  const { userId } = (req as unknown as { user: AuthPayload }).user;
  const { start, end } = req.query as { start?: string; end?: string };
  const now = new Date();
  const startDate = start ? new Date(start) : new Date(now.getFullYear(), now.getMonth(), 1);
  const endDate = end
    ? new Date(end)
    : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const items = await prisma.inquiry.findMany({
    where: {
      preferredDate: { gte: startDate, lte: endDate },
      status: { not: 'CANCELLED' },
      assignments: {
        some: { teamLeaderId: userId },
      },
    },
    orderBy: [{ preferredDate: 'asc' }, { preferredTime: 'asc' }],
    include: {
      assignments: {
        orderBy: { sortOrder: 'asc' },
        include: { teamLeader: { select: { id: true, name: true } } },
      },
    },
  });
  res.json({ items });
});

export default router;
