import { Router } from 'express';
import multer from 'multer';
import { uploadHelpCmsImageBuffer } from './helpCms.upload.js';
import { mapHelpCmsError } from './helpCms.service.js';
import {
  helpCmsPublishActor,
  helpCmsPublishKeyAuth,
  helpCmsPublishRequestIp,
} from './helpCmsPublish.auth.js';
import {
  upsertHelpCmsPublishArticle,
  writeHelpCmsPublishLog,
} from './helpCmsPublish.service.js';

const router = Router();

const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/webp']);
const ALLOWED_EXT = /\.(png|jpe?g|webp)$/i;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    const mimeOk = ALLOWED_MIME.has(file.mimetype);
    const nameOk = ALLOWED_EXT.test(file.originalname || '');
    if (mimeOk || nameOk) {
      cb(null, true);
      return;
    }
    cb(new Error('INVALID_IMAGE_TYPE'));
  },
});

router.use(helpCmsPublishKeyAuth);

/** POST /api/help-cms/publish/image — multipart field `file` */
router.post('/image', (req, res) => {
  upload.single('file')(req, res, async (err) => {
    if (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg === 'INVALID_IMAGE_TYPE') {
        res.status(400).json({ error: 'png, jpg, webp만 업로드할 수 있습니다.' });
        return;
      }
      if (msg.includes('File too large') || (err as { code?: string }).code === 'LIMIT_FILE_SIZE') {
        res.status(400).json({ error: '이미지는 5MB 이하여야 합니다.' });
        return;
      }
      res.status(400).json({ error: '이미지 업로드에 실패했습니다.' });
      return;
    }
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: '이미지 파일을 선택해 주세요.' });
      return;
    }
    if (!ALLOWED_MIME.has(file.mimetype) && !ALLOWED_EXT.test(file.originalname || '')) {
      res.status(400).json({ error: 'png, jpg, webp만 업로드할 수 있습니다.' });
      return;
    }
    try {
      const uploaded = await uploadHelpCmsImageBuffer(file.buffer);
      await writeHelpCmsPublishLog({
        actor: helpCmsPublishActor(req),
        action: 'image',
        detail: `publicId=${uploaded.publicId}`,
        requestIp: helpCmsPublishRequestIp(req),
      });
      res.json({ url: uploaded.secureUrl });
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      if (msg === 'CLOUDINARY_NOT_CONFIGURED') {
        res.status(503).json({ error: '이미지 업로드 설정이 되어 있지 않습니다.' });
        return;
      }
      console.error('[help-cms publish] image', e instanceof Error ? e.message : e);
      res.status(500).json({ error: '이미지 업로드에 실패했습니다.' });
    }
  });
});

/** POST /api/help-cms/publish/article */
router.post('/article', async (req, res) => {
  const body = req.body as {
    slug?: string;
    title?: string;
    excerpt?: string | null;
    coverImageUrl?: string | null;
    bodyMarkdown?: string;
    categorySlug?: string;
    isPublished?: boolean;
  };
  try {
    const { item, created } = await upsertHelpCmsPublishArticle({
      slug: String(body.slug ?? ''),
      title: String(body.title ?? ''),
      excerpt: body.excerpt,
      coverImageUrl: body.coverImageUrl,
      bodyMarkdown: String(body.bodyMarkdown ?? ''),
      categorySlug: body.categorySlug,
      isPublished: body.isPublished ?? false,
    });
    await writeHelpCmsPublishLog({
      actor: helpCmsPublishActor(req),
      action: created ? 'article_create' : 'article_update',
      slug: item.slug,
      detail: `title=${item.title.slice(0, 120)}; published=${item.isPublished}`,
      requestIp: helpCmsPublishRequestIp(req),
    });
    res.status(created ? 201 : 200).json({ item, created });
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    const mapped = mapHelpCmsError(msg);
    if (mapped.status >= 500) {
      console.error('[help-cms publish] article', e instanceof Error ? e.message : e);
    }
    res.status(mapped.status).json({ error: mapped.error });
  }
});

export default router;
