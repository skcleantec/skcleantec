import { Router } from 'express';
import { platformAuthMiddleware, platformSuperAdminOnly } from '../platform/platformAuth.middleware.js';
import {
  createPlatformLegalDocument,
  createPlatformLegalInvite,
  deletePlatformLegalDocument,
  LEGAL_DOCUMENT_TYPE_LABELS,
  listPlatformLegalAgreements,
  listPlatformLegalDocuments,
  listPlatformLegalInvites,
  updatePlatformLegalDocument,
} from './platformLegal.service.js';
import type { PlatformScopedRequest } from '../platform/platformAuth.middleware.js';
import type { PlatformLegalDocumentType } from '@prisma/client';

const router = Router();
router.use(platformAuthMiddleware);
router.use(platformSuperAdminOnly);

function publicOriginFromRequest(req: { get: (name: string) => string | undefined }): string {
  const proto = req.get('x-forwarded-proto') || 'https';
  const host = req.get('x-forwarded-host') || req.get('host') || 'www.cbiseo.com';
  return `${proto}://${host}`;
}

router.get('/document-types', (_req, res) => {
  res.json({ types: LEGAL_DOCUMENT_TYPE_LABELS });
});

router.get('/documents', async (_req, res) => {
  try {
    res.json({ items: await listPlatformLegalDocuments() });
  } catch (e) {
    console.error('[platform legal] list documents', e);
    res.status(500).json({ error: '불러오기에 실패했습니다.' });
  }
});

router.post('/documents', async (req, res) => {
  const body = req.body as {
    title?: string;
    documentType?: PlatformLegalDocumentType;
    contentHtml?: string;
    slug?: string;
    isPublished?: boolean;
  };
  try {
    const item = await createPlatformLegalDocument({
      title: String(body.title ?? ''),
      documentType: body.documentType ?? 'MEMBER_TERMS',
      contentHtml: String(body.contentHtml ?? ''),
      slug: body.slug,
      isPublished: body.isPublished,
    });
    res.status(201).json({ item });
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    if (msg === 'TITLE_REQUIRED' || msg === 'CONTENT_REQUIRED') {
      res.status(400).json({ error: '제목과 본문을 입력해 주세요.' });
      return;
    }
    console.error('[platform legal] create document', e);
    res.status(500).json({ error: '저장에 실패했습니다.' });
  }
});

router.patch('/documents/:id', async (req, res) => {
  const body = req.body as {
    title?: string;
    contentHtml?: string;
    isPublished?: boolean;
    bumpVersion?: boolean;
  };
  try {
    const item = await updatePlatformLegalDocument(req.params.id, body);
    res.json({ item });
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    if (msg === 'NOT_FOUND') {
      res.status(404).json({ error: '문서를 찾을 수 없습니다.' });
      return;
    }
    if (msg === 'TITLE_REQUIRED' || msg === 'CONTENT_REQUIRED') {
      res.status(400).json({ error: '제목과 본문을 입력해 주세요.' });
      return;
    }
    console.error('[platform legal] patch document', e);
    res.status(500).json({ error: '저장에 실패했습니다.' });
  }
});

router.delete('/documents/:id', async (req, res) => {
  try {
    await deletePlatformLegalDocument(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    if (msg === 'NOT_FOUND') {
      res.status(404).json({ error: '문서를 찾을 수 없습니다.' });
      return;
    }
    if (msg === 'HAS_AGREEMENTS') {
      res.status(409).json({ error: '체결 기록이 있는 문서는 삭제할 수 없습니다.' });
      return;
    }
    console.error('[platform legal] delete document', e);
    res.status(500).json({ error: '삭제에 실패했습니다.' });
  }
});

router.post('/invites', async (req, res) => {
  const body = req.body as { documentId?: string; memo?: string; expiresAt?: string | null };
  if (!body.documentId) {
    res.status(400).json({ error: '문서를 선택해 주세요.' });
    return;
  }
  try {
    const expiresAt =
      body.expiresAt && String(body.expiresAt).trim()
        ? new Date(String(body.expiresAt))
        : null;
    const invite = await createPlatformLegalInvite({
      documentId: body.documentId,
      memo: body.memo,
      expiresAt: expiresAt && !Number.isNaN(expiresAt.getTime()) ? expiresAt : null,
      createdById: (req as PlatformScopedRequest).platformUser?.platformUserId ?? null,
      publicOrigin: publicOriginFromRequest(req),
    });
    res.status(201).json({ invite });
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    if (msg === 'NOT_FOUND') {
      res.status(404).json({ error: '문서를 찾을 수 없습니다.' });
      return;
    }
    if (msg === 'NOT_PUBLISHED') {
      res.status(400).json({ error: '게시 중지된 문서입니다.' });
      return;
    }
    console.error('[platform legal] create invite', e);
    res.status(500).json({ error: '링크 발급에 실패했습니다.' });
  }
});

router.get('/invites', async (req, res) => {
  const documentId = typeof req.query.documentId === 'string' ? req.query.documentId : undefined;
  try {
    res.json({ items: await listPlatformLegalInvites(documentId) });
  } catch (e) {
    console.error('[platform legal] list invites', e);
    res.status(500).json({ error: '불러오기에 실패했습니다.' });
  }
});

router.get('/agreements', async (req, res) => {
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '30'), 10) || 30));
  const offset = Math.max(0, parseInt(String(req.query.offset ?? '0'), 10) || 0);
  const documentId = typeof req.query.documentId === 'string' ? req.query.documentId : undefined;
  try {
    res.json(await listPlatformLegalAgreements({ documentId, limit, offset }));
  } catch (e) {
    console.error('[platform legal] list agreements', e);
    res.status(500).json({ error: '불러오기에 실패했습니다.' });
  }
});

export default router;
