import { Router, type Request, type Response } from 'express';
import { buildPublicSitemapXml } from './publicSitemap.service.js';

const router = Router();

async function sendPublicSitemap(_req: Request, res: Response) {
  try {
    const xml = await buildPublicSitemapXml();
    res.setHeader('Cache-Control', 'public, max-age=600');
    res.type('application/xml; charset=utf-8').send(xml);
  } catch (e) {
    console.error('[public-sitemap]', e);
    res.status(500).type('text/plain; charset=utf-8').send('사이트맵 생성에 실패했습니다.');
  }
}

router.get('/sitemap.xml', sendPublicSitemap);

export default router;
