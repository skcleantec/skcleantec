import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { teamAuthMiddleware } from '../auth/auth.middleware.team.js';
import type { AuthPayload } from '../auth/auth.middleware.js';
import { happyCallDeadlineEnd, isHappyCallEligible } from '../inquiries/happyCall.helpers.js';
import inquiryCleaningPhotosTeamRoutes from '../inquiry-cleaning-photos/inquiryCleaningPhotos.team.routes.js';
import { csReportFullInclude } from '../cs/csReport.include.js';
import { buildCsReportUpdateData } from '../cs/csReport.patch.js';
import { notifyCsReportNavBadges } from '../realtime/navBadgeNotify.js';
import { assertCrewCapacityForInquiry } from '../inquiries/crewMemberCapacity.helpers.js';
import { assignmentTeamLeaderSelect } from '../inquiries/assignmentTeamLeaderSelect.js';
import { notifyInboxRefresh } from '../realtime/inboxNotify.js';

const router = Router();

router.use(teamAuthMiddleware);

/** 팀장 GNB: 미읽 메시지 + 담당 미처리(접수) C/S + 미확인 배정(상세 미조회) — 한 요청으로 병렬 COUNT */
router.get('/nav-badges', async (req, res) => {
  const { userId } = (req as unknown as { user: AuthPayload }).user;
  const [unreadCount, csPendingCount, newAssignmentCount] = await Promise.all([
    prisma.message.count({
      where: { receiverId: userId, readAt: null },
    }),
    prisma.csReport.count({
      where: {
        status: 'RECEIVED',
        inquiryId: { not: null },
        inquiry: {
          assignments: { some: { teamLeaderId: userId } },
        },
      },
    }),
    prisma.assignment.count({
      where: {
        teamLeaderId: userId,
        detailViewedAt: null,
        inquiry: {
          status: { notIn: ['CANCELLED', 'COMPLETED'] },
        },
      },
    }),
  ]);
  res.json({ unreadCount, csPendingCount, newAssignmentCount });
});

router.use('/inquiries/:inquiryId/cleaning-photos', inquiryCleaningPhotosTeamRoutes);

/** 팀장: 접수 상세를 열어 확인한 것으로 표시 — 메뉴 미확인 배정 수 감소 */
router.post('/inquiries/:id/detail-viewed', async (req, res) => {
  const { userId } = (req as unknown as { user: AuthPayload }).user;
  const { id: inquiryId } = req.params;
  const row = await prisma.assignment.findFirst({
    where: { inquiryId, teamLeaderId: userId },
  });
  if (!row) {
    res.status(404).json({ error: '담당 접수를 찾을 수 없습니다.' });
    return;
  }
  await prisma.assignment.updateMany({
    where: { inquiryId, teamLeaderId: userId, detailViewedAt: null },
    data: { detailViewedAt: new Date() },
  });
  notifyInboxRefresh([userId]);
  res.json({ ok: true });
});

/** 담당 미처리(접수) C/S 건수 — 상단 메뉴 배지용 */
router.get('/cs/pending-count', async (req, res) => {
  const { userId } = (req as unknown as { user: AuthPayload }).user;
  const count = await prisma.csReport.count({
    where: {
      status: 'RECEIVED',
      inquiryId: { not: null },
      inquiry: {
        assignments: { some: { teamLeaderId: userId } },
      },
    },
  });
  res.json({ count });
});

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
  void notifyCsReportNavBadges(updated.inquiryId);
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

/** 팀장: 본인 배정 건 예약일 변경 */
router.patch('/inquiries/:id/preferred-date', async (req, res) => {
  const { userId } = (req as unknown as { user: AuthPayload }).user;
  const { id } = req.params;
  const body = req.body as { preferredDate?: string };
  const ymd = typeof body.preferredDate === 'string' ? body.preferredDate.trim() : '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
    res.status(400).json({ error: '예약일은 YYYY-MM-DD 형식이어야 합니다.' });
    return;
  }
  const preferredDate = new Date(`${ymd}T12:00:00+09:00`);
  if (Number.isNaN(preferredDate.getTime())) {
    res.status(400).json({ error: '유효한 예약일이 아닙니다.' });
    return;
  }
  const inquiry = await prisma.inquiry.findFirst({
    where: {
      id,
      assignments: { some: { teamLeaderId: userId } },
    },
    include: {
      assignments: {
        orderBy: { sortOrder: 'asc' },
        include: {
          teamLeader: { select: assignmentTeamLeaderSelect },
          assignedBy: { select: { id: true, name: true } },
        },
      },
    },
  });
  if (!inquiry) {
    res.status(404).json({ error: '담당 접수를 찾을 수 없습니다.' });
    return;
  }
  if (inquiry.status === 'CANCELLED') {
    res.status(400).json({ error: '취소된 접수는 예약일을 변경할 수 없습니다.' });
    return;
  }
  const beforeYmd = inquiry.preferredDate ? inquiry.preferredDate.toISOString().slice(0, 10) : null;
  if (beforeYmd === ymd) {
    const unchanged = await prisma.inquiry.findUnique({
      where: { id },
      include: {
        assignments: {
          orderBy: { sortOrder: 'asc' },
          include: {
            teamLeader: { select: assignmentTeamLeaderSelect },
            assignedBy: { select: { id: true, name: true } },
          },
        },
      },
    });
    res.json(unchanged);
    return;
  }

  const cap = await assertCrewCapacityForInquiry({
    prisma,
    preferredDate,
    crewMemberCount: inquiry.crewMemberCount ?? null,
    excludeInquiryId: id,
    assigneeUserIdsPreview: inquiry.assignments.map((a) => a.teamLeader.id),
  });
  if (!cap.ok) {
    res.status(400).json({ error: cap.error });
    return;
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.inquiry.update({
      where: { id },
      data: { preferredDate },
    });
    await tx.inquiryChangeLog.create({
      data: {
        inquiryId: id,
        actorId: userId,
        lines: [`청소 희망일: ${beforeYmd ?? '(없음)'} → ${ymd}`],
      },
    });
    return tx.inquiry.findUnique({
      where: { id },
      include: {
        assignments: {
          orderBy: { sortOrder: 'asc' },
          include: {
            teamLeader: { select: assignmentTeamLeaderSelect },
            assignedBy: { select: { id: true, name: true } },
          },
        },
      },
    });
  });
  res.json(updated);
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
        include: {
          teamLeader: { select: assignmentTeamLeaderSelect },
          assignedBy: { select: { id: true, name: true } },
        },
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
        include: {
          teamLeader: { select: assignmentTeamLeaderSelect },
          assignedBy: { select: { id: true, name: true } },
        },
      },
    },
  });
  res.json({ items });
});

export default router;
