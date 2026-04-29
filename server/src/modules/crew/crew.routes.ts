import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../../lib/prisma.js';
import { authMiddleware, crewGroupOnly, type AuthPayload } from '../auth/auth.middleware.js';
import { crewGroupLeaderFromDb } from './crewGroupLeader.middleware.js';
import { ROSTER_YMD, getDayRosterInRange, putDayRosterEntries } from '../team-crew-groups/crewGroupDayRoster.service.js';
import { buildCrewFieldSchedule, getCrewMonthlyInquiryStats } from './crewFieldSchedule.service.js';
import { notifyCrewGroupsInboxRefresh } from './crewFieldRealtime.js';

const router = Router();

router.use(authMiddleware, crewGroupOnly);

function crewGroupId(req: { user: AuthPayload }): string {
  return req.user.crewGroupId!;
}

router.get('/day-roster', async (req, res) => {
  const gid = crewGroupId(req as unknown as { user: AuthPayload });
  const { start, end } = req.query as { start?: string; end?: string };
  if (!start || !end || !ROSTER_YMD.test(start) || !ROSTER_YMD.test(end)) {
    res.status(400).json({ error: 'start, end는 YYYY-MM-DD 형식이어야 합니다.' });
    return;
  }
  const group = await prisma.teamCrewGroup.findUnique({ where: { id: gid } });
  if (!group) {
    res.status(404).json({ error: '그룹을 찾을 수 없습니다.' });
    return;
  }
  const items = await getDayRosterInRange(gid, start, end);
  res.json({ crewGroupId: gid, start, end, items });
});

/** 이번 달(KST) 멤버별 접수 건수(취소·보류 제외) — 현장 메모(인원) 이름 일치 기준 */
router.get('/monthly-job-stats', async (req, res) => {
  const gid = crewGroupId(req as unknown as { user: AuthPayload });
  const monthRaw = typeof req.query.month === 'string' ? req.query.month.trim() : '';
  const monthKey =
    monthRaw || new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(monthKey)) {
    res.status(400).json({ error: 'month는 YYYY-MM 형식이어야 합니다.' });
    return;
  }
  try {
    const data = await getCrewMonthlyInquiryStats(gid, monthKey);
    if (!data) {
      res.status(404).json({ error: '그룹을 찾을 수 없습니다.' });
      return;
    }
    res.json(data);
  } catch (e: unknown) {
    console.error('GET /crew/monthly-job-stats', e);
    res.status(500).json({ error: '조회 중 오류가 발생했습니다.' });
  }
});

/** 배정일·짝 팀장·차량번호 — 그룹원 일정 표시용 */
router.get('/field-schedule', async (req, res) => {
  const gid = crewGroupId(req as unknown as { user: AuthPayload });
  const { start, end } = req.query as { start?: string; end?: string };
  if (!start || !end || !ROSTER_YMD.test(start) || !ROSTER_YMD.test(end)) {
    res.status(400).json({ error: 'start, end는 YYYY-MM-DD 형식이어야 합니다.' });
    return;
  }
  try {
    const data = await buildCrewFieldSchedule(gid, start, end);
    res.json({ crewGroupId: gid, start, end, ...data });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === 'CREW_GROUP_NOT_FOUND') {
      res.status(404).json({ error: '그룹을 찾을 수 없습니다.' });
      return;
    }
    console.error('GET /crew/field-schedule', e);
    res.status(500).json({ error: '조회 중 오류가 발생했습니다.' });
  }
});

/** 운영(관리자·마케터) 공지 — 이 크루 그룹에 전달된 내역 */
router.get('/staff-notices', async (req, res) => {
  const gid = crewGroupId(req as unknown as { user: AuthPayload });
  try {
    const items = await prisma.crewStaffNotice.findMany({
      where: { crewGroupId: gid },
      orderBy: { createdAt: 'desc' },
      take: 80,
      select: {
        id: true,
        batchId: true,
        content: true,
        createdAt: true,
        sender: { select: { id: true, name: true } },
      },
    });
    res.json({ items });
  } catch (e) {
    console.error('GET /crew/staff-notices', e);
    res.status(500).json({ error: '공지를 불러오지 못했습니다.' });
  }
});

/**
 * 그룹장(그룹에 그룹장 슬롯이 있는 공유 계정): 소속 멤버의 표시용 보조 이름(nameTh)만 수정.
 * 한글 이름·연락처 등은 관리자만 변경.
 */
router.patch('/members/display-names', crewGroupLeaderFromDb, async (req, res) => {
  const gid = crewGroupId(req as unknown as { user: AuthPayload });
  const body = req.body as { updates?: { teamMemberId?: string; nameTh?: string | null }[] };
  if (!Array.isArray(body.updates) || body.updates.length === 0) {
    res.status(400).json({ error: 'updates 배열이 필요합니다.' });
    return;
  }
  const groupRows = await prisma.teamCrewGroupMember.findMany({
    where: { groupId: gid },
    select: { teamMemberId: true },
  });
  const allowed = new Set(groupRows.map((r) => r.teamMemberId));
  const seen = new Set<string>();
  for (const u of body.updates) {
    if (!u || typeof u.teamMemberId !== 'string' || !u.teamMemberId.trim()) {
      res.status(400).json({ error: '각 항목에 teamMemberId가 필요합니다.' });
      return;
    }
    if (!allowed.has(u.teamMemberId)) {
      res.status(400).json({ error: '이 그룹 멤버만 표시명을 수정할 수 있습니다.' });
      return;
    }
    if (seen.has(u.teamMemberId)) {
      res.status(400).json({ error: '중복된 teamMemberId가 있습니다.' });
      return;
    }
    seen.add(u.teamMemberId);
  }
  try {
    await prisma.$transaction(
      body.updates.map((u) => {
        const raw = u.nameTh != null ? String(u.nameTh).trim() : '';
        return prisma.teamMember.update({
          where: { id: u.teamMemberId! },
          data: { nameTh: raw ? raw.slice(0, 128) : null },
        });
      }),
    );
    notifyCrewGroupsInboxRefresh([gid]);
    res.json({ ok: true });
  } catch (e) {
    console.error('PATCH /crew/members/display-names', e);
    res.status(500).json({ error: '저장 중 오류가 발생했습니다.' });
  }
});

/** 그룹장: 소속 멤버 연락처만 수정 (이름·표시명은 별도 API) */
router.patch('/members/:teamMemberId/phone', crewGroupLeaderFromDb, async (req, res) => {
  const gid = crewGroupId(req as unknown as { user: AuthPayload });
  const { teamMemberId } = req.params;
  if (!teamMemberId || typeof teamMemberId !== 'string') {
    res.status(400).json({ error: 'teamMemberId가 필요합니다.' });
    return;
  }
  const body = req.body as { phone?: string | null };
  if (!('phone' in body)) {
    res.status(400).json({ error: 'phone 필드가 필요합니다. (비우려면 null)' });
    return;
  }
  const inGroup = await prisma.teamCrewGroupMember.findFirst({
    where: { groupId: gid, teamMemberId },
  });
  if (!inGroup) {
    res.status(404).json({ error: '그룹 멤버가 아닙니다.' });
    return;
  }
  const phone =
    body.phone === null || body.phone === undefined
      ? null
      : String(body.phone).trim() === ''
        ? null
        : String(body.phone).trim().slice(0, 64);
  try {
    await prisma.teamMember.update({
      where: { id: teamMemberId },
      data: { phone },
    });
    notifyCrewGroupsInboxRefresh([gid]);
    res.json({ ok: true });
  } catch (e) {
    console.error('PATCH /crew/members/:teamMemberId/phone', e);
    res.status(500).json({ error: '저장 중 오류가 발생했습니다.' });
  }
});

router.put('/day-roster', crewGroupLeaderFromDb, async (req, res) => {
  const gid = crewGroupId(req as unknown as { user: AuthPayload });
  const leaderCount = await prisma.teamCrewGroupMember.count({
    where: { groupId: gid, isGroupLeader: true },
  });
  if (leaderCount === 0) {
    res.status(403).json({ error: '그룹장이 지정되어 있지 않아 명단을 저장할 수 없습니다.' });
    return;
  }
  const body = req.body as {
    entries?: { date: string; teamMemberIds: string[] }[];
    settingsPassword?: string;
  };
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
  const group = await prisma.teamCrewGroup.findUnique({
    where: { id: gid },
    select: { id: true, settingsPasswordHash: true, useDailyRosterOnly: true },
  });
  if (!group) {
    res.status(404).json({ error: '그룹을 찾을 수 없습니다.' });
    return;
  }

  /** 집계·명단 모드일 때만 명단이 스케줄 가용 인원에 반영되므로, 이때만 2차(설정용) 비밀번호를 요구한다. */
  const needsSettingsPassword =
    group.useDailyRosterOnly === true && group.settingsPasswordHash != null;
  if (needsSettingsPassword) {
    const sp = body.settingsPassword != null ? String(body.settingsPassword) : '';
    if (!sp.trim()) {
      res.status(400).json({
        error:
          '「집계·일자 명단」모드이고 설정용 비밀번호가 지정된 그룹은, 명단 저장 시 해당 비밀번호를 함께 보내야 합니다.',
      });
      return;
    }
    const hash = group.settingsPasswordHash;
    const match = hash ? await bcrypt.compare(sp, hash) : false;
    if (!match) {
      res.status(400).json({ error: '그룹 설정용 비밀번호가 일치하지 않습니다.' });
      return;
    }
  }

  try {
    await putDayRosterEntries(gid, entries);
    notifyCrewGroupsInboxRefresh([gid]);
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
    console.error('PUT /crew/day-roster', e);
    res.status(500).json({ error: '저장 중 오류가 발생했습니다.' });
  }
});

export default router;
