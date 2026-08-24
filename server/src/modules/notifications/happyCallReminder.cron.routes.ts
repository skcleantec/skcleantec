import { Router } from 'express';
import type { Request } from 'express';
import { runHappyCallReminderJob } from '../notifications/happyCallReminder.service.js';

const router = Router();

function verifyHappyCallCronSecret(req: Request): boolean {
  const secret =
    process.env.HAPPY_CALL_CRON_SECRET?.trim() || process.env.BILLING_CRON_SECRET?.trim();
  if (!secret) return false;
  const auth = req.headers.authorization;
  if (auth === `Bearer ${secret}`) return true;
  const header = req.headers['x-cron-secret'];
  return typeof header === 'string' && header.trim() === secret;
}

/** POST — 15~60분 주기 외부 스케줄러 (HAPPY_CALL_CRON_SECRET 또는 BILLING_CRON_SECRET) */
router.post('/happy-call-reminders', async (req, res) => {
  if (!verifyHappyCallCronSecret(req)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const dryRun = req.query.dryRun === '1' || req.query.dryRun === 'true';
  try {
    const result = await runHappyCallReminderJob({ dryRun });
    console.info('[happy-call-reminders] cron', result);
    res.json(result);
  } catch (e) {
    console.error('[happy-call-reminders] cron failed', e);
    res.status(500).json({ error: '해피콜 알림 작업에 실패했습니다.' });
  }
});

export default router;
