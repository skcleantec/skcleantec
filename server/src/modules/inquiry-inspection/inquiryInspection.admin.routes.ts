import { Router } from 'express';
import bcrypt from 'bcryptjs';
import type { AuthPayload } from '../auth/auth.middleware.js';
import { getTenantIdFromAuth } from '../tenants/tenant.middleware.js';
import { findInquiryForStaff } from './inquiryInspection.access.js';
import { loadInspectionChecklist, voidInspectionChecklist } from './inquiryInspection.service.js';
import { prisma } from '../../lib/prisma.js';

const router = Router({ mergeParams: true });

/** GET — 관리자·마케터 조회 */
router.get('/', async (req, res) => {
  const { inquiryId } = req.params as { inquiryId: string };
  const user = (req as unknown as { user: AuthPayload }).user;
  const tenantId = getTenantIdFromAuth(user);
  if (!tenantId) {
    res.status(403).json({ error: '테넌트 세션이 필요합니다.' });
    return;
  }
  const inquiry = await findInquiryForStaff({ inquiryId, tenantId, user });
  if (!inquiry) {
    res.status(404).json({ error: '접수를 찾을 수 없거나 권한이 없습니다.' });
    return;
  }
  const checklist = await loadInspectionChecklist({ inquiryId, tenantId });
  res.json({ checklist });
});

/** POST /void — 관리자만 완료본 무효 */
router.post('/void', async (req, res) => {
  const { inquiryId } = req.params as { inquiryId: string };
  const user = (req as unknown as { user: AuthPayload }).user;
  const tenantId = getTenantIdFromAuth(user);
  if (!tenantId) {
    res.status(403).json({ error: '테넌트 세션이 필요합니다.' });
    return;
  }

  if (user.role !== 'ADMIN') {
    res.status(403).json({ error: '관리자만 무효 처리할 수 있습니다.' });
    return;
  }

  const inquiry = await prisma.inquiry.findFirst({
    where: { id: inquiryId, tenantId },
    select: { id: true },
  });
  if (!inquiry) {
    res.status(404).json({ error: '접수를 찾을 수 없습니다.' });
    return;
  }

  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const voidReason = typeof req.body?.voidReason === 'string' ? req.body.voidReason : '';
  if (!voidReason.trim()) {
    res.status(400).json({ error: '무효 사유를 입력해 주세요.' });
    return;
  }

  const admin = await prisma.user.findFirst({
    where: { id: user.userId, tenantId },
    select: { passwordHash: true },
  });
  if (!admin || !(await bcrypt.compare(password, admin.passwordHash))) {
    res.status(401).json({ error: '비밀번호가 올바르지 않습니다.' });
    return;
  }

  const checklist = await prisma.inquiryInspectionChecklist.findFirst({
    where: { inquiryId, tenantId },
  });
  if (!checklist) {
    res.status(404).json({ error: '검수 체크리스트가 없습니다.' });
    return;
  }

  try {
    const dto = await voidInspectionChecklist({
      checklistId: checklist.id,
      tenantId,
      voidedById: user.userId,
      voidReason,
    });
    res.json({ checklist: dto });
  } catch (e) {
    const code = e && typeof e === 'object' && 'code' in e ? (e as { code: string }).code : '';
    if (code === 'bad_request') {
      res.status(400).json({ error: '완료된 검수본만 무효 처리할 수 있습니다.' });
      return;
    }
    throw e;
  }
});

export default router;
