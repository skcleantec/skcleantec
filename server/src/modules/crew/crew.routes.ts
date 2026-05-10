import { Router } from 'express';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import { prisma } from '../../lib/prisma.js';
import {
  authMiddleware,
  crewGroupOnly,
  crewLeaderJwtOnly,
  type AuthPayload,
} from '../auth/auth.middleware.js';
import { crewGroupLeaderFromDb } from './crewGroupLeader.middleware.js';
import { ROSTER_YMD, getDayRosterInRange, putDayRosterEntries } from '../team-crew-groups/crewGroupDayRoster.service.js';
import { buildCrewFieldSchedule, getCrewMonthlyInquiryStats } from './crewFieldSchedule.service.js';
import { notifyCrewGroupsInboxRefresh } from './crewFieldRealtime.js';
import {
  createCrewGroupExpense,
  deleteCrewGroupExpense,
  listCrewExpensesForGroup,
} from './crewGroupExpense.service.js';
import { crewSettlementPayrollSheetAccess } from './crewSettlement.middleware.js';
import { buildPoolMemberPayrollSheetRows } from '../admin-payroll/payrollSheetPoolShared.js';
import { computePoolMemberPayrollDetail } from '../admin-payroll/poolMemberPayrollCompute.js';
import { kstMonthRangeYm } from '../inquiries/inquiryListDateRange.js';
import { isCloudinaryConfigured } from '../../lib/cloudinary.js';
import { notifyInboxRefresh } from '../realtime/inboxNotify.js';
import { getEmployedStaffUserIds } from '../realtime/navBadgeNotify.js';

const router = Router();

const expenseUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 },
});
const expenseUploadFields = expenseUpload.fields([{ name: 'images', maxCount: 15 }]);

const SETTLEMENT_MONTH_KEY = /^\d{4}-\d{2}$/;

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

/**
 * 조장 비번·미리보기 JWT 검증만 수행 — 정산 메뉴 진입 확인용(무거운 조회 없음).
 */
router.get('/settlement/access-ping', crewSettlementPayrollSheetAccess, (_req, res) => {
  res.json({ ok: true });
});

/**
 * 그룹 소속 풀 팀원만 — 관리자 정산표(풀)와 동일 산출의 읽기 전용 행.
 * 조장 비번 헤더(X-Crew-Sensitive-Password) 또는 미리보기 JWT.
 */
router.get('/settlement/payroll-sheet', crewSettlementPayrollSheetAccess, async (req, res) => {
  const gid = crewGroupId(req as unknown as { user: AuthPayload });
  const monthRaw = typeof req.query.month === 'string' ? req.query.month.trim() : '';
  const monthKey =
    monthRaw || new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(monthKey)) {
    res.status(400).json({ error: 'month는 YYYY-MM 형식이어야 합니다.' });
    return;
  }
  try {
    const links = await prisma.teamCrewGroupMember.findMany({
      where: { groupId: gid },
      select: { teamMemberId: true },
    });
    const allowed = [...new Set(links.map((l) => l.teamMemberId))];
    if (allowed.length === 0) {
      res.json({ crewGroupId: gid, month: monthKey, rows: [] });
      return;
    }

    const poolMembers = await prisma.teamMember.findMany({
      where: { teamId: null, isActive: true, id: { in: allowed } },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        name: true,
        nameTh: true,
        monthlyPayDay: true,
        payAmountPerJob: true,
        sortOrder: true,
        createdAt: true,
      },
    });

    const rows = await buildPoolMemberPayrollSheetRows(prisma, monthKey, poolMembers);
    res.json({ crewGroupId: gid, month: monthKey, rows });
  } catch (e) {
    console.error('GET /crew/settlement/payroll-sheet', e);
    res.status(500).json({ error: '조회 중 오류가 발생했습니다.' });
  }
});

/** 그룹 소속 팀원 한 명 — 관리자 풀 상세와 동일 산출(읽기 전용). 정산표와 동일 게이트. */
router.get('/settlement/pool-member/:teamMemberId/detail', crewSettlementPayrollSheetAccess, async (req, res) => {
  const gid = crewGroupId(req as unknown as { user: AuthPayload });
  const teamMemberId =
    typeof req.params.teamMemberId === 'string' ? req.params.teamMemberId.trim() : '';
  if (!teamMemberId) {
    res.status(400).json({ error: 'teamMemberId가 필요합니다.' });
    return;
  }

  const raw = typeof req.query.month === 'string' ? req.query.month.trim() : '';
  const monthKey =
    raw && SETTLEMENT_MONTH_KEY.test(raw)
      ? raw
      : new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 7);

  if (!kstMonthRangeYm(monthKey)) {
    res.status(400).json({ error: 'month는 YYYY-MM 형식이어야 합니다.' });
    return;
  }

  const inGroup = await prisma.teamCrewGroupMember.findFirst({
    where: { groupId: gid, teamMemberId },
    select: { teamMemberId: true },
  });
  if (!inGroup) {
    res.status(403).json({ error: '이 크루 그룹 소속 팀원만 조회할 수 있습니다.' });
    return;
  }

  let computation: Awaited<ReturnType<typeof computePoolMemberPayrollDetail>>;
  try {
    const result = await computePoolMemberPayrollDetail(prisma, teamMemberId, monthKey);
    if (!result) {
      res.status(404).json({ error: '팀원을 찾을 수 없습니다.' });
      return;
    }
    computation = result;
  } catch (e) {
    if (e instanceof Error && e.message === 'INVALID_MONTH_KEY') {
      res.status(400).json({ error: 'month는 YYYY-MM 형식이어야 합니다.' });
      return;
    }
    console.error('GET /crew/settlement/pool-member/detail', e);
    res.status(500).json({ error: '조회 중 오류가 발생했습니다.' });
    return;
  }

  const [currentSettlement, historyRows] = await Promise.all([
    prisma.teamMemberPayrollSettlement.findUnique({
      where: { teamMemberId_monthKey: { teamMemberId, monthKey } },
      select: { amount: true, settledAt: true },
    }),
    prisma.teamMemberPayrollSettlement.findMany({
      where: { teamMemberId },
      orderBy: { settledAt: 'desc' },
      select: { monthKey: true, amount: true, settledAt: true },
    }),
  ]);

  const totalPaid = historyRows.reduce((s, r) => s + r.amount, 0);

  res.json({
    month: computation.monthKey,
    member: {
      id: computation.member.id,
      name: computation.member.name,
      nameTh: computation.member.nameTh,
    },
    payDateYmd: computation.payDateYmd,
    accrualStartYmd: computation.accrualStartYmd,
    accrualEndYmd: computation.accrualEndYmd,
    unitAmount: computation.unitAmount,
    poolSystemDays: computation.poolSystemDays,
    poolManualExtraDays: computation.poolManualExtraDays,
    jobCount: computation.jobCount,
    amount: computation.amount,
    crewExpenseTotal: computation.crewExpenseTotal,
    poolLedgerManualDeductionTotal: computation.poolLedgerManualDeductionTotal,
    amountNet: computation.amountNet,
    crewExpenseLines: computation.crewExpenseLines,
    notes: computation.notes,
    lines: computation.lines,
    settlement: currentSettlement
      ? {
          amount: currentSettlement.amount,
          settledAt: currentSettlement.settledAt.toISOString(),
        }
      : null,
    paymentHistory: {
      totalPaid,
      items: historyRows.map((r) => ({
        monthKey: r.monthKey,
        amount: r.amount,
        settledAt: r.settledAt.toISOString(),
      })),
    },
  });
});

/** 귀속 월별 크루 지출 목록 — 그룹 로그인 전원 조회 가능 */
router.get('/expenses', async (req, res) => {
  const gid = crewGroupId(req as unknown as { user: AuthPayload });
  const monthRaw = typeof req.query.month === 'string' ? req.query.month.trim() : '';
  const monthKey =
    monthRaw || new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(monthKey)) {
    res.status(400).json({ error: 'month는 YYYY-MM 형식이어야 합니다.' });
    return;
  }
  try {
    const rows = await listCrewExpensesForGroup(gid, monthKey);
    res.json({
      crewGroupId: gid,
      month: monthKey,
      items: rows.map((row) => ({
        id: row.id,
        monthKey: row.monthKey,
        amount: row.amount,
        memo: row.memo,
        createdAt: row.createdAt.toISOString(),
        teamMember: row.teamMember,
        attachments: row.attachments.map((a) => ({
          id: a.id,
          secureUrl: a.secureUrl,
          width: a.width,
          height: a.height,
        })),
      })),
    });
  } catch (e) {
    console.error('GET /crew/expenses', e);
    res.status(500).json({ error: '조회 중 오류가 발생했습니다.' });
  }
});

/**
 * 그룹장 전용 — 팀원별 지출 등록(영수증 복수 첨부).
 * CLOUDINARY 미설정 시 이미지 없는 등록만 가능합니다.
 */
router.post('/expenses', crewGroupLeaderFromDb, crewLeaderJwtOnly, expenseUploadFields, async (req, res) => {
  const gid = crewGroupId(req as unknown as { user: AuthPayload });
  const body = req.body as { monthKey?: string; teamMemberId?: string; amount?: string; memo?: string };
  const monthKey =
    typeof body.monthKey === 'string' && body.monthKey.trim()
      ? body.monthKey.trim()
      : new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(monthKey)) {
    res.status(400).json({ error: 'monthKey는 YYYY-MM 형식이어야 합니다.' });
    return;
  }
  const teamMemberId = typeof body.teamMemberId === 'string' ? body.teamMemberId.trim() : '';
  if (!teamMemberId) {
    res.status(400).json({ error: 'teamMemberId가 필요합니다.' });
    return;
  }
  const amountParsed = parseInt(String(body.amount ?? '').replace(/,/g, ''), 10);
  if (!Number.isFinite(amountParsed) || amountParsed < 1) {
    res.status(400).json({ error: '금액은 1원 이상 정수로 입력해 주세요.' });
    return;
  }
  const memoRaw = body.memo != null ? String(body.memo).trim() : '';
  const memo = memoRaw ? memoRaw.slice(0, 4000) : null;

  const rawFiles = req.files as Record<string, Express.Multer.File[]> | undefined;
  const files = [...(rawFiles?.images ?? [])];
  if (files.length > 0 && !isCloudinaryConfigured()) {
    res.status(503).json({
      error: '영수증 업로드를 위해 서버에 CLOUDINARY 설정이 필요합니다.',
    });
    return;
  }

  try {
    const { expense, attachments } = await createCrewGroupExpense({
      crewGroupId: gid,
      teamMemberId,
      monthKey,
      amount: amountParsed,
      memo,
      imageBuffers: files.map((f) => ({ buffer: f.buffer, mimetype: f.mimetype })),
    });
    void getEmployedStaffUserIds()
      .then((ids) => notifyInboxRefresh(ids))
      .catch((e) => console.error('[crew-expense POST] notify', e));
    notifyCrewGroupsInboxRefresh([gid]);
    res.status(201).json({
      item: {
        id: expense.id,
        monthKey: expense.monthKey,
        amount: expense.amount,
        memo: expense.memo,
        createdAt: expense.createdAt.toISOString(),
        attachmentCount: attachments.length,
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === 'NOT_GROUP_MEMBER') {
      res.status(400).json({ error: '이 크루 그룹 소속 팀원만 선택할 수 있습니다.' });
      return;
    }
    if (msg === 'CLOUDINARY_NOT_CONFIGURED') {
      res.status(503).json({ error: '영수증 업로드가 준비되지 않았습니다.' });
      return;
    }
    console.error('POST /crew/expenses', e);
    res.status(500).json({ error: '저장 중 오류가 발생했습니다.' });
  }
});

router.delete('/expenses/:expenseId', crewGroupLeaderFromDb, crewLeaderJwtOnly, async (req, res) => {
  const gid = crewGroupId(req as unknown as { user: AuthPayload });
  const expenseId = typeof req.params.expenseId === 'string' ? req.params.expenseId.trim() : '';
  if (!expenseId) {
    res.status(400).json({ error: 'expenseId가 필요합니다.' });
    return;
  }
  try {
    const ok = await deleteCrewGroupExpense(gid, expenseId);
    if (!ok) {
      res.status(404).json({ error: '지출 내역을 찾을 수 없습니다.' });
      return;
    }
    void getEmployedStaffUserIds()
      .then((ids) => notifyInboxRefresh(ids))
      .catch((e) => console.error('[crew-expense DELETE] notify', e));
    notifyCrewGroupsInboxRefresh([gid]);
    res.json({ ok: true });
  } catch (e) {
    console.error('DELETE /crew/expenses/:expenseId', e);
    res.status(500).json({ error: '삭제 중 오류가 발생했습니다.' });
  }
});

export default router;
