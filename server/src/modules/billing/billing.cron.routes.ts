import { Router } from 'express';
import type { Request } from 'express';
import { runBillingDailyJob } from './tenantBilling.service.js';

const router = Router();

function verifyBillingCronSecret(req: Request): boolean {
  const secret = process.env.BILLING_CRON_SECRET?.trim();
  if (!secret) return false;
  const auth = req.headers.authorization;
  if (auth === `Bearer ${secret}`) return true;
  const header = req.headers['x-cron-secret'];
  return typeof header === 'string' && header.trim() === secret;
}

/** POST — Railway/UptimeRobot 등 외부 스케줄러용 (BILLING_CRON_SECRET) */
router.post('/billing-daily', async (req, res) => {
  if (!verifyBillingCronSecret(req)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const dryRun = req.query.dryRun === '1' || req.query.dryRun === 'true';
  try {
    const result = await runBillingDailyJob({ dryRun });
    console.info('[billing-daily] cron', result);
    res.json(result);
  } catch (e) {
    console.error('[billing-daily] cron failed', e);
    res.status(500).json({ error: '과금 일일 작업에 실패했습니다.' });
  }
});

export default router;
