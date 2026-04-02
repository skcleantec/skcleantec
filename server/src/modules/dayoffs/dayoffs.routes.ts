import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { authMiddleware } from '../auth/auth.middleware.js';
import { adminOnly, adminOrMarketer } from '../auth/auth.middleware.js';
import { teamAuthMiddleware } from '../auth/auth.middleware.team.js';
import type { AuthPayload } from '../auth/auth.middleware.js';
import {
  consumesAfternoonSlot,
  consumesMorningSlot,
  isSideCleaningPreferredTime,
} from '../schedule/scheduleSlot.helpers.js';

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

const YMD = /^\d{4}-\d{2}-\d{2}$/;

/** 관리자: 날짜별 휴무/근무 현황 */
router.get('/schedule-stats', authMiddleware, adminOrMarketer, async (req, res) => {
  const { start, end } = req.query as { start?: string; end?: string };
  const now = new Date();
  const startDate =
    start && YMD.test(start)
      ? new Date(`${start}T00:00:00+09:00`)
      : new Date(now.getFullYear(), now.getMonth(), 1);
  const endDate = end && YMD.test(end)
    ? new Date(`${end}T23:59:59.999+09:00`)
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

  const inquiries = await prisma.inquiry.findMany({
    where: {
      preferredDate: { gte: startDate, lte: endDate },
      status: { not: 'CANCELLED' },
    },
    select: {
      id: true,
      preferredDate: true,
      preferredTime: true,
      betweenScheduleSlot: true,
      assignments: {
        take: 1,
        select: { teamLeaderId: true },
      },
    },
  });

  function toDateKey(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  const byDate: Record<
    string,
    {
      offCount: number;
      offNames: string[];
      workingCount: number;
      totalTeamLeaders: number;
      assignedCount: number;
      availableNames: string[];
      availableMorningNames: string[];
      availableAfternoonNames: string[];
      availableMorningLeaderIds: string[];
      availableAfternoonLeaderIds: string[];
      /** 오전 슬롯 소진 건수(일반 오전 + 사이청소→오전 확정) */
      morningOccupied: number;
      /** 오후 슬롯 소진 건수 */
      afternoonOccupied: number;
      /** 사이청소 옵션 접수 건수(발주서). 표시용 */
      sideCleaningOrderCount: number;
      /** 사이청소 중 오전/오후 미확정 건수 */
      sideCleaningUnconfirmedCount: number;
      unassignedTotal: number;
      assignableMorning: number;
      assignableAfternoonSlot: number;
    }
  > = {};

  const rangeStart = new Date(startDate);
  rangeStart.setHours(0, 0, 0, 0);
  const rangeEnd = new Date(endDate);
  rangeEnd.setHours(23, 59, 59, 999);
  for (let d = new Date(rangeStart); d <= rangeEnd; d.setDate(d.getDate() + 1)) {
    const key = toDateKey(d);
    const dayOffList = dayOffs.filter((o) => toDateKey(o.date) === key);
    const offNames = dayOffList.map((o) => o.teamLeader.name);
    const offIds = new Set(dayOffList.map((o) => o.teamLeaderId));
    const workingCount = totalCount - offIds.size;

    const dayInquiries = inquiries.filter(
      (inv) => inv.preferredDate && toDateKey(inv.preferredDate) === key
    );

    const assignedIds = new Set(
      dayInquiries.filter((inv) => inv.assignments[0]).map((inv) => inv.assignments[0]!.teamLeaderId)
    );
    const availableLeaders = teamLeaders.filter(
      (t) => !offIds.has(t.id) && !assignedIds.has(t.id)
    );

    let morningOccupied = 0;
    let afternoonOccupied = 0;
    let sideCleaningOrderCount = 0;
    let sideCleaningUnconfirmedCount = 0;
    for (const inv of dayInquiries) {
      if (isSideCleaningPreferredTime(inv.preferredTime)) {
        sideCleaningOrderCount += 1;
        if (inv.betweenScheduleSlot == null || inv.betweenScheduleSlot === '') {
          sideCleaningUnconfirmedCount += 1;
        }
      }
      if (consumesMorningSlot(inv)) morningOccupied += 1;
      if (consumesAfternoonSlot(inv)) afternoonOccupied += 1;
    }

    const morningAssignedIds = new Set(
      dayInquiries
        .filter((inv) => consumesMorningSlot(inv) && inv.assignments[0])
        .map((inv) => inv.assignments[0]!.teamLeaderId)
    );
    const afternoonAssignedIds = new Set(
      dayInquiries
        .filter((inv) => consumesAfternoonSlot(inv) && inv.assignments[0])
        .map((inv) => inv.assignments[0]!.teamLeaderId)
    );

    const availableMorningLeaders = teamLeaders.filter(
      (t) => !offIds.has(t.id) && !morningAssignedIds.has(t.id)
    );
    const availableAfternoonLeaders = teamLeaders.filter(
      (t) => !offIds.has(t.id) && !afternoonAssignedIds.has(t.id)
    );

    const assignableMorning = Math.max(0, workingCount - morningOccupied);
    const assignableAfternoonSlot = Math.max(0, workingCount - afternoonOccupied);
    const unassignedTotal = assignableMorning + assignableAfternoonSlot;

    byDate[key] = {
      offCount: offNames.length,
      offNames,
      workingCount,
      totalTeamLeaders: totalCount,
      assignedCount: assignedIds.size,
      availableNames: availableLeaders.map((t) => t.name),
      availableMorningNames: availableMorningLeaders.map((t) => t.name),
      availableAfternoonNames: availableAfternoonLeaders.map((t) => t.name),
      availableMorningLeaderIds: availableMorningLeaders.map((t) => t.id),
      availableAfternoonLeaderIds: availableAfternoonLeaders.map((t) => t.id),
      morningOccupied,
      afternoonOccupied,
      sideCleaningOrderCount,
      sideCleaningUnconfirmedCount,
      unassignedTotal,
      assignableMorning,
      assignableAfternoonSlot,
    };
  }

  res.json({ byDate });
});

export default router;
