import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import type { AuthPayload } from '../auth/auth.middleware.js';
import {
  listAdditionalReceipts,
  normalizeSettlementChannel,
  notifyAdditionalReceiptChanged,
  serializeAdditionalReceipt,
  validateAdditionalReceiptInput,
  validateSettlementChannelInput,
} from './inquiryAdditionalReceipts.service.js';
import { canAdminOrMarketerViewInquiry } from '../inquiry-cleaning-photos/inquiryCleaningPhotos.access.js';

const router = Router({ mergeParams: true });

async function assertCanEdit(inquiryId: string, user: AuthPayload): Promise<boolean> {
  if (user.role !== 'ADMIN' && user.role !== 'MARKETER') return false;
  return canAdminOrMarketerViewInquiry(user, inquiryId);
}

router.get('/', async (req, res) => {
  const { inquiryId } = req.params as { inquiryId: string };
  const user = (req as unknown as { user: AuthPayload }).user;
  if (!(await assertCanEdit(inquiryId, user))) {
    res.status(403).json({ error: '권한이 없습니다.' });
    return;
  }
  const items = await listAdditionalReceipts(inquiryId);
  res.json({ items });
});

router.post('/', async (req, res) => {
  const { inquiryId } = req.params as { inquiryId: string };
  const user = (req as unknown as { user: AuthPayload }).user;
  if (!(await assertCanEdit(inquiryId, user))) {
    res.status(403).json({ error: '권한이 없습니다.' });
    return;
  }
  const body = req.body as { description?: unknown; amount?: unknown; settlementChannel?: unknown };
  const err = validateAdditionalReceiptInput({
    description: String(body.description ?? ''),
    amount: Number(body.amount ?? NaN),
  });
  if (err) {
    res.status(400).json({ error: err });
    return;
  }
  let settlementChannel = normalizeSettlementChannel(body.settlementChannel);
  if (!settlementChannel) settlementChannel = 'COMPANY_DEPOSIT';
  const last = await prisma.inquiryAdditionalReceipt.findFirst({
    where: { inquiryId },
    orderBy: { sortOrder: 'desc' },
    select: { sortOrder: true },
  });
  const nextSort = (last?.sortOrder ?? -1) + 1;
  const created = await prisma.inquiryAdditionalReceipt.create({
    data: {
      inquiryId,
      description: String(body.description).trim(),
      amount: Math.trunc(Number(body.amount)),
      settlementChannel,
      sortOrder: nextSort,
      createdById: user.userId,
    },
    include: { createdBy: { select: { id: true, name: true } } },
  });
  void notifyAdditionalReceiptChanged(inquiryId);
  res.status(201).json({ item: serializeAdditionalReceipt(created) });
});

router.patch('/:receiptId', async (req, res) => {
  const { inquiryId, receiptId } = req.params as { inquiryId: string; receiptId: string };
  const user = (req as unknown as { user: AuthPayload }).user;
  if (!(await assertCanEdit(inquiryId, user))) {
    res.status(403).json({ error: '권한이 없습니다.' });
    return;
  }
  const existing = await prisma.inquiryAdditionalReceipt.findFirst({
    where: { id: receiptId, inquiryId },
    select: { id: true, description: true, amount: true, settlementChannel: true },
  });
  if (!existing) {
    res.status(404).json({ error: '항목을 찾을 수 없습니다.' });
    return;
  }
  const body = req.body as { description?: unknown; amount?: unknown; settlementChannel?: unknown };
  const description =
    body.description !== undefined ? String(body.description).trim() : existing.description;
  const amount =
    body.amount !== undefined ? Math.trunc(Number(body.amount)) : existing.amount;
  const verr = validateAdditionalReceiptInput({ description, amount });
  if (verr) {
    res.status(400).json({ error: verr });
    return;
  }
  let settlementChannel = existing.settlementChannel;
  if (body.settlementChannel !== undefined) {
    const scErr = validateSettlementChannelInput(body.settlementChannel, { required: true });
    if (scErr) {
      res.status(400).json({ error: scErr });
      return;
    }
    settlementChannel = normalizeSettlementChannel(body.settlementChannel)!;
  }
  const updated = await prisma.inquiryAdditionalReceipt.update({
    where: { id: receiptId },
    data: { description, amount, settlementChannel },
    include: { createdBy: { select: { id: true, name: true } } },
  });
  void notifyAdditionalReceiptChanged(inquiryId);
  res.json({ item: serializeAdditionalReceipt(updated) });
});

router.delete('/:receiptId', async (req, res) => {
  const { inquiryId, receiptId } = req.params as { inquiryId: string; receiptId: string };
  const user = (req as unknown as { user: AuthPayload }).user;
  if (!(await assertCanEdit(inquiryId, user))) {
    res.status(403).json({ error: '권한이 없습니다.' });
    return;
  }
  const existing = await prisma.inquiryAdditionalReceipt.findFirst({
    where: { id: receiptId, inquiryId },
    select: { id: true },
  });
  if (!existing) {
    res.status(404).json({ error: '항목을 찾을 수 없습니다.' });
    return;
  }
  await prisma.inquiryAdditionalReceipt.delete({ where: { id: receiptId } });
  void notifyAdditionalReceiptChanged(inquiryId);
  res.json({ ok: true });
});

export default router;
