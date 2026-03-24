import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { authMiddleware } from '../auth/auth.middleware.js';
import { adminOnly } from '../auth/auth.middleware.js';

const router = Router();

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
      },
    }),
    prisma.inquiry.count({ where }),
  ]);
  res.json({ items, total });
});

router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const body = req.body as Record<string, unknown>;
  const inquiry = await prisma.inquiry.findUnique({ where: { id } });
  if (!inquiry) {
    res.status(404).json({ error: '문의를 찾을 수 없습니다.' });
    return;
  }
  const updated = await prisma.inquiry.update({
    where: { id },
    data: {
      ...(body.customerName != null && { customerName: String(body.customerName) }),
      ...(body.customerPhone != null && { customerPhone: String(body.customerPhone) }),
      ...(body.customerPhone2 != null && {
        customerPhone2: body.customerPhone2 ? String(body.customerPhone2) : null,
      }),
      ...(body.address != null && { address: String(body.address) }),
      ...(body.addressDetail != null && { addressDetail: body.addressDetail ? String(body.addressDetail) : null }),
      ...(body.areaPyeong != null && { areaPyeong: Number(body.areaPyeong) }),
      ...(body.areaBasis != null && { areaBasis: body.areaBasis ? String(body.areaBasis) : null }),
      ...(body.propertyType != null && { propertyType: body.propertyType ? String(body.propertyType) : null }),
      ...(body.roomCount !== undefined && {
        roomCount:
          body.roomCount === null || body.roomCount === '' ? null : Number(body.roomCount),
      }),
      ...(body.bathroomCount !== undefined && {
        bathroomCount:
          body.bathroomCount === null || body.bathroomCount === '' ? null : Number(body.bathroomCount),
      }),
      ...(body.balconyCount !== undefined && {
        balconyCount:
          body.balconyCount === null || body.balconyCount === '' ? null : Number(body.balconyCount),
      }),
      ...(body.preferredDate != null && {
        preferredDate: body.preferredDate ? new Date(body.preferredDate as string) : null,
      }),
      ...(body.preferredTime != null && { preferredTime: body.preferredTime ? String(body.preferredTime) : null }),
      ...(body.preferredTimeDetail != null && {
        preferredTimeDetail: body.preferredTimeDetail ? String(body.preferredTimeDetail) : null,
      }),
      ...(body.buildingType !== undefined && {
        buildingType: body.buildingType ? String(body.buildingType) : null,
      }),
      ...(body.moveInDate !== undefined && {
        moveInDate: body.moveInDate ? new Date(String(body.moveInDate)) : null,
      }),
      ...(body.specialNotes !== undefined && {
        specialNotes: body.specialNotes ? String(body.specialNotes) : null,
      }),
      ...(body.kitchenCount !== undefined && {
        kitchenCount:
          body.kitchenCount === null || body.kitchenCount === ''
            ? null
            : Number(body.kitchenCount),
      }),
      ...(body.serviceTotalAmount !== undefined && {
        serviceTotalAmount:
          body.serviceTotalAmount === null || body.serviceTotalAmount === ''
            ? null
            : Number(body.serviceTotalAmount),
      }),
      ...(body.serviceDepositAmount !== undefined && {
        serviceDepositAmount:
          body.serviceDepositAmount === null || body.serviceDepositAmount === ''
            ? null
            : Number(body.serviceDepositAmount),
      }),
      ...(body.serviceBalanceAmount !== undefined && {
        serviceBalanceAmount:
          body.serviceBalanceAmount === null || body.serviceBalanceAmount === ''
            ? null
            : Number(body.serviceBalanceAmount),
      }),
      ...(body.memo != null && { memo: body.memo ? String(body.memo) : null }),
      ...(body.claimMemo != null && { claimMemo: body.claimMemo ? String(body.claimMemo) : null }),
      ...(body.status != null && { status: body.status as 'RECEIVED' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'CS_PROCESSING' }),
    },
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
