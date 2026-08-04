import { Router } from 'express';
import multer from 'multer';
import {
  platformAuthMiddleware,
  platformSuperAdminOnly,
  type PlatformScopedRequest,
} from '../platform/platformAuth.middleware.js';
import {
  createHelpCmsArticle,
  createHelpCmsCategory,
  deleteHelpCmsArticle,
  deleteHelpCmsCategory,
  getHelpCmsArticleBySlugPlatform,
  getHelpCmsArticlePlatform,
  listHelpCmsArticlesPlatform,
  listHelpCmsCategoriesPlatform,
  mapHelpCmsError,
  reorderHelpCmsCategories,
  updateHelpCmsArticle,
  updateHelpCmsCategory,
} from './helpCms.service.js';
import { uploadHelpCmsImageBuffer } from './helpCms.upload.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 },
});

router.use(platformAuthMiddleware);

router.get('/categories', async (_req, res) => {
  try {
    res.json({ items: await listHelpCmsCategoriesPlatform() });
  } catch (e) {
    console.error('[platform help-cms] list categories', e);
    res.status(500).json({ error: '불러오기에 실패했습니다.' });
  }
});

router.post('/categories', platformSuperAdminOnly, async (req, res) => {
  const body = req.body as {
    slug?: string;
    label?: string;
    description?: string | null;
    tabGroup?: string;
    sortOrder?: number;
    isPublished?: boolean;
  };
  try {
    const item = await createHelpCmsCategory({
      slug: body.slug,
      label: String(body.label ?? ''),
      description: body.description,
      tabGroup: String(body.tabGroup ?? ''),
      sortOrder: body.sortOrder,
      isPublished: body.isPublished,
    });
    res.status(201).json({ item });
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    const mapped = mapHelpCmsError(msg);
    if (mapped.status >= 500) console.error('[platform help-cms] create category', e);
    res.status(mapped.status).json({ error: mapped.error });
  }
});

router.patch('/categories/reorder', platformSuperAdminOnly, async (req, res) => {
  const body = req.body as { tabGroup?: string; orderedIds?: string[] };
  const tabGroup = String(body.tabGroup ?? '');
  const orderedIds = Array.isArray(body.orderedIds) ? body.orderedIds : [];
  try {
    const items = await reorderHelpCmsCategories(tabGroup, orderedIds);
    res.json({ items });
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    const mapped = mapHelpCmsError(msg);
    res.status(mapped.status).json({ error: mapped.error });
  }
});

router.patch('/categories/:id', platformSuperAdminOnly, async (req, res) => {
  const body = req.body as {
    slug?: string;
    label?: string;
    description?: string | null;
    tabGroup?: string;
    sortOrder?: number;
    isPublished?: boolean;
  };
  try {
    const item = await updateHelpCmsCategory(req.params.id, body);
    res.json({ item });
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    const mapped = mapHelpCmsError(msg);
    if (mapped.status >= 500) console.error('[platform help-cms] patch category', e);
    res.status(mapped.status).json({ error: mapped.error });
  }
});

router.delete('/categories/:id', platformSuperAdminOnly, async (req, res) => {
  try {
    await deleteHelpCmsCategory(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    const mapped = mapHelpCmsError(msg);
    res.status(mapped.status).json({ error: mapped.error });
  }
});

router.get('/articles', async (req, res) => {
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '30'), 10) || 30));
  const offset = Math.max(0, parseInt(String(req.query.offset ?? '0'), 10) || 0);
  const categoryId = typeof req.query.categoryId === 'string' ? req.query.categoryId : undefined;
  const tabGroup = typeof req.query.tabGroup === 'string' ? req.query.tabGroup : undefined;
  const q = typeof req.query.q === 'string' ? req.query.q : undefined;
  try {
    res.json(await listHelpCmsArticlesPlatform({ categoryId, tabGroup, q, limit, offset }));
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    const mapped = mapHelpCmsError(msg);
    res.status(mapped.status).json({ error: mapped.error });
  }
});

router.get('/articles/by-slug/:slug', async (req, res) => {
  try {
    const item = await getHelpCmsArticleBySlugPlatform(req.params.slug, true);
    res.json({ item });
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    const mapped = mapHelpCmsError(msg);
    res.status(mapped.status).json({ error: mapped.error });
  }
});

router.get('/articles/:id', async (req, res) => {
  try {
    const item = await getHelpCmsArticlePlatform(req.params.id);
    res.json({ item });
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    const mapped = mapHelpCmsError(msg);
    res.status(mapped.status).json({ error: mapped.error });
  }
});

router.post('/articles', async (req, res) => {
  const user = (req as unknown as PlatformScopedRequest).platformUser;
  const body = req.body as {
    categoryId?: string;
    slug?: string;
    title?: string;
    excerpt?: string | null;
    coverImageUrl?: string | null;
    bodyHtml?: string;
    bodyMarkdown?: string | null;
    contentFormat?: string;
    sortOrder?: number;
    isPublished?: boolean;
  };
  if (!body.categoryId) {
    res.status(400).json({ error: '카테고리를 선택해 주세요.' });
    return;
  }
  try {
    const item = await createHelpCmsArticle(user.platformUserId, {
      categoryId: body.categoryId,
      slug: body.slug,
      title: String(body.title ?? ''),
      excerpt: body.excerpt,
      coverImageUrl: body.coverImageUrl,
      bodyHtml: body.bodyHtml,
      bodyMarkdown: body.bodyMarkdown,
      contentFormat: body.contentFormat,
      sortOrder: body.sortOrder,
      isPublished: body.isPublished,
    });
    res.status(201).json({ item });
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    const mapped = mapHelpCmsError(msg);
    if (mapped.status >= 500) console.error('[platform help-cms] create article', e);
    res.status(mapped.status).json({ error: mapped.error });
  }
});

router.patch('/articles/:id', async (req, res) => {
  const body = req.body as {
    categoryId?: string;
    slug?: string;
    title?: string;
    excerpt?: string | null;
    coverImageUrl?: string | null;
    bodyHtml?: string;
    bodyMarkdown?: string | null;
    contentFormat?: string;
    sortOrder?: number;
    isPublished?: boolean;
  };
  try {
    const item = await updateHelpCmsArticle(req.params.id, body);
    res.json({ item });
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    const mapped = mapHelpCmsError(msg);
    if (mapped.status >= 500) console.error('[platform help-cms] patch article', e);
    res.status(mapped.status).json({ error: mapped.error });
  }
});

router.delete('/articles/:id', async (req, res) => {
  const user = (req as unknown as PlatformScopedRequest).platformUser;
  try {
    await deleteHelpCmsArticle(req.params.id, {
      platformUserId: user.platformUserId,
      role: user.role,
    });
    res.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    const mapped = mapHelpCmsError(msg);
    res.status(mapped.status).json({ error: mapped.error });
  }
});

router.post('/upload-image', upload.single('file'), async (req, res) => {
  const file = req.file;
  if (!file) {
    res.status(400).json({ error: '이미지 파일을 선택해 주세요.' });
    return;
  }
  try {
    const uploaded = await uploadHelpCmsImageBuffer(file.buffer);
    res.json({ url: uploaded.secureUrl, publicId: uploaded.publicId });
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    if (msg === 'CLOUDINARY_NOT_CONFIGURED') {
      res.status(503).json({ error: '이미지 업로드 설정이 되어 있지 않습니다.' });
      return;
    }
    console.error('[platform help-cms] upload image', e);
    res.status(500).json({ error: '이미지 업로드에 실패했습니다.' });
  }
});

export default router;
