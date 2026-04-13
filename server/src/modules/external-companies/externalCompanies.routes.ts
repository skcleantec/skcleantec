import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../../lib/prisma.js';
import { authMiddleware, adminOnly } from '../auth/auth.middleware.js';

const router = Router();

router.use(authMiddleware);
router.use(adminOnly);

const YMD = /^\d{4}-\d{2}-\d{2}$/;

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
  const taken = await prisma.user.findUnique({ where: { email } });
  if (taken) {
    res.status(400).json({ error: '이미 사용 중인 아이디입니다.' });
    return;
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const result = await prisma.$transaction(async (tx) => {
    const company = await tx.externalCompany.create({
      data: {
        name,
        bizNumber: body.bizNumber ? String(body.bizNumber).trim() || null : null,
        phone: body.phone ? String(body.phone).trim() || null : null,
        memo: body.memo ? String(body.memo).trim() || null : null,
      },
    });
    const user = await tx.user.create({
      data: {
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

/**
 * 타업체별 넘김 수수료 집계 (기간: 예약일 preferredDate KST)
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
      status: { not: 'CANCELLED' },
      externalTransferFee: { not: null },
    },
    select: {
      id: true,
      inquiryNumber: true,
      customerName: true,
      externalTransferFee: true,
      preferredDate: true,
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
    inquiryCount: number;
    feeSum: number;
  };
  const byCompany = new Map<string, Row>();
  let unassignedFee = 0;
  let unassignedCount = 0;

  for (const inq of inquiries) {
    const fee = inq.externalTransferFee ?? 0;
    const extAssign = inq.assignments.find((a) => a.teamLeader.role === 'EXTERNAL_PARTNER');
    const cid = extAssign?.teamLeader.externalCompanyId;
    const cname = extAssign?.teamLeader.externalCompany?.name;
    if (cid && cname) {
      const prev = byCompany.get(cid);
      if (prev) {
        prev.inquiryCount += 1;
        prev.feeSum += fee;
      } else {
        byCompany.set(cid, {
          externalCompanyId: cid,
          companyName: cname,
          inquiryCount: 1,
          feeSum: fee,
        });
      }
    } else {
      unassignedCount += 1;
      unassignedFee += fee;
    }
  }

  const rows = [...byCompany.values()].sort((a, b) => b.feeSum - a.feeSum);
  const grandTotal = rows.reduce((s, r) => s + r.feeSum, 0) + unassignedFee;

  res.json({
    from,
    to,
    rows,
    unassigned: unassignedCount > 0 ? { inquiryCount: unassignedCount, feeSum: unassignedFee } : null,
    grandTotal,
  });
});

export default router;
