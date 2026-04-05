import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { authMiddleware, adminOnly, adminOrMarketer } from '../auth/auth.middleware.js';
import { teamAuthMiddleware } from '../auth/auth.middleware.team.js';
import type { AuthPayload } from '../auth/auth.middleware.js';
import {
  consumesAfternoonSlot,
  consumesMorningSlot,
  isSideCleaningPreferredTime,
} from '../schedule/scheduleSlot.helpers.js';
import {
  countAvailableFieldStaffOnDate,
  sumCrewDemandForPreferredDate,
} from '../inquiries/crewMemberCapacity.helpers.js';
import { DEFAULT_CREW_UNITS_PER_INQUIRY } from '../schedule/crewCapacity.constants.js';
import { resolveLeaderMorningAfternoon } from '../schedule/scheduleDayAvailability.helpers.js';

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

function toDateKeyFromDb(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 관리자: 팀장·팀원 휴무를 월 캘린더에 표시하기 위한 집계 */
router.get('/team-calendar', authMiddleware, adminOnly, async (req, res) => {
  const { start, end } = req.query as { start?: string; end?: string };
  const now = new Date();
  const startDate =
    start && YMD.test(start)
      ? new Date(`${start}T00:00:00+09:00`)
      : new Date(now.getFullYear(), now.getMonth(), 1);
  const endDate =
    end && YMD.test(end)
      ? new Date(`${end}T23:59:59.999+09:00`)
      : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const [userDayOffRows, memberDayOffRows] = await Promise.all([
    prisma.userDayOff.findMany({
      where: {
        date: { gte: startDate, lte: endDate },
        teamLeader: { isActive: true, role: 'TEAM_LEADER' },
      },
      select: {
        date: true,
        teamLeader: { select: { id: true, name: true } },
      },
    }),
    prisma.teamMemberDayOff.findMany({
      where: {
        date: { gte: startDate, lte: endDate },
        teamMember: { isActive: true },
      },
      select: {
        date: true,
        teamMember: { select: { id: true, name: true } },
      },
    }),
  ]);

  const rangeStart = new Date(startDate);
  rangeStart.setHours(0, 0, 0, 0);
  const rangeEnd = new Date(endDate);
  rangeEnd.setHours(23, 59, 59, 999);

  const byDate: Record<
    string,
    { teamLeaderOffs: { id: string; name: string }[]; teamMemberOffs: { id: string; name: string }[] }
  > = {};

  for (let d = new Date(rangeStart); d <= rangeEnd; d.setDate(d.getDate() + 1)) {
    const key = toDateKeyFromDb(d);
    byDate[key] = { teamLeaderOffs: [], teamMemberOffs: [] };
  }

  const leaderByDay = new Map<string, Map<string, { id: string; name: string }>>();
  for (const row of userDayOffRows) {
    const key = toDateKeyFromDb(row.date);
    if (!byDate[key]) continue;
    if (!leaderByDay.has(key)) leaderByDay.set(key, new Map());
    leaderByDay.get(key)!.set(row.teamLeader.id, {
      id: row.teamLeader.id,
      name: row.teamLeader.name,
    });
  }
  for (const [k, map] of leaderByDay) {
    if (!byDate[k]) continue;
    byDate[k].teamLeaderOffs = [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  }

  const memberByDay = new Map<string, Map<string, { id: string; name: string }>>();
  for (const row of memberDayOffRows) {
    const key = toDateKeyFromDb(row.date);
    if (!byDate[key]) continue;
    if (!memberByDay.has(key)) memberByDay.set(key, new Map());
    memberByDay.get(key)!.set(row.teamMember.id, {
      id: row.teamMember.id,
      name: row.teamMember.name,
    });
  }
  for (const [k, map] of memberByDay) {
    if (!byDate[k]) continue;
    byDate[k].teamMemberOffs = [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  }

  res.json({ byDate });
});

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
      /** 오전·오후 슬롯에 근무 가능한 팀장 전원(이름, 표시용) */
      morningWorkingNames: string[];
      afternoonWorkingNames: string[];
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
      manualClosed?: boolean;
      /** 당일 휴무 제외 활성 팀원 수 */
      crewAvailable?: number;
      /** 당일 휴무인 활성 팀원 수 */
      crewDayOffCount?: number;
      /** 해당일 접수 팀원 투입 단위 합(취소 제외, 미입력 접수는 표준 2단위) */
      crewDemand?: number;
      /** 팀원 투입 잔여(명) */
      crewRemaining?: number;
      /** 팀원 잔여로 받을 수 있는 표준(팀원 2명) 접수 건수 상한(참고) */
      additionalStandardJobsByCrew?: number;
      /** 휴무일 기준 + 수동 슬롯 반영 오전·오후 근무 가능 팀장 수 */
      morningWorkingCount?: number;
      afternoonWorkingCount?: number;
      /** 관리자 일정 마감 범위 */
      closureScope?: 'FULL' | 'MORNING' | 'AFTERNOON';
    }
  > = {};

  const activeMembersTotal = await prisma.teamMember.count({ where: { isActive: true } });

  const leaderSlots = await prisma.scheduleDayLeaderSlot.findMany({
    where: { date: { gte: startDate, lte: endDate } },
  });
  const leaderSlotByKey = new Map<string, Map<string, { morning: boolean; afternoon: boolean }>>();
  for (const row of leaderSlots) {
    const k = toDateKey(row.date);
    if (!leaderSlotByKey.has(k)) leaderSlotByKey.set(k, new Map());
    leaderSlotByKey.get(k)!.set(row.teamLeaderId, {
      morning: row.morningAvailable,
      afternoon: row.afternoonAvailable,
    });
  }

  const rangeStart = new Date(startDate);
  rangeStart.setHours(0, 0, 0, 0);
  const rangeEnd = new Date(endDate);
  rangeEnd.setHours(23, 59, 59, 999);
  for (let d = new Date(rangeStart); d <= rangeEnd; d.setDate(d.getDate() + 1)) {
    const key = toDateKey(d);
    const dayOffList = dayOffs.filter((o) => toDateKey(o.date) === key);
    const offNames = dayOffList.map((o) => o.teamLeader.name);
    const offIds = new Set(dayOffList.map((o) => o.teamLeaderId));

    const slotMap = leaderSlotByKey.get(key);
    const leaderSlotsFor = (tid: string) => {
      const o = slotMap?.get(tid);
      return resolveLeaderMorningAfternoon(
        offIds.has(tid),
        o ? { morningAvailable: o.morning, afternoonAvailable: o.afternoon } : null
      );
    };

    const morningWorkingCount = teamLeaders.filter((t) => leaderSlotsFor(t.id).morning).length;
    const afternoonWorkingCount = teamLeaders.filter((t) => leaderSlotsFor(t.id).afternoon).length;
    const workingCount = teamLeaders.filter((t) => {
      const s = leaderSlotsFor(t.id);
      return s.morning || s.afternoon;
    }).length;

    const dayInquiries = inquiries.filter(
      (inv) => inv.preferredDate && toDateKey(inv.preferredDate) === key
    );

    const assignedIds = new Set<string>();
    for (const inv of dayInquiries) {
      for (const a of inv.assignments) {
        assignedIds.add(a.teamLeaderId);
      }
    }
    const availableLeaders = teamLeaders.filter((t) => {
      const s = leaderSlotsFor(t.id);
      return (s.morning || s.afternoon) && !assignedIds.has(t.id);
    });

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
      const leaderCount = inv.assignments.length;
      const slotWeight = leaderCount > 0 ? leaderCount : 1;
      if (consumesMorningSlot(inv)) morningOccupied += slotWeight;
      if (consumesAfternoonSlot(inv)) afternoonOccupied += slotWeight;
    }

    const morningAssignedIds = new Set<string>();
    for (const inv of dayInquiries) {
      if (!consumesMorningSlot(inv)) continue;
      for (const a of inv.assignments) {
        morningAssignedIds.add(a.teamLeaderId);
      }
    }
    const afternoonAssignedIds = new Set<string>();
    for (const inv of dayInquiries) {
      if (!consumesAfternoonSlot(inv)) continue;
      for (const a of inv.assignments) {
        afternoonAssignedIds.add(a.teamLeaderId);
      }
    }

    const morningWorkingLeaders = teamLeaders.filter((t) => leaderSlotsFor(t.id).morning);
    const afternoonWorkingLeaders = teamLeaders.filter((t) => leaderSlotsFor(t.id).afternoon);
    const morningWorkingNames = [...morningWorkingLeaders]
      .map((t) => t.name)
      .sort((a, b) => a.localeCompare(b, 'ko'));
    const afternoonWorkingNames = [...afternoonWorkingLeaders]
      .map((t) => t.name)
      .sort((a, b) => a.localeCompare(b, 'ko'));

    const availableMorningLeaders = teamLeaders.filter(
      (t) => leaderSlotsFor(t.id).morning && !morningAssignedIds.has(t.id)
    );
    const availableAfternoonLeaders = teamLeaders.filter(
      (t) => leaderSlotsFor(t.id).afternoon && !afternoonAssignedIds.has(t.id)
    );

    const assignableMorning = Math.max(0, morningWorkingCount - morningOccupied);
    const assignableAfternoonSlot = Math.max(0, afternoonWorkingCount - afternoonOccupied);
    const unassignedTotal = assignableMorning + assignableAfternoonSlot;

    const crewAvailable = await countAvailableFieldStaffOnDate(prisma, key);
    const crewDemand = await sumCrewDemandForPreferredDate(prisma, key);
    const crewRemaining = Math.max(0, crewAvailable - crewDemand);
    const additionalStandardJobsByCrew = Math.floor(crewRemaining / DEFAULT_CREW_UNITS_PER_INQUIRY);
    const crewDayOffCount = Math.max(0, activeMembersTotal - crewAvailable);

    byDate[key] = {
      offCount: offNames.length,
      offNames,
      workingCount,
      totalTeamLeaders: totalCount,
      assignedCount: assignedIds.size,
      availableNames: availableLeaders.map((t) => t.name),
      availableMorningNames: availableMorningLeaders.map((t) => t.name),
      availableAfternoonNames: availableAfternoonLeaders.map((t) => t.name),
      morningWorkingNames,
      afternoonWorkingNames,
      availableMorningLeaderIds: availableMorningLeaders.map((t) => t.id),
      availableAfternoonLeaderIds: availableAfternoonLeaders.map((t) => t.id),
      morningOccupied,
      afternoonOccupied,
      sideCleaningOrderCount,
      sideCleaningUnconfirmedCount,
      unassignedTotal,
      assignableMorning,
      assignableAfternoonSlot,
      crewAvailable,
      crewDayOffCount,
      crewDemand,
      crewRemaining,
      additionalStandardJobsByCrew,
      morningWorkingCount,
      afternoonWorkingCount,
    };
  }

  const closureRows = await prisma.scheduleDayClosure.findMany({
    where: {
      date: { gte: rangeStart, lte: rangeEnd },
    },
    select: { date: true, scope: true },
  });
  const closureByKey = new Map<string, 'FULL' | 'MORNING' | 'AFTERNOON'>();
  for (const row of closureRows) {
    closureByKey.set(toDateKey(row.date), row.scope);
  }
  for (const key of Object.keys(byDate)) {
    const scope = closureByKey.get(key);
    if (!scope) continue;
    const cur = byDate[key];
    if (scope === 'FULL') {
      byDate[key] = {
        ...cur,
        assignableMorning: 0,
        assignableAfternoonSlot: 0,
        unassignedTotal: 0,
        availableMorningNames: [],
        availableAfternoonNames: [],
        availableMorningLeaderIds: [],
        availableAfternoonLeaderIds: [],
        availableNames: [],
        crewAvailable: 0,
        crewDemand: cur.crewDemand ?? 0,
        crewRemaining: 0,
        additionalStandardJobsByCrew: 0,
        manualClosed: true,
        closureScope: 'FULL',
      };
    } else if (scope === 'MORNING') {
      byDate[key] = {
        ...cur,
        assignableMorning: 0,
        unassignedTotal: cur.assignableAfternoonSlot ?? 0,
        availableMorningNames: [],
        availableMorningLeaderIds: [],
        manualClosed: false,
        closureScope: 'MORNING',
      };
    } else if (scope === 'AFTERNOON') {
      byDate[key] = {
        ...cur,
        assignableAfternoonSlot: 0,
        unassignedTotal: cur.assignableMorning ?? 0,
        availableAfternoonNames: [],
        availableAfternoonLeaderIds: [],
        manualClosed: false,
        closureScope: 'AFTERNOON',
      };
    }
  }

  res.json({ byDate });
});

export default router;
