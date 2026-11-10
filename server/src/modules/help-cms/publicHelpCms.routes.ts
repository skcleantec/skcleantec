import { Router } from 'express';
import {
  getHelpCmsArticlePublic,
  listHelpCmsArticlesPublic,
  listHelpCmsCategoriesPublic,
  mapHelpCmsError,
} from './helpCms.service.js';
import { parseHelpCmsTabGroup } from './helpCms.helpers.js';
import {
  helpCmsFeedbackClientHash,
  searchHelpCmsArticlesPublic,
  submitHelpCmsArticleFeedback,
} from './helpCmsSearch.service.js';

const router = Router();

router.get('/categories', async (req, res) => {
  const tab = parseHelpCmsTabGroup(req.query.tabGroup ?? req.query.tab);
  if (!tab) {
    res.status(400).json({ error: 'tabGroup은 usage 또는 notice입니다.' });
    return;
  }
  try {
    res.json({ items: await listHelpCmsCategoriesPublic(tab) });
  } catch (e) {
    console.error('[public help-cms] list categories', e);
    res.status(500).json({ error: '불러오기에 실패했습니다.' });
  }
});

router.get('/search', async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q : '';
  const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit ?? '20'), 10) || 20));
  try {
    res.json(await searchHelpCmsArticlesPublic(q, limit));
  } catch (e) {
    console.error('[public help-cms] search', e);
    res.status(500).json({ error: '검색에 실패했습니다.' });
  }
});

router.get('/articles', async (req, res) => {
  const categorySlug = typeof req.query.categorySlug === 'string' ? req.query.categorySlug.trim() : '';
  if (!categorySlug) {
    res.status(400).json({ error: 'categorySlug가 필요합니다.' });
    return;
  }
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '50'), 10) || 50));
  const offset = Math.max(0, parseInt(String(req.query.offset ?? '0'), 10) || 0);
  try {
    res.json(await listHelpCmsArticlesPublic({ categorySlug, limit, offset }));
  } catch (e) {
    console.error('[public help-cms] list articles', e);
    res.status(500).json({ error: '불러오기에 실패했습니다.' });
  }
});

router.get('/articles/:slug', async (req, res) => {
  try {
    const item = await getHelpCmsArticlePublic(req.params.slug);
    res.json({ item });
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    const mapped = mapHelpCmsError(msg);
    res.status(mapped.status).json({ error: mapped.error });
  }
});

router.post('/articles/:slug/feedback', async (req, res) => {
  const helpful = (req.body as { helpful?: unknown })?.helpful;
  if (typeof helpful !== 'boolean') {
    res.status(400).json({ error: 'helpful(true/false)가 필요합니다.' });
    return;
  }
  const ip =
    (typeof req.headers['x-forwarded-for'] === 'string'
      ? req.headers['x-forwarded-for'].split(',')[0]?.trim()
      : '') ||
    req.ip ||
    '';
  const ua = typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : '';
  const clientHash = helpCmsFeedbackClientHash(ip, ua);
  try {
    const result = await submitHelpCmsArticleFeedback({
      slug: req.params.slug,
      helpful,
      clientHash,
    });
    res.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    const mapped = mapHelpCmsError(msg);
    res.status(mapped.status).json({ error: mapped.error });
  }
});

export default router;
