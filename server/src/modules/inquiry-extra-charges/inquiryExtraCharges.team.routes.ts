import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import type { AuthPayload } from '../auth/auth.middleware.js';
import {
  listExtraCharges,
  notifyExtraChargeChanged,
  serializeExtraCharge,
  validateExtraChargeInput,
} from './inquiryExtraCharges.service.js';

const router = Router({ mergeParams: true });

async function assertAssignedTeamLeader(inquiryId: string, userId: string): Promise<boolean> {
  const ok = await prisma.inquiry.findFirst({
    where: { id: inquiryId, assignments: { some: { teamLeaderId: userId } } },
    select: { id: true },
  });
  return Boolean(ok);
}

/** 담당 팀장: 해당 접수의 추가/할인 항목 목록 */
router.get('/', async (req, res) => {
  const { inquiryId } = req.params as { inquiryId: string };
  const { userId } = (req as unknown as { user: AuthPayload }).user;
  if (!(await assertAssignedTeamLeader(inquiryId, userId))) {
    res.status(404).json({ error: '담당 접수를 찾을 수 없습니다.' });
    return;
  }
  const items = await listExtraCharges(inquiryId);
  res.json({ items });
});

/** 담당 팀장: 추가/할인 항목 생성 */
router.post('/', async (req, res) => {
  const { inquiryId } = req.params as { inquiryId: string };
  const { userId } = (req as unknown as { user: AuthPayload }).user;
  if (!(await assertAssignedTeamLeader(inquiryId, userId))) {
    res.status(404).json({ error: '담당 접수를 찾을 수 없습니다.' });
    return;
  }
  const body = req.body as { description?: unknown; amount?: unknown };
  const err = validateExtraChargeInput({
    description: String(body.description ?? ''),
    amount: Number(body.amount ?? NaN),
  });
  if (err) {
    res.status(400).json({ error: err });
    return;
  }
  const last = await prisma.inquiryExtraCharge.findFirst({
    where: { inquiryId },
    orderBy: { sortOrder: 'desc' },
    select: { sortOrder: true },
  });
  const nextSort = (last?.sortOrder ?? -1) + 1;
  const created = await prisma.inquiryExtraCharge.create({
    data: {
      inquiryId,
      description: String(body.description).trim(),
      amount: Math.trunc(Number(body.amount)),
      sortOrder: nextSort,
      createdById: userId,
    },
    include: { createdBy: { select: { id: true, name: true } } },
  });
  void notifyExtraChargeChanged(inquiryId);
  res.status(201).json({ item: serializeExtraCharge(created) });
});

/** 담당 팀장: 추가/할인 항목 수정 */
router.patch('/:chargeId', async (req, res) => {
  const { inquiryId, chargeId } = req.params as { inquiryId: string; chargeId: string };
  const { userId } = (req as unknown as { user: AuthPayload }).user;
  if (!(await assertAssignedTeamLeader(inquiryId, userId))) {
    res.status(404).json({ error: '담당 접수를 찾을 수 없습니다.' });
    return;
  }
  const existing = await prisma.inquiryExtraCharge.findFirst({
    where: { id: chargeId, inquiryId },
    select: { id: true, description: true, amount: true },
  });
  if (!existing) {
    res.status(404).json({ error: '항목을 찾을 수 없습니다.' });
    return;
  }
  const body = req.body as { description?: unknown; amount?: unknown };
  const description =
    body.description !== undefined ? String(body.description).trim() : existing.description;
  const amount =
    body.amount !== undefined ? Math.trunc(Number(body.amount)) : existing.amount;
  const err = validateExtraChargeInput({ description, amount });
  if (err) {
    res.status(400).json({ error: err });
    return;
  }
  const updated = await prisma.inquiryExtraCharge.update({
    where: { id: chargeId },
    data: { description, amount },
    include: { createdBy: { select: { id: true, name: true } } },
  });
  void notifyExtraChargeChanged(inquiryId);
  res.json({ item: serializeExtraCharge(updated) });
});

/** 담당 팀장: 추가/할인 항목 삭제 */
router.delete('/:chargeId', async (req, res) => {
  const { inquiryId, chargeId } = req.params as { inquiryId: string; chargeId: string };
  const { userId } = (req as unknown as { user: AuthPayload }).user;
  if (!(await assertAssignedTeamLeader(inquiryId, userId))) {
    res.status(404).json({ error: '담당 접수를 찾을 수 없습니다.' });
    return;
  }
  const existing = await prisma.inquiryExtraCharge.findFirst({
    where: { id: chargeId, inquiryId },
    select: { id: true },
  });
  if (!existing) {
    res.status(404).json({ error: '항목을 찾을 수 없습니다.' });
    return;
  }
  await prisma.inquiryExtraCharge.delete({ where: { id: chargeId } });
  void notifyExtraChargeChanged(inquiryId);
  res.json({ ok: true });
});

export default router;
