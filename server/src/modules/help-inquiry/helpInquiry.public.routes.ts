import { Router } from 'express';
import multer from 'multer';
import { getHelpInquirySettings } from './helpInquirySettings.service.js';
import { createHelpInquiryPost, getHelpInquiryPost, listHelpInquiryPosts } from './helpInquiryPost.service.js';
import { uploadHelpInquiryImageBuffer } from './helpInquiry.upload.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 12 * 1024 * 1024 } });

/** 공개: 연락처·카테고리·작성 도움말 (notifyEmail 제외) */
router.get('/settings', async (_req, res) => {
  const s = await getHelpInquirySettings();
  res.json({
    contactEmail: s.contactEmail,
    composeHelpText: s.composeHelpText,
    categories: s.categories,
  });
});

router.get('/posts', async (req, res) => {
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '30'), 10) || 30));
  const offset = Math.max(0, parseInt(String(req.query.offset ?? '0'), 10) || 0);
  const r = await listHelpInquiryPosts({ limit, offset });
  res.json(r);
});

router.get('/posts/:id', async (req, res) => {
  const post = await getHelpInquiryPost(String(req.params.id ?? '').trim());
  if (!post) {
    res.status(404).json({ error: '글을 찾을 수 없습니다.' });
    return;
  }
  res.json(post);
});

router.post('/posts', async (req, res) => {
  const body = req.body as {
    categoryId?: string;
    authorName?: string;
    authorEmail?: string;
    title?: string;
    bodyMarkdown?: string;
    imageUrls?: unknown;
  };
  try {
    const imageUrls = Array.isArray(body.imageUrls)
      ? body.imageUrls.filter((u): u is string => typeof u === 'string')
      : [];
    const r = await createHelpInquiryPost({
      categoryId: String(body.categoryId ?? ''),
      authorName: String(body.authorName ?? ''),
      authorEmail: String(body.authorEmail ?? ''),
      title: String(body.title ?? ''),
      bodyMarkdown: String(body.bodyMarkdown ?? ''),
      imageUrls,
    });
    res.status(201).json(r);
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    if (msg === 'INVALID_CATEGORY' || msg === 'VALIDATION') {
      res.status(400).json({ error: '입력 내용을 확인해 주세요.' });
      return;
    }
    console.error('[help-inquiry] create post', e);
    res.status(500).json({ error: '등록 중 오류가 발생했습니다.' });
  }
});

router.post('/upload-image', upload.single('image'), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: '이미지를 선택해 주세요.' });
    return;
  }
  try {
    const { secureUrl, publicId } = await uploadHelpInquiryImageBuffer(req.file.buffer);
    res.json({ url: secureUrl, publicId });
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    if (msg === 'CLOUDINARY_NOT_CONFIGURED') {
      res.status(503).json({ error: '이미지 업로드가 일시적으로 불가합니다.' });
      return;
    }
    console.error('[help-inquiry] upload', e);
    res.status(500).json({ error: '업로드에 실패했습니다.' });
  }
});

export default router;
