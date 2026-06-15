import { Router } from 'express';
import multer from 'multer';
import { resolvePublicTenantIdFromRequest } from '../tenants/publicRequestTenant.js';
import {
  assertTenantAllowsPublicService,
  PublicTenantAccessError,
  publicTenantAccessHttpStatus,
} from '../tenants/publicTenantAccess.js';
import { isCloudinaryConfigured } from '../../lib/cloudinary.js';
import {
  findOrderFormByPaybackToken,
  ReviewPaybackError,
  submitReviewPaybackRequest,
} from './reviewPayback.service.js';
import { uploadReviewPaybackImageBuffer } from './reviewPayback.upload.js';
import { notifyReviewPaybackSubmitted } from './reviewPaybackNotify.js';
import { normalizeReviewPaybackImagesInput } from './reviewPayback.images.js';
import { Prisma } from '@prisma/client';

const router = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 12 * 1024 * 1024 } });

function sendPaybackError(res: import('express').Response, e: unknown): void {
  if (res.headersSent) return;
  if (e instanceof ReviewPaybackError) {
    res.status(e.status).json({ error: e.message, code: e.code });
    return;
  }
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === 'P2002') {
      res.status(409).json({ error: '이미 페이백 신청이 완료되었습니다.', code: 'ALREADY_SUBMITTED' });
      return;
    }
    if (e.code === 'P2022') {
      console.error('[review-payback] schema drift P2022:', e.meta);
      res.status(503).json({
        error: 'DB 스키마가 최신이 아닙니다. 잠시 후 다시 시도해 주세요.',
        code: 'SCHEMA_DRIFT',
      });
      return;
    }
    if (e.code === 'P2000') {
      res.status(400).json({ error: '이미지 정보가 너무 깁니다. 캡처를 다시 업로드해 주세요.' });
      return;
    }
  }
  console.error('[review-payback]', e);
  res.status(500).json({ error: '처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' });
}

/** 공개: 페이백 페이지 메타 (이미 신청 여부) */
router.get('/:token', async (req, res) => {
  const token = String(req.params.token ?? '').trim();
  if (!token) {
    res.status(400).json({ error: '유효하지 않은 링크입니다.' });
    return;
  }
  let tenantId: string;
  try {
    tenantId = await resolvePublicTenantIdFromRequest(req);
    await assertTenantAllowsPublicService(tenantId);
  } catch (e) {
    if (e instanceof PublicTenantAccessError) {
      res.status(publicTenantAccessHttpStatus(e.code)).json({ error: e.message });
      return;
    }
    throw e;
  }
  const form = await findOrderFormByPaybackToken(token);
  if (!form || form.tenantId !== tenantId) {
    res.status(404).json({ error: '유효하지 않은 링크입니다.' });
    return;
  }
  res.json({
    customerName: form.customerName,
    alreadySubmitted: Boolean(form.reviewPaybackRequest),
    submittedAt: form.reviewPaybackRequest?.submittedAt.toISOString() ?? null,
  });
});

/** 공개: 리뷰 캡처 업로드 */
router.post('/:token/upload', upload.single('image'), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: '이미지를 선택해 주세요.' });
    return;
  }
  const token = String(req.params.token ?? '').trim();
  if (!token) {
    res.status(400).json({ error: '유효하지 않은 링크입니다.' });
    return;
  }
  let tenantId: string;
  try {
    tenantId = await resolvePublicTenantIdFromRequest(req);
    await assertTenantAllowsPublicService(tenantId);
  } catch (e) {
    if (e instanceof PublicTenantAccessError) {
      res.status(publicTenantAccessHttpStatus(e.code)).json({ error: e.message });
      return;
    }
    throw e;
  }
  const form = await findOrderFormByPaybackToken(token);
  if (!form || form.tenantId !== tenantId) {
    res.status(404).json({ error: '유효하지 않은 링크입니다.' });
    return;
  }
  if (form.reviewPaybackRequest) {
    res.status(409).json({ error: '이미 페이백 신청이 완료되었습니다.' });
    return;
  }
  if (!isCloudinaryConfigured()) {
    res.status(503).json({ error: '이미지 업로드가 일시적으로 불가합니다. 잠시 후 다시 시도해 주세요.' });
    return;
  }
  try {
    const { secureUrl, publicId } = await uploadReviewPaybackImageBuffer(req.file.buffer, tenantId);
    res.json({ url: secureUrl, publicId });
  } catch (e) {
    console.error('[review-payback-upload]', e);
    res.status(500).json({ error: '이미지 업로드에 실패했습니다.' });
  }
});

/** 공개: 페이백 신청 제출 */
router.post('/:token/submit', async (req, res) => {
  const token = String(req.params.token ?? '').trim();
  if (!token) {
    res.status(400).json({ error: '유효하지 않은 링크입니다.' });
    return;
  }
  const body = req.body as {
    bankName?: string;
    accountNumber?: string;
    reviewImages?: unknown;
    reviewImageUrl?: string;
    reviewImagePublicId?: string;
  };
  let reviewImages = normalizeReviewPaybackImagesInput(body.reviewImages);
  if (!reviewImages && body.reviewImageUrl?.trim()) {
    reviewImages = [
      {
        url: body.reviewImageUrl.trim(),
        publicId: body.reviewImagePublicId?.trim() || null,
      },
    ];
  }
  if (!body.bankName?.trim() || !body.accountNumber?.trim() || !reviewImages?.length) {
    res.status(400).json({ error: '은행, 계좌번호, 리뷰 캡처를 모두 입력해 주세요.' });
    return;
  }
  let tenantId: string;
  try {
    tenantId = await resolvePublicTenantIdFromRequest(req);
    await assertTenantAllowsPublicService(tenantId);
  } catch (e) {
    if (e instanceof PublicTenantAccessError) {
      res.status(publicTenantAccessHttpStatus(e.code)).json({ error: e.message });
      return;
    }
    throw e;
  }
  try {
    const created = await submitReviewPaybackRequest({
      paybackToken: token,
      tenantId,
      bankName: body.bankName.trim(),
      accountNumber: body.accountNumber.trim(),
      reviewImages,
    });
    res.status(201).json({ ok: true, submittedAt: created.submittedAt.toISOString() });
    void notifyReviewPaybackSubmitted({
      tenantId: created.tenantId,
      requestId: created.id,
      customerName: created.customerName,
      orderFormId: created.orderFormId,
      inquiryId: created.inquiryId,
    }).catch((err) => {
      console.error('[review-payback-submit] notify failed:', err);
    });
  } catch (e) {
    sendPaybackError(res, e);
  }
});

export default router;
