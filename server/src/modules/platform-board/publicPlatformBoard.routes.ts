import { Router } from 'express';
import multer from 'multer';
import jwt from 'jsonwebtoken';
import type { Request } from 'express';
import { config } from '../../config/index.js';
import type { AuthPayload } from '../auth/auth.middleware.js';
import {
  createPublicInquiryPost,
  getPublicBoardPost,
  getPublicBoardSettings,
  listPublicBoardPosts,
} from './platformBoard.service.js';
import { mapBoardError } from './platformBoard.helpers.js';
import { notifyNewInquiry } from './platformBoardReply.service.js';
import { INQUIRY_FIELD_MESSAGES, InquiryValidationError } from './platformBoardInquiry.helpers.js';
import { uploadPlatformBoardImageBuffer } from './platformBoard.upload.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 12 * 1024 * 1024 } });

function readOptionalAuth(req: Request): AuthPayload | null {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;
  try {
    return jwt.verify(authHeader.slice(7), config.jwtSecret) as AuthPayload;
  } catch {
    return null;
  }
}

router.get('/boards/:slug/settings', async (req, res) => {
  try {
    const settings = await getPublicBoardSettings(String(req.params.slug ?? ''));
    res.json({
      slug: settings.slug,
      label: settings.label,
      boardType: settings.boardType,
      listPublic: settings.listPublic,
      contactEmail: settings.settings.contactEmail ?? '',
      composeHelpText: settings.settings.composeHelpText ?? null,
      categories: settings.categories.map((c) => ({
        id: c.id,
        slug: c.slug,
        label: c.label,
        sortOrder: c.sortOrder,
      })),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    const mapped = mapBoardError(msg);
    res.status(mapped.status).json({ error: mapped.error });
  }
});

router.get('/boards/:slug/posts', async (req, res) => {
  const slug = String(req.params.slug ?? '');
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '30'), 10) || 30));
  const offset = Math.max(0, parseInt(String(req.query.offset ?? '0'), 10) || 0);
  const categorySlug = typeof req.query.category === 'string' ? req.query.category : undefined;
  const q = typeof req.query.q === 'string' ? req.query.q : undefined;
  try {
    const r = await listPublicBoardPosts({ boardSlug: slug, categorySlug, q, limit, offset });
    res.json(r);
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    const mapped = mapBoardError(msg);
    res.status(mapped.status).json({ error: mapped.error });
  }
});

router.get('/boards/:slug/posts/:id', async (req, res) => {
  const auth = readOptionalAuth(req);
  try {
    const post = await getPublicBoardPost({
      boardSlug: String(req.params.slug ?? ''),
      postId: String(req.params.id ?? ''),
      accessEmail: typeof req.query.accessEmail === 'string' ? req.query.accessEmail : undefined,
      accessUserId: auth?.userId,
    });
    res.json({ post });
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    const mapped = mapBoardError(msg);
    res.status(mapped.status).json({ error: mapped.error });
  }
});

router.post('/boards/:slug/posts', async (req, res) => {
  const auth = readOptionalAuth(req);
  const body = req.body as {
    categoryId?: string;
    authorName?: string;
    authorEmail?: string;
    authorPhone?: string;
    privacyConsent?: unknown;
    consentVersion?: unknown;
    title?: string;
    bodyHtml?: string;
    isSecret?: boolean;
  };
  try {
    let authorName = String(body.authorName ?? '').trim();
    let authorEmail = String(body.authorEmail ?? '').trim();
    let authorUserId: string | null = null;
    let tenantId: string | null = null;
    if (auth?.userId) {
      authorUserId = auth.userId;
      tenantId = auth.tenantId ?? null;
      if (!authorName) authorName = auth.email.split('@')[0] ?? '사용자';
      if (!authorEmail) authorEmail = auth.email;
    }

    const created = await createPublicInquiryPost({
      boardSlug: String(req.params.slug ?? ''),
      categoryId: String(body.categoryId ?? ''),
      authorName,
      authorEmail,
      authorPhone: String(body.authorPhone ?? ''),
      privacyConsent: body.privacyConsent,
      consentVersion: body.consentVersion,
      title: String(body.title ?? ''),
      bodyHtml: String(body.bodyHtml ?? ''),
      isSecret: body.isSecret === true,
      authorUserId,
      tenantId,
    });

    let emailSent = false;
    try {
      const mail = await notifyNewInquiry(created.id);
      emailSent = mail.sent > 0;
    } catch (err) {
      console.error('[platform-board] inquiry notify failed', err instanceof Error ? err.message : 'error');
    }

    // 공개 응답에는 휴대폰·문의 번호·동의 시각을 넣지 않는다
    const { authorPhone: _p, replyToken: _t, privacyConsentAt: _c, ...post } = created;
    res.status(201).json({ post, emailSent });
  } catch (e) {
    if (e instanceof InquiryValidationError) {
      res.status(400).json({ error: INQUIRY_FIELD_MESSAGES[e.field], code: 'VALIDATION', field: e.field });
      return;
    }
    const msg = e instanceof Error ? e.message : '';
    const mapped = mapBoardError(msg);
    if (mapped.status >= 500) console.error('[platform-board] create post', e instanceof Error ? e.message : 'error');
    res.status(mapped.status).json({ error: mapped.error });
  }
});

router.post('/boards/:slug/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: '이미지를 선택해 주세요.' });
    return;
  }
  try {
    const { secureUrl, publicId } = await uploadPlatformBoardImageBuffer(
      req.file.buffer,
      String(req.params.slug ?? 'general'),
    );
    res.json({ url: secureUrl, publicId });
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    if (msg === 'CLOUDINARY_NOT_CONFIGURED') {
      res.status(503).json({ error: '이미지 업로드가 일시적으로 불가합니다.' });
      return;
    }
    console.error('[platform-board] upload', e);
    res.status(500).json({ error: '업로드에 실패했습니다.' });
  }
});

export default router;
