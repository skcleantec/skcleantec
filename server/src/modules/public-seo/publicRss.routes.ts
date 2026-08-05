import { Router, type Request, type Response } from 'express';
import { buildPublicRssXml } from './publicRss.service.js';

const router = Router();

async function sendPublicRss(_req: Request, res: Response) {
  try {
    const xml = await buildPublicRssXml();
    res.setHeader('Cache-Control', 'public, max-age=600');
    res.type('application/rss+xml; charset=utf-8').send(xml);
  } catch (e) {
    console.error('[public-rss]', e);
    res.status(500).type('text/plain; charset=utf-8').send('RSS 생성에 실패했습니다.');
  }
}

router.get('/feed.xml', sendPublicRss);
router.get('/rss.xml', sendPublicRss);

export default router;
