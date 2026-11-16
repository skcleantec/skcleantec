import { Router } from 'express';
import type { Request } from 'express';
import { runAlimtalkBarobillResultJob } from './alimtalkBarobillResult.service.js';

const router = Router();

function verifyAlimtalkCronSecret(req: Request): boolean {
  const secret =
    process.env.ALIMTALK_CRON_SECRET?.trim() ||
    process.env.HAPPY_CALL_CRON_SECRET?.trim() ||
    process.env.BILLING_CRON_SECRET?.trim();
  if (!secret) return false;
  const auth = req.headers.authorization;
  if (auth === `Bearer ${secret}`) return true;
  const header = req.headers['x-cron-secret'];
  return typeof header === 'string' && header.trim() === secret;
}

/** POST — 1분마다. 바로빌 접수 건의 성공·대체문자·실패를 확정한다. */
router.post('/alimtalk-barobill-result', async (req, res) => {
  if (!verifyAlimtalkCronSecret(req)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  try {
    const result = await runAlimtalkBarobillResultJob();
    console.info('[alimtalk-barobill-result] cron', result);
    res.json(result);
  } catch (e) {
    console.error('[alimtalk-barobill-result] cron failed', e instanceof Error ? e.name : 'error');
    res.status(500).json({ error: '알림톡 결과 확인에 실패했습니다.' });
  }
});

export default router;
