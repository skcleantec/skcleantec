import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import type { AuthPayload } from '../auth/auth.middleware.js';
import {
  listExtraCharges,
  notifyExtraChargeChanged,
  serializeExtraCharge,
  validateExtraChargeInput,
  recordExtraChargeChangeLog,
  extraChargeAddLine,
  extraChargeUpdateLine,
  extraChargeDeleteLine,
} from './inquiryExtraCharges.service.js';
import { canAdminOrMarketerViewInquiry } from '../inquiry-cleaning-photos/inquiryCleaningPhotos.access.js';

const router = Router({ mergeParams: true });

async function assertCanEdit(inquiryId: string, user: AuthPayload): Promise<boolean> {
  if (user.role !== 'ADMIN' && user.role !== 'MARKETER') return false;
  return canAdminOrMarketerViewInquiry(user, inquiryId);
}

/** 관리자·마케터: 목록 */
router.get('/', async (req, res) => {
  const { inquiryId } = req.params as { inquiryId: string };
  const user = (req as unknown as { user: AuthPayload }).user;
  if (!(await assertCanEdit(inquiryId, user))) {
    res.status(403).json({ error: '권한이 없습니다.' });
    return;
  }
  const items = await listExtraCharges(inquiryId);
  res.json({ items });
});

/** 관리자·마케터: 항목 추가 */
router.post('/', async (req, res) => {
  const { inquiryId } = req.params as { inquiryId: string };
  const user = (req as unknown as { user: AuthPayload }).user;
  if (!(await assertCanEdit(inquiryId, user))) {
    res.status(403).json({ error: '권한이 없습니다.' });
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
      createdById: user.userId,
    },
    include: { createdBy: { select: { id: true, name: true } } },
  });
  void notifyExtraChargeChanged(inquiryId);
  void recordExtraChargeChangeLog({
    inquiryId,
    actorId: user.userId,
    line: extraChargeAddLine(created.description, created.amount),
  }).catch((e) => console.error('[extra-charge] changeLog add', e));
  res.status(201).json({ item: serializeExtraCharge(created) });
});

/** 관리자·마케터: 항목 수정 */
router.patch('/:chargeId', async (req, res) => {
  const { inquiryId, chargeId } = req.params as { inquiryId: string; chargeId: string };
  const user = (req as unknown as { user: AuthPayload }).user;
  if (!(await assertCanEdit(inquiryId, user))) {
    res.status(403).json({ error: '권한이 없습니다.' });
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
  if (existing.description !== updated.description || existing.amount !== updated.amount) {
    void recordExtraChargeChangeLog({
      inquiryId,
      actorId: user.userId,
      line: extraChargeUpdateLine(existing, { description: updated.description, amount: updated.amount }),
    }).catch((e) => console.error('[extra-charge] changeLog update', e));
  }
  res.json({ item: serializeExtraCharge(updated) });
});

/** 관리자·마케터: 항목 삭제 */
router.delete('/:chargeId', async (req, res) => {
  const { inquiryId, chargeId } = req.params as { inquiryId: string; chargeId: string };
  const user = (req as unknown as { user: AuthPayload }).user;
  if (!(await assertCanEdit(inquiryId, user))) {
    res.status(403).json({ error: '권한이 없습니다.' });
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
  await prisma.inquiryExtraCharge.delete({ where: { id: chargeId } });
  void notifyExtraChargeChanged(inquiryId);
  void recordExtraChargeChangeLog({
    inquiryId,
    actorId: user.userId,
    line: extraChargeDeleteLine(existing.description, existing.amount),
  }).catch((e) => console.error('[extra-charge] changeLog delete', e));
  res.json({ ok: true });
});

export default router;
