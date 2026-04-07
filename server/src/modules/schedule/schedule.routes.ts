import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { authMiddleware, adminOnly } from '../auth/auth.middleware.js';
import { adminOrMarketer } from '../auth/auth.middleware.js';
import { resolveLeaderMorningAfternoon, resolveMemberAvailable } from './scheduleDayAvailability.helpers.js';
import { countAvailableFieldStaffOnDate } from '../inquiries/crewMemberCapacity.helpers.js';
import { dateToYmdKst, isUserEmployedOnYmd } from '../users/userEmployment.js';

const router = Router();

router.use(authMiddleware);
router.use(adminOrMarketer);

const YMD = /^\d{4}-\d{2}-\d{2}$/;

/** preferredDate 조회 — 하루 단위는 KST(Asia/Seoul)와 동일하게 맞춤 (말일 일정 누락 방지) */
function rangeFromQuery(start?: string, end?: string) {
  const now = new Date();
  if (start && YMD.test(start) && end && YMD.test(end)) {
    return {
      startDate: new Date(`${start}T00:00:00+09:00`),
      endDate: new Date(`${end}T23:59:59.999+09:00`),
    };
  }
  return {
    startDate: new Date(now.getFullYear(), now.getMonth(), 1),
    endDate: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999),
  };
}

router.get('/', async (req, res) => {
  const { start, end } = req.query as { start?: string; end?: string };
  const { startDate, endDate } = rangeFromQuery(
    typeof start === 'string' ? start : undefined,
    typeof end === 'string' ? end : undefined
  );

  const items = await prisma.inquiry.findMany({
    where: {
      preferredDate: { gte: startDate, lte: endDate },
      /** 대기(PENDING)도 예약일이 있으면 스케줄에 표시(접수 확정 전·발주서 대기 구분용) */
      status: { not: 'CANCELLED' },
    },
    orderBy: [{ preferredDate: 'asc' }, { preferredTime: 'asc' }],
    include: {
      assignments: {
        orderBy: { sortOrder: 'asc' },
        include: { teamLeader: { select: { id: true, name: true } } },
      },
      orderForm: {
        select: {
          id: true,
          totalAmount: true,
          depositAmount: true,
          balanceAmount: true,
          createdBy: { select: { id: true, name: true } },
        },
      },
      changeLogs: {
        orderBy: { createdAt: 'desc' as const },
        take: 30,
        select: { id: true, createdAt: true, lines: true },
      },
    },
  });

  res.json({ items });
});

/** 관리자: 해당일 일정 마감(범위별 잔여 슬롯·TO 조정) */
router.post('/closures', authMiddleware, adminOnly, async (req, res) => {
  const { date, scope } = req.body as {
    date?: string;
    scope?: 'FULL' | 'MORNING' | 'AFTERNOON';
  };
  if (!date || !YMD.test(date)) {
    res.status(400).json({ error: '유효한 날짜(yyyy-mm-dd)가 필요합니다.' });
    return;
  }
  const scopeVal =
    scope === 'MORNING' || scope === 'AFTERNOON' || scope === 'FULL' ? scope : 'FULL';
  const d = new Date(`${date}T12:00:00+09:00`);
  await prisma.scheduleDayClosure.upsert({
    where: { date: d },
    create: { date: d, scope: scopeVal },
    update: { scope: scopeVal },
  });
  res.json({ ok: true });
});

router.delete('/closures', authMiddleware, adminOnly, async (req, res) => {
  const { date } = req.query as { date?: string };
  if (!date || !YMD.test(date)) {
    res.status(400).json({ error: '유효한 날짜(yyyy-mm-dd)가 필요합니다.' });
    return;
  }
  const d = new Date(`${date}T12:00:00+09:00`);
  await prisma.scheduleDayClosure.deleteMany({ where: { date: d } });
  res.json({ ok: true });
});

/** 관리자: 해당일 가용 팀장·팀원 편집용 데이터 */
router.get('/day-availability', async (req, res) => {
  const { date } = req.query as { date?: string };
  if (!date || !YMD.test(date)) {
    res.status(400).json({ error: 'date(yyyy-mm-dd)가 필요합니다.' });
    return;
  }
  const d = new Date(`${date}T12:00:00+09:00`);

  const [teamLeadersRaw, members, leaderDayOffs, leaderSlots, memberSlots, closure] = await Promise.all([
    prisma.user.findMany({
      where: { role: 'TEAM_LEADER', isActive: true },
      select: { id: true, name: true, hireDate: true, resignationDate: true },
      orderBy: { name: 'asc' },
    }),
    prisma.teamMember.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    }),
    prisma.userDayOff.findMany({
      where: { date: d },
      select: { teamLeaderId: true },
    }),
    prisma.scheduleDayLeaderSlot.findMany({ where: { date: d } }),
    prisma.scheduleDayTeamMemberSlot.findMany({ where: { date: d } }),
    prisma.scheduleDayClosure.findUnique({ where: { date: d }, select: { scope: true } }),
  ]);

  const ymdForDay = dateToYmdKst(d);
  const teamLeaders = teamLeadersRaw.filter((u) =>
    isUserEmployedOnYmd(u.hireDate, u.resignationDate, ymdForDay)
  );

  const offLeaderIds = new Set(leaderDayOffs.map((x) => x.teamLeaderId));
  const leaderSlotMap = new Map(leaderSlots.map((r) => [r.teamLeaderId, r]));
  const memberSlotMap = new Map(memberSlots.map((r) => [r.teamMemberId, r]));

  const memberDayOffRows = await prisma.teamMemberDayOff.findMany({
    where: { date: d },
    select: { teamMemberId: true },
  });
  const memberOffSet = new Set(memberDayOffRows.map((x) => x.teamMemberId));

  const teamLeadersOut = teamLeaders.map((u) => {
    const o = leaderSlotMap.get(u.id);
    const hasOff = offLeaderIds.has(u.id);
    const slots = resolveLeaderMorningAfternoon(
      hasOff,
      o ? { morningAvailable: o.morningAvailable, afternoonAvailable: o.afternoonAvailable } : null
    );
    return {
      id: u.id,
      name: u.name,
      hasUserDayOff: hasOff,
      morningAvailable: slots.morning,
      afternoonAvailable: slots.afternoon,
      note: o?.note ?? null,
      hasOverride: Boolean(o),
    };
  });

  const membersOut = members.map((m) => {
    const o = memberSlotMap.get(m.id);
    const hasOff = memberOffSet.has(m.id);
    const avail = resolveMemberAvailable(hasOff, o != null ? o.available : null);
    return {
      id: m.id,
      name: m.name,
      hasTeamMemberDayOff: hasOff,
      available: avail,
      note: o?.note ?? null,
      hasOverride: Boolean(o),
    };
  });

  let morningWorkingCount = 0;
  let afternoonWorkingCount = 0;
  for (const row of teamLeadersOut) {
    if (row.morningAvailable) morningWorkingCount += 1;
    if (row.afternoonAvailable) afternoonWorkingCount += 1;
  }

  const ymd = date;
  const crewAvailable = await countAvailableFieldStaffOnDate(prisma, ymd);

  res.json({
    date: ymd,
    closureScope: closure?.scope ?? null,
    teamLeaders: teamLeadersOut,
    teamMembers: membersOut,
    summary: {
      morningWorkingCount,
      afternoonWorkingCount,
      crewAvailable,
    },
  });
});

/** 관리자: 해당일 가용 팀장·팀원 수동 설정(전체 교체) */
router.put('/day-availability', authMiddleware, adminOnly, async (req, res) => {
  const body = req.body as {
    date?: string;
    leaders?: Array<{
      teamLeaderId: string;
      morningAvailable: boolean;
      afternoonAvailable: boolean;
      note?: string | null;
    }>;
    members?: Array<{
      teamMemberId: string;
      available: boolean;
      note?: string | null;
    }>;
  };
  if (!body.date || !YMD.test(body.date)) {
    res.status(400).json({ error: 'date(yyyy-mm-dd)가 필요합니다.' });
    return;
  }
  const d = new Date(`${body.date}T12:00:00+09:00`);
  const leaders = body.leaders ?? [];
  const members = body.members ?? [];

  const noteMax = 500;
  const trimNote = (n: string | null | undefined) => {
    const s = (n ?? '').trim();
    if (!s) return null;
    return s.length > noteMax ? s.slice(0, noteMax) : s;
  };

  await prisma.$transaction(async (tx) => {
    await tx.scheduleDayLeaderSlot.deleteMany({ where: { date: d } });
    await tx.scheduleDayTeamMemberSlot.deleteMany({ where: { date: d } });
    if (leaders.length > 0) {
      await tx.scheduleDayLeaderSlot.createMany({
        data: leaders.map((l) => ({
          date: d,
          teamLeaderId: l.teamLeaderId,
          morningAvailable: l.morningAvailable,
          afternoonAvailable: l.afternoonAvailable,
          note: trimNote(l.note),
        })),
      });
    }
    if (members.length > 0) {
      await tx.scheduleDayTeamMemberSlot.createMany({
        data: members.map((m) => ({
          date: d,
          teamMemberId: m.teamMemberId,
          available: m.available,
          note: trimNote(m.note),
        })),
      });
    }
  });

  res.json({ ok: true });
});

export default router;
