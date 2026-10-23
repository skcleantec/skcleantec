import { Router } from 'express';
import type { Request } from 'express';
import { pullEnabledSkHomepageMailboxes } from './skHomepageMail.pull.js';

const router = Router();

function verifyCronSecret(req: Request): boolean {
  const secret =
    process.env.HAPPY_CALL_CRON_SECRET?.trim() || process.env.BILLING_CRON_SECRET?.trim();
  if (!secret) return false;
  const auth = req.headers.authorization;
  if (auth === `Bearer ${secret}`) return true;
  const header = req.headers['x-cron-secret'];
  return typeof header === 'string' && header.trim() === secret;
}

/** POST — 15분 주기. SK클린텍 네이버 홈페이지 문의 메일만 가져온다. */
router.post('/sk-homepage-mail', async (req, res) => {
  if (!verifyCronSecret(req)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  try {
    const result = await pullEnabledSkHomepageMailboxes();
    console.info('[sk-homepage-mail] cron', result);
    res.json(result);
  } catch (e) {
    console.error('[sk-homepage-mail] cron failed', e instanceof Error ? e.message : 'error');
    res.status(500).json({ error: '홈페이지 문의 메일을 가져오지 못했습니다.' });
  }
});

export default router;
