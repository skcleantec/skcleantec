import { Router, type Request, type Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../../lib/prisma.js';
import { authMiddleware, adminOnly } from '../auth/auth.middleware.js';
import type { AuthPayload } from '../auth/auth.middleware.js';
import { resolveTenantIdFromAuth, type TenantScopedRequest } from '../tenants/tenant.middleware.js';
import { notifyCrewGroupsInboxRefresh } from '../crew/crewFieldRealtime.js';
import { ROSTER_YMD, getDayRosterInRange, putDayRosterEntries } from './crewGroupDayRoster.service.js';

const router = Router();

router.use(authMiddleware, adminOnly);
router.use(async (req, res, next) => {
  const tenantId = await resolveTenantIdFromAuth((req as unknown as { user: AuthPayload }).user);
  if (!tenantId) {
    res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
    return;
  }
  (req as unknown as TenantScopedRequest).tenantId = tenantId;
  next();
});

const MAX_CREW_GROUPS = 30;
/** 공유 로그인 ID — 이메일 형태(@) 허용, 한글·공백 불가 */
const LOGIN_ID_RE = /^[a-zA-Z0-9@._-]{3,64}$/;

async function verifyAdminPassword(req: Request, password: unknown): Promise<boolean> {
  const p = password != null ? String(password) : '';
  if (!p) return false;
  const user = (req as unknown as { user: AuthPayload }).user;
  const tenantId = (req as unknown as TenantScopedRequest).tenantId;
  const dbUser = await prisma.user.findFirst({ where: { id: user.userId, tenantId } });
  if (!dbUser) return false;
  return bcrypt.compare(p, dbUser.passwordHash);
}

async function findGroupForTenant(groupId: string, tenantId: string) {
  return prisma.teamCrewGroup.findFirst({ where: { id: groupId, tenantId } });
}

function badPasswordResponse(res: Response, password: unknown) {
  const p = password != null ? String(password) : '';
  res.status(p ? 401 : 400).json({ error: p ? '관리자 비밀번호가 일치하지 않습니다.' : '관리자 비밀번호를 입력해주세요.' });
}

router.get('/', async (req, res) => {
  const tenantId = (req as unknown as TenantScopedRequest).tenantId;
  const groups = await prisma.teamCrewGroup.findMany({
    where: { tenantId },
    orderBy: { updatedAt: 'desc' },
    include: {
      members: {
        include: {
          teamMember: { select: { id: true, name: true, nameTh: true, phone: true, isActive: true } },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  });
  res.json({
    items: groups.map((g) => ({
      id: g.id,
      name: g.name,
      loginId: g.loginId,
      phone: g.phone,
      useDailyRosterOnly: g.useDailyRosterOnly,
      hasSettingsPassword: g.settingsPasswordHash != null,
      isActive: g.isActive,
      createdAt: g.createdAt.toISOString(),
      updatedAt: g.updatedAt.toISOString(),
      members: g.members.map((m) => ({
        id: m.id,
        teamMemberId: m.teamMemberId,
        name: m.teamMember.name,
        nameTh: m.teamMember.nameTh,
        phone: m.teamMember.phone,
        isActive: m.teamMember.isActive,
        isGroupLeader: m.isGroupLeader,
      })),
    })),
  });
});

router.post('/', async (req, res) => {
  const tenantId = (req as unknown as TenantScopedRequest).tenantId;
  const body = req.body as {
    name?: string;
    loginId?: string;
    password?: string;
    phone?: string | null;
    useDailyRosterOnly?: boolean;
    settingsPassword?: string | null;
    adminPassword?: string;
  };

  if (!(await verifyAdminPassword(req, body.adminPassword))) {
    badPasswordResponse(res, body.adminPassword);
    return;
  }

  const name = body.name != null ? String(body.name).trim() : '';
  const loginId = body.loginId != null ? String(body.loginId).trim() : '';
  const password = body.password != null ? String(body.password) : '';

  if (!name) {
    res.status(400).json({ error: '그룹 이름을 입력해주세요.' });
    return;
  }
  if (!LOGIN_ID_RE.test(loginId)) {
    res.status(400).json({
      error: '로그인 아이디는 3~64자의 영문·숫자·@ . _ - 만 사용할 수 있습니다.',
    });
    return;
  }
  if (password.length < 4) {
    res.status(400).json({ error: '공유 로그인 비밀번호는 4자 이상이어야 합니다.' });
    return;
  }

  const count = await prisma.teamCrewGroup.count({ where: { tenantId } });
  if (count >= MAX_CREW_GROUPS) {
    res.status(400).json({ error: `크루 그룹은 최대 ${MAX_CREW_GROUPS}개까지 만들 수 있습니다.` });
    return;
  }

  const phone =
    body.phone != null && String(body.phone).trim() ? String(body.phone).trim().slice(0, 32) : null;
  const useDailyRosterOnly = Boolean(body.useDailyRosterOnly);

  let settingsPasswordHash: string | null = null;
  const sp = body.settingsPassword != null ? String(body.settingsPassword) : '';
  if (sp) {
    if (sp.length < 4) {
      res.status(400).json({ error: '설정용 비밀번호는 4자 이상이어야 합니다.' });
      return;
    }
    settingsPasswordHash = await bcrypt.hash(sp, 10);
  }

  try {
    const created = await prisma.teamCrewGroup.create({
      data: {
        tenantId,
        name,
        loginId,
        passwordHash: await bcrypt.hash(password, 10),
        phone,
        useDailyRosterOnly,
        settingsPasswordHash,
      },
    });
    res.status(201).json({
      id: created.id,
      name: created.name,
      loginId: created.loginId,
      phone: created.phone,
      useDailyRosterOnly: created.useDailyRosterOnly,
      hasSettingsPassword: created.settingsPasswordHash != null,
      isActive: created.isActive,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
      members: [],
    });
  } catch (e: unknown) {
    const code = e && typeof e === 'object' && 'code' in e ? (e as { code: string }).code : '';
    if (code === 'P2002') {
      res.status(409).json({ error: '이미 사용 중인 로그인 아이디입니다.' });
      return;
    }
    if (code === 'P2021') {
      res.status(503).json({
        error:
          'DB에 크루 그룹 테이블이 없습니다. server에서 `npx prisma db push` 또는 마이그레이션 적용 후 API를 재시작하세요.',
      });
      return;
    }
    console.error('POST /team-crew-groups', e);
    res.status(500).json({ error: '저장 중 오류가 발생했습니다.' });
  }
});

router.get('/:groupId/day-roster', async (req, res) => {
  const tenantId = (req as unknown as TenantScopedRequest).tenantId;
  const { groupId } = req.params;
  const { start, end } = req.query as { start?: string; end?: string };
  if (!start || !end || !ROSTER_YMD.test(start) || !ROSTER_YMD.test(end)) {
    res.status(400).json({ error: 'start, end는 YYYY-MM-DD 형식이어야 합니다.' });
    return;
  }
  const group = await findGroupForTenant(groupId, tenantId);
  if (!group) {
    res.status(404).json({ error: '그룹을 찾을 수 없습니다.' });
    return;
  }
  const items = await getDayRosterInRange(groupId, start, end);
  res.json({ groupId, start, end, items });
});

router.put('/:groupId/day-roster', async (req, res) => {
  const tenantId = (req as unknown as TenantScopedRequest).tenantId;
  const { groupId } = req.params;
  const body = req.body as { entries?: { date: string; teamMemberIds: string[] }[] };
  const entries = body.entries;
  if (!Array.isArray(entries) || entries.length === 0) {
    res.status(400).json({ error: 'entries 배열이 필요합니다.' });
    return;
  }
  for (const e of entries) {
    if (!e || typeof e.date !== 'string' || !Array.isArray(e.teamMemberIds)) {
      res.status(400).json({ error: '각 항목은 date, teamMemberIds가 필요합니다.' });
      return;
    }
  }
  const group = await findGroupForTenant(groupId, tenantId);
  if (!group) {
    res.status(404).json({ error: '그룹을 찾을 수 없습니다.' });
    return;
  }
  try {
    await putDayRosterEntries(groupId, entries);
    notifyCrewGroupsInboxRefresh([groupId]);
    res.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === 'CREW_ROSTER_BAD_DATE') {
      res.status(400).json({ error: '날짜 형식이 올바르지 않습니다.' });
      return;
    }
    if (msg.startsWith('CREW_ROSTER_INVALID_MEMBER')) {
      res.status(400).json({ error: '그룹 멤버가 아닌 팀원이 포함되어 있습니다.' });
      return;
    }
    console.error('PUT /team-crew-groups/:groupId/day-roster', e);
    res.status(500).json({ error: '저장 중 오류가 발생했습니다.' });
  }
});

router.patch('/:groupId', async (req, res) => {
  const tenantId = (req as unknown as TenantScopedRequest).tenantId;
  const { groupId } = req.params;
  const body = req.body as {
    name?: string;
    phone?: string | null;
    loginId?: string;
    useDailyRosterOnly?: boolean;
    isActive?: boolean;
    password?: string | null;
    settingsPassword?: string | null;
    clearSettingsPassword?: boolean;
    adminPassword?: string;
  };

  const group = await findGroupForTenant(groupId, tenantId);
  if (!group) {
    res.status(404).json({ error: '그룹을 찾을 수 없습니다.' });
    return;
  }

  const needsAdminPw =
    (body.loginId !== undefined && String(body.loginId).trim() !== group.loginId) ||
    (body.password != null && String(body.password).length > 0) ||
    (body.settingsPassword != null && String(body.settingsPassword).length > 0) ||
    body.clearSettingsPassword === true;

  if (needsAdminPw && !(await verifyAdminPassword(req, body.adminPassword))) {
    badPasswordResponse(res, body.adminPassword);
    return;
  }

  const data: {
    name?: string;
    phone?: string | null;
    loginId?: string;
    useDailyRosterOnly?: boolean;
    isActive?: boolean;
    passwordHash?: string;
    settingsPasswordHash?: string | null;
  } = {};

  if (body.name !== undefined) {
    const n = String(body.name).trim();
    if (!n) {
      res.status(400).json({ error: '그룹 이름을 비울 수 없습니다.' });
      return;
    }
    data.name = n;
  }
  if (body.phone !== undefined) {
    data.phone =
      body.phone != null && String(body.phone).trim() ? String(body.phone).trim().slice(0, 32) : null;
  }
  if (body.useDailyRosterOnly !== undefined) {
    data.useDailyRosterOnly = Boolean(body.useDailyRosterOnly);
  }
  if (body.isActive !== undefined) {
    data.isActive = Boolean(body.isActive);
  }
  if (body.loginId !== undefined) {
    const lid = String(body.loginId).trim();
    if (!LOGIN_ID_RE.test(lid)) {
      res.status(400).json({
        error: '로그인 아이디는 3~64자의 영문·숫자·@ . _ - 만 사용할 수 있습니다.',
      });
      return;
    }
    data.loginId = lid;
  }
  if (body.password != null && String(body.password).length > 0) {
    const p = String(body.password);
    if (p.length < 4) {
      res.status(400).json({ error: '공유 로그인 비밀번호는 4자 이상이어야 합니다.' });
      return;
    }
    data.passwordHash = await bcrypt.hash(p, 10);
  }
  if (body.clearSettingsPassword === true) {
    data.settingsPasswordHash = null;
  } else if (body.settingsPassword != null && String(body.settingsPassword).length > 0) {
    const sp = String(body.settingsPassword);
    if (sp.length < 4) {
      res.status(400).json({ error: '설정용 비밀번호는 4자 이상이어야 합니다.' });
      return;
    }
    data.settingsPasswordHash = await bcrypt.hash(sp, 10);
  }

  if (Object.keys(data).length === 0) {
    res.status(400).json({ error: '변경할 내용이 없습니다.' });
    return;
  }

  try {
    const updated = await prisma.teamCrewGroup.update({
      where: { id: groupId },
      data,
      include: {
        members: {
          include: {
            teamMember: { select: { id: true, name: true, nameTh: true, phone: true, isActive: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    res.json({
      id: updated.id,
      name: updated.name,
      loginId: updated.loginId,
      phone: updated.phone,
      useDailyRosterOnly: updated.useDailyRosterOnly,
      hasSettingsPassword: updated.settingsPasswordHash != null,
      isActive: updated.isActive,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
      members: updated.members.map((m) => ({
        id: m.id,
        teamMemberId: m.teamMemberId,
        name: m.teamMember.name,
        nameTh: m.teamMember.nameTh,
        phone: m.teamMember.phone,
        isActive: m.teamMember.isActive,
        isGroupLeader: m.isGroupLeader,
      })),
    });
  } catch (e: unknown) {
    const code = e && typeof e === 'object' && 'code' in e ? (e as { code: string }).code : '';
    if (code === 'P2002') {
      res.status(409).json({ error: '이미 사용 중인 로그인 아이디입니다.' });
      return;
    }
    console.error('PATCH /team-crew-groups/:groupId', e);
    res.status(500).json({ error: '저장 중 오류가 발생했습니다.' });
  }
});

router.delete('/:groupId', async (req, res) => {
  const tenantId = (req as unknown as TenantScopedRequest).tenantId;
  const { groupId } = req.params;
  const { password } = req.body as { password?: string };
  if (!(await verifyAdminPassword(req, password))) {
    badPasswordResponse(res, password);
    return;
  }
  const group = await findGroupForTenant(groupId, tenantId);
  if (!group) {
    res.status(404).json({ error: '그룹을 찾을 수 없습니다.' });
    return;
  }
  await prisma.teamCrewGroup.delete({ where: { id: groupId } });
  res.json({ ok: true });
});

router.post('/:groupId/members', async (req, res) => {
  const tenantId = (req as unknown as TenantScopedRequest).tenantId;
  const { groupId } = req.params;
  const { teamMemberId } = req.body as { teamMemberId?: string };
  if (!teamMemberId || typeof teamMemberId !== 'string') {
    res.status(400).json({ error: 'teamMemberId가 필요합니다.' });
    return;
  }
  const group = await findGroupForTenant(groupId, tenantId);
  if (!group) {
    res.status(404).json({ error: '그룹을 찾을 수 없습니다.' });
    return;
  }
  const member = await prisma.teamMember.findFirst({
    where: { id: teamMemberId, teamId: null, tenantId },
  });
  if (!member) {
    res.status(400).json({ error: '전사 팀원 풀에서만 멤버를 추가할 수 있습니다.' });
    return;
  }
  try {
    const row = await prisma.teamCrewGroupMember.create({
      data: { groupId, teamMemberId },
      include: {
        teamMember: { select: { id: true, name: true, nameTh: true, phone: true, isActive: true } },
      },
    });
    res.status(201).json({
      id: row.id,
      teamMemberId: row.teamMemberId,
      name: row.teamMember.name,
      nameTh: row.teamMember.nameTh,
      phone: row.teamMember.phone,
      isActive: row.teamMember.isActive,
      isGroupLeader: row.isGroupLeader,
    });
  } catch (e: unknown) {
    const code = e && typeof e === 'object' && 'code' in e ? (e as { code: string }).code : '';
    if (code === 'P2002') {
      res.status(409).json({ error: '이미 이 그룹에 속한 팀원입니다.' });
      return;
    }
    console.error('POST /team-crew-groups/:groupId/members', e);
    res.status(500).json({ error: '저장 중 오류가 발생했습니다.' });
  }
});

router.delete('/:groupId/members/:teamMemberId', async (req, res) => {
  const tenantId = (req as unknown as TenantScopedRequest).tenantId;
  const { groupId, teamMemberId } = req.params;
  const group = await findGroupForTenant(groupId, tenantId);
  if (!group) {
    res.status(404).json({ error: '그룹을 찾을 수 없습니다.' });
    return;
  }
  const deleted = await prisma.teamCrewGroupMember.deleteMany({
    where: { groupId, teamMemberId },
  });
  if (deleted.count === 0) {
    res.status(404).json({ error: '멤버 관계를 찾을 수 없습니다.' });
    return;
  }
  await prisma.teamCrewGroupDayRoster.deleteMany({
    where: { groupId, teamMemberId },
  });
  res.json({ ok: true });
});

router.patch('/:groupId/members/:teamMemberId', async (req, res) => {
  const tenantId = (req as unknown as TenantScopedRequest).tenantId;
  const { groupId, teamMemberId } = req.params;
  const { isGroupLeader } = req.body as { isGroupLeader?: boolean };
  if (isGroupLeader === undefined) {
    res.status(400).json({ error: 'isGroupLeader가 필요합니다.' });
    return;
  }
  const group = await findGroupForTenant(groupId, tenantId);
  if (!group) {
    res.status(404).json({ error: '그룹을 찾을 수 없습니다.' });
    return;
  }
  const row = await prisma.teamCrewGroupMember.findFirst({
    where: { groupId, teamMemberId },
  });
  if (!row) {
    res.status(404).json({ error: '멤버를 찾을 수 없습니다.' });
    return;
  }

  await prisma.$transaction(async (tx) => {
    if (isGroupLeader) {
      await tx.teamCrewGroupMember.updateMany({
        where: { groupId, isGroupLeader: true },
        data: { isGroupLeader: false },
      });
    }
    await tx.teamCrewGroupMember.update({
      where: { id: row.id },
      data: { isGroupLeader: Boolean(isGroupLeader) },
    });
  });

  const updated = await prisma.teamCrewGroupMember.findUnique({
    where: { id: row.id },
    include: {
      teamMember: { select: { id: true, name: true, nameTh: true, phone: true, isActive: true } },
    },
  });
  if (!updated) {
    res.status(500).json({ error: '갱신 후 조회에 실패했습니다.' });
    return;
  }
  res.json({
    id: updated.id,
    teamMemberId: updated.teamMemberId,
    name: updated.teamMember.name,
    nameTh: updated.teamMember.nameTh,
    phone: updated.teamMember.phone,
    isActive: updated.teamMember.isActive,
    isGroupLeader: updated.isGroupLeader,
  });
});

export default router;
