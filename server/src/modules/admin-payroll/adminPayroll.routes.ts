import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { authMiddleware, adminOnly, type AuthPayload } from '../auth/auth.middleware.js';
import { kstMonthRangeYm } from '../inquiries/inquiryListDateRange.js';
import {
  crewMemberNoteIncludesTeamMember,
  distinctPayrollDaysForPoolMember,
  payYmdInMonth,
  payrollAccrualPeriodForPaymentDate,
  payrollCyclePreferredDateWhere,
} from '../teams/teamMemberPayrollCycle.js';
import { dateToYmdKst, employmentOverlapsMonthKst } from '../users/userEmployment.js';

import { computePoolMemberPayrollDetail } from './poolMemberPayrollCompute.js';

const router = Router();

router.use(authMiddleware, adminOnly);

const MONTH_KEY = /^\d{4}-\d{2}$/;

function todayYmdKst(): string {
  return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10);
}

/** @db.Date 로 저장된 값을 표시용 YYYY-MM-DD로 */
function dateOnlyToYmd(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseYmdDateOnly(ymd: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) return null;
  const y = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10) - 1;
  const d = parseInt(m[3], 10);
  const dt = new Date(Date.UTC(y, mo, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo || dt.getUTCDate() !== d) return null;
  return dt;
}

function payrollMonthLabelFromKey(monthKey: string): string {
  const [ys, ms] = monthKey.split('-');
  const y = parseInt(ys, 10);
  const m = parseInt(ms, 10);
  if (!Number.isFinite(y) || !Number.isFinite(m)) return monthKey;
  return `${y}년 ${m}월`;
}

async function loadTeamLeaderPayrollSubject(
  prismaClient: typeof prisma,
  userId: string,
  monthKey: string,
): Promise<{
  id: string;
  name: string;
  payrollMonthlySalary: number | null;
} | null> {
  const range = kstMonthRangeYm(monthKey);
  if (!range) return null;
  const monthStartYmd = dateToYmdKst(range.gte);
  const monthEndYmd = dateToYmdKst(range.lte);
  const u = await prismaClient.user.findFirst({
    where: { id: userId, role: 'TEAM_LEADER', isActive: true },
    select: {
      id: true,
      name: true,
      payrollMonthlySalary: true,
      hireDate: true,
      resignationDate: true,
    },
  });
  if (!u) return null;
  if (!employmentOverlapsMonthKst(u.hireDate, u.resignationDate, monthStartYmd, monthEndYmd)) {
    return null;
  }
  return { id: u.id, name: u.name, payrollMonthlySalary: u.payrollMonthlySalary };
}

type PayrollSheetRowKind = 'POOL_MEMBER' | 'TEAM_LEADER' | 'MARKETER';

router.get('/sheet', async (req, res) => {
  const raw = typeof req.query.month === 'string' ? req.query.month.trim() : '';
  const monthKey =
    raw && MONTH_KEY.test(raw)
      ? raw
      : new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 7);

  const range = kstMonthRangeYm(monthKey);
  if (!range) {
    res.status(400).json({ error: 'month는 YYYY-MM 형식이어야 합니다.' });
    return;
  }

  const monthStartYmd = dateToYmdKst(range.gte);
  const monthEndYmd = dateToYmdKst(range.lte);
  const [yStr, mStr] = monthKey.split('-');
  const calYear = parseInt(yStr, 10);
  const calMonthNum = parseInt(mStr, 10);
  const monthIndex = calMonthNum - 1;

  type SheetRow = {
    kind: PayrollSheetRowKind;
    id: string;
    name: string;
    roleLabel: string;
    payDateYmd: string | null;
    accrualStartYmd: string | null;
    accrualEndYmd: string | null;
    jobCount: number | null;
    unitAmount: number | null;
    amount: number | null;
    notes: string[];
    poolSystemDays?: number | null;
    poolManualExtraDays?: number | null;
    poolSettlementComplete?: boolean;
    leaderPaymentCount?: number;
  };

  const rows: SheetRow[] = [];

  const poolMembers = await prisma.teamMember.findMany({
    where: { teamId: null, isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });

  const byPayDay = new Map<number, (typeof poolMembers)[number][]>();
  for (const m of poolMembers) {
    const d = m.monthlyPayDay;
    if (d == null || d < 1 || d > 31) continue;
    if (!byPayDay.has(d)) byPayDay.set(d, []);
    byPayDay.get(d)!.push(m);
  }

  const inquiryCache = new Map<
    number,
    { crewMemberNote: string | null; preferredDate: Date | null }[]
  >();
  for (const payDay of byPayDay.keys()) {
    const payDateYmd = payYmdInMonth(calYear, monthIndex, payDay);
    const period = payrollAccrualPeriodForPaymentDate(payDateYmd, payDay);
    if (!period) continue;
    const bounds = payrollCyclePreferredDateWhere(period.startYmd, period.endYmd);
    const inquiries = await prisma.inquiry.findMany({
      where: {
        preferredDate: { gte: bounds.gte, lte: bounds.lte },
        status: { notIn: ['CANCELLED', 'ON_HOLD'] },
      },
      select: { crewMemberNote: true, preferredDate: true },
    });
    inquiryCache.set(payDay, inquiries);
  }

  const poolAdjusts = await prisma.teamMemberPayrollMonthAdjust.findMany({
    where: {
      monthKey,
      teamMemberId: { in: poolMembers.map((pm) => pm.id) },
    },
  });
  const extraDaysByMemberId = new Map(poolAdjusts.map((a) => [a.teamMemberId, a.extraWorkDays]));

  const poolSettlementRows = await prisma.teamMemberPayrollSettlement.findMany({
    where: {
      monthKey,
      teamMemberId: { in: poolMembers.map((pm) => pm.id) },
    },
    select: { teamMemberId: true },
  });
  const settledMemberIds = new Set(poolSettlementRows.map((r) => r.teamMemberId));

  for (const m of poolMembers) {
    const notes: string[] = [];
    let payDateYmd: string | null = null;
    let accrualStartYmd: string | null = null;
    let accrualEndYmd: string | null = null;
    let autoDays: number | null = null;
    let unitAmount: number | null = m.payAmountPerJob;
    let amount: number | null = null;

    const manualExtraRaw = extraDaysByMemberId.get(m.id) ?? 0;
    const manualExtra =
      typeof manualExtraRaw === 'number' &&
      Number.isFinite(manualExtraRaw) &&
      manualExtraRaw > 0
        ? Math.min(93, Math.floor(manualExtraRaw))
        : 0;

    if (m.monthlyPayDay != null && m.monthlyPayDay >= 1 && m.monthlyPayDay <= 31) {
      payDateYmd = payYmdInMonth(calYear, monthIndex, m.monthlyPayDay);
      const period = payrollAccrualPeriodForPaymentDate(payDateYmd, m.monthlyPayDay);
      if (period) {
        accrualStartYmd = period.startYmd;
        accrualEndYmd = period.endYmd;
        const cached = inquiryCache.get(m.monthlyPayDay);
        if (cached) {
          autoDays = distinctPayrollDaysForPoolMember(cached, m);
        }
      }
    } else {
      notes.push('월급 지급일 미설정');
    }

    if (m.payAmountPerJob == null) {
      notes.push('일당(1일 급여) 미설정');
      unitAmount = null;
    }

    let jobCount: number | null = null;
    if (autoDays !== null) {
      jobCount = autoDays + manualExtra;
    } else if (manualExtra > 0) {
      jobCount = manualExtra;
      notes.push('자동 근무일 산정 없음·수기 일만 반영');
    }
    if (manualExtra > 0) {
      notes.push(`수기 추가 근무 ${manualExtra}일`);
    }

    if (jobCount != null && unitAmount != null) {
      amount = jobCount * unitAmount;
    }

    rows.push({
      kind: 'POOL_MEMBER',
      id: m.id,
      name: m.name,
      roleLabel: '현장',
      payDateYmd,
      accrualStartYmd,
      accrualEndYmd,
      jobCount,
      unitAmount,
      amount,
      notes,
      poolSystemDays: autoDays,
      poolManualExtraDays: manualExtra,
      poolSettlementComplete: settledMemberIds.has(m.id),
    });
  }

  const staffUsers = await prisma.user.findMany({
    where: {
      role: { in: ['TEAM_LEADER', 'MARKETER'] },
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      role: true,
      hireDate: true,
      resignationDate: true,
      payrollMonthlySalary: true,
      payrollPayDay: true,
    },
    orderBy: [{ role: 'asc' }, { name: 'asc' }],
  });

  const leaderIds = staffUsers.filter((u) => u.role === 'TEAM_LEADER').map((u) => u.id);
  const leaderPaymentsMonth =
    leaderIds.length === 0
      ? []
      : await prisma.teamLeaderPayrollPayment.findMany({
          where: { userId: { in: leaderIds }, monthKey },
          select: { userId: true, amount: true },
        });
  const leaderAgg = new Map<string, { sum: number; count: number }>();
  for (const p of leaderPaymentsMonth) {
    const cur = leaderAgg.get(p.userId) ?? { sum: 0, count: 0 };
    cur.sum += p.amount;
    cur.count += 1;
    leaderAgg.set(p.userId, cur);
  }

  for (const u of staffUsers) {
    if (!employmentOverlapsMonthKst(u.hireDate, u.resignationDate, monthStartYmd, monthEndYmd)) {
      continue;
    }

    if (u.role === 'TEAM_LEADER') {
      const notes: string[] = [];
      if (u.payrollMonthlySalary != null) {
        notes.push(`참고·등록 월급액 ${u.payrollMonthlySalary.toLocaleString('ko-KR')}원`);
      }
      const agg = leaderAgg.get(u.id);
      const paymentCount = agg?.count ?? 0;
      const paidSum = agg?.sum ?? 0;

      rows.push({
        kind: 'TEAM_LEADER',
        id: u.id,
        name: u.name,
        roleLabel: '팀장',
        payDateYmd: null,
        accrualStartYmd: null,
        accrualEndYmd: null,
        jobCount: null,
        unitAmount: null,
        amount: paymentCount > 0 ? paidSum : null,
        notes,
        leaderPaymentCount: paymentCount,
      });
      continue;
    }

    const notes: string[] = [];
    const payDayStaff =
      u.payrollPayDay != null && u.payrollPayDay >= 1 && u.payrollPayDay <= 31 ? u.payrollPayDay : 31;
    const payDateYmd = payYmdInMonth(calYear, monthIndex, payDayStaff);
    if (u.payrollPayDay == null) {
      notes.push('지급일: 해당 월 말일');
    }
    const salary = u.payrollMonthlySalary;
    if (salary == null) notes.push('월 급여 미설정');

    rows.push({
      kind: 'MARKETER',
      id: u.id,
      name: u.name,
      roleLabel: '마케터',
      payDateYmd,
      accrualStartYmd: null,
      accrualEndYmd: null,
      jobCount: null,
      unitAmount: null,
      amount: salary != null ? salary : null,
      notes,
    });
  }

  rows.sort((a, b) => {
    const da = a.payDateYmd ?? '9999-12-31';
    const db = b.payDateYmd ?? '9999-12-31';
    if (da !== db) return da.localeCompare(db);
    const orderKind = (k: PayrollSheetRowKind) =>
      k === 'TEAM_LEADER' ? 0 : k === 'MARKETER' ? 1 : 2;
    const ka = orderKind(a.kind);
    const kb = orderKind(b.kind);
    if (ka !== kb) return ka - kb;
    return a.name.localeCompare(b.name, 'ko');
  });

  let amountSum = 0;
  let rowsWithAmount = 0;
  for (const r of rows) {
    if (r.amount != null) {
      amountSum += r.amount;
      rowsWithAmount++;
    }
  }

  res.json({
    month: monthKey,
    monthLabel: `${calYear}년 ${calMonthNum}월`,
    rows,
    totals: {
      rowsTotal: rows.length,
      rowsWithAmount,
      amountSum,
    },
  });
});

/** 풀 팀원: 해당 월 급여 산정 구간에 포함된 접수 건별 상세 + 정산·지급 이력 */
router.get('/pool-member/:teamMemberId/detail', async (req, res) => {
  const teamMemberId =
    typeof req.params.teamMemberId === 'string' ? req.params.teamMemberId.trim() : '';
  if (!teamMemberId) {
    res.status(400).json({ error: 'teamMemberId가 필요합니다.' });
    return;
  }

  const raw = typeof req.query.month === 'string' ? req.query.month.trim() : '';
  const monthKey =
    raw && MONTH_KEY.test(raw)
      ? raw
      : new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 7);

  if (!kstMonthRangeYm(monthKey)) {
    res.status(400).json({ error: 'month는 YYYY-MM 형식이어야 합니다.' });
    return;
  }

  let computation: Awaited<ReturnType<typeof computePoolMemberPayrollDetail>>;
  try {
    const result = await computePoolMemberPayrollDetail(prisma, teamMemberId, monthKey);
    if (!result) {
      res.status(404).json({ error: '풀 팀원을 찾을 수 없습니다.' });
      return;
    }
    computation = result;
  } catch (e) {
    if (e instanceof Error && e.message === 'INVALID_MONTH_KEY') {
      res.status(400).json({ error: 'month는 YYYY-MM 형식이어야 합니다.' });
      return;
    }
    throw e;
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
    monthLabel: computation.monthLabel,
    member: { id: computation.member.id, name: computation.member.name },
    payDateYmd: computation.payDateYmd,
    accrualStartYmd: computation.accrualStartYmd,
    accrualEndYmd: computation.accrualEndYmd,
    unitAmount: computation.unitAmount,
    poolSystemDays: computation.poolSystemDays,
    poolManualExtraDays: computation.poolManualExtraDays,
    jobCount: computation.jobCount,
    amount: computation.amount,
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
        monthLabel: payrollMonthLabelFromKey(r.monthKey),
        amount: r.amount,
        settledAt: r.settledAt.toISOString(),
      })),
    },
  });
});

router.post('/pool-member/:teamMemberId/settle', async (req: Request, res: Response) => {
  const authUser = (req as Request & { user?: AuthPayload }).user;
  if (!authUser?.userId) {
    res.status(401).json({ error: '인증이 필요합니다.' });
    return;
  }

  const teamMemberId =
    typeof req.params.teamMemberId === 'string' ? req.params.teamMemberId.trim() : '';
  if (!teamMemberId) {
    res.status(400).json({ error: 'teamMemberId가 필요합니다.' });
    return;
  }

  const raw = typeof req.query.month === 'string' ? req.query.month.trim() : '';
  const monthKey =
    raw && MONTH_KEY.test(raw)
      ? raw
      : new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 7);

  if (!kstMonthRangeYm(monthKey)) {
    res.status(400).json({ error: 'month는 YYYY-MM 형식이어야 합니다.' });
    return;
  }

  let computation: NonNullable<Awaited<ReturnType<typeof computePoolMemberPayrollDetail>>>;
  try {
    const result = await computePoolMemberPayrollDetail(prisma, teamMemberId, monthKey);
    if (!result) {
      res.status(404).json({ error: '풀 팀원을 찾을 수 없습니다.' });
      return;
    }
    computation = result;
  } catch (e) {
    if (e instanceof Error && e.message === 'INVALID_MONTH_KEY') {
      res.status(400).json({ error: 'month는 YYYY-MM 형식이어야 합니다.' });
      return;
    }
    throw e;
  }

  if (computation.amount == null) {
    res.status(400).json({
      error: '예상 급여가 산출되지 않아 정산할 수 없습니다. 월급일·일당·근무일을 확인해 주세요.',
    });
    return;
  }

  try {
    await prisma.teamMemberPayrollSettlement.create({
      data: {
        teamMemberId,
        monthKey,
        amount: computation.amount,
        actorId: authUser.userId,
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      res.status(409).json({ error: '이미 해당 귀속 월 정산이 완료되었습니다.' });
      return;
    }
    throw e;
  }

  res.status(201).json({
    ok: true,
    teamMemberId,
    monthKey,
    amount: computation.amount,
    settledAt: new Date().toISOString(),
  });
});

router.get('/team-leader/:userId/payments', async (req, res) => {
  const userId = typeof req.params.userId === 'string' ? req.params.userId.trim() : '';
  const raw = typeof req.query.month === 'string' ? req.query.month.trim() : '';
  const monthKey =
    raw && MONTH_KEY.test(raw)
      ? raw
      : new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 7);

  if (!kstMonthRangeYm(monthKey)) {
    res.status(400).json({ error: 'month는 YYYY-MM 형식이어야 합니다.' });
    return;
  }

  const subject = await loadTeamLeaderPayrollSubject(prisma, userId, monthKey);
  if (!subject) {
    res.status(404).json({ error: '팀장 급여 대상을 찾을 수 없습니다.' });
    return;
  }

  const [monthRows, priorRows] = await Promise.all([
    prisma.teamLeaderPayrollPayment.findMany({
      where: { userId, monthKey },
      orderBy: [{ paidOn: 'desc' }, { createdAt: 'desc' }],
    }),
    prisma.teamLeaderPayrollPayment.findMany({
      where: { userId, monthKey: { not: monthKey } },
      orderBy: [{ paidOn: 'desc' }, { createdAt: 'desc' }],
      take: 80,
    }),
  ]);

  const mapRow = (row: (typeof monthRows)[number]) => ({
    id: row.id,
    paidOnYmd: dateOnlyToYmd(row.paidOn),
    amount: row.amount,
    memo: row.memo,
    createdAt: row.createdAt.toISOString(),
    monthKey: row.monthKey,
    monthLabel: payrollMonthLabelFromKey(row.monthKey),
  });

  const monthPaidTotal = monthRows.reduce((s, r) => s + r.amount, 0);

  res.json({
    month: monthKey,
    monthLabel: payrollMonthLabelFromKey(monthKey),
    user: { id: subject.id, name: subject.name },
    contractSalary: subject.payrollMonthlySalary,
    monthPaidTotal,
    monthPayments: monthRows.map(mapRow),
    priorPayments: priorRows.map(mapRow),
  });
});

router.post('/team-leader/:userId/payments', async (req: Request, res: Response) => {
  const authUser = (req as Request & { user?: AuthPayload }).user;
  if (!authUser?.userId) {
    res.status(401).json({ error: '인증이 필요합니다.' });
    return;
  }

  const userId = typeof req.params.userId === 'string' ? req.params.userId.trim() : '';
  const raw = typeof req.query.month === 'string' ? req.query.month.trim() : '';
  const monthKey =
    raw && MONTH_KEY.test(raw)
      ? raw
      : new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 7);

  if (!kstMonthRangeYm(monthKey)) {
    res.status(400).json({ error: 'month는 YYYY-MM 형식이어야 합니다.' });
    return;
  }

  const subject = await loadTeamLeaderPayrollSubject(prisma, userId, monthKey);
  if (!subject) {
    res.status(404).json({ error: '팀장 급여 대상을 찾을 수 없습니다.' });
    return;
  }

  const body = req.body as { amount?: unknown; paidOn?: unknown; memo?: unknown };
  let amount = 0;
  if (typeof body.amount === 'number' && Number.isInteger(body.amount)) {
    amount = body.amount;
  } else if (typeof body.amount === 'string' && /^\d+$/.test(body.amount.trim())) {
    amount = parseInt(body.amount.trim(), 10);
  }
  if (amount <= 0 || amount > 500_000_000) {
    res.status(400).json({ error: '금액은 1원 이상 5억 원 이하 정수로 입력해 주세요.' });
    return;
  }

  const paidOnRaw =
    typeof body.paidOn === 'string' && body.paidOn.trim() ? body.paidOn.trim() : todayYmdKst();
  const paidOnDate = parseYmdDateOnly(paidOnRaw);
  if (!paidOnDate) {
    res.status(400).json({ error: '입금일은 YYYY-MM-DD 형식이어야 합니다.' });
    return;
  }

  let memo: string | null = null;
  if (typeof body.memo === 'string') {
    const t = body.memo.trim();
    memo = t.length > 2000 ? t.slice(0, 2000) : t.length ? t : null;
  }

  const row = await prisma.teamLeaderPayrollPayment.create({
    data: {
      userId,
      monthKey,
      amount,
      paidOn: paidOnDate,
      memo,
      actorId: authUser.userId,
    },
  });

  res.status(201).json({
    ok: true,
    payment: {
      id: row.id,
      paidOnYmd: dateOnlyToYmd(row.paidOn),
      amount: row.amount,
      memo: row.memo,
      createdAt: row.createdAt.toISOString(),
      monthKey: row.monthKey,
      monthLabel: payrollMonthLabelFromKey(row.monthKey),
    },
  });
});

router.delete('/team-leader/payment/:paymentId', async (req: Request, res: Response) => {
  const authUser = (req as Request & { user?: AuthPayload }).user;
  if (!authUser?.userId) {
    res.status(401).json({ error: '인증이 필요합니다.' });
    return;
  }

  const paymentId =
    typeof req.params.paymentId === 'string' ? req.params.paymentId.trim() : '';
  if (!paymentId) {
    res.status(400).json({ error: 'paymentId가 필요합니다.' });
    return;
  }

  const body = req.body as { password?: unknown };
  const password = body.password != null ? String(body.password).trim() : '';
  if (!password) {
    res.status(400).json({ error: '비밀번호를 입력해주세요.' });
    return;
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: authUser.userId },
    select: { id: true, passwordHash: true },
  });
  if (!dbUser) {
    res.status(401).json({ error: '사용자를 찾을 수 없습니다.' });
    return;
  }
  const valid = await bcrypt.compare(password, dbUser.passwordHash);
  if (!valid) {
    res.status(401).json({ error: '비밀번호가 일치하지 않습니다.' });
    return;
  }

  const existing = await prisma.teamLeaderPayrollPayment.findUnique({
    where: { id: paymentId },
    select: {
      id: true,
      user: { select: { role: true } },
    },
  });

  if (!existing || existing.user.role !== 'TEAM_LEADER') {
    res.status(404).json({ error: '지급 내역을 찾을 수 없습니다.' });
    return;
  }

  await prisma.teamLeaderPayrollPayment.delete({ where: { id: paymentId } });
  res.json({ ok: true });
});

router.patch('/pool-member/:teamMemberId/month-adjust', async (req, res) => {
  const teamMemberId =
    typeof req.params.teamMemberId === 'string' ? req.params.teamMemberId.trim() : '';
  if (!teamMemberId) {
    res.status(400).json({ error: 'teamMemberId가 필요합니다.' });
    return;
  }

  const raw = typeof req.query.month === 'string' ? req.query.month.trim() : '';
  const monthKey =
    raw && MONTH_KEY.test(raw)
      ? raw
      : new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 7);

  if (!kstMonthRangeYm(monthKey)) {
    res.status(400).json({ error: 'month는 YYYY-MM 형식이어야 합니다.' });
    return;
  }

  const body = req.body as { extraWorkDays?: unknown };
  const v = body.extraWorkDays;
  let n = 0;
  if (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 93) {
    n = v;
  } else if (typeof v === 'string' && /^\d+$/.test(v.trim())) {
    const parsed = parseInt(v.trim(), 10);
    if (parsed >= 0 && parsed <= 93) n = parsed;
    else {
      res.status(400).json({ error: '추가 근무일은 0~93 정수입니다.' });
      return;
    }
  } else if (v != null && v !== '') {
    res.status(400).json({ error: '추가 근무일은 0~93 정수입니다.' });
    return;
  }

  const exists = await prisma.teamMember.findFirst({
    where: { id: teamMemberId, teamId: null, isActive: true },
    select: { id: true },
  });
  if (!exists) {
    res.status(404).json({ error: '풀 팀원을 찾을 수 없습니다.' });
    return;
  }

  if (n === 0) {
    await prisma.teamMemberPayrollMonthAdjust.deleteMany({
      where: { teamMemberId, monthKey },
    });
    res.json({ ok: true, teamMemberId, monthKey, extraWorkDays: 0 });
    return;
  }

  await prisma.teamMemberPayrollMonthAdjust.upsert({
    where: {
      teamMemberId_monthKey: { teamMemberId, monthKey },
    },
    create: { teamMemberId, monthKey, extraWorkDays: n },
    update: { extraWorkDays: n },
  });
  res.json({ ok: true, teamMemberId, monthKey, extraWorkDays: n });
});

export default router;
