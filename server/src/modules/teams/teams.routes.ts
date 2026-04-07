import { Router, type Request } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../../lib/prisma.js';
import { authMiddleware, adminOnly } from '../auth/auth.middleware.js';
import type { AuthPayload } from '../auth/auth.middleware.js';
import { kstMonthRangeYm } from '../inquiries/inquiryListDateRange.js';

const router = Router();

const YMD = /^\d{4}-\d{2}-\d{2}$/;
/** 활성 팀원 기준 최대 인원 (표준 구성: 팀장 1 + 팀원 2) */
const MAX_ACTIVE_TEAM_MEMBERS = 2;

router.use(authMiddleware, adminOnly);

/**
 * 팀장별 월간 배정·상태 집계
 * - 기준: 예약일(preferredDate)이 해당 달(KST)에 속하는 접수만
 * - 배정: 해당 팀장에게 Assignment가 있는 건(행) 수
 */
router.get('/leader-monthly-stats', async (req, res) => {
  const monthRaw = typeof req.query.month === 'string' ? req.query.month.trim() : '';
  const monthKey =
    monthRaw || new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 7);
  const range = kstMonthRangeYm(monthKey);
  if (!range) {
    res.status(400).json({ error: 'month는 YYYY-MM 형식이어야 합니다.' });
    return;
  }

  const leaders = await prisma.user.findMany({
    where: { role: 'TEAM_LEADER', isActive: true },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });

  const assignments = await prisma.assignment.findMany({
    where: {
      inquiry: {
        preferredDate: { gte: range.gte, lte: range.lte },
      },
    },
    select: {
      teamLeaderId: true,
      inquiry: { select: { status: true } },
    },
  });

  const statsMap = new Map<
    string,
    { assigned: number; completed: number; incomplete: number; cancelled: number }
  >();
  for (const l of leaders) {
    statsMap.set(l.id, { assigned: 0, completed: 0, incomplete: 0, cancelled: 0 });
  }

  for (const a of assignments) {
    const stats = statsMap.get(a.teamLeaderId);
    if (!stats) continue;
    stats.assigned++;
    const st = a.inquiry.status;
    if (st === 'COMPLETED') stats.completed++;
    else if (st === 'CANCELLED') stats.cancelled++;
    else stats.incomplete++;
  }

  res.json({
    month: monthKey,
    items: leaders.map((l) => {
      const s = statsMap.get(l.id)!;
      return {
        teamLeaderId: l.id,
        name: l.name,
        assigned: s.assigned,
        completed: s.completed,
        incomplete: s.incomplete,
        cancelled: s.cancelled,
      };
    }),
  });
});

async function verifyAdminPassword(req: Request, password: unknown): Promise<boolean> {
  const p = password != null ? String(password) : '';
  if (!p) return false;
  const user = (req as unknown as { user: AuthPayload }).user;
  const dbUser = await prisma.user.findUnique({ where: { id: user.userId } });
  if (!dbUser) return false;
  return bcrypt.compare(p, dbUser.passwordHash);
}

/** 팀 목록 (팀장·팀원·휴무 일부 메타는 별도 조회) */
router.get('/', async (_req, res) => {
  const teams = await prisma.team.findMany({
    orderBy: { updatedAt: 'desc' },
    include: {
      teamLeader: { select: { id: true, name: true, email: true, phone: true, isActive: true } },
      members: {
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        include: {
          _count: { select: { dayOffs: true } },
        },
      },
    },
  });
  res.json({
    items: teams.map((t) => ({
      id: t.id,
      memo: t.memo,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
      teamLeader: t.teamLeader,
      members: t.members.map((m) => ({
        id: m.id,
        name: m.name,
        phone: m.phone,
        sortOrder: m.sortOrder,
        isActive: m.isActive,
        createdAt: m.createdAt.toISOString(),
        dayOffCount: m._count.dayOffs,
      })),
    })),
  });
});

/** 팀 생성 (팀장당 1팀) */
router.post('/', async (req, res) => {
  const { teamLeaderId, memo } = req.body as { teamLeaderId?: string; memo?: string | null };
  if (!teamLeaderId || typeof teamLeaderId !== 'string') {
    res.status(400).json({ error: 'teamLeaderId가 필요합니다.' });
    return;
  }
  const leader = await prisma.user.findFirst({
    where: { id: teamLeaderId, role: 'TEAM_LEADER' },
  });
  if (!leader) {
    res.status(400).json({ error: '유효한 팀장 계정을 찾을 수 없습니다.' });
    return;
  }
  const existing = await prisma.team.findUnique({ where: { teamLeaderId } });
  if (existing) {
    res.status(409).json({ error: '이 팀장에게 이미 팀이 등록되어 있습니다.' });
    return;
  }
  const team = await prisma.team.create({
    data: {
      teamLeaderId,
      memo: memo != null && memo !== '' ? String(memo) : null,
    },
    include: {
      teamLeader: { select: { id: true, name: true, email: true, phone: true, isActive: true } },
      members: true,
    },
  });
  res.status(201).json({
    id: team.id,
    memo: team.memo,
    teamLeader: team.teamLeader,
    members: [],
  });
});

/** 전사 팀원 풀 (teamId 없음). `/:teamId`보다 먼저 등록해야 `/members`가 teamId로 오인되지 않음 */
const MAX_POOL_MEMBERS = 100;

router.get('/members', async (_req, res) => {
  const members = await prisma.teamMember.findMany({
    where: { teamId: null },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    include: { _count: { select: { dayOffs: true } } },
  });
  res.json({
    items: members.map((m) => ({
      id: m.id,
      name: m.name,
      phone: m.phone,
      sortOrder: m.sortOrder,
      isActive: m.isActive,
      createdAt: m.createdAt.toISOString(),
      dayOffCount: m._count.dayOffs,
    })),
  });
});

router.post('/members', async (req, res) => {
  const body = req.body as { name?: string; phone?: string | null; sortOrder?: number };
  if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
    res.status(400).json({ error: '이름을 입력해주세요.' });
    return;
  }
  try {
    const activePool = await prisma.teamMember.count({
      where: { teamId: null, isActive: true },
    });
    if (activePool >= MAX_POOL_MEMBERS) {
      res.status(400).json({
        error: `팀원은 활성 최대 ${MAX_POOL_MEMBERS}명까지 등록할 수 있습니다.`,
      });
      return;
    }
    const member = await prisma.teamMember.create({
      data: {
        teamId: null,
        name: body.name.trim(),
        phone: body.phone != null && String(body.phone).trim() ? String(body.phone).trim() : null,
        sortOrder:
          typeof body.sortOrder === 'number' && Number.isFinite(body.sortOrder) ? body.sortOrder : activePool,
      },
    });
    res.status(201).json({
      id: member.id,
      name: member.name,
      phone: member.phone,
      sortOrder: member.sortOrder,
      isActive: member.isActive,
      createdAt: member.createdAt.toISOString(),
    });
  } catch (e) {
    console.error('POST /teams/members:', e);
    const msg = e instanceof Error ? e.message : String(e);
    const hint =
      process.env.NODE_ENV !== 'production'
        ? msg
        : '저장 중 오류가 발생했습니다. DB 스키마(team_id nullable)를 최신으로 맞췄는지 확인하세요.';
    res.status(500).json({ error: hint });
  }
});

router.patch('/members/:memberId', async (req, res) => {
  const { memberId } = req.params;
  const body = req.body as {
    name?: string;
    phone?: string | null;
    sortOrder?: number;
    isActive?: boolean;
  };
  const member = await prisma.teamMember.findFirst({
    where: { id: memberId, teamId: null },
  });
  if (!member) {
    res.status(404).json({ error: '팀원을 찾을 수 없습니다.' });
    return;
  }
  if (body.isActive === true && !member.isActive) {
    const activePool = await prisma.teamMember.count({
      where: { teamId: null, isActive: true },
    });
    if (activePool >= MAX_POOL_MEMBERS) {
      res.status(400).json({
        error: `전사 팀원은 활성 최대 ${MAX_POOL_MEMBERS}명까지입니다.`,
      });
      return;
    }
  }
  const updated = await prisma.teamMember.update({
    where: { id: memberId },
    data: {
      name: body.name === undefined ? undefined : String(body.name).trim() || member.name,
      phone: body.phone === undefined ? undefined : body.phone === null || body.phone === '' ? null : String(body.phone),
      sortOrder:
        body.sortOrder === undefined
          ? undefined
          : typeof body.sortOrder === 'number' && Number.isFinite(body.sortOrder)
            ? body.sortOrder
            : member.sortOrder,
      isActive: body.isActive === undefined ? undefined : Boolean(body.isActive),
    },
  });
  res.json({
    id: updated.id,
    name: updated.name,
    phone: updated.phone,
    sortOrder: updated.sortOrder,
    isActive: updated.isActive,
  });
});

router.delete('/members/:memberId', async (req, res) => {
  const { memberId } = req.params;
  const { password } = req.body as { password?: string };
  if (!(await verifyAdminPassword(req, password))) {
    const p = password != null ? String(password) : '';
    res.status(p ? 401 : 400).json({ error: p ? '비밀번호가 일치하지 않습니다.' : '비밀번호를 입력해주세요.' });
    return;
  }
  const member = await prisma.teamMember.findFirst({
    where: { id: memberId, teamId: null },
  });
  if (!member) {
    res.status(404).json({ error: '팀원을 찾을 수 없습니다.' });
    return;
  }
  await prisma.teamMember.delete({ where: { id: memberId } });
  res.json({ ok: true });
});

router.get('/members/:memberId/day-offs', async (req, res) => {
  const { memberId } = req.params;
  const { start, end } = req.query as { start?: string; end?: string };
  const member = await prisma.teamMember.findFirst({
    where: { id: memberId, teamId: null },
  });
  if (!member) {
    res.status(404).json({ error: '팀원을 찾을 수 없습니다.' });
    return;
  }
  const now = new Date();
  const startDate =
    start && YMD.test(start) ? new Date(`${start}T12:00:00`) : new Date(now.getFullYear(), now.getMonth(), 1);
  const endDate =
    end && YMD.test(end)
      ? new Date(`${end}T12:00:00`)
      : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const list = await prisma.teamMemberDayOff.findMany({
    where: {
      teamMemberId: memberId,
      date: { gte: startDate, lte: endDate },
    },
    orderBy: { date: 'asc' },
  });
  res.json({ items: list.map((d) => d.date.toISOString().slice(0, 10)) });
});

router.post('/members/:memberId/day-offs', async (req, res) => {
  const { memberId } = req.params;
  const { date } = req.body as { date?: string };
  if (!date || !YMD.test(date)) {
    res.status(400).json({ error: '유효한 날짜(yyyy-mm-dd)를 입력해주세요.' });
    return;
  }
  const member = await prisma.teamMember.findFirst({
    where: { id: memberId, teamId: null },
  });
  if (!member) {
    res.status(404).json({ error: '팀원을 찾을 수 없습니다.' });
    return;
  }
  const d = new Date(`${date}T12:00:00`);
  await prisma.teamMemberDayOff.upsert({
    where: {
      teamMemberId_date: { teamMemberId: memberId, date: d },
    },
    create: { teamMemberId: memberId, date: d },
    update: {},
  });
  res.json({ ok: true });
});

router.delete('/members/:memberId/day-offs', async (req, res) => {
  const { memberId } = req.params;
  const { date } = req.query as { date?: string };
  if (!date || !YMD.test(date)) {
    res.status(400).json({ error: '유효한 날짜(yyyy-mm-dd)를 입력해주세요.' });
    return;
  }
  const member = await prisma.teamMember.findFirst({
    where: { id: memberId, teamId: null },
  });
  if (!member) {
    res.status(404).json({ error: '팀원을 찾을 수 없습니다.' });
    return;
  }
  const d = new Date(`${date}T12:00:00`);
  await prisma.teamMemberDayOff.deleteMany({
    where: { teamMemberId: memberId, date: d },
  });
  res.json({ ok: true });
});

router.patch('/:teamId', async (req, res) => {
  const { teamId } = req.params;
  const { memo } = req.body as { memo?: string | null };
  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team) {
    res.status(404).json({ error: '팀을 찾을 수 없습니다.' });
    return;
  }
  const updated = await prisma.team.update({
    where: { id: teamId },
    data: { memo: memo === undefined ? undefined : memo === null || memo === '' ? null : String(memo) },
  });
  res.json({ id: updated.id, memo: updated.memo, updatedAt: updated.updatedAt.toISOString() });
});

router.delete('/:teamId', async (req, res) => {
  const { teamId } = req.params;
  const { password } = req.body as { password?: string };
  if (!(await verifyAdminPassword(req, password))) {
    const p = password != null ? String(password) : '';
    res.status(p ? 401 : 400).json({ error: p ? '비밀번호가 일치하지 않습니다.' : '비밀번호를 입력해주세요.' });
    return;
  }
  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team) {
    res.status(404).json({ error: '팀을 찾을 수 없습니다.' });
    return;
  }
  await prisma.team.delete({ where: { id: teamId } });
  res.json({ ok: true });
});

router.post('/:teamId/members', async (req, res) => {
  const { teamId } = req.params;
  const body = req.body as { name?: string; phone?: string | null; sortOrder?: number };
  if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
    res.status(400).json({ error: '이름을 입력해주세요.' });
    return;
  }
  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team) {
    res.status(404).json({ error: '팀을 찾을 수 없습니다.' });
    return;
  }
  const activeCount = await prisma.teamMember.count({
    where: { teamId, isActive: true },
  });
  if (activeCount >= MAX_ACTIVE_TEAM_MEMBERS) {
    res.status(400).json({ error: `활성 팀원은 최대 ${MAX_ACTIVE_TEAM_MEMBERS}명까지 등록할 수 있습니다.` });
    return;
  }
  const member = await prisma.teamMember.create({
    data: {
      teamId,
      name: body.name.trim(),
      phone: body.phone != null && String(body.phone).trim() ? String(body.phone).trim() : null,
      sortOrder: typeof body.sortOrder === 'number' && Number.isFinite(body.sortOrder) ? body.sortOrder : activeCount,
    },
  });
  res.status(201).json({
    id: member.id,
    name: member.name,
    phone: member.phone,
    sortOrder: member.sortOrder,
    isActive: member.isActive,
    createdAt: member.createdAt.toISOString(),
  });
});

router.patch('/:teamId/members/:memberId', async (req, res) => {
  const { teamId, memberId } = req.params;
  const body = req.body as {
    name?: string;
    phone?: string | null;
    sortOrder?: number;
    isActive?: boolean;
  };
  const member = await prisma.teamMember.findFirst({
    where: { id: memberId, teamId },
  });
  if (!member) {
    res.status(404).json({ error: '팀원을 찾을 수 없습니다.' });
    return;
  }
  if (body.isActive === true && !member.isActive) {
    const activeCount = await prisma.teamMember.count({
      where: { teamId, isActive: true },
    });
    if (activeCount >= MAX_ACTIVE_TEAM_MEMBERS) {
      res.status(400).json({ error: `활성 팀원은 최대 ${MAX_ACTIVE_TEAM_MEMBERS}명까지입니다.` });
      return;
    }
  }
  const updated = await prisma.teamMember.update({
    where: { id: memberId },
    data: {
      name: body.name === undefined ? undefined : String(body.name).trim() || member.name,
      phone: body.phone === undefined ? undefined : body.phone === null || body.phone === '' ? null : String(body.phone),
      sortOrder:
        body.sortOrder === undefined
          ? undefined
          : typeof body.sortOrder === 'number' && Number.isFinite(body.sortOrder)
            ? body.sortOrder
            : member.sortOrder,
      isActive: body.isActive === undefined ? undefined : Boolean(body.isActive),
    },
  });
  res.json({
    id: updated.id,
    name: updated.name,
    phone: updated.phone,
    sortOrder: updated.sortOrder,
    isActive: updated.isActive,
  });
});

router.delete('/:teamId/members/:memberId', async (req, res) => {
  const { teamId, memberId } = req.params;
  const { password } = req.body as { password?: string };
  if (!(await verifyAdminPassword(req, password))) {
    const p = password != null ? String(password) : '';
    res.status(p ? 401 : 400).json({ error: p ? '비밀번호가 일치하지 않습니다.' : '비밀번호를 입력해주세요.' });
    return;
  }
  const member = await prisma.teamMember.findFirst({
    where: { id: memberId, teamId },
  });
  if (!member) {
    res.status(404).json({ error: '팀원을 찾을 수 없습니다.' });
    return;
  }
  await prisma.teamMember.delete({ where: { id: memberId } });
  res.json({ ok: true });
});

/** 팀원 휴무 목록 */
router.get('/:teamId/members/:memberId/day-offs', async (req, res) => {
  const { teamId, memberId } = req.params;
  const { start, end } = req.query as { start?: string; end?: string };
  const member = await prisma.teamMember.findFirst({
    where: { id: memberId, teamId },
  });
  if (!member) {
    res.status(404).json({ error: '팀원을 찾을 수 없습니다.' });
    return;
  }
  const now = new Date();
  const startDate =
    start && YMD.test(start) ? new Date(`${start}T12:00:00`) : new Date(now.getFullYear(), now.getMonth(), 1);
  const endDate =
    end && YMD.test(end)
      ? new Date(`${end}T12:00:00`)
      : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const list = await prisma.teamMemberDayOff.findMany({
    where: {
      teamMemberId: memberId,
      date: { gte: startDate, lte: endDate },
    },
    orderBy: { date: 'asc' },
  });
  res.json({ items: list.map((d) => d.date.toISOString().slice(0, 10)) });
});

router.post('/:teamId/members/:memberId/day-offs', async (req, res) => {
  const { teamId, memberId } = req.params;
  const { date } = req.body as { date?: string };
  if (!date || !YMD.test(date)) {
    res.status(400).json({ error: '유효한 날짜(yyyy-mm-dd)를 입력해주세요.' });
    return;
  }
  const member = await prisma.teamMember.findFirst({
    where: { id: memberId, teamId },
  });
  if (!member) {
    res.status(404).json({ error: '팀원을 찾을 수 없습니다.' });
    return;
  }
  const d = new Date(`${date}T12:00:00`);
  await prisma.teamMemberDayOff.upsert({
    where: {
      teamMemberId_date: { teamMemberId: memberId, date: d },
    },
    create: { teamMemberId: memberId, date: d },
    update: {},
  });
  res.json({ ok: true });
});

router.delete('/:teamId/members/:memberId/day-offs', async (req, res) => {
  const { teamId, memberId } = req.params;
  const { date } = req.query as { date?: string };
  if (!date || !YMD.test(date)) {
    res.status(400).json({ error: '유효한 날짜(yyyy-mm-dd)를 입력해주세요.' });
    return;
  }
  const member = await prisma.teamMember.findFirst({
    where: { id: memberId, teamId },
  });
  if (!member) {
    res.status(404).json({ error: '팀원을 찾을 수 없습니다.' });
    return;
  }
  const d = new Date(`${date}T12:00:00`);
  await prisma.teamMemberDayOff.deleteMany({
    where: { teamMemberId: memberId, date: d },
  });
  res.json({ ok: true });
});

export default router;
