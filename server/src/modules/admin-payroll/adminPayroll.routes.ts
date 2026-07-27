import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { InquiryStatus, PayrollAccountLedgerManualDirection, PayrollLedgerManualPayrollLinkKind, Prisma, TeamLeaderPayrollPaymentBucket, TeamLeaderGeneralSettlementMode } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { authMiddleware, adminOnly, type AuthPayload } from '../auth/auth.middleware.js';
import { requireStaffPermission } from '../auth/marketerPermission.middleware.js';
import { getTenantIdFromAuth, type TenantScopedRequest } from '../tenants/tenant.middleware.js';
import { kstMonthRangeYm } from '../inquiries/inquiryListDateRange.js';
import {
  payYmdInMonth,
  payrollAccrualPeriodForPaymentDate,
} from '../teams/teamMemberPayrollCycle.js';
import { dateToYmdKst, employmentOverlapsMonthKst } from '../users/userEmployment.js';

import { computePoolMemberPayrollDetail } from './poolMemberPayrollCompute.js';
import { buildPoolMemberPayrollSheetRows } from './payrollSheetPoolShared.js';
import { poolMemberInTenantWhere as basePoolMemberInTenantWhere } from '../inquiries/crewMemberCapacity.helpers.js';
import {
  attachPaidAndUnsettled,
  computeLeaderCumulativeUnsettledThroughMonth,
  computeTeamLeaderPayrollMonthAccrualMap,
} from './teamLeaderPayrollMonthAccrual.service.js';
import {
  compareMonthKey,
  marketerRemainderAfterSettle,
  marketerTotalDue,
  simulateMarketerOpeningCarryForward,
  type MarketerSettlementSlice,
} from './marketerPayrollLedger.js';
import { getAdminCrewExpenseDetail, listAdminCrewExpensesForMonth } from '../crew/crewGroupExpense.service.js';
import {
  computePayrollExpenseForward,
  computeMarketerAccruedEstimateForAccrualBounds,
} from './payrollExpenseForward.service.js';
import {
  createPayrollAdminPersonalExpense,
  deletePayrollAdminPersonalExpenseById,
  listPayrollAdminPersonalExpensesForMonth,
} from './payrollAdminPersonalExpense.service.js';
import {
  createPayrollAdminSharedExpense,
  deletePayrollAdminSharedExpenseById,
  listPayrollAdminSharedExpensesForMonth,
} from './payrollAdminSharedExpense.service.js';
import {
  createPayrollIncomeDeposit,
  deletePayrollIncomeDepositById,
  listPayrollIncomeDepositsForMonth,
} from './payrollIncomeDeposit.service.js';
import { buildPayrollAccountLedger } from './payrollAccountLedger.service.js';
import { resolveSettlementOperatingCompanyId } from '../../lib/externalSettlementOperatingCompanyScope.js';
import {
  createPayrollAccountLedgerManualEntry,
  deletePayrollAccountLedgerManualEntryById,
} from './payrollAccountLedgerManual.service.js';

const router = Router();

router.use(authMiddleware, requireStaffPermission('admin.payroll'));
router.use((req, res, next) => {
  const tenantId = getTenantIdFromAuth((req as unknown as { user: AuthPayload }).user);
  if (!tenantId) {
    res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
    return;
  }
  (req as unknown as TenantScopedRequest).tenantId = tenantId;
  next();
});

const MONTH_KEY = /^\d{4}-\d{2}$/;

function poolMemberInTenantWhere(tenantId: string, teamMemberId?: string) {
  return {
    ...basePoolMemberInTenantWhere(tenantId),
    ...(teamMemberId ? { id: teamMemberId } : {}),
  };
}

router.get('/expense-forward', async (req, res) => {
  const tenantId = (req as unknown as TenantScopedRequest).tenantId;
  try {
    const payload = await computePayrollExpenseForward(prisma, tenantId);
    res.json(payload);
  } catch (e) {
    console.error('[admin/payroll/expense-forward]', e);
    res.status(500).json({ error: '진행 중 급여 집계 중 오류가 발생했습니다.' });
  }
});

/** 접수 예약일(KST 월)·상태 기준 서비스 총액 합계 — 급여표 「수입」 탭용 */
router.get('/income-summary', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as unknown as TenantScopedRequest).tenantId;
    const monthKey = typeof req.query.month === 'string' ? req.query.month.trim() : '';
    if (!MONTH_KEY.test(monthKey)) {
      res.status(400).json({ error: 'month는 YYYY-MM 형식이어야 합니다.' });
      return;
    }
    const range = kstMonthRangeYm(monthKey);
    if (!range) {
      res.status(400).json({ error: '유효하지 않은 월입니다.' });
      return;
    }

    const operatingCompanyId = await resolveSettlementOperatingCompanyId(
      res,
      tenantId,
      req.query.operatingCompanyId,
    );
    if (!operatingCompanyId) return;

    const statusWhere = {
      tenantId,
      operatingCompanyId,
      preferredDate: { gte: range.gte, lte: range.lte },
      status: { notIn: [InquiryStatus.CANCELLED, InquiryStatus.ON_HOLD] },
    };

    const [inquiryCount, agg] = await Promise.all([
      prisma.inquiry.count({ where: statusWhere }),
      prisma.inquiry.aggregate({
        where: {
          ...statusWhere,
          serviceTotalAmount: { not: null },
        },
        _sum: { serviceTotalAmount: true },
        _count: true,
      }),
    ]);

    const inquiriesWithTotalAmount = agg._count;
    const serviceTotalSum = agg._sum.serviceTotalAmount ?? 0;

    res.json({
      month: monthKey,
      monthLabel: payrollMonthLabelFromKey(monthKey),
      operatingCompanyId,
      inquiryCount,
      inquiriesWithTotalAmount,
      inquiriesMissingTotalAmount: Math.max(0, inquiryCount - inquiriesWithTotalAmount),
      serviceTotalSum,
    });
  } catch (e) {
    console.error('[admin/payroll/income-summary]', e);
    res.status(500).json({ error: '수입 집계 중 오류가 발생했습니다.' });
  }
});

/** 타업체 정산 메뉴에서 등록한 정산완료 금액 — 급여표 「정산」수입 카드용 (정산일 paidAt 기준 KST 월) */
router.get('/external-settlement-received', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as unknown as TenantScopedRequest).tenantId;
    const monthKey = typeof req.query.month === 'string' ? req.query.month.trim() : '';
    if (!MONTH_KEY.test(monthKey)) {
      res.status(400).json({ error: 'month는 YYYY-MM 형식이어야 합니다.' });
      return;
    }
    const range = kstMonthRangeYm(monthKey);
    if (!range) {
      res.status(400).json({ error: '유효하지 않은 월입니다.' });
      return;
    }

    const operatingCompanyId = await resolveSettlementOperatingCompanyId(
      res,
      tenantId,
      req.query.operatingCompanyId,
    );
    if (!operatingCompanyId) return;

    const rows = await prisma.externalCompanySettlementPayment.findMany({
      where: {
        paidAt: { gte: range.gte, lte: range.lte },
        operatingCompanyId,
        externalCompany: { tenantId },
      },
      orderBy: [{ paidAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        amount: true,
        memo: true,
        paidAt: true,
        externalCompany: { select: { id: true, name: true } },
        actor: { select: { id: true, name: true } },
      },
    });

    const totalAmount = rows.reduce((s, r) => s + r.amount, 0);

    res.json({
      month: monthKey,
      monthLabel: payrollMonthLabelFromKey(monthKey),
      operatingCompanyId,
      paymentCount: rows.length,
      totalAmount,
      items: rows.map((r) => ({
        id: r.id,
        paidAt: r.paidAt.toISOString(),
        amount: r.amount,
        memo: r.memo,
        externalCompany: r.externalCompany,
        actor: r.actor,
      })),
    });
  } catch (e) {
    console.error('[admin/payroll/external-settlement-received]', e);
    res.status(500).json({ error: '타업체 정산 내역 집계 중 오류가 발생했습니다.' });
  }
});

/** 귀속 월별 계정 수입·지출 타임라인 — 현금성(입금·지급)과 접수 매출(예약일 총액) 구분 */
router.get('/account-ledger', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as unknown as TenantScopedRequest).tenantId;
    const monthKey = typeof req.query.month === 'string' ? req.query.month.trim() : '';
    if (!MONTH_KEY.test(monthKey)) {
      res.status(400).json({ error: 'month는 YYYY-MM 형식이어야 합니다.' });
      return;
    }
    const operatingCompanyId = await resolveSettlementOperatingCompanyId(
      res,
      tenantId,
      req.query.operatingCompanyId,
    );
    if (!operatingCompanyId) return;
    const payload = await buildPayrollAccountLedger(prisma, tenantId, monthKey, operatingCompanyId);
    res.json({ ...payload, operatingCompanyId });
  } catch (e) {
    if (e instanceof Error && e.message === 'INVALID_MONTH') {
      res.status(400).json({ error: '유효하지 않은 월입니다.' });
      return;
    }
    console.error('[admin/payroll/account-ledger]', e);
    res.status(500).json({ error: '수입·지출 내역 집계 중 오류가 발생했습니다.' });
  }
});

/** 계정 수입·지출 표 — 수기 수입·지출 행 추가 */
router.post('/account-ledger/manual', async (req: Request, res: Response) => {
  const authUser = (req as Request & { user?: AuthPayload }).user;
  const tenantId = (req as unknown as TenantScopedRequest).tenantId;
  if (!authUser?.userId) {
    res.status(401).json({ error: '인증이 필요합니다.' });
    return;
  }

  const body = req.body as {
    month?: unknown;
    occurredOn?: unknown;
    direction?: unknown;
    accountLabel?: unknown;
    amount?: unknown;
    memo?: unknown;
    payrollLinkKind?: unknown;
    linkTeamMemberId?: unknown;
    linkUserId?: unknown;
    linkExternalCompanyId?: unknown;
  };

  const monthRaw = typeof body.month === 'string' ? body.month.trim() : '';
  const monthKey = monthRaw && MONTH_KEY.test(monthRaw) ? monthRaw : '';
  if (!monthKey || !kstMonthRangeYm(monthKey)) {
    res.status(400).json({ error: 'month는 YYYY-MM 형식이어야 합니다.' });
    return;
  }

  const depRaw = typeof body.occurredOn === 'string' ? body.occurredOn.trim() : '';
  const occurredDt = parseYmdDateOnly(depRaw);
  if (!occurredDt) {
    res.status(400).json({ error: '거래일은 YYYY-MM-DD 형식으로 입력해 주세요.' });
    return;
  }
  const ymdFromRow = dateOnlyToYmd(occurredDt);
  if (ymdFromRow.slice(0, 7) !== monthKey) {
    res.status(400).json({ error: '거래일은 선택한 귀속 월 안의 날짜여야 합니다.' });
    return;
  }

  const dirRaw = typeof body.direction === 'string' ? body.direction.trim().toLowerCase() : '';
  const direction =
    dirRaw === 'in'
      ? PayrollAccountLedgerManualDirection.IN
      : dirRaw === 'out'
        ? PayrollAccountLedgerManualDirection.OUT
        : null;
  if (!direction) {
    res.status(400).json({ error: 'direction은 in 또는 out 이어야 합니다.' });
    return;
  }

  const labelRaw = typeof body.accountLabel === 'string' ? body.accountLabel.trim() : '';
  if (!labelRaw || labelRaw.length > 128) {
    res.status(400).json({ error: '계정·명목은 1~128자로 입력해 주세요.' });
    return;
  }

  const amtRaw = body.amount;
  const amount =
    typeof amtRaw === 'number' && Number.isFinite(amtRaw)
      ? Math.floor(amtRaw)
      : typeof amtRaw === 'string'
        ? parseInt(amtRaw.replace(/,/g, '').trim(), 10)
        : NaN;
  if (!Number.isFinite(amount) || amount < 1 || amount > 1_000_000_000) {
    res.status(400).json({ error: '금액은 1원 이상 유효한 숫자로 입력해 주세요.' });
    return;
  }

  let memo: string | null = null;
  if (typeof body.memo === 'string') {
    const t = body.memo.trim();
    memo = t.length > 2000 ? t.slice(0, 2000) : t.length ? t : null;
  }

  let payrollLinkKind: PayrollLedgerManualPayrollLinkKind = PayrollLedgerManualPayrollLinkKind.NONE;
  let linkTeamMemberId: string | null = null;
  let linkUserId: string | null = null;
  let linkExternalCompanyId: string | null = null;

  const rangeForLink = kstMonthRangeYm(monthKey);
  const linkMonthStartYmd = rangeForLink ? dateToYmdKst(rangeForLink.gte) : '';
  const linkMonthEndYmd = rangeForLink ? dateToYmdKst(rangeForLink.lte) : '';

  if (direction === PayrollAccountLedgerManualDirection.OUT) {
    const lkRaw =
      typeof body.payrollLinkKind === 'string' ? body.payrollLinkKind.trim().toLowerCase() : '';
    if (lkRaw === '' || lkRaw === 'none') {
      payrollLinkKind = PayrollLedgerManualPayrollLinkKind.NONE;
    } else if (lkRaw === 'pool_member') {
      payrollLinkKind = PayrollLedgerManualPayrollLinkKind.POOL_MEMBER;
      const tid =
        typeof body.linkTeamMemberId === 'string' ? body.linkTeamMemberId.trim() : '';
      if (!tid) {
        res.status(400).json({ error: '현장 팀원 연결 시 대상을 선택해 주세요.' });
        return;
      }
      const tm = await prisma.teamMember.findFirst({
        where: poolMemberInTenantWhere(tenantId, tid),
        select: { id: true },
      });
      if (!tm) {
        res.status(400).json({ error: '풀(현장) 팀원만 연결할 수 있습니다.' });
        return;
      }
      linkTeamMemberId = tm.id;
    } else if (lkRaw === 'team_leader') {
      payrollLinkKind = PayrollLedgerManualPayrollLinkKind.TEAM_LEADER;
      const uid = typeof body.linkUserId === 'string' ? body.linkUserId.trim() : '';
      if (!uid) {
        res.status(400).json({ error: '팀장 연결 시 대상을 선택해 주세요.' });
        return;
      }
      const u = await prisma.user.findFirst({
        where: { id: uid, tenantId, isActive: true, role: 'TEAM_LEADER' },
        select: { id: true, hireDate: true, resignationDate: true },
      });
      if (!u) {
        res.status(400).json({ error: '활성 팀장 계정만 연결할 수 있습니다.' });
        return;
      }
      if (
        linkMonthStartYmd &&
        linkMonthEndYmd &&
        !employmentOverlapsMonthKst(u.hireDate, u.resignationDate, linkMonthStartYmd, linkMonthEndYmd)
      ) {
        res.status(400).json({ error: '선택한 귀속 월 급여표에 포함되지 않는 팀장입니다.' });
        return;
      }
      linkUserId = u.id;
    } else if (lkRaw === 'marketer') {
      payrollLinkKind = PayrollLedgerManualPayrollLinkKind.MARKETER;
      const uid = typeof body.linkUserId === 'string' ? body.linkUserId.trim() : '';
      if (!uid) {
        res.status(400).json({ error: '마케터 연결 시 대상을 선택해 주세요.' });
        return;
      }
      const u = await prisma.user.findFirst({
        where: { id: uid, tenantId, isActive: true, role: { in: ['MARKETER', 'OFFICE_STAFF'] } },
        select: { id: true, hireDate: true, resignationDate: true },
      });
      if (!u) {
        res.status(400).json({ error: '활성 마케터 계정만 연결할 수 있습니다.' });
        return;
      }
      if (
        linkMonthStartYmd &&
        linkMonthEndYmd &&
        !employmentOverlapsMonthKst(u.hireDate, u.resignationDate, linkMonthStartYmd, linkMonthEndYmd)
      ) {
        res.status(400).json({ error: '선택한 귀속 월 급여표에 포함되지 않는 마케터입니다.' });
        return;
      }
      linkUserId = u.id;
    } else if (lkRaw === 'external_company') {
      payrollLinkKind = PayrollLedgerManualPayrollLinkKind.EXTERNAL_COMPANY;
      const cid =
        typeof body.linkExternalCompanyId === 'string' ? body.linkExternalCompanyId.trim() : '';
      if (!cid) {
        res.status(400).json({ error: '타업체 연결 시 업체를 선택해 주세요.' });
        return;
      }
      const ec = await prisma.externalCompany.findFirst({
        where: { id: cid, tenantId, isActive: true },
        select: { id: true },
      });
      if (!ec) {
        res.status(400).json({ error: '활성 타업체만 연결할 수 있습니다.' });
        return;
      }
      linkExternalCompanyId = ec.id;
    } else {
      res.status(400).json({ error: '지원하지 않는 급여 연결 유형입니다.' });
      return;
    }
  }

  const row = await createPayrollAccountLedgerManualEntry(prisma, {
    tenantId,
    monthKey,
    direction,
    occurredOn: occurredDt,
    accountLabel: labelRaw,
    amount,
    memo,
    createdById: authUser.userId,
    payrollLinkKind,
    linkTeamMemberId,
    linkUserId,
    linkExternalCompanyId,
  });

  res.status(201).json({
    ok: true,
    item: {
      id: row.id,
      direction: row.direction === PayrollAccountLedgerManualDirection.IN ? 'in' : 'out',
      occurredOnYmd: dateOnlyToYmd(row.occurredOn),
      accountLabel: row.accountLabel,
      amount: row.amount,
      memo: row.memo,
      payrollLinkKind:
        row.payrollLinkKind === PayrollLedgerManualPayrollLinkKind.NONE
          ? 'none'
          : row.payrollLinkKind === PayrollLedgerManualPayrollLinkKind.POOL_MEMBER
            ? 'pool_member'
            : row.payrollLinkKind === PayrollLedgerManualPayrollLinkKind.TEAM_LEADER
              ? 'team_leader'
              : row.payrollLinkKind === PayrollLedgerManualPayrollLinkKind.MARKETER
                ? 'marketer'
                : row.payrollLinkKind === PayrollLedgerManualPayrollLinkKind.EXTERNAL_COMPANY
                  ? 'external_company'
                  : 'none',
      linkTeamMemberId: row.linkTeamMemberId,
      linkUserId: row.linkUserId,
      linkExternalCompanyId: row.linkExternalCompanyId,
      createdAt: row.createdAt.toISOString(),
      createdBy: row.createdBy,
    },
  });
});

router.delete('/account-ledger/manual/:entryId', async (req: Request, res: Response) => {
  const authUser = (req as Request & { user?: AuthPayload }).user;
  const tenantId = (req as unknown as TenantScopedRequest).tenantId;
  if (!authUser?.userId) {
    res.status(401).json({ error: '인증이 필요합니다.' });
    return;
  }

  const entryId = typeof req.params.entryId === 'string' ? req.params.entryId.trim() : '';
  if (!entryId) {
    res.status(400).json({ error: 'entryId가 필요합니다.' });
    return;
  }

  const body = req.body as { password?: unknown };
  const password = body.password != null ? String(body.password).trim() : '';
  if (!password) {
    res.status(400).json({ error: '비밀번호를 입력해주세요.' });
    return;
  }

  const dbUser = await prisma.user.findFirst({
    where: { id: authUser.userId, tenantId },
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

  const deleted = await deletePayrollAccountLedgerManualEntryById(prisma, tenantId, entryId);
  if (!deleted) {
    res.status(404).json({ error: '내역을 찾을 수 없습니다.' });
    return;
  }

  res.json({ ok: true });
});

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
  tenantId: string,
  userId: string,
  monthKey: string,
): Promise<{
  id: string;
  name: string;
  payrollMonthlySalary: number | null;
  teamLeaderGeneralSettlementMode: TeamLeaderGeneralSettlementMode | null;
  teamLeaderGeneralSettlementValue: number | null;
  teamLeaderAdditionalReceiptCompanyShareBps: number | null;
} | null> {
  const range = kstMonthRangeYm(monthKey);
  if (!range) return null;
  const monthStartYmd = dateToYmdKst(range.gte);
  const monthEndYmd = dateToYmdKst(range.lte);
  const u = await prismaClient.user.findFirst({
    where: { id: userId, tenantId, role: 'TEAM_LEADER', isActive: true },
    select: {
      id: true,
      name: true,
      payrollMonthlySalary: true,
      teamLeaderGeneralSettlementMode: true,
      teamLeaderGeneralSettlementValue: true,
      teamLeaderAdditionalReceiptCompanyShareBps: true,
      hireDate: true,
      resignationDate: true,
    },
  });
  if (!u) return null;
  if (!employmentOverlapsMonthKst(u.hireDate, u.resignationDate, monthStartYmd, monthEndYmd)) {
    return null;
  }
  return {
    id: u.id,
    name: u.name,
    payrollMonthlySalary: u.payrollMonthlySalary,
    teamLeaderGeneralSettlementMode: u.teamLeaderGeneralSettlementMode ?? null,
    teamLeaderGeneralSettlementValue: u.teamLeaderGeneralSettlementValue ?? null,
    teamLeaderAdditionalReceiptCompanyShareBps: u.teamLeaderAdditionalReceiptCompanyShareBps ?? null,
  };
}

async function loadMarketerPayrollSubject(
  prismaClient: typeof prisma,
  tenantId: string,
  userId: string,
  monthKey: string,
): Promise<{
  id: string;
  name: string;
  payrollMonthlySalary: number | null;
  payrollPayDay: number | null;
  hireDate: Date | null;
  resignationDate: Date | null;
} | null> {
  const range = kstMonthRangeYm(monthKey);
  if (!range) return null;
  const monthStartYmd = dateToYmdKst(range.gte);
  const monthEndYmd = dateToYmdKst(range.lte);
  const u = await prismaClient.user.findFirst({
    where: { id: userId, tenantId, role: { in: ['MARKETER', 'OFFICE_STAFF'] }, isActive: true },
    select: {
      id: true,
      name: true,
      payrollMonthlySalary: true,
      payrollPayDay: true,
      hireDate: true,
      resignationDate: true,
    },
  });
  if (!u) return null;
  if (!employmentOverlapsMonthKst(u.hireDate, u.resignationDate, monthStartYmd, monthEndYmd)) {
    return null;
  }
  return u;
}

type PayrollSheetRowKind = 'POOL_MEMBER' | 'TEAM_LEADER' | 'MARKETER' | 'OFFICE_STAFF';

router.get('/sheet', async (req, res) => {
  const tenantId = (req as unknown as TenantScopedRequest).tenantId;
  const raw = typeof req.query.month === 'string' ? req.query.month.trim() : '';
  const monthKey =
    raw && MONTH_KEY.test(raw)
      ? raw
      : new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 7);

  const scopeRaw = typeof req.query.scope === 'string' ? req.query.scope.trim() : '';
  const scope: 'pool' | 'staff' | 'leader' | 'full' =
    scopeRaw === 'pool' || scopeRaw === 'staff' || scopeRaw === 'leader' ? scopeRaw : 'full';
  const includePool = scope === 'pool' || scope === 'staff' || scope === 'leader' || scope === 'full';
  const includeStaff = scope === 'staff' || scope === 'leader' || scope === 'full';
  const includeLeaderCumulative = scope === 'leader' || scope === 'full';

  const range = kstMonthRangeYm(monthKey);
  if (!range) {
    res.status(400).json({ error: 'month는 YYYY-MM 형식이어야 합니다.' });
    return;
  }

  try {
  const monthStartYmd = dateToYmdKst(range.gte);
  const monthEndYmd = dateToYmdKst(range.lte);
  const todayYmd = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10);
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
    poolSettledAmount?: number | null;
    leaderPaymentCount?: number;
    /** 팀장: 귀속 월 일반(건당) 정산 지급 합 */
    leaderGeneralPaidSum?: number;
    /** 팀장: 귀속 월 추가결재 정산 지급 합 */
    leaderAdditionalPaidSum?: number;
    marketerOpeningCarryForward?: number;
    marketerMonthlySalary?: number | null;
    marketerTotalDue?: number | null;
    marketerSettlementComplete?: boolean;
    marketerSettledAmount?: number | null;
    marketerUnsettledRemainder?: number | null;
    /** 마케터: 미정산 시 등록 월급을 귀속 일수로 나눈 오늘(KST)까지 일할 누적(이월 제외) — 수입·지출 탭 표시용 */
    marketerAccruedSalaryEstimateAsOfToday?: number | null;
    /** 마케터: 사용자 등록 급여일(미등록 시 말일과 동일하게 31) */
    payrollPayDay?: number;
    /** 팀장: 사용자 등록 일반 정산 방식 */
    teamLeaderGeneralSettlementMode?: TeamLeaderGeneralSettlementMode | null;
    teamLeaderGeneralSettlementValue?: number | null;
    teamLeaderAdditionalReceiptCompanyShareBps?: number | null;
    /** 팀장: 귀속 월 예약일 기준 배정 접수 수·매출·예상 정산·미정산 */
    leaderMonthAssignedJobCount?: number;
    leaderMonthGeneralSalesSum?: number;
    leaderMonthAdditionalSalesSum?: number;
    leaderMonthSettlementDueGeneral?: number | null;
    leaderMonthSettlementDueAdditional?: number;
    leaderMonthSettlementDueTotal?: number | null;
    leaderMonthUnsettledGeneral?: number | null;
    leaderMonthUnsettledAdditional?: number;
    leaderMonthUnsettledCombined?: number;
    /** 추가결재 금액이 있는 배정 접수 건수 */
    leaderMonthAdditionalReceiptInquiryCount?: number;
    /** 입사월~선택 귀속 월까지 월별 미정산 합산 */
    leaderCumulativeUnsettledWon?: number;
    crewExpenseTotal?: number;
    /** 수기 장부 지출 중 해당 풀 팀원 연결 합계 — 실지급 예상 차감분 */
    poolLedgerManualDeductionTotal?: number;
    amountNet?: number | null;
  };

  const rows: SheetRow[] = [];

  const poolMembers = includePool
    ? await prisma.teamMember.findMany({
        where: {
          teamId: null,
          isActive: true,
          crewGroupMembers: { some: { group: { tenantId } } },
        },
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
      })
    : [];

  if (includePool) {
    const poolRows = await buildPoolMemberPayrollSheetRows(prisma, tenantId, monthKey, poolMembers);
    for (const r of poolRows) {
      rows.push(r);
    }
  }

  const staffUsers = includeStaff
    ? await prisma.user.findMany({
        where: {
          tenantId,
          role: { in: ['TEAM_LEADER', 'MARKETER', 'OFFICE_STAFF'] },
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
          teamLeaderGeneralSettlementMode: true,
          teamLeaderGeneralSettlementValue: true,
          teamLeaderAdditionalReceiptCompanyShareBps: true,
        },
        orderBy: [{ role: 'asc' }, { name: 'asc' }],
      })
    : [];

  const leaderIds = staffUsers.filter((u) => u.role === 'TEAM_LEADER').map((u) => u.id);
  const leaderPaymentsMonth =
    includeStaff && leaderIds.length > 0
      ? await prisma.teamLeaderPayrollPayment.findMany({
          where: { userId: { in: leaderIds }, monthKey },
          select: { userId: true, amount: true, settlementBucket: true },
        })
      : [];
  const leaderAgg = new Map<
    string,
    { sum: number; count: number; sumGeneral: number; sumAdditional: number }
  >();
  for (const p of leaderPaymentsMonth) {
    const cur = leaderAgg.get(p.userId) ?? {
      sum: 0,
      count: 0,
      sumGeneral: 0,
      sumAdditional: 0,
    };
    cur.sum += p.amount;
    cur.count += 1;
    if (p.settlementBucket === 'ADDITIONAL_RECEIPT_SETTLEMENT') {
      cur.sumAdditional += p.amount;
    } else {
      cur.sumGeneral += p.amount;
    }
    leaderAgg.set(p.userId, cur);
  }

  const leaderStaffForAccrualMonth = staffUsers.filter(
    (u) =>
      u.role === 'TEAM_LEADER' &&
      employmentOverlapsMonthKst(u.hireDate, u.resignationDate, monthStartYmd, monthEndYmd),
  );

  const leaderProfilesForAccrual = leaderStaffForAccrualMonth.map((u) => ({
    id: u.id,
    teamLeaderGeneralSettlementMode: u.teamLeaderGeneralSettlementMode ?? null,
    teamLeaderGeneralSettlementValue: u.teamLeaderGeneralSettlementValue ?? null,
    teamLeaderAdditionalReceiptCompanyShareBps: u.teamLeaderAdditionalReceiptCompanyShareBps ?? null,
  }));

  const leaderMonthAccrualById =
    !includeStaff || leaderProfilesForAccrual.length === 0
      ? new Map()
      : await computeTeamLeaderPayrollMonthAccrualMap(prisma, tenantId, monthKey, leaderProfilesForAccrual);

  const leaderCumulativeUnsettledById =
    !includeStaff || !includeLeaderCumulative || leaderStaffForAccrualMonth.length === 0
      ? new Map<string, number>()
      : await computeLeaderCumulativeUnsettledThroughMonth(
          prisma,
          tenantId,
          monthKey,
          leaderStaffForAccrualMonth.map((u) => ({
            id: u.id,
            hireDate: u.hireDate,
            teamLeaderGeneralSettlementMode: u.teamLeaderGeneralSettlementMode ?? null,
            teamLeaderGeneralSettlementValue: u.teamLeaderGeneralSettlementValue ?? null,
            teamLeaderAdditionalReceiptCompanyShareBps: u.teamLeaderAdditionalReceiptCompanyShareBps ?? null,
          })),
        );

  const fixedSalaryUserIdsForSheet = staffUsers
    .filter((u) => u.role === 'MARKETER' || u.role === 'OFFICE_STAFF')
    .map((u) => u.id);
  const marketerAllSettleRows =
    includeStaff && fixedSalaryUserIdsForSheet.length > 0
      ? await prisma.marketerPayrollSettlement.findMany({
          where: {
            userId: { in: fixedSalaryUserIdsForSheet },
            monthKey: { lte: monthKey },
          },
          select: {
            userId: true,
            monthKey: true,
            openingCarryForward: true,
            scheduledMonthlySalary: true,
            settledAmount: true,
            memo: true,
            settledAt: true,
          },
          orderBy: [{ userId: 'asc' }, { monthKey: 'asc' }],
        })
      : [];

  const marketerAscSlicesByUserId = new Map<string, MarketerSettlementSlice[]>();
  const marketerCurrentMonthSettleByUserId = new Map<
    string,
    {
      openingCarryForward: number;
      scheduledMonthlySalary: number | null;
      settledAmount: number;
      memo: string | null;
      settledAt: Date;
    }
  >();

  for (const row of marketerAllSettleRows) {
    const arr = marketerAscSlicesByUserId.get(row.userId) ?? [];
    arr.push({
      monthKey: row.monthKey,
      scheduledMonthlySalary: row.scheduledMonthlySalary,
      settledAmount: row.settledAmount,
    });
    marketerAscSlicesByUserId.set(row.userId, arr);
    if (row.monthKey === monthKey) {
      marketerCurrentMonthSettleByUserId.set(row.userId, {
        openingCarryForward: row.openingCarryForward,
        scheduledMonthlySalary: row.scheduledMonthlySalary,
        settledAmount: row.settledAmount,
        memo: row.memo,
        settledAt: row.settledAt,
      });
    }
  }

  for (const u of staffUsers) {
    if (!employmentOverlapsMonthKst(u.hireDate, u.resignationDate, monthStartYmd, monthEndYmd)) {
      continue;
    }

    if (u.role === 'TEAM_LEADER') {
      const notes: string[] = [];
      const genMode = u.teamLeaderGeneralSettlementMode ?? null;
      const genVal = u.teamLeaderGeneralSettlementValue ?? null;
      const addBps = u.teamLeaderAdditionalReceiptCompanyShareBps ?? null;
      if (genMode === 'FIXED_PER_JOB_WON' && genVal != null) {
        notes.push(`일반·건당 ${genVal.toLocaleString('ko-KR')}원`);
      } else if (genMode === 'PERCENT_OF_GENERAL_SERVICE_BPS' && genVal != null) {
        notes.push(`일반·만분율 ${genVal} (${(genVal / 100).toFixed(2)}%)`);
      } else if (genMode != null && genVal == null) {
        notes.push('일반 정산: 방식만 등록됨');
      }
      if (addBps != null) {
        notes.push(`추가결재 회사몫 만분율 ${addBps} (${(addBps / 100).toFixed(2)}%)`);
      }
      if (u.payrollMonthlySalary != null) {
        notes.push(`참고·등록 월급액 ${u.payrollMonthlySalary.toLocaleString('ko-KR')}원`);
      }
      const agg = leaderAgg.get(u.id);
      const paymentCount = agg?.count ?? 0;
      const paidSum = agg?.sum ?? 0;
      const paidGeneral = agg?.sumGeneral ?? 0;
      const paidAdditional = agg?.sumAdditional ?? 0;

      const accrualCore = leaderMonthAccrualById.get(u.id) ?? {
        assignedJobCount: 0,
        additionalReceiptInquiryCount: 0,
        generalSalesSum: 0,
        additionalSalesSum: 0,
        settlementDueGeneral: null,
        settlementDueAdditional: 0,
        settlementDueTotal: null,
      };
      const accrualFull = attachPaidAndUnsettled(accrualCore, paidGeneral, paidAdditional);

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
        leaderGeneralPaidSum: paidGeneral > 0 ? paidGeneral : undefined,
        leaderAdditionalPaidSum: paidAdditional > 0 ? paidAdditional : undefined,
        teamLeaderGeneralSettlementMode: genMode,
        teamLeaderGeneralSettlementValue: genVal,
        teamLeaderAdditionalReceiptCompanyShareBps: addBps,
        leaderMonthAssignedJobCount: accrualFull.assignedJobCount,
        leaderMonthGeneralSalesSum: accrualFull.generalSalesSum,
        leaderMonthAdditionalSalesSum: accrualFull.additionalSalesSum,
        leaderMonthSettlementDueGeneral: accrualFull.settlementDueGeneral,
        leaderMonthSettlementDueAdditional: accrualFull.settlementDueAdditional,
        leaderMonthSettlementDueTotal: accrualFull.settlementDueTotal,
        leaderMonthUnsettledGeneral: accrualFull.unsettledGeneral,
        leaderMonthUnsettledAdditional: accrualFull.unsettledAdditional,
        leaderMonthUnsettledCombined: accrualFull.unsettledCombined,
        leaderMonthAdditionalReceiptInquiryCount: accrualFull.additionalReceiptInquiryCount,
        leaderCumulativeUnsettledWon: includeLeaderCumulative
          ? (leaderCumulativeUnsettledById.get(u.id) ?? 0)
          : undefined,
      });
      continue;
    }

    if (u.role === 'MARKETER' || u.role === 'OFFICE_STAFF') {
    const sheetKind: PayrollSheetRowKind = u.role === 'OFFICE_STAFF' ? 'OFFICE_STAFF' : 'MARKETER';
    const roleLabel = u.role === 'OFFICE_STAFF' ? '사무직' : '마케터';
    const notes: string[] = [];
    const payDayStaff =
      u.payrollPayDay != null && u.payrollPayDay >= 1 && u.payrollPayDay <= 31 ? u.payrollPayDay : 31;
    const payDateYmd = payYmdInMonth(calYear, monthIndex, payDayStaff);
    if (u.payrollPayDay == null) {
      notes.push('지급일: 해당 월 말일');
    }
    const salary = u.payrollMonthlySalary;
    if (salary == null) notes.push('월 급여 미설정');

    const marketerAccrual = payrollAccrualPeriodForPaymentDate(payDateYmd, payDayStaff);

    const ascFull = marketerAscSlicesByUserId.get(u.id) ?? [];
    const ascBefore = ascFull.filter((s) => compareMonthKey(s.monthKey, monthKey) < 0);
    const openingCarryForward = simulateMarketerOpeningCarryForward({
      targetMonthKey: monthKey,
      hireDate: u.hireDate,
      resignationDate: u.resignationDate,
      liveMonthlySalary: salary,
      settlementsAscFull: ascFull,
      settlementsAscBeforeTarget: ascBefore,
    });
    const totalDue = marketerTotalDue(openingCarryForward, salary);
    const curSettle = marketerCurrentMonthSettleByUserId.get(u.id);
    const settlementComplete = Boolean(curSettle);
    let marketerAccruedSalaryEstimateAsOfToday: number | null = null;
    if (marketerAccrual?.startYmd && marketerAccrual?.endYmd) {
      const accruedBreakdown = computeMarketerAccruedEstimateForAccrualBounds({
        accrualStartYmd: marketerAccrual.startYmd,
        accrualEndYmd: marketerAccrual.endYmd,
        salary,
        todayYmd,
      });
      if (accruedBreakdown && !settlementComplete) {
        if (
          salary != null &&
          salary > 0 &&
          accruedBreakdown.elapsedDays === 0
        ) {
          marketerAccruedSalaryEstimateAsOfToday = 0;
        } else {
          marketerAccruedSalaryEstimateAsOfToday = accruedBreakdown.accruedEstimate;
        }
      }
    }
    if (openingCarryForward > 0) {
      notes.push(`미정산 이월 ${openingCarryForward.toLocaleString('ko-KR')}원 (이번 달 합산)`);
    }
    if (curSettle) {
      const rem = marketerRemainderAfterSettle(
        curSettle.openingCarryForward,
        curSettle.scheduledMonthlySalary,
        curSettle.settledAmount,
      );
      if (rem > 0) {
        notes.push(`차월 이월 미정산 ${rem.toLocaleString('ko-KR')}원`);
      }
    }

    rows.push({
      kind: sheetKind,
      id: u.id,
      name: u.name,
      roleLabel,
      payrollPayDay: payDayStaff,
      payDateYmd,
      accrualStartYmd: marketerAccrual?.startYmd ?? null,
      accrualEndYmd: marketerAccrual?.endYmd ?? null,
      jobCount: null,
      unitAmount: null,
      amount: totalDue,
      notes,
      marketerOpeningCarryForward: openingCarryForward,
      marketerMonthlySalary: salary,
      marketerTotalDue: totalDue,
      marketerSettlementComplete: settlementComplete,
      marketerSettledAmount: curSettle?.settledAmount ?? null,
      marketerUnsettledRemainder: curSettle
        ? marketerRemainderAfterSettle(
            curSettle.openingCarryForward,
            curSettle.scheduledMonthlySalary,
            curSettle.settledAmount,
          )
        : null,
      marketerAccruedSalaryEstimateAsOfToday,
    });
    }
  }

  rows.sort((a, b) => {
    const da = a.payDateYmd ?? '9999-12-31';
    const db = b.payDateYmd ?? '9999-12-31';
    if (da !== db) return da.localeCompare(db);
    const orderKind = (k: PayrollSheetRowKind) =>
      k === 'TEAM_LEADER' ? 0 : k === 'MARKETER' ? 1 : k === 'OFFICE_STAFF' ? 2 : 3;
    const ka = orderKind(a.kind);
    const kb = orderKind(b.kind);
    if (ka !== kb) return ka - kb;
    return a.name.localeCompare(b.name, 'ko');
  });

  let amountSum = 0;
  let rowsWithAmount = 0;
  for (const r of rows) {
    const contrib =
      r.kind === 'POOL_MEMBER' && r.amountNet != null ? r.amountNet : r.amount != null ? r.amount : null;
    if (contrib != null) {
      amountSum += contrib;
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
  } catch (err) {
    console.error('[admin/payroll/sheet]', err);
    res.status(500).json({ error: '급여표를 계산하는 중 서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' });
  }
});

/** 풀 팀원: 해당 월 급여 산정 구간에 포함된 접수 건별 상세 + 정산·지급 이력 */
router.get('/pool-member/:teamMemberId/detail', async (req, res) => {
  const tenantId = (req as unknown as TenantScopedRequest).tenantId;
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
    const result = await computePoolMemberPayrollDetail(prisma, tenantId, teamMemberId, monthKey);
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
        monthLabel: payrollMonthLabelFromKey(r.monthKey),
        amount: r.amount,
        settledAt: r.settledAt.toISOString(),
      })),
    },
  });
});

router.post('/pool-member/:teamMemberId/settle', async (req: Request, res: Response) => {
  const tenantId = (req as unknown as TenantScopedRequest).tenantId;
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
    const result = await computePoolMemberPayrollDetail(prisma, tenantId, teamMemberId, monthKey);
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

  if (computation.amountNet == null) {
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
        amount: computation.amountNet,
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
    amount: computation.amountNet,
    settledAt: new Date().toISOString(),
  });
});

router.get('/team-leader/:userId/payments', async (req, res) => {
  const tenantId = (req as unknown as TenantScopedRequest).tenantId;
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

  const subject = await loadTeamLeaderPayrollSubject(prisma, tenantId, userId, monthKey);
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
    settlementBucket: row.settlementBucket,
  });

  const monthPaidTotal = monthRows.reduce((s, r) => s + r.amount, 0);

  const paidGeneralSum = monthRows
    .filter((r) => r.settlementBucket !== 'ADDITIONAL_RECEIPT_SETTLEMENT')
    .reduce((s, r) => s + r.amount, 0);
  const paidAdditionalSum = monthRows
    .filter((r) => r.settlementBucket === 'ADDITIONAL_RECEIPT_SETTLEMENT')
    .reduce((s, r) => s + r.amount, 0);

  const accrualMap = await computeTeamLeaderPayrollMonthAccrualMap(prisma, tenantId, monthKey, [
    {
      id: subject.id,
      teamLeaderGeneralSettlementMode: subject.teamLeaderGeneralSettlementMode,
      teamLeaderGeneralSettlementValue: subject.teamLeaderGeneralSettlementValue,
      teamLeaderAdditionalReceiptCompanyShareBps: subject.teamLeaderAdditionalReceiptCompanyShareBps,
    },
  ]);
  const accrualCore = accrualMap.get(subject.id) ?? {
    assignedJobCount: 0,
    additionalReceiptInquiryCount: 0,
    generalSalesSum: 0,
    additionalSalesSum: 0,
    settlementDueGeneral: null,
    settlementDueAdditional: 0,
    settlementDueTotal: null,
  };
  const monthAccrual = attachPaidAndUnsettled(accrualCore, paidGeneralSum, paidAdditionalSum);

  res.json({
    month: monthKey,
    monthLabel: payrollMonthLabelFromKey(monthKey),
    user: { id: subject.id, name: subject.name },
    contractSalary: subject.payrollMonthlySalary,
    teamLeaderGeneralSettlementMode: subject.teamLeaderGeneralSettlementMode,
    teamLeaderGeneralSettlementValue: subject.teamLeaderGeneralSettlementValue,
    teamLeaderAdditionalReceiptCompanyShareBps: subject.teamLeaderAdditionalReceiptCompanyShareBps,
    monthPaidTotal,
    monthAccrual,
    monthPayments: monthRows.map(mapRow),
    priorPayments: priorRows.map(mapRow),
  });
});

router.post('/team-leader/:userId/payments', async (req: Request, res: Response) => {
  const authUser = (req as Request & { user?: AuthPayload }).user;
  const tenantId = (req as unknown as TenantScopedRequest).tenantId;
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

  const subject = await loadTeamLeaderPayrollSubject(prisma, tenantId, userId, monthKey);
  if (!subject) {
    res.status(404).json({ error: '팀장 급여 대상을 찾을 수 없습니다.' });
    return;
  }

  const body = req.body as {
    amount?: unknown;
    paidOn?: unknown;
    memo?: unknown;
    settlementBucket?: unknown;
  };
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

  let settlementBucket: TeamLeaderPayrollPaymentBucket = 'GENERAL_JOB_SETTLEMENT';
  const sb = body.settlementBucket;
  if (sb === 'ADDITIONAL_RECEIPT_SETTLEMENT') settlementBucket = 'ADDITIONAL_RECEIPT_SETTLEMENT';
  else if (sb !== undefined && sb !== null && sb !== '' && sb !== 'GENERAL_JOB_SETTLEMENT') {
    res.status(400).json({
      error:
        'settlementBucket는 GENERAL_JOB_SETTLEMENT 또는 ADDITIONAL_RECEIPT_SETTLEMENT 여야 합니다.',
    });
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
      settlementBucket,
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
      settlementBucket: row.settlementBucket,
    },
  });
});

router.delete('/team-leader/payment/:paymentId', async (req: Request, res: Response) => {
  const authUser = (req as Request & { user?: AuthPayload }).user;
  const tenantId = (req as unknown as TenantScopedRequest).tenantId;
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

  const dbUser = await prisma.user.findFirst({
    where: { id: authUser.userId, tenantId },
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

  const existing = await prisma.teamLeaderPayrollPayment.findFirst({
    where: { id: paymentId, user: { tenantId, role: 'TEAM_LEADER' } },
    select: { id: true },
  });

  if (!existing) {
    res.status(404).json({ error: '지급 내역을 찾을 수 없습니다.' });
    return;
  }

  await prisma.teamLeaderPayrollPayment.delete({ where: { id: paymentId } });
  res.json({ ok: true });
});

router.get('/marketer/:userId/detail', async (req, res) => {
  const tenantId = (req as unknown as TenantScopedRequest).tenantId;
  const userId = typeof req.params.userId === 'string' ? req.params.userId.trim() : '';
  if (!userId) {
    res.status(400).json({ error: 'userId가 필요합니다.' });
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

  const subject = await loadMarketerPayrollSubject(prisma, tenantId, userId, monthKey);
  if (!subject) {
    res.status(404).json({ error: '고정 월급 급여 대상(마케터·사무직)을 찾을 수 없습니다.' });
    return;
  }

  const [yStr, mStr] = monthKey.split('-');
  const calYear = parseInt(yStr, 10);
  const calMonthNum = parseInt(mStr, 10);
  const monthIndex = calMonthNum - 1;

  const payDayStaff =
    subject.payrollPayDay != null && subject.payrollPayDay >= 1 && subject.payrollPayDay <= 31
      ? subject.payrollPayDay
      : 31;
  const payDateYmd = payYmdInMonth(calYear, monthIndex, payDayStaff);
  const marketerAccrual = payrollAccrualPeriodForPaymentDate(payDateYmd, payDayStaff);

  const ascRows = await prisma.marketerPayrollSettlement.findMany({
    where: { userId },
    orderBy: { monthKey: 'asc' },
    select: {
      monthKey: true,
      openingCarryForward: true,
      scheduledMonthlySalary: true,
      settledAmount: true,
      memo: true,
      settledAt: true,
    },
  });

  const slicesFull: MarketerSettlementSlice[] = ascRows.map((r) => ({
    monthKey: r.monthKey,
    scheduledMonthlySalary: r.scheduledMonthlySalary,
    settledAmount: r.settledAmount,
  }));
  const ascBefore = slicesFull.filter((s) => compareMonthKey(s.monthKey, monthKey) < 0);

  const openingCarryForward = simulateMarketerOpeningCarryForward({
    targetMonthKey: monthKey,
    hireDate: subject.hireDate,
    resignationDate: subject.resignationDate,
    liveMonthlySalary: subject.payrollMonthlySalary,
    settlementsAscFull: slicesFull,
    settlementsAscBeforeTarget: ascBefore,
  });

  const totalDue = marketerTotalDue(openingCarryForward, subject.payrollMonthlySalary);

  const notes: string[] = [];
  if (subject.payrollPayDay == null) notes.push('지급일: 해당 월 말일');
  if (subject.payrollMonthlySalary == null) notes.push('월 급여 미설정');
  if (openingCarryForward > 0) {
    notes.push(`미정산 이월 ${openingCarryForward.toLocaleString('ko-KR')}원 (이번 달 합산)`);
  }

  const currentRow = ascRows.find((r) => r.monthKey === monthKey);

  const historyDesc = [...ascRows].sort((a, b) => b.settledAt.getTime() - a.settledAt.getTime());

  const settlementHistory = historyDesc.map((r) => ({
    monthKey: r.monthKey,
    monthLabel: payrollMonthLabelFromKey(r.monthKey),
    settledAmount: r.settledAmount,
    openingCarryForward: r.openingCarryForward,
    scheduledMonthlySalary: r.scheduledMonthlySalary,
    remainderCarriedForward: marketerRemainderAfterSettle(
      r.openingCarryForward,
      r.scheduledMonthlySalary,
      r.settledAmount,
    ),
    memo: r.memo,
    settledAt: r.settledAt.toISOString(),
  }));

  const totalSettledSum = ascRows.reduce((s, r) => s + r.settledAmount, 0);

  res.json({
    month: monthKey,
    monthLabel: payrollMonthLabelFromKey(monthKey),
    member: { id: subject.id, name: subject.name },
    payDateYmd,
    accrualStartYmd: marketerAccrual?.startYmd ?? null,
    accrualEndYmd: marketerAccrual?.endYmd ?? null,
    openingCarryForward,
    scheduledMonthlySalary: subject.payrollMonthlySalary,
    totalDue,
    notes,
    settlement: currentRow
      ? {
          openingCarryForward: currentRow.openingCarryForward,
          scheduledMonthlySalary: currentRow.scheduledMonthlySalary,
          settledAmount: currentRow.settledAmount,
          remainderCarriedForward: marketerRemainderAfterSettle(
            currentRow.openingCarryForward,
            currentRow.scheduledMonthlySalary,
            currentRow.settledAmount,
          ),
          memo: currentRow.memo,
          settledAt: currentRow.settledAt.toISOString(),
        }
      : null,
    settlementHistory,
    totalSettledSum,
  });
});

router.post('/marketer/:userId/settle', async (req: Request, res: Response) => {
  const authUser = (req as Request & { user?: AuthPayload }).user;
  const tenantId = (req as unknown as TenantScopedRequest).tenantId;
  if (!authUser?.userId) {
    res.status(401).json({ error: '인증이 필요합니다.' });
    return;
  }

  const userId = typeof req.params.userId === 'string' ? req.params.userId.trim() : '';
  if (!userId) {
    res.status(400).json({ error: 'userId가 필요합니다.' });
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

  const subject = await loadMarketerPayrollSubject(prisma, tenantId, userId, monthKey);
  if (!subject) {
    res.status(404).json({ error: '고정 월급 급여 대상(마케터·사무직)을 찾을 수 없습니다.' });
    return;
  }

  const ascRows = await prisma.marketerPayrollSettlement.findMany({
    where: { userId },
    orderBy: { monthKey: 'asc' },
    select: {
      monthKey: true,
      scheduledMonthlySalary: true,
      settledAmount: true,
    },
  });

  const slicesFull: MarketerSettlementSlice[] = ascRows.map((r) => ({
    monthKey: r.monthKey,
    scheduledMonthlySalary: r.scheduledMonthlySalary,
    settledAmount: r.settledAmount,
  }));
  const ascBefore = slicesFull.filter((s) => compareMonthKey(s.monthKey, monthKey) < 0);

  const openingCarryForward = simulateMarketerOpeningCarryForward({
    targetMonthKey: monthKey,
    hireDate: subject.hireDate,
    resignationDate: subject.resignationDate,
    liveMonthlySalary: subject.payrollMonthlySalary,
    settlementsAscFull: slicesFull,
    settlementsAscBeforeTarget: ascBefore,
  });

  const totalDue = marketerTotalDue(openingCarryForward, subject.payrollMonthlySalary);
  if (totalDue == null || totalDue < 1) {
    res.status(400).json({
      error: '정산할 급여 합계가 없습니다. 미정산 이월 또는 등록 월급을 확인해 주세요.',
    });
    return;
  }

  const body = req.body as { settledAmount?: unknown; memo?: unknown };
  let settledAmount = 0;
  if (typeof body.settledAmount === 'number' && Number.isInteger(body.settledAmount)) {
    settledAmount = body.settledAmount;
  } else if (
    typeof body.settledAmount === 'string' &&
    /^-?\d+$/.test(body.settledAmount.trim())
  ) {
    settledAmount = parseInt(body.settledAmount.trim(), 10);
  }

  if (settledAmount < 1 || settledAmount > 500_000_000) {
    res.status(400).json({
      error: '정산금은 1원 이상 5억 원 이하 정수로 입력해 주세요.',
    });
    return;
  }

  let memo: string | null = null;
  if (typeof body.memo === 'string') {
    const t = body.memo.trim();
    memo = t.length > 2000 ? t.slice(0, 2000) : t.length ? t : null;
  }

  try {
    await prisma.marketerPayrollSettlement.create({
      data: {
        userId,
        monthKey,
        openingCarryForward,
        scheduledMonthlySalary: subject.payrollMonthlySalary,
        settledAmount,
        memo,
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

  const remainder = marketerRemainderAfterSettle(
    openingCarryForward,
    subject.payrollMonthlySalary,
    settledAmount,
  );

  res.status(201).json({
    ok: true,
    userId,
    monthKey,
    openingCarryForward,
    scheduledMonthlySalary: subject.payrollMonthlySalary,
    settledAmount,
    remainderCarriedForward: remainder,
    settledAt: new Date().toISOString(),
  });
});

router.patch('/pool-member/:teamMemberId/month-adjust', async (req, res) => {
  const tenantId = (req as unknown as TenantScopedRequest).tenantId;
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
    where: poolMemberInTenantWhere(tenantId, teamMemberId),
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

/** 크루 그룹장 등록 지출 — 귀속 월별 목록 (관리자) */
router.get('/crew-expenses', async (req, res) => {
  const tenantId = (req as unknown as TenantScopedRequest).tenantId;
  const raw = typeof req.query.month === 'string' ? req.query.month.trim() : '';
  const monthKey =
    raw && MONTH_KEY.test(raw)
      ? raw
      : new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 7);

  if (!kstMonthRangeYm(monthKey)) {
    res.status(400).json({ error: 'month는 YYYY-MM 형식이어야 합니다.' });
    return;
  }

  const rows = await listAdminCrewExpensesForMonth(tenantId, monthKey);
  res.json({
    month: monthKey,
    items: rows.map((row) => ({
      id: row.id,
      crewGroupId: row.crewGroupId,
      crewGroupName: row.group.name,
      teamMemberId: row.teamMemberId,
      memberName: row.teamMember.name,
      memberNameTh: row.teamMember.nameTh,
      amount: row.amount,
      memo: row.memo,
      attachmentCount: row.attachments.length,
      createdAt: row.createdAt.toISOString(),
    })),
  });
});

/** 크루 지출 단건 상세 (영수증 URL 포함) */
router.get('/crew-expenses/:expenseId', async (req, res) => {
  const tenantId = (req as unknown as TenantScopedRequest).tenantId;
  const expenseId = typeof req.params.expenseId === 'string' ? req.params.expenseId.trim() : '';
  if (!expenseId) {
    res.status(400).json({ error: 'expenseId가 필요합니다.' });
    return;
  }
  const row = await getAdminCrewExpenseDetail(tenantId, expenseId);
  if (!row) {
    res.status(404).json({ error: '지출 내역을 찾을 수 없습니다.' });
    return;
  }
  res.json({
    id: row.id,
    monthKey: row.monthKey,
    amount: row.amount,
    memo: row.memo,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    crewGroup: row.group,
    teamMember: row.teamMember,
    attachments: row.attachments.map((a) => ({
      id: a.id,
      secureUrl: a.secureUrl,
      width: a.width,
      height: a.height,
      createdAt: a.createdAt.toISOString(),
    })),
  });
});

/** 급여표 지출 탭 — 관리자 개인·업무 지출(귀속 월별, 참고용) */
router.get('/admin-personal-expenses', async (req, res) => {
  const tenantId = (req as unknown as TenantScopedRequest).tenantId;
  const raw = typeof req.query.month === 'string' ? req.query.month.trim() : '';
  const monthKey =
    raw && MONTH_KEY.test(raw)
      ? raw
      : new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 7);

  if (!kstMonthRangeYm(monthKey)) {
    res.status(400).json({ error: 'month는 YYYY-MM 형식이어야 합니다.' });
    return;
  }

  const rows = await listPayrollAdminPersonalExpensesForMonth(prisma, tenantId, monthKey);
  res.json({
    month: monthKey,
    items: rows.map((row) => ({
      id: row.id,
      amount: row.amount,
      memo: row.memo,
      createdAt: row.createdAt.toISOString(),
      createdBy: row.createdBy,
    })),
  });
});

router.post('/admin-personal-expenses', async (req: Request, res: Response) => {
  const authUser = (req as Request & { user?: AuthPayload }).user;
  const tenantId = (req as unknown as TenantScopedRequest).tenantId;
  if (!authUser?.userId) {
    res.status(401).json({ error: '인증이 필요합니다.' });
    return;
  }

  const body = req.body as { month?: unknown; amount?: unknown; memo?: unknown };
  const monthRaw = typeof body.month === 'string' ? body.month.trim() : '';
  const monthKey =
    monthRaw && MONTH_KEY.test(monthRaw)
      ? monthRaw
      : new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 7);

  if (!kstMonthRangeYm(monthKey)) {
    res.status(400).json({ error: 'month는 YYYY-MM 형식이어야 합니다.' });
    return;
  }

  const amtRaw = body.amount;
  const amount =
    typeof amtRaw === 'number' && Number.isFinite(amtRaw)
      ? Math.floor(amtRaw)
      : typeof amtRaw === 'string'
        ? parseInt(amtRaw.replace(/,/g, '').trim(), 10)
        : NaN;
  if (!Number.isFinite(amount) || amount < 1 || amount > 1_000_000_000) {
    res.status(400).json({ error: '금액은 1원 이상 유효한 숫자로 입력해 주세요.' });
    return;
  }

  let memo: string | null = null;
  if (typeof body.memo === 'string') {
    const t = body.memo.trim();
    memo = t.length > 2000 ? t.slice(0, 2000) : t.length ? t : null;
  }

  const row = await createPayrollAdminPersonalExpense(prisma, {
    tenantId,
    monthKey,
    amount,
    memo,
    createdById: authUser.userId,
  });

  res.status(201).json({
    ok: true,
    item: {
      id: row.id,
      amount: row.amount,
      memo: row.memo,
      createdAt: row.createdAt.toISOString(),
      createdBy: row.createdBy,
    },
  });
});

router.delete('/admin-personal-expenses/:expenseId', async (req: Request, res: Response) => {
  const authUser = (req as Request & { user?: AuthPayload }).user;
  const tenantId = (req as unknown as TenantScopedRequest).tenantId;
  if (!authUser?.userId) {
    res.status(401).json({ error: '인증이 필요합니다.' });
    return;
  }

  const expenseId =
    typeof req.params.expenseId === 'string' ? req.params.expenseId.trim() : '';
  if (!expenseId) {
    res.status(400).json({ error: 'expenseId가 필요합니다.' });
    return;
  }

  const body = req.body as { password?: unknown };
  const password = body.password != null ? String(body.password).trim() : '';
  if (!password) {
    res.status(400).json({ error: '비밀번호를 입력해주세요.' });
    return;
  }

  const dbUser = await prisma.user.findFirst({
    where: { id: authUser.userId, tenantId },
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

  const deleted = await deletePayrollAdminPersonalExpenseById(prisma, tenantId, expenseId);
  if (!deleted) {
    res.status(404).json({ error: '지출 내역을 찾을 수 없습니다.' });
    return;
  }

  res.json({ ok: true });
});

/** 급여표 정산 탭 — 관리자 공용 지출(귀속 월별, 참고용) */
router.get('/admin-shared-expenses', async (req, res) => {
  const tenantId = (req as unknown as TenantScopedRequest).tenantId;
  const raw = typeof req.query.month === 'string' ? req.query.month.trim() : '';
  const monthKey =
    raw && MONTH_KEY.test(raw)
      ? raw
      : new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 7);

  if (!kstMonthRangeYm(monthKey)) {
    res.status(400).json({ error: 'month는 YYYY-MM 형식이어야 합니다.' });
    return;
  }

  const rows = await listPayrollAdminSharedExpensesForMonth(prisma, tenantId, monthKey);
  res.json({
    month: monthKey,
    items: rows.map((row) => ({
      id: row.id,
      amount: row.amount,
      memo: row.memo,
      createdAt: row.createdAt.toISOString(),
      createdBy: row.createdBy,
    })),
  });
});

router.post('/admin-shared-expenses', async (req: Request, res: Response) => {
  const authUser = (req as Request & { user?: AuthPayload }).user;
  const tenantId = (req as unknown as TenantScopedRequest).tenantId;
  if (!authUser?.userId) {
    res.status(401).json({ error: '인증이 필요합니다.' });
    return;
  }

  const body = req.body as { month?: unknown; amount?: unknown; memo?: unknown };
  const monthRaw = typeof body.month === 'string' ? body.month.trim() : '';
  const monthKey =
    monthRaw && MONTH_KEY.test(monthRaw)
      ? monthRaw
      : new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 7);

  if (!kstMonthRangeYm(monthKey)) {
    res.status(400).json({ error: 'month는 YYYY-MM 형식이어야 합니다.' });
    return;
  }

  const amtRaw = body.amount;
  const amount =
    typeof amtRaw === 'number' && Number.isFinite(amtRaw)
      ? Math.floor(amtRaw)
      : typeof amtRaw === 'string'
        ? parseInt(amtRaw.replace(/,/g, '').trim(), 10)
        : NaN;
  if (!Number.isFinite(amount) || amount < 1 || amount > 1_000_000_000) {
    res.status(400).json({ error: '금액은 1원 이상 유효한 숫자로 입력해 주세요.' });
    return;
  }

  let memo: string | null = null;
  if (typeof body.memo === 'string') {
    const t = body.memo.trim();
    memo = t.length > 2000 ? t.slice(0, 2000) : t.length ? t : null;
  }

  const row = await createPayrollAdminSharedExpense(prisma, {
    tenantId,
    monthKey,
    amount,
    memo,
    createdById: authUser.userId,
  });

  res.status(201).json({
    ok: true,
    item: {
      id: row.id,
      amount: row.amount,
      memo: row.memo,
      createdAt: row.createdAt.toISOString(),
      createdBy: row.createdBy,
    },
  });
});

router.delete('/admin-shared-expenses/:expenseId', async (req: Request, res: Response) => {
  const authUser = (req as Request & { user?: AuthPayload }).user;
  const tenantId = (req as unknown as TenantScopedRequest).tenantId;
  if (!authUser?.userId) {
    res.status(401).json({ error: '인증이 필요합니다.' });
    return;
  }

  const expenseId =
    typeof req.params.expenseId === 'string' ? req.params.expenseId.trim() : '';
  if (!expenseId) {
    res.status(400).json({ error: 'expenseId가 필요합니다.' });
    return;
  }

  const body = req.body as { password?: unknown };
  const password = body.password != null ? String(body.password).trim() : '';
  if (!password) {
    res.status(400).json({ error: '비밀번호를 입력해주세요.' });
    return;
  }

  const dbUser = await prisma.user.findFirst({
    where: { id: authUser.userId, tenantId },
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

  const deleted = await deletePayrollAdminSharedExpenseById(prisma, tenantId, expenseId);
  if (!deleted) {
    res.status(404).json({ error: '지출 내역을 찾을 수 없습니다.' });
    return;
  }

  res.json({ ok: true });
});

/** 급여표 정산 탭 수입 — 귀속 월별 입금 기록(참고용) */
router.get('/income-deposits', async (req, res) => {
  const tenantId = (req as unknown as TenantScopedRequest).tenantId;
  const raw = typeof req.query.month === 'string' ? req.query.month.trim() : '';
  const monthKey =
    raw && MONTH_KEY.test(raw)
      ? raw
      : new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 7);

  if (!kstMonthRangeYm(monthKey)) {
    res.status(400).json({ error: 'month는 YYYY-MM 형식이어야 합니다.' });
    return;
  }

  const rows = await listPayrollIncomeDepositsForMonth(prisma, tenantId, monthKey);
  res.json({
    month: monthKey,
    items: rows.map((row) => ({
      id: row.id,
      depositedOnYmd: dateOnlyToYmd(row.depositedOn),
      amount: row.amount,
      memo: row.memo,
      createdAt: row.createdAt.toISOString(),
      createdBy: row.createdBy,
    })),
  });
});

router.post('/income-deposits', async (req: Request, res: Response) => {
  const authUser = (req as Request & { user?: AuthPayload }).user;
  const tenantId = (req as unknown as TenantScopedRequest).tenantId;
  if (!authUser?.userId) {
    res.status(401).json({ error: '인증이 필요합니다.' });
    return;
  }

  const body = req.body as { month?: unknown; depositedOn?: unknown; amount?: unknown; memo?: unknown };
  const monthRaw = typeof body.month === 'string' ? body.month.trim() : '';
  const monthKey =
    monthRaw && MONTH_KEY.test(monthRaw)
      ? monthRaw
      : new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 7);

  if (!kstMonthRangeYm(monthKey)) {
    res.status(400).json({ error: 'month는 YYYY-MM 형식이어야 합니다.' });
    return;
  }

  const depRaw = typeof body.depositedOn === 'string' ? body.depositedOn.trim() : '';
  const depDt = parseYmdDateOnly(depRaw);
  if (!depDt) {
    res.status(400).json({ error: '입금일은 YYYY-MM-DD 형식으로 입력해 주세요.' });
    return;
  }

  const amtRaw = body.amount;
  const amount =
    typeof amtRaw === 'number' && Number.isFinite(amtRaw)
      ? Math.floor(amtRaw)
      : typeof amtRaw === 'string'
        ? parseInt(amtRaw.replace(/,/g, '').trim(), 10)
        : NaN;
  if (!Number.isFinite(amount) || amount < 1 || amount > 1_000_000_000) {
    res.status(400).json({ error: '금액은 1원 이상 유효한 숫자로 입력해 주세요.' });
    return;
  }

  let memo: string | null = null;
  if (typeof body.memo === 'string') {
    const t = body.memo.trim();
    memo = t.length > 2000 ? t.slice(0, 2000) : t.length ? t : null;
  }

  const row = await createPayrollIncomeDeposit(prisma, {
    tenantId,
    monthKey,
    depositedOn: depDt,
    amount,
    memo,
    createdById: authUser.userId,
  });

  res.status(201).json({
    ok: true,
    item: {
      id: row.id,
      depositedOnYmd: dateOnlyToYmd(row.depositedOn),
      amount: row.amount,
      memo: row.memo,
      createdAt: row.createdAt.toISOString(),
      createdBy: row.createdBy,
    },
  });
});

router.delete('/income-deposits/:depositId', async (req: Request, res: Response) => {
  const authUser = (req as Request & { user?: AuthPayload }).user;
  const tenantId = (req as unknown as TenantScopedRequest).tenantId;
  if (!authUser?.userId) {
    res.status(401).json({ error: '인증이 필요합니다.' });
    return;
  }

  const depositId = typeof req.params.depositId === 'string' ? req.params.depositId.trim() : '';
  if (!depositId) {
    res.status(400).json({ error: 'depositId가 필요합니다.' });
    return;
  }

  const body = req.body as { password?: unknown };
  const password = body.password != null ? String(body.password).trim() : '';
  if (!password) {
    res.status(400).json({ error: '비밀번호를 입력해주세요.' });
    return;
  }

  const dbUser = await prisma.user.findFirst({
    where: { id: authUser.userId, tenantId },
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

  const deleted = await deletePayrollIncomeDepositById(prisma, tenantId, depositId);
  if (!deleted) {
    res.status(404).json({ error: '입금 내역을 찾을 수 없습니다.' });
    return;
  }

  res.json({ ok: true });
});

export default router;
