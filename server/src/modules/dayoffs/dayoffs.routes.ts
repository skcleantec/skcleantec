import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { authMiddleware } from '../auth/auth.middleware.js';
import { adminOnly } from '../auth/auth.middleware.js';
import { teamAuthMiddleware } from '../auth/auth.middleware.team.js';
import type { AuthPayload } from '../auth/auth.middleware.js';

const router = Router();

/** 팀장: 내 휴무일 목록 */
router.get('/me', teamAuthMiddleware, async (req, res) => {
  const { userId } = (req as unknown as { user: AuthPayload }).user;
  const { start, end } = req.query as { start?: string; end?: string };
  const now = new Date();
  const startDate = start ? new Date(start) : new Date(now.getFullYear(), now.getMonth(), 1);
  const endDate = end
    ? new Date(end + 'T23:59:59')
    : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const list = await prisma.userDayOff.findMany({
    where: {
      teamLeaderId: userId,
      date: { gte: startDate, lte: endDate },
    },
    orderBy: { date: 'asc' },
  });
  res.json({ items: list.map((d) => d.date.toISOString().slice(0, 10)) });
});

/** 팀장: 휴무일 추가 */
router.post('/me', teamAuthMiddleware, async (req, res) => {
  const { userId } = (req as unknown as { user: AuthPayload }).user;
  const { date } = req.body as { date?: string };
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    res.status(400).json({ error: '유효한 날짜(yyyy-mm-dd)를 입력해주세요.' });
    return;
  }
  const d = new Date(date + 'T12:00:00');
  await prisma.userDayOff.upsert({
    where: {
      teamLeaderId_date: { teamLeaderId: userId, date: d },
    },
    create: { teamLeaderId: userId, date: d },
    update: {},
  });
  res.json({ ok: true });
});

/** 팀장: 휴무일 삭제 */
router.delete('/me', teamAuthMiddleware, async (req, res) => {
  const { userId } = (req as unknown as { user: AuthPayload }).user;
  const { date } = req.query as { date?: string };
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    res.status(400).json({ error: '유효한 날짜(yyyy-mm-dd)를 입력해주세요.' });
    return;
  }
  const d = new Date(date + 'T12:00:00');
  await prisma.userDayOff.deleteMany({
    where: { teamLeaderId: userId, date: d },
  });
  res.json({ ok: true });
});

/** 관리자: 날짜별 휴무/근무 현황 */
router.get('/schedule-stats', authMiddleware, adminOnly, async (req, res) => {
  const { start, end } = req.query as { start?: string; end?: string };
  const now = new Date();
  const startDate = start ? new Date(start) : new Date(now.getFullYear(), now.getMonth(), 1);
  const endDate = end
    ? new Date(end + 'T23:59:59')
    : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const teamLeaders = await prisma.user.findMany({
    where: { role: 'TEAM_LEADER', isActive: true },
    select: { id: true, name: true },
  });
  const totalCount = teamLeaders.length;

  const dayOffs = await prisma.userDayOff.findMany({
    where: {
      date: { gte: startDate, lte: endDate },
      teamLeader: { isActive: true, role: 'TEAM_LEADER' },
    },
    include: { teamLeader: { select: { id: true, name: true } } },
  });

  const assignments = await prisma.assignment.findMany({
    where: {
      inquiry: {
        preferredDate: { gte: startDate, lte: endDate },
        status: { not: 'CANCELLED' },
      },
    },
    include: {
      teamLeader: { select: { id: true, name: true } },
      inquiry: { select: { preferredDate: true, preferredTime: true } },
    },
  });

  const byDate: Record<
    string,
    {
      offCount: number;
      offNames: string[];
      workingCount: number;
      totalTeamLeaders: number;
      assignedCount: number;
      availableNames: string[];
      morningCount: number;
      afternoonCount: number;
    }
  > = {};

  const rangeStart = new Date(startDate);
  rangeStart.setHours(0, 0, 0, 0);
  const rangeEnd = new Date(endDate);
  rangeEnd.setHours(23, 59, 59, 999);
  for (let d = new Date(rangeStart); d <= rangeEnd; d.setDate(d.getDate() + 1)) {
    const key = d.toISOString().slice(0, 10);
    const dayOffList = dayOffs.filter((o) => o.date.toISOString().slice(0, 10) === key);
    const offNames = dayOffList.map((o) => o.teamLeader.name);
    const offIds = new Set(dayOffList.map((o) => o.teamLeaderId));
    const workingCount = totalCount - offIds.size;
    const dayAssignments = assignments.filter(
      (a) => a.inquiry.preferredDate?.toISOString().slice(0, 10) === key
    );
    const assignedIds = new Set(dayAssignments.map((a) => a.teamLeaderId));
    const availableLeaders = teamLeaders.filter(
      (t) => !offIds.has(t.id) && !assignedIds.has(t.id)
    );

    const morningCount = dayAssignments.filter((a) => {
      const t = a.inquiry.preferredTime || '';
      return t.includes('오전') || (!t.includes('오후') && (parseInt(t, 10) || 24) < 12);
    }).length;
    const afternoonCount = dayAssignments.length - morningCount;

    byDate[key] = {
      offCount: offNames.length,
      offNames,
      workingCount,
      totalTeamLeaders: totalCount,
      assignedCount: assignedIds.size,
      availableNames: availableLeaders.map((t) => t.name),
      morningCount,
      afternoonCount,
    };
  }

  res.json({ byDate });
});

export default router;
