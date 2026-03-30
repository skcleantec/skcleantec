import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import type { InquiryStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { authMiddleware } from '../auth/auth.middleware.js';
import { adminOrMarketer } from '../auth/auth.middleware.js';
import type { AuthPayload } from '../auth/auth.middleware.js';
import { createdAtRangeFromQuery } from './inquiryListDateRange.js';
import {
  buildMarketerOverview,
  whereInquiryAttributedToMarketer,
} from './inquiryMarketerOverview.js';
import {
  buildAmountDateChangeLines,
  buildInquiryPatchData,
  projectAfterPatch,
} from './inquiryPatch.helpers.js';
import {
  filterExistingProfessionalOptionIds,
  parseProfessionalOptionIdsRaw,
} from '../orderform/specialtyOptions.js';

const router = Router();

const inquiryDetailInclude = {
  createdBy: { select: { id: true, name: true } },
  assignments: {
    include: { teamLeader: { select: { id: true, name: true } } },
  },
  orderForm: {
    select: {
      id: true,
      totalAmount: true,
      depositAmount: true,
      balanceAmount: true,
      createdBy: { select: { id: true, name: true } },
    },
  },
  changeLogs: {
    orderBy: { createdAt: 'desc' as const },
    take: 30,
    select: { id: true, createdAt: true, lines: true },
  },
};

router.use(authMiddleware);
router.use(adminOrMarketer);

/** 마케터별 이번 달·오늘 접수 건수 (목록 필터와 무관, 접수일 KST) */
router.get('/marketer-overview', async (_req, res) => {
  try {
    const data = await buildMarketerOverview();
    res.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('marketer-overview error:', msg, err);
    const hint =
      process.env.NODE_ENV !== 'production'
        ? `${msg}`
        : '마케터별 집계를 불러올 수 없습니다.';
    res.status(500).json({ error: hint });
  }
});

router.get('/', async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user;
  const { status, limit = '200', offset = '0', search, datePreset, month, day, createdById } = req.query;
  const range = createdAtRangeFromQuery({
    datePreset: typeof datePreset === 'string' ? datePreset : undefined,
    month: typeof month === 'string' ? month : undefined,
    day: typeof day === 'string' ? day : undefined,
  });

  const andClauses: Prisma.InquiryWhereInput[] = [];
  if (range) {
    andClauses.push({ createdAt: { gte: range.gte, lte: range.lte } });
  }
  if (status && typeof status === 'string') {
    andClauses.push({ status: status as InquiryStatus });
  }
  if (search && typeof search === 'string' && search.trim()) {
    const s = search.trim();
    andClauses.push({
      OR: [{ customerName: { contains: s } }, { customerPhone: { contains: s } }],
    });
  }
  /** 마케터: 본인 접수(또는 구 데이터 발주서 작성자)만. 관리자: 선택 시 해당 마케터만 */
  if (user.role === 'MARKETER') {
    andClauses.push(whereInquiryAttributedToMarketer(user.userId));
  } else if (user.role === 'ADMIN' && typeof createdById === 'string' && createdById.trim()) {
    andClauses.push(whereInquiryAttributedToMarketer(createdById.trim()));
  }

  const where: Prisma.InquiryWhereInput = andClauses.length > 0 ? { AND: andClauses } : {};
  const listInclude = {
    createdBy: { select: { id: true, name: true } },
    assignments: {
      include: { teamLeader: { select: { id: true, name: true } } },
    },
    orderForm: {
      select: {
        id: true,
        totalAmount: true,
        depositAmount: true,
        balanceAmount: true,
        createdBy: { select: { id: true, name: true } },
      },
    },
    changeLogs: {
      orderBy: { createdAt: 'desc' as const },
      take: 25,
      select: { id: true, createdAt: true, lines: true },
    },
  } as const;

  const [items, total] = await Promise.all([
    prisma.inquiry.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string, 10),
      skip: parseInt(offset as string, 10),
      include: listInclude,
    }),
    prisma.inquiry.count({ where }),
  ]);
  res.json({ items, total });
});

router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const body = req.body as Record<string, unknown>;
  const user = (req as unknown as { user: AuthPayload }).user;
  const inquiry = await prisma.inquiry.findUnique({
    where: { id },
    include: { orderForm: { select: { createdById: true } } },
  });
  if (!inquiry) {
    res.status(404).json({ error: '문의를 찾을 수 없습니다.' });
    return;
  }
  if (user.role === 'MARKETER') {
    const mine =
      inquiry.createdById === user.userId ||
      (inquiry.createdById == null && inquiry.orderForm?.createdById === user.userId);
    if (!mine) {
      res.status(403).json({ error: '본인이 접수한 건만 수정할 수 있습니다.' });
      return;
    }
  }
  const data = buildInquiryPatchData(body);
  if (body.professionalOptionIds !== undefined) {
    const raw = parseProfessionalOptionIdsRaw(body.professionalOptionIds);
    data.professionalOptionIds = await filterExistingProfessionalOptionIds(prisma, raw);
  }
  if (Object.keys(data).length === 0) {
    const unchanged = await prisma.inquiry.findUnique({
      where: { id },
      include: inquiryDetailInclude,
    });
    res.json(unchanged);
    return;
  }
  const beforeSnap = {
    preferredDate: inquiry.preferredDate,
    serviceTotalAmount: inquiry.serviceTotalAmount,
    serviceDepositAmount: inquiry.serviceDepositAmount,
    serviceBalanceAmount: inquiry.serviceBalanceAmount,
  };
  const afterSnap = projectAfterPatch(inquiry, data);
  const lines = buildAmountDateChangeLines(beforeSnap, afterSnap);

  await prisma.$transaction(async (tx) => {
    await tx.inquiry.update({ where: { id }, data });
    if (lines.length > 0) {
      await tx.inquiryChangeLog.create({
        data: {
          inquiryId: id,
          actorId: user?.userId ?? null,
          lines,
        },
      });
    }
  });

  const updated = await prisma.inquiry.findUnique({
    where: { id },
    include: inquiryDetailInclude,
  });
  res.json(updated);
});

const CREATE_STATUSES: InquiryStatus[] = [
  'PENDING',
  'RECEIVED',
  'ASSIGNED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'CS_PROCESSING',
];

router.post('/', async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const user = (req as unknown as { user: AuthPayload }).user;
  const rawStatus = body.status != null ? String(body.status) : '';
  const status: InquiryStatus =
    rawStatus && CREATE_STATUSES.includes(rawStatus as InquiryStatus)
      ? (rawStatus as InquiryStatus)
      : 'RECEIVED';

  const inquiry = await prisma.inquiry.create({
    data: {
      createdById: user?.userId ?? null,
      customerName: String(body.customerName ?? ''),
      customerPhone: String(body.customerPhone ?? ''),
      customerPhone2: body.customerPhone2 ? String(body.customerPhone2) : null,
      address: String(body.address ?? ''),
      addressDetail: body.addressDetail ? String(body.addressDetail) : null,
      areaPyeong: body.areaPyeong != null ? Number(body.areaPyeong) : null,
      areaBasis: body.areaBasis ? String(body.areaBasis) : null,
      propertyType: body.propertyType ? String(body.propertyType) : null,
      roomCount: body.roomCount != null ? Number(body.roomCount) : null,
      bathroomCount: body.bathroomCount != null ? Number(body.bathroomCount) : null,
      balconyCount: body.balconyCount != null ? Number(body.balconyCount) : null,
      preferredDate: body.preferredDate ? new Date(body.preferredDate as string) : null,
      preferredTime: body.preferredTime ? String(body.preferredTime) : null,
      preferredTimeDetail: body.preferredTimeDetail ? String(body.preferredTimeDetail) : null,
      callAttempt: body.callAttempt != null ? Number(body.callAttempt) : null,
      memo: body.memo ? String(body.memo) : null,
      source: body.source ? String(body.source) : '전화',
      status,
    },
  });
  res.status(201).json(inquiry);
});

export default router;
