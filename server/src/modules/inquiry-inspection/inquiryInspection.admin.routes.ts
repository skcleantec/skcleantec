import { Router } from 'express';
import bcrypt from 'bcryptjs';
import type { AuthPayload } from '../auth/auth.middleware.js';
import { getTenantIdFromAuth } from '../tenants/tenant.middleware.js';
import { findInquiryForStaff } from './inquiryInspection.access.js';
import { loadInspectionChecklist, voidInspectionChecklist } from './inquiryInspection.service.js';
import { resendInspectionCompletionEmail } from './inquiryInspection.postComplete.service.js';
import { buildInspectionPhotosZipBuffer } from './inquiryInspection.zip.service.js';
import { buildInspectionPdfBuffer } from './inquiryInspection.pdf.service.js';
import { inspectionChecklistInclude } from './inquiryInspection.include.js';
import { prisma } from '../../lib/prisma.js';
import { isSmtpConfigured } from '../../lib/mailer.js';

const router = Router({ mergeParams: true });

async function loadChecklistRow(inquiryId: string, tenantId: string) {
  return prisma.inquiryInspectionChecklist.findFirst({
    where: { inquiryId, tenantId },
    include: inspectionChecklistInclude,
  });
}

async function loadInquiryBrief(inquiryId: string, tenantId: string) {
  return prisma.inquiry.findFirst({
    where: { id: inquiryId, tenantId },
    select: {
      customerName: true,
      inquiryNumber: true,
      preferredDate: true,
      address: true,
      addressDetail: true,
    },
  });
}

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
  res.json({ checklist, smtpConfigured: isSmtpConfigured() });
});

/** GET /pdf — 완료본 PDF 다운로드 */
router.get('/pdf', async (req, res) => {
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
  const row = await loadChecklistRow(inquiryId, tenantId);
  if (!row || row.status !== 'COMPLETED') {
    res.status(404).json({ error: '완료된 검수본이 없습니다.' });
    return;
  }
  if (row.completionPdfSecureUrl) {
    res.redirect(302, row.completionPdfSecureUrl);
    return;
  }
  const brief = await loadInquiryBrief(inquiryId, tenantId);
  if (!brief) {
    res.status(404).json({ error: '접수를 찾을 수 없습니다.' });
    return;
  }
  const address = [brief.address, brief.addressDetail].filter(Boolean).join(' ');
  const pdf = await buildInspectionPdfBuffer(row, {
    customerName: brief.customerName,
    inquiryNumber: brief.inquiryNumber,
    preferredDate: brief.preferredDate,
    address,
  });
  const fileName = `inspection_${brief.inquiryNumber ?? inquiryId.slice(0, 8)}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
  res.send(pdf);
});

/** GET /photos.zip — 구역별 사진 ZIP */
router.get('/photos.zip', async (req, res) => {
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
  const row = await loadChecklistRow(inquiryId, tenantId);
  if (!row) {
    res.status(404).json({ error: '검수 체크리스트가 없습니다.' });
    return;
  }
  try {
    const zip = await buildInspectionPhotosZipBuffer(row);
    const brief = await loadInquiryBrief(inquiryId, tenantId);
    const fileName = `inspection_photos_${brief?.inquiryNumber ?? inquiryId.slice(0, 8)}.zip`;
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
    res.send(zip);
  } catch (e) {
    console.error('[inspection] zip failed', e);
    res.status(500).json({ error: '사진 ZIP 생성에 실패했습니다.' });
  }
});

/** POST /resend-email — 완료본 이메일 재발송 (관리자) */
router.post('/resend-email', async (req, res) => {
  const { inquiryId } = req.params as { inquiryId: string };
  const user = (req as unknown as { user: AuthPayload }).user;
  const tenantId = getTenantIdFromAuth(user);
  if (!tenantId) {
    res.status(403).json({ error: '테넌트 세션이 필요합니다.' });
    return;
  }
  if (user.role !== 'ADMIN') {
    res.status(403).json({ error: '관리자만 이메일을 재발송할 수 있습니다.' });
    return;
  }
  const row = await loadChecklistRow(inquiryId, tenantId);
  if (!row) {
    res.status(404).json({ error: '검수 체크리스트가 없습니다.' });
    return;
  }
  if (!isSmtpConfigured()) {
    res.status(503).json({ error: 'SMTP가 설정되지 않았습니다. SMTP_HOST·SMTP_FROM 등을 설정하세요.' });
    return;
  }
  try {
    const result = await resendInspectionCompletionEmail({
      checklistId: row.id,
      tenantId,
      inquiryId,
    });
    const checklist = await loadInspectionChecklist({ inquiryId, tenantId });
    res.json({ checklist, emailSent: result.emailSent, pdfUrl: result.pdfUrl });
  } catch (e) {
    const code = e && typeof e === 'object' && 'code' in e ? (e as { code: string }).code : '';
    if (code === 'bad_request') {
      res.status(400).json({ error: '완료된 검수본만 이메일을 발송할 수 있습니다.' });
      return;
    }
    if (code === 'not_found') {
      res.status(404).json({ error: '검수본을 찾을 수 없습니다.' });
      return;
    }
    console.error('[inspection] resend-email failed', e);
    res.status(500).json({ error: '이메일 발송에 실패했습니다.' });
  }
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
