import { Router } from 'express';
import multer from 'multer';
import {
  platformAuthMiddleware,
  platformSuperAdminOnly,
  type PlatformScopedRequest,
} from '../platform/platformAuth.middleware.js';
import {
  createPlatformBoardCategory,
  createPlatformBoardPost,
  deletePlatformBoardCategory,
  deletePlatformBoardPost,
  getPlatformBoardBySlug,
  getPlatformBoardPost,
  listPlatformBoardCategories,
  listPlatformBoardPosts,
  listPlatformBoards,
  updatePlatformBoard,
  updatePlatformBoardCategory,
  updatePlatformBoardPost,
} from './platformBoard.service.js';
import { mapBoardError } from './platformBoard.helpers.js';
import { uploadPlatformBoardImageBuffer } from './platformBoard.upload.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 12 * 1024 * 1024 } });

router.use(platformAuthMiddleware);

router.get('/boards', async (_req, res) => {
  try {
    res.json({ items: await listPlatformBoards() });
  } catch (e) {
    console.error('[platform-board] list boards', e);
    res.status(500).json({ error: '불러오기에 실패했습니다.' });
  }
});

router.get('/boards/:slug', async (req, res) => {
  try {
    const item = await getPlatformBoardBySlug(String(req.params.slug ?? ''));
    if (!item) {
      res.status(404).json({ error: '게시판을 찾을 수 없습니다.' });
      return;
    }
    res.json({ item });
  } catch (e) {
    console.error('[platform-board] get board', e);
    res.status(500).json({ error: '불러오기에 실패했습니다.' });
  }
});

router.patch('/boards/:slug', platformSuperAdminOnly, async (req, res) => {
  const body = req.body as {
    label?: string;
    isPublished?: boolean;
    listPublic?: boolean;
    settings?: {
      notifyEmail?: string;
      contactEmail?: string;
      composeHelpText?: string | null;
      maskAuthorNames?: boolean;
    };
  };
  try {
    const item = await updatePlatformBoard(String(req.params.slug ?? ''), body);
    res.json({ item });
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    const mapped = mapBoardError(msg);
    res.status(mapped.status).json({ error: mapped.error });
  }
});

router.get('/boards/:slug/categories', async (req, res) => {
  try {
    const items = await listPlatformBoardCategories(String(req.params.slug ?? ''));
    res.json({ items });
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    const mapped = mapBoardError(msg);
    res.status(mapped.status).json({ error: mapped.error });
  }
});

router.post('/boards/:slug/categories', platformSuperAdminOnly, async (req, res) => {
  const body = req.body as { slug?: string; label?: string; sortOrder?: number };
  try {
    const item = await createPlatformBoardCategory(String(req.params.slug ?? ''), {
      slug: body.slug,
      label: String(body.label ?? ''),
      sortOrder: body.sortOrder,
    });
    res.status(201).json({ item });
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    const mapped = mapBoardError(msg);
    res.status(mapped.status).json({ error: mapped.error });
  }
});

router.patch('/boards/:slug/categories/:categoryId', platformSuperAdminOnly, async (req, res) => {
  const body = req.body as { label?: string; sortOrder?: number };
  try {
    const item = await updatePlatformBoardCategory(
      String(req.params.slug ?? ''),
      String(req.params.categoryId ?? ''),
      body,
    );
    res.json({ item });
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    const mapped = mapBoardError(msg);
    res.status(mapped.status).json({ error: mapped.error });
  }
});

router.delete('/boards/:slug/categories/:categoryId', platformSuperAdminOnly, async (req, res) => {
  try {
    await deletePlatformBoardCategory(
      String(req.params.slug ?? ''),
      String(req.params.categoryId ?? ''),
    );
    res.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    const mapped = mapBoardError(msg);
    res.status(mapped.status).json({ error: mapped.error });
  }
});

router.get('/posts', async (req, res) => {
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '30'), 10) || 30));
  const offset = Math.max(0, parseInt(String(req.query.offset ?? '0'), 10) || 0);
  const boardSlug = typeof req.query.boardSlug === 'string' ? req.query.boardSlug : undefined;
  const categoryId = typeof req.query.categoryId === 'string' ? req.query.categoryId : undefined;
  const status =
    req.query.status === 'OPEN' || req.query.status === 'ANSWERED' || req.query.status === 'HIDDEN'
      ? req.query.status
      : undefined;
  const q = typeof req.query.q === 'string' ? req.query.q : undefined;
  try {
    const r = await listPlatformBoardPosts({ boardSlug, categoryId, status, q, limit, offset });
    res.json(r);
  } catch (e) {
    console.error('[platform-board] list posts', e);
    res.status(500).json({ error: '불러오기에 실패했습니다.' });
  }
});

router.get('/posts/:id', async (req, res) => {
  try {
    const post = await getPlatformBoardPost(String(req.params.id ?? ''));
    if (!post) {
      res.status(404).json({ error: '글을 찾을 수 없습니다.' });
      return;
    }
    res.json({ post });
  } catch (e) {
    console.error('[platform-board] get post', e);
    res.status(500).json({ error: '불러오기에 실패했습니다.' });
  }
});

router.post('/boards/:slug/posts', platformSuperAdminOnly, async (req, res) => {
  const body = req.body as {
    categoryId?: string | null;
    title?: string;
    excerpt?: string | null;
    bodyHtml?: string;
    slug?: string | null;
    isPinned?: boolean;
    isPublished?: boolean;
  };
  const platformReq = req as PlatformScopedRequest;
  try {
    const post = await createPlatformBoardPost({
      boardSlug: String(req.params.slug ?? ''),
      categoryId: body.categoryId,
      title: String(body.title ?? ''),
      excerpt: body.excerpt,
      bodyHtml: String(body.bodyHtml ?? ''),
      slug: body.slug,
      isPinned: body.isPinned,
      isPublished: body.isPublished,
      authorPlatformUserId: platformReq.platformUser?.platformUserId ?? null,
    });
    res.status(201).json({ post });
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    const mapped = mapBoardError(msg);
    if (mapped.status >= 500) console.error('[platform-board] create post', e);
    res.status(mapped.status).json({ error: mapped.error });
  }
});

router.patch('/posts/:id', platformSuperAdminOnly, async (req, res) => {
  const body = req.body as {
    categoryId?: string | null;
    title?: string;
    excerpt?: string | null;
    bodyHtml?: string;
    slug?: string | null;
    isPinned?: boolean;
    isPublished?: boolean;
    status?: 'OPEN' | 'ANSWERED' | 'HIDDEN';
    isSecret?: boolean;
  };
  try {
    const post = await updatePlatformBoardPost(String(req.params.id ?? ''), body);
    res.json({ post });
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    const mapped = mapBoardError(msg);
    res.status(mapped.status).json({ error: mapped.error });
  }
});

router.delete('/posts/:id', platformSuperAdminOnly, async (req, res) => {
  try {
    await deletePlatformBoardPost(String(req.params.id ?? ''));
    res.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    const mapped = mapBoardError(msg);
    res.status(mapped.status).json({ error: mapped.error });
  }
});

router.post('/boards/:slug/upload', platformSuperAdminOnly, upload.single('file'), async (req, res) => {
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
