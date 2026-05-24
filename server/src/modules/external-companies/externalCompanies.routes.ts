import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../../lib/prisma.js';
import { authMiddleware, adminOrMarketer, type AuthPayload } from '../auth/auth.middleware.js';
import { getTenantIdFromAuth } from '../tenants/tenant.middleware.js';
import { resolveExternalSettlementPaidAt } from '../../lib/externalSettlementPaidAt.js';

const router = Router();

router.use(authMiddleware);
/** 관리자·마케터(타업체·정산) — `adminOnly`이면 비관리자 계정(마케터)이 정산 POST/목록 403 */
router.use(adminOrMarketer);

const YMD = /^\d{4}-\d{2}-\d{2}$/;
const YM = /^\d{4}-\d{2}$/;

function kstYmd(d: Date): string {
  return d.toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10);
}

/** 타업체 목록 + 소속 로그인 계정 수 */
router.get('/', async (_req, res) => {
  const rows = await prisma.externalCompany.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
    include: {
      _count: { select: { partnerUsers: true } },
      partnerUsers: {
        where: { isActive: true },
        select: { id: true, email: true, name: true, phone: true },
      },
    },
  });
  res.json({
    items: rows.map((r) => ({
      id: r.id,
      name: r.name,
      bizNumber: r.bizNumber,
      phone: r.phone,
      memo: r.memo,
      partnerUserCount: r._count.partnerUsers,
      partnerUsers: r.partnerUsers,
    })),
  });
});

/**
 * 타업체 등록 + 로그인 계정 1개(EXTERNAL_PARTNER)
 * body: { name, bizNumber?, phone?, memo?, login: { email, password, contactName, phone? } }
 */
router.post('/', async (req, res) => {
  const authUser = (req as unknown as { user: AuthPayload }).user;
  const tenantId = getTenantIdFromAuth(authUser);
  if (!tenantId) {
    res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
    return;
  }
  const body = req.body as {
    name?: string;
    bizNumber?: string;
    phone?: string;
    memo?: string;
    login?: { email?: string; password?: string; contactName?: string; phone?: string };
  };
  const name = String(body.name ?? '').trim();
  if (!name) {
    res.status(400).json({ error: '업체명을 입력해주세요.' });
    return;
  }
  const login = body.login;
  const email = String(login?.email ?? '')
    .trim()
    .toLowerCase();
  const password = login?.password != null ? String(login.password) : '';
  const contactName = String(login?.contactName ?? '').trim();
  if (!email || !password || !contactName) {
    res.status(400).json({ error: '로그인 아이디·비밀번호·담당자 이름을 입력해주세요.' });
    return;
  }
  const taken = await prisma.user.findUnique({
    where: { tenantId_email: { tenantId, email } },
  });
  if (taken) {
    res.status(400).json({ error: '이미 사용 중인 아이디입니다.' });
    return;
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const result = await prisma.$transaction(async (tx) => {
    const company = await tx.externalCompany.create({
      data: {
        tenantId,
        name,
        bizNumber: body.bizNumber ? String(body.bizNumber).trim() || null : null,
        phone: body.phone ? String(body.phone).trim() || null : null,
        memo: body.memo ? String(body.memo).trim() || null : null,
      },
    });
    const user = await tx.user.create({
      data: {
        tenantId,
        email,
        passwordHash,
        name: contactName,
        phone: login?.phone ? String(login.phone).trim() || null : null,
        role: 'EXTERNAL_PARTNER',
        externalCompanyId: company.id,
      },
      select: { id: true, email: true, name: true, phone: true },
    });
    return { company, user };
  });
  res.status(201).json({
    company: {
      id: result.company.id,
      name: result.company.name,
      bizNumber: result.company.bizNumber,
      phone: result.company.phone,
      memo: result.company.memo,
    },
    user: result.user,
  });
});

router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const body = req.body as {
    name?: string;
    bizNumber?: string | null;
    phone?: string | null;
    memo?: string | null;
  };
  const existing = await prisma.externalCompany.findFirst({ where: { id, isActive: true } });
  if (!existing) {
    res.status(404).json({ error: '타업체를 찾을 수 없습니다.' });
    return;
  }
  const data: {
    name?: string;
    bizNumber?: string | null;
    phone?: string | null;
    memo?: string | null;
  } = {};
  if (body.name != null) {
    const n = String(body.name).trim();
    if (!n) {
      res.status(400).json({ error: '업체명을 입력해주세요.' });
      return;
    }
    data.name = n;
  }
  if (body.bizNumber !== undefined) {
    data.bizNumber = body.bizNumber == null || String(body.bizNumber).trim() === '' ? null : String(body.bizNumber).trim();
  }
  if (body.phone !== undefined) {
    data.phone = body.phone == null || String(body.phone).trim() === '' ? null : String(body.phone).trim();
  }
  if (body.memo !== undefined) {
    data.memo = body.memo == null || String(body.memo).trim() === '' ? null : String(body.memo).trim();
  }
  if (Object.keys(data).length === 0) {
    res.json({
      id: existing.id,
      name: existing.name,
      bizNumber: existing.bizNumber,
      phone: existing.phone,
      memo: existing.memo,
    });
    return;
  }
  const updated = await prisma.externalCompany.update({
    where: { id },
    data,
  });
  res.json({
    id: updated.id,
    name: updated.name,
    bizNumber: updated.bizNumber,
    phone: updated.phone,
    memo: updated.memo,
  });
});

/** 타업체 비활성 + 소속 계정 비활성 */
router.post('/:id/deactivate', async (req, res) => {
  const { id } = req.params;
  const existing = await prisma.externalCompany.findFirst({ where: { id, isActive: true } });
  if (!existing) {
    res.status(404).json({ error: '타업체를 찾을 수 없습니다.' });
    return;
  }
  await prisma.$transaction(async (tx) => {
    await tx.externalCompany.update({ where: { id }, data: { isActive: false } });
    await tx.user.updateMany({
      where: { externalCompanyId: id, role: 'EXTERNAL_PARTNER' },
      data: { isActive: false },
    });
  });
  res.json({ ok: true });
});

/** 업체별 누적 정산 요약 목록 (전체 기간) */
router.get('/settlement/company-overview-list', async (_req, res) => {
  const companies = await prisma.externalCompany.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
  const signedByCompany = new Map<string, number>();
  for (const c of companies) signedByCompany.set(c.id, 0);

  const activeRows = await prisma.inquiry.findMany({
    where: {
      externalTransferFee: { not: null },
      status: { notIn: ['CANCELLED', 'ON_HOLD'] },
      assignments: {
        some: { teamLeader: { role: 'EXTERNAL_PARTNER', externalCompanyId: { not: null } } },
      },
    },
    select: {
      externalTransferFee: true,
      assignments: {
        orderBy: { sortOrder: 'asc' },
        select: { teamLeader: { select: { role: true, externalCompanyId: true } } },
      },
    },
  });
  for (const r of activeRows) {
    const ext = r.assignments.find((a) => a.teamLeader.role === 'EXTERNAL_PARTNER' && a.teamLeader.externalCompanyId);
    const cid = ext?.teamLeader.externalCompanyId ?? null;
    if (!cid || !signedByCompany.has(cid)) continue;
    signedByCompany.set(cid, (signedByCompany.get(cid) ?? 0) + (r.externalTransferFee ?? 0));
  }

  const cancelledRows = await prisma.inquiry.findMany({
    where: {
      status: 'CANCELLED',
      externalTransferFee: { not: null },
      OR: [
        { cancelFeeExternalCompanyId: { not: null } },
        {
          assignments: {
            some: { teamLeader: { role: 'EXTERNAL_PARTNER', externalCompanyId: { not: null } } },
          },
        },
      ],
    },
    select: {
      externalTransferFee: true,
      cancelFeeExternalCompanyId: true,
      assignments: {
        orderBy: { sortOrder: 'asc' },
        select: { teamLeader: { select: { role: true, externalCompanyId: true } } },
      },
    },
  });
  for (const r of cancelledRows) {
    const ext = r.assignments.find((a) => a.teamLeader.role === 'EXTERNAL_PARTNER' && a.teamLeader.externalCompanyId);
    const cid = r.cancelFeeExternalCompanyId ?? ext?.teamLeader.externalCompanyId ?? null;
    if (!cid || !signedByCompany.has(cid)) continue;
    signedByCompany.set(cid, (signedByCompany.get(cid) ?? 0) - (r.externalTransferFee ?? 0));
  }

  const paidRows = await prisma.externalCompanySettlementPayment.groupBy({
    by: ['externalCompanyId'],
    _sum: { amount: true },
  });
  const paidByCompany = new Map<string, number>();
  for (const r of paidRows) paidByCompany.set(r.externalCompanyId, r._sum.amount ?? 0);

  res.json({
    items: companies.map((c) => {
      const payableAmount = signedByCompany.get(c.id) ?? 0;
      const paidAmount = paidByCompany.get(c.id) ?? 0;
      return {
        externalCompanyId: c.id,
        companyName: c.name,
        payableAmount,
        paidAmount,
        remainingAmount: payableAmount - paidAmount,
      };
    }),
  });
});

/**
 * 타업체별 수수료 집계 (기간: 예약일 preferredDate KST)
 * query: from, to (yyyy-mm-dd)
 */
router.get('/settlement/summary', async (req, res) => {
  const from = typeof req.query.from === 'string' ? req.query.from.trim() : '';
  const to = typeof req.query.to === 'string' ? req.query.to.trim() : '';
  if (!YMD.test(from) || !YMD.test(to)) {
    res.status(400).json({ error: 'from, to는 YYYY-MM-DD 형식이 필요합니다.' });
    return;
  }
  const startDate = new Date(`${from}T00:00:00.000+09:00`);
  const endDate = new Date(`${to}T23:59:59.999+09:00`);

  const inquiries = await prisma.inquiry.findMany({
    where: {
      preferredDate: { gte: startDate, lte: endDate },
      externalTransferFee: { not: null },
      /** 보류는 수수료 집계 제외(취소는 마이너스 반영) */
      status: { not: 'ON_HOLD' },
    },
    select: {
      id: true,
      inquiryNumber: true,
      customerName: true,
      externalTransferFee: true,
      preferredDate: true,
      status: true,
      cancelFeeExternalCompanyId: true,
      cancelFeeExternalCompany: { select: { id: true, name: true } },
      assignments: {
        orderBy: { sortOrder: 'asc' },
        select: {
          teamLeader: {
            select: {
              role: true,
              externalCompanyId: true,
              externalCompany: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
  });

  type Row = {
    externalCompanyId: string;
    companyName: string;
    /** 취소 제외 건수 */
    inquiryCount: number;
    /** 기간 내 취소 건수(수수료 차감 대상) */
    cancelledInquiryCount: number;
    /** 활성(+), 취소(-) 합산 순액 */
    feeSum: number;
  };
  const byCompany = new Map<string, Row>();
  let unassignedFee = 0;
  let unassignedActive = 0;
  let unassignedCancelled = 0;

  for (const inq of inquiries) {
    const fee = inq.externalTransferFee ?? 0;
    const extAssign = inq.assignments.find((a) => a.teamLeader.role === 'EXTERNAL_PARTNER');
    const isCancelled = inq.status === 'CANCELLED';
    const cid = isCancelled
      ? (inq.cancelFeeExternalCompanyId ?? extAssign?.teamLeader.externalCompanyId ?? null)
      : (extAssign?.teamLeader.externalCompanyId ?? null);
    const cname =
      inq.cancelFeeExternalCompany?.name ?? extAssign?.teamLeader.externalCompany?.name ?? null;
    const sign = isCancelled ? -1 : 1;
    if (cid && cname) {
      const prev = byCompany.get(cid);
      if (prev) {
        if (isCancelled) prev.cancelledInquiryCount += 1;
        else prev.inquiryCount += 1;
        prev.feeSum += sign * fee;
      } else {
        byCompany.set(cid, {
          externalCompanyId: cid,
          companyName: cname,
          inquiryCount: isCancelled ? 0 : 1,
          cancelledInquiryCount: isCancelled ? 1 : 0,
          feeSum: sign * fee,
        });
      }
    } else {
      unassignedFee += sign * fee;
      if (isCancelled) unassignedCancelled += 1;
      else unassignedActive += 1;
    }
  }

  const rows = [...byCompany.values()].sort((a, b) => b.feeSum - a.feeSum);
  const grandTotal = rows.reduce((s, r) => s + r.feeSum, 0) + unassignedFee;
  const unassignedTotalCount = unassignedActive + unassignedCancelled;

  res.json({
    from,
    to,
    rows,
    unassigned:
      unassignedTotalCount > 0
        ? {
            inquiryCount: unassignedActive,
            cancelledInquiryCount: unassignedCancelled,
            feeSum: unassignedFee,
          }
        : null,
    grandTotal,
  });
});

/** 월별/업체별/전체 정산 요약 */
router.get('/settlement/monthly-overview', async (req, res) => {
  const fromMonthRaw = typeof req.query.fromMonth === 'string' ? req.query.fromMonth.trim() : '';
  const toMonthRaw = typeof req.query.toMonth === 'string' ? req.query.toMonth.trim() : '';
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const fromMonth = YM.test(fromMonthRaw) ? fromMonthRaw : defaultMonth;
  const toMonth = YM.test(toMonthRaw) ? toMonthRaw : defaultMonth;
  const loMonth = fromMonth <= toMonth ? fromMonth : toMonth;
  const hiMonth = fromMonth <= toMonth ? toMonth : fromMonth;
  const startDate = new Date(`${loMonth}-01T00:00:00.000+09:00`);
  const [toY, toM] = hiMonth.split('-').map(Number);
  const endDate = new Date(new Date(toY, toM, 0).toISOString().slice(0, 10) + 'T23:59:59.999+09:00');

  const inquiries = await prisma.inquiry.findMany({
    where: {
      preferredDate: { gte: startDate, lte: endDate },
      externalTransferFee: { not: null },
      status: { not: 'ON_HOLD' },
    },
    select: {
      preferredDate: true,
      status: true,
      externalTransferFee: true,
      cancelFeeExternalCompanyId: true,
      cancelFeeExternalCompany: { select: { id: true, name: true } },
      assignments: {
        orderBy: { sortOrder: 'asc' },
        select: {
          teamLeader: {
            select: {
              role: true,
              externalCompanyId: true,
              externalCompany: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
  });

  const payments = await prisma.externalCompanySettlementPayment.findMany({
    where: { paidAt: { gte: startDate, lte: endDate } },
    select: {
      externalCompanyId: true,
      amount: true,
      paidAt: true,
      externalCompany: { select: { id: true, name: true } },
    },
  });

  const companyNameById = new Map<string, string>();
  const payableByMonthCompany = new Map<string, number>();
  const paidByMonthCompany = new Map<string, number>();
  const monthSet = new Set<string>();

  for (const inq of inquiries) {
    if (!inq.preferredDate) continue;
    const monthKey = kstYmd(inq.preferredDate).slice(0, 7);
    monthSet.add(monthKey);
    const fee = inq.externalTransferFee ?? 0;
    const extAssign = inq.assignments.find((a) => a.teamLeader.role === 'EXTERNAL_PARTNER');
    const isCancelled = inq.status === 'CANCELLED';
    const cid = isCancelled
      ? (inq.cancelFeeExternalCompanyId ?? extAssign?.teamLeader.externalCompanyId ?? null)
      : (extAssign?.teamLeader.externalCompanyId ?? null);
    const cname = inq.cancelFeeExternalCompany?.name ?? extAssign?.teamLeader.externalCompany?.name ?? null;
    if (!cid || !cname) continue;
    companyNameById.set(cid, cname);
    const key = `${monthKey}|${cid}`;
    const prev = payableByMonthCompany.get(key) ?? 0;
    const signed = isCancelled ? -fee : fee;
    payableByMonthCompany.set(key, prev + signed);
  }

  for (const p of payments) {
    const monthKey = kstYmd(p.paidAt).slice(0, 7);
    monthSet.add(monthKey);
    const cid = p.externalCompanyId;
    const cname = p.externalCompany?.name ?? null;
    if (cname) companyNameById.set(cid, cname);
    const key = `${monthKey}|${cid}`;
    paidByMonthCompany.set(key, (paidByMonthCompany.get(key) ?? 0) + p.amount);
  }

  const months = [...monthSet].filter((m) => m >= loMonth && m <= hiMonth).sort();
  const companyIds = [...companyNameById.keys()].sort((a, b) => {
    const an = companyNameById.get(a) ?? '';
    const bn = companyNameById.get(b) ?? '';
    return an.localeCompare(bn, 'ko-KR');
  });

  let cumulativeOverallRemaining = 0;
  const cumulativeByCompany = new Map<string, number>();
  const monthRows = months.map((month) => {
    const companies = companyIds
      .map((cid) => {
        const key = `${month}|${cid}`;
        const payableAmount = payableByMonthCompany.get(key) ?? 0;
        const paidAmount = paidByMonthCompany.get(key) ?? 0;
        const remainingAmount = payableAmount - paidAmount;
        if (payableAmount === 0 && paidAmount === 0) return null;
        const prev = cumulativeByCompany.get(cid) ?? 0;
        const cumulativeRemaining = prev + remainingAmount;
        cumulativeByCompany.set(cid, cumulativeRemaining);
        return {
          externalCompanyId: cid,
          companyName: companyNameById.get(cid) ?? cid,
          payableAmount,
          paidAmount,
          remainingAmount,
          cumulativeRemaining,
        };
      })
      .filter((x): x is NonNullable<typeof x> => Boolean(x));
    const totalPayable = companies.reduce((s, c) => s + c.payableAmount, 0);
    const totalPaid = companies.reduce((s, c) => s + c.paidAmount, 0);
    const totalRemaining = totalPayable - totalPaid;
    cumulativeOverallRemaining += totalRemaining;
    return {
      month,
      totalPayable,
      totalPaid,
      totalRemaining,
      cumulativeOverallRemaining,
      companies,
    };
  });

  const overallPayable = monthRows.reduce((s, r) => s + r.totalPayable, 0);
  const overallPaid = monthRows.reduce((s, r) => s + r.totalPaid, 0);

  res.json({
    fromMonth: loMonth,
    toMonth: hiMonth,
    months: monthRows,
    overall: {
      payableAmount: overallPayable,
      paidAmount: overallPaid,
      remainingAmount: overallPayable - overallPaid,
    },
  });
});

/** 관리자: 특정 타업체 정산 상세(결제대상/정산완료/남은금액/히스토리) */
router.get('/settlement/company-detail', async (req, res) => {
  const externalCompanyId =
    typeof req.query.externalCompanyId === 'string' ? req.query.externalCompanyId.trim() : '';
  if (!externalCompanyId) {
    res.status(400).json({ error: 'externalCompanyId가 필요합니다.' });
    return;
  }
  const company = await prisma.externalCompany.findFirst({
    where: { id: externalCompanyId, isActive: true },
    select: { id: true, name: true },
  });
  if (!company) {
    res.status(404).json({ error: '타업체를 찾을 수 없습니다.' });
    return;
  }
  const fromRaw = typeof req.query.from === 'string' ? req.query.from.trim() : '';
  const toRaw = typeof req.query.to === 'string' ? req.query.to.trim() : '';
  const now = new Date();
  const fallbackMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const fallbackFromYmd = `${fallbackMonth}-01`;
  const fromYmd = YMD.test(fromRaw) ? fromRaw : fallbackFromYmd;
  const toYmd = YMD.test(toRaw)
    ? toRaw
    : (() => {
        const tmp = new Date(`${fallbackFromYmd}T00:00:00+09:00`);
        const last = new Date(tmp.getFullYear(), tmp.getMonth() + 1, 0);
        return `${fallbackMonth}-${String(last.getDate()).padStart(2, '0')}`;
      })();
  const loYmd = fromYmd <= toYmd ? fromYmd : toYmd;
  const hiYmd = fromYmd <= toYmd ? toYmd : fromYmd;
  const from = new Date(`${loYmd}T00:00:00+09:00`);
  const to = new Date(`${hiYmd}T23:59:59.999+09:00`);

  const activeRows = await prisma.inquiry.findMany({
    where: {
      externalTransferFee: { not: null },
      preferredDate: { gte: from, lte: to },
      status: { notIn: ['CANCELLED', 'ON_HOLD'] },
      assignments: {
        some: {
          teamLeader: { role: 'EXTERNAL_PARTNER', externalCompanyId },
        },
      },
    },
    orderBy: [{ preferredDate: 'desc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      inquiryNumber: true,
      customerName: true,
      address: true,
      addressDetail: true,
      preferredDate: true,
      status: true,
      externalTransferFee: true,
    },
  });
  const cancelledRows = await prisma.inquiry.findMany({
    where: {
      status: 'CANCELLED',
      externalTransferFee: { not: null },
      preferredDate: { gte: from, lte: to },
      OR: [
        { cancelFeeExternalCompanyId: externalCompanyId },
        {
          assignments: {
            some: {
              teamLeader: { role: 'EXTERNAL_PARTNER', externalCompanyId },
            },
          },
        },
      ],
    },
    orderBy: [{ preferredDate: 'desc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      inquiryNumber: true,
      customerName: true,
      address: true,
      addressDetail: true,
      preferredDate: true,
      status: true,
      externalTransferFee: true,
    },
  });
  const items = [
    ...activeRows.map((r) => ({
      inquiryId: r.id,
      inquiryNumber: r.inquiryNumber ?? null,
      customerName: r.customerName,
      address: r.address,
      addressDetail: r.addressDetail ?? null,
      preferredDate: r.preferredDate ? r.preferredDate.toISOString() : null,
      status: r.status,
      isCancelled: false,
      feeAmount: r.externalTransferFee ?? 0,
      signedFeeAmount: r.externalTransferFee ?? 0,
    })),
    ...cancelledRows.map((r) => ({
      inquiryId: r.id,
      inquiryNumber: r.inquiryNumber ?? null,
      customerName: r.customerName,
      address: r.address,
      addressDetail: r.addressDetail ?? null,
      preferredDate: r.preferredDate ? r.preferredDate.toISOString() : null,
      status: r.status,
      isCancelled: true,
      feeAmount: r.externalTransferFee ?? 0,
      signedFeeAmount: -(r.externalTransferFee ?? 0),
    })),
  ].sort((a, b) => (b.preferredDate ?? '').localeCompare(a.preferredDate ?? ''));
  const inquiryCount = activeRows.length;
  const cancelledInquiryCount = cancelledRows.length;
  const totalFee = items.reduce((sum, it) => sum + it.signedFeeAmount, 0);

  const activeBeforeAgg = await prisma.inquiry.aggregate({
    where: {
      externalTransferFee: { not: null },
      preferredDate: { lt: from },
      status: { notIn: ['CANCELLED', 'ON_HOLD'] },
      assignments: {
        some: {
          teamLeader: { role: 'EXTERNAL_PARTNER', externalCompanyId },
        },
      },
    },
    _sum: { externalTransferFee: true },
  });
  const cancelledBeforeAgg = await prisma.inquiry.aggregate({
    where: {
      status: 'CANCELLED',
      externalTransferFee: { not: null },
      preferredDate: { lt: from },
      OR: [
        { cancelFeeExternalCompanyId: externalCompanyId },
        {
          assignments: {
            some: {
              teamLeader: { role: 'EXTERNAL_PARTNER', externalCompanyId },
            },
          },
        },
      ],
    },
    _sum: { externalTransferFee: true },
  });
  const signedBeforeRange =
    (activeBeforeAgg._sum.externalTransferFee ?? 0) - (cancelledBeforeAgg._sum.externalTransferFee ?? 0);

  const paidBeforeAgg = await prisma.externalCompanySettlementPayment.aggregate({
    where: { externalCompanyId, paidAt: { lt: from } },
    _sum: { amount: true },
  });
  const paidBeforeRange = paidBeforeAgg._sum.amount ?? 0;
  const paymentRows = await prisma.externalCompanySettlementPayment.findMany({
    where: { externalCompanyId, paidAt: { gte: from, lte: to } },
    orderBy: [{ paidAt: 'desc' }],
    select: {
      id: true,
      amount: true,
      paidAt: true,
      memo: true,
      actor: { select: { name: true, role: true } },
    },
  });
  const periodPaidAgg = await prisma.externalCompanySettlementPayment.aggregate({
    where: { externalCompanyId, paidAt: { gte: from, lte: to } },
    _sum: { amount: true },
  });
  const periodPaidAmount = periodPaidAgg._sum.amount ?? 0;
  const carryOverAmount = signedBeforeRange - paidBeforeRange;
  const payableAmount = carryOverAmount + totalFee;
  const remainingAmount = payableAmount - periodPaidAmount;

  res.json({
    month: loYmd.slice(0, 7),
    from: loYmd,
    to: hiYmd,
    externalCompanyId: company.id,
    externalCompanyName: company.name,
    inquiryCount,
    cancelledInquiryCount,
    totalCount: inquiryCount + cancelledInquiryCount,
    totalFee,
    carryOverAmount,
    payableAmount,
    periodPaidAmount,
    remainingAmount,
    payments: paymentRows.map((r) => ({
      id: r.id,
      amount: r.amount,
      paidAt: r.paidAt.toISOString(),
      memo: r.memo ?? null,
      actorName: r.actor?.name ?? null,
      actorRole: r.actor?.role ?? null,
    })),
    items,
  });
});

/**
 * 업체별 수수료 누계(마지막 「정산완료」 이후 구간 + 예약일 기준 일·월·년)
 * 타업체(EXTERNAL_PARTNER) 배정 접수만, 수수료 입력 건만 합산
 */
router.get('/settlement/accruals', async (_req, res) => {
  const now = new Date();
  const todayYmd = kstYmd(now);
  const monthKey = todayYmd.slice(0, 7);
  const yearPrefix = todayYmd.slice(0, 4);

  const companies = await prisma.externalCompany.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });

  const resets = await prisma.externalCompanySettlementReset.findMany({
    orderBy: { resetAt: 'desc' },
    select: { externalCompanyId: true, resetAt: true },
  });
  const lastResetByCompany = new Map<string, Date>();
  for (const r of resets) {
    if (!lastResetByCompany.has(r.externalCompanyId)) {
      lastResetByCompany.set(r.externalCompanyId, r.resetAt);
    }
  }

  const accrualSelect = {
    id: true,
    preferredDate: true,
    externalTransferFee: true,
    createdAt: true,
    updatedAt: true,
    status: true,
    cancelFeeExternalCompanyId: true,
    assignments: {
      orderBy: { sortOrder: 'asc' as const },
      select: {
        teamLeader: { select: { role: true, externalCompanyId: true } },
      },
    },
  };

  const activeInquiries = await prisma.inquiry.findMany({
    where: {
      externalTransferFee: { not: null },
      status: { notIn: ['CANCELLED', 'ON_HOLD'] },
      assignments: {
        some: {
          teamLeader: { role: 'EXTERNAL_PARTNER', externalCompanyId: { not: null } },
        },
      },
    },
    select: accrualSelect,
  });

  const cancelledInquiries = await prisma.inquiry.findMany({
    where: {
      status: 'CANCELLED',
      externalTransferFee: { not: null },
      OR: [
        { cancelFeeExternalCompanyId: { not: null } },
        {
          assignments: {
            some: {
              teamLeader: { role: 'EXTERNAL_PARTNER', externalCompanyId: { not: null } },
            },
          },
        },
      ],
    },
    select: accrualSelect,
  });

  type Acc = { sinceReset: number; today: number; month: number; year: number };
  const accByCompany = new Map<string, Acc>();
  for (const c of companies) {
    accByCompany.set(c.id, { sinceReset: 0, today: 0, month: 0, year: 0 });
  }

  const addSignedByPreferred = (cid: string, fee: number, sign: 1 | -1, inq: { preferredDate: Date | null }) => {
    const a = accByCompany.get(cid);
    if (!a) return;
    const v = sign * fee;
    a.sinceReset += v;
    if (inq.preferredDate) {
      const pYmd = kstYmd(inq.preferredDate);
      if (pYmd === todayYmd) a.today += v;
      if (pYmd.slice(0, 7) === monthKey) a.month += v;
      if (pYmd.slice(0, 4) === yearPrefix) a.year += v;
    }
  };

  for (const inq of activeInquiries) {
    const ext = inq.assignments.find(
      (a) => a.teamLeader.role === 'EXTERNAL_PARTNER' && a.teamLeader.externalCompanyId
    );
    const cid = ext?.teamLeader.externalCompanyId;
    if (!cid || !accByCompany.has(cid)) continue;

    const fee = inq.externalTransferFee ?? 0;
    const lastReset = lastResetByCompany.get(cid) ?? new Date(0);
    const activeSinceReset = inq.createdAt > lastReset || inq.updatedAt > lastReset;
    if (!activeSinceReset) continue;

    addSignedByPreferred(cid, fee, 1, inq);
  }

  for (const inq of cancelledInquiries) {
    const ext = inq.assignments.find(
      (a) => a.teamLeader.role === 'EXTERNAL_PARTNER' && a.teamLeader.externalCompanyId
    );
    const cid =
      inq.cancelFeeExternalCompanyId ?? ext?.teamLeader.externalCompanyId ?? null;
    if (!cid || !accByCompany.has(cid)) continue;

    const fee = inq.externalTransferFee ?? 0;
    const lastReset = lastResetByCompany.get(cid) ?? new Date(0);
    if (inq.updatedAt <= lastReset) continue;
    const createdAfterReset = inq.createdAt > lastReset;
    if (createdAfterReset && inq.updatedAt.getTime() - inq.createdAt.getTime() < 120_000) continue;

    addSignedByPreferred(cid, fee, -1, inq);
  }

  const items = companies.map((c) => ({
    externalCompanyId: c.id,
    companyName: c.name,
    lastResetAt: lastResetByCompany.get(c.id)?.toISOString() ?? null,
    sinceResetTotal: accByCompany.get(c.id)!.sinceReset,
    todayTotal: accByCompany.get(c.id)!.today,
    monthTotal: accByCompany.get(c.id)!.month,
    yearTotal: accByCompany.get(c.id)!.year,
  }));

  res.json({ todayYmd, monthKey, year: yearPrefix, items });
});

/** 정산 완료 후 누계 초기화(해당 업체만) */
router.post('/settlement/reset-accrual', async (req, res) => {
  const actorId = (req as unknown as { user: AuthPayload }).user.userId;
  const body = req.body as { externalCompanyId?: string };
  const id = typeof body.externalCompanyId === 'string' ? body.externalCompanyId.trim() : '';
  if (!id) {
    res.status(400).json({ error: 'externalCompanyId가 필요합니다.' });
    return;
  }
  const co = await prisma.externalCompany.findFirst({ where: { id, isActive: true } });
  if (!co) {
    res.status(404).json({ error: '타업체를 찾을 수 없습니다.' });
    return;
  }
  await prisma.externalCompanySettlementReset.create({
    data: {
      externalCompanyId: id,
      actorId,
    },
  });
  res.json({ ok: true });
});

/** 관리자: 타업체 정산완료(부분/전체) 금액 기록 */
router.post('/settlement/payments', async (req, res) => {
  const actorId = (req as unknown as { user: AuthPayload }).user.userId;
  const body = req.body as { externalCompanyId?: string; amount?: number; memo?: string; paidDate?: string };
  const externalCompanyId = typeof body.externalCompanyId === 'string' ? body.externalCompanyId.trim() : '';
  const amount = Number(body.amount);
  const memo = typeof body.memo === 'string' ? body.memo.trim() : '';
  const paidResolved = resolveExternalSettlementPaidAt(body.paidDate);
  if (!paidResolved.ok) {
    res.status(400).json({ error: paidResolved.error });
    return;
  }
  if (!externalCompanyId) {
    res.status(400).json({ error: 'externalCompanyId가 필요합니다.' });
    return;
  }
  if (!Number.isFinite(amount) || amount === 0) {
    res.status(400).json({
      error:
        '정산완료 금액은 0이 아닌 정수여야 합니다. 과납·오기입 보정은 마이너스 금액으로 입력할 수 있습니다.',
    });
    return;
  }
  const amountInt = Math.trunc(amount);
  const co = await prisma.externalCompany.findFirst({
    where: { id: externalCompanyId, isActive: true },
    select: { id: true },
  });
  if (!co) {
    res.status(404).json({ error: '타업체를 찾을 수 없습니다.' });
    return;
  }
  const row = await prisma.externalCompanySettlementPayment.create({
    data: {
      externalCompanyId,
      amount: amountInt,
      memo: memo || null,
      actorId,
      paidAt: paidResolved.paidAt,
    },
    select: { id: true, amount: true, paidAt: true },
  });
  res.json({
    ok: true,
    payment: {
      id: row.id,
      amount: row.amount,
      paidAt: row.paidAt.toISOString(),
    },
  });
});

export default router;
