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

const router = Router({ mergeParams: true });

async function assertAssignedTeamLeader(inquiryId: string, userId: string): Promise<boolean> {
  const ok = await prisma.inquiry.findFirst({
    where: { id: inquiryId, assignments: { some: { teamLeaderId: userId } } },
    select: { id: true },
  });
  return Boolean(ok);
}

router.get('/', async (req, res) => {
  const { inquiryId } = req.params as { inquiryId: string };
  const { userId } = (req as unknown as { user: AuthPayload }).user;
  if (!(await assertAssignedTeamLeader(inquiryId, userId))) {
    res.status(404).json({ error: '담당 접수를 찾을 수 없습니다.' });
    return;
  }
  const items = await listAdditionalReceipts(inquiryId);
  res.json({ items });
});

router.post('/', async (req, res) => {
  const { inquiryId } = req.params as { inquiryId: string };
  const { userId } = (req as unknown as { user: AuthPayload }).user;
  if (!(await assertAssignedTeamLeader(inquiryId, userId))) {
    res.status(404).json({ error: '담당 접수를 찾을 수 없습니다.' });
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
  const scErr = validateSettlementChannelInput(body.settlementChannel, { required: true });
  if (scErr) {
    res.status(400).json({ error: scErr });
    return;
  }
  const settlementChannel = normalizeSettlementChannel(body.settlementChannel)!;
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
      createdById: userId,
    },
    include: { createdBy: { select: { id: true, name: true } } },
  });
  void notifyAdditionalReceiptChanged(inquiryId);
  res.status(201).json({ item: serializeAdditionalReceipt(created) });
});

router.patch('/:receiptId', async (req, res) => {
  const { inquiryId, receiptId } = req.params as { inquiryId: string; receiptId: string };
  const { userId } = (req as unknown as { user: AuthPayload }).user;
  if (!(await assertAssignedTeamLeader(inquiryId, userId))) {
    res.status(404).json({ error: '담당 접수를 찾을 수 없습니다.' });
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
  const { userId } = (req as unknown as { user: AuthPayload }).user;
  if (!(await assertAssignedTeamLeader(inquiryId, userId))) {
    res.status(404).json({ error: '담당 접수를 찾을 수 없습니다.' });
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
