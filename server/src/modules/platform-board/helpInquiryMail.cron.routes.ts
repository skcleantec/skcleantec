import { Router } from 'express';
import type { Request } from 'express';
import { pullHelpInquiryMail } from './helpInquiryMail.pull.js';

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

/** POST — 5분 주기. 1:1 문의 답장 메일함에서 답변·추가 질문을 가져온다. */
router.post('/help-inquiry-mail', async (req, res) => {
  if (!verifyCronSecret(req)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  try {
    const result = await pullHelpInquiryMail();
    console.info('[help-inquiry-mail] cron', result);
    res.json(result);
  } catch (e) {
    console.error('[help-inquiry-mail] cron failed', e instanceof Error ? e.message : 'error');
    res.status(500).json({ error: '문의 답장 메일을 가져오지 못했습니다.' });
  }
});

export default router;
