import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../../lib/prisma.js';
import { authMiddleware, crewGroupOnly, type AuthPayload } from '../auth/auth.middleware.js';
import { crewGroupLeaderFromDb } from './crewGroupLeader.middleware.js';
import { ROSTER_YMD, getDayRosterInRange, putDayRosterEntries } from '../team-crew-groups/crewGroupDayRoster.service.js';
import { buildCrewFieldSchedule } from './crewFieldSchedule.service.js';
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
