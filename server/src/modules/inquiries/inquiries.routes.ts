import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { authMiddleware } from '../auth/auth.middleware.js';
import { adminOnly } from '../auth/auth.middleware.js';
import type { AuthPayload } from '../auth/auth.middleware.js';
import {
  buildAmountDateChangeLines,
  buildInquiryPatchData,
  projectAfterPatch,
} from './inquiryPatch.helpers.js';

const router = Router();

const inquiryDetailInclude = {
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
router.use(adminOnly);

router.get('/', async (req, res) => {
  const { status, limit = '50', offset = '0', search } = req.query;
  const where: Record<string, unknown> = status ? { status: status as string } : {};
  if (search && typeof search === 'string' && search.trim()) {
    where.OR = [
      { customerName: { contains: search.trim() } },
      { customerPhone: { contains: search.trim() } },
    ];
  }
  const [items, total] = await Promise.all([
    prisma.inquiry.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string, 10),
      skip: parseInt(offset as string, 10),
      include: {
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
      },
    }),
    prisma.inquiry.count({ where }),
  ]);
  res.json({ items, total });
});

router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const body = req.body as Record<string, unknown>;
  const user = (req as unknown as { user: AuthPayload }).user;
  const inquiry = await prisma.inquiry.findUnique({ where: { id } });
  if (!inquiry) {
    res.status(404).json({ error: '문의를 찾을 수 없습니다.' });
    return;
  }
  const data = buildInquiryPatchData(body);
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

router.post('/', async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const inquiry = await prisma.inquiry.create({
    data: {
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
    },
  });
  res.status(201).json(inquiry);
});

export default router;
