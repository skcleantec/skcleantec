import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { authMiddleware, adminOnly } from '../auth/auth.middleware.js';
import { kstMonthRangeYm } from '../inquiries/inquiryListDateRange.js';
import {
  crewMemberNoteIncludesTeamMember,
  distinctPayrollDaysForPoolMember,
  payYmdInMonth,
  payrollAccrualPeriodForPaymentDate,
  payrollCyclePreferredDateWhere,
} from '../teams/teamMemberPayrollCycle.js';
import { dateToYmdKst, employmentOverlapsMonthKst } from '../users/userEmployment.js';

const router = Router();

router.use(authMiddleware, adminOnly);

const MONTH_KEY = /^\d{4}-\d{2}$/;

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
    const period = payrollAccrualPeriodForPaymentDate(payDateYmd);
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

  for (const m of poolMembers) {
    const notes: string[] = [];
    let payDateYmd: string | null = null;
    let accrualStartYmd: string | null = null;
    let accrualEndYmd: string | null = null;
    let jobCount: number | null = null;
    let unitAmount: number | null = m.payAmountPerJob;
    let amount: number | null = null;

    if (m.monthlyPayDay != null && m.monthlyPayDay >= 1 && m.monthlyPayDay <= 31) {
      payDateYmd = payYmdInMonth(calYear, monthIndex, m.monthlyPayDay);
      const period = payrollAccrualPeriodForPaymentDate(payDateYmd);
      if (period) {
        accrualStartYmd = period.startYmd;
        accrualEndYmd = period.endYmd;
        const cached = inquiryCache.get(m.monthlyPayDay);
        if (cached) {
          jobCount = distinctPayrollDaysForPoolMember(cached, m);
        }
      }
    } else {
      notes.push('월급 지급일 미설정');
    }

    if (m.payAmountPerJob == null) {
      notes.push('일당(1일 급여) 미설정');
      unitAmount = null;
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

  for (const u of staffUsers) {
    if (!employmentOverlapsMonthKst(u.hireDate, u.resignationDate, monthStartYmd, monthEndYmd)) {
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
      kind: u.role === 'MARKETER' ? 'MARKETER' : 'TEAM_LEADER',
      id: u.id,
      name: u.name,
      roleLabel: u.role === 'MARKETER' ? '마케터' : '팀장',
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

/** 풀 팀원: 해당 월 급여 산정 구간에 포함된 접수 건별 상세 */
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

  const [yStr, mStr] = monthKey.split('-');
  const calYear = parseInt(yStr, 10);
  const calMonthNum = parseInt(mStr, 10);
  const monthIndex = calMonthNum - 1;

  const m = await prisma.teamMember.findFirst({
    where: { id: teamMemberId, teamId: null, isActive: true },
    select: {
      id: true,
      name: true,
      nameTh: true,
      monthlyPayDay: true,
      payAmountPerJob: true,
    },
  });

  if (!m) {
    res.status(404).json({ error: '풀 팀원을 찾을 수 없습니다.' });
    return;
  }

  const notes: string[] = [];
  let payDateYmd: string | null = null;
  let accrualStartYmd: string | null = null;
  let accrualEndYmd: string | null = null;
  let unitAmount: number | null = m.payAmountPerJob;

  if (m.monthlyPayDay == null || m.monthlyPayDay < 1 || m.monthlyPayDay > 31) {
    notes.push('월급 지급일 미설정');
  } else {
    payDateYmd = payYmdInMonth(calYear, monthIndex, m.monthlyPayDay);
    const period = payrollAccrualPeriodForPaymentDate(payDateYmd);
    if (period) {
      accrualStartYmd = period.startYmd;
      accrualEndYmd = period.endYmd;
    }
  }

  if (m.payAmountPerJob == null) {
    notes.push('일당(1일 급여) 미설정');
    unitAmount = null;
  }

  type LineOut = {
    inquiryId: string;
    inquiryNumber: string | null;
    customerName: string;
    nickname: string | null;
    preferredDateYmd: string | null;
    crewMemberNote: string | null;
  };

  let lines: LineOut[] = [];
  let jobCount: number | null = null;

  if (payDateYmd && accrualStartYmd && accrualEndYmd) {
    const bounds = payrollCyclePreferredDateWhere(accrualStartYmd, accrualEndYmd);
    const inquiries = await prisma.inquiry.findMany({
      where: {
        preferredDate: { gte: bounds.gte, lte: bounds.lte },
        status: { notIn: ['CANCELLED', 'ON_HOLD'] },
      },
      select: {
        id: true,
        inquiryNumber: true,
        customerName: true,
        nickname: true,
        preferredDate: true,
        crewMemberNote: true,
      },
      orderBy: [{ preferredDate: 'asc' }],
    });

    jobCount = distinctPayrollDaysForPoolMember(
      inquiries.map((i) => ({
        crewMemberNote: i.crewMemberNote,
        preferredDate: i.preferredDate,
      })),
      m,
    );

    lines = inquiries
      .filter((inq) => crewMemberNoteIncludesTeamMember(inq.crewMemberNote, m))
      .map((inq) => ({
        inquiryId: inq.id,
        inquiryNumber: inq.inquiryNumber,
        customerName: inq.customerName,
        nickname: inq.nickname,
        preferredDateYmd: inq.preferredDate ? dateToYmdKst(inq.preferredDate) : null,
        crewMemberNote: inq.crewMemberNote,
      }));
  }

  const amount = unitAmount != null && jobCount != null ? jobCount * unitAmount : null;

  res.json({
    month: monthKey,
    monthLabel: `${calYear}년 ${calMonthNum}월`,
    member: { id: m.id, name: m.name },
    payDateYmd,
    accrualStartYmd,
    accrualEndYmd,
    unitAmount,
    jobCount,
    amount,
    notes,
    lines,
  });
});

export default router;
