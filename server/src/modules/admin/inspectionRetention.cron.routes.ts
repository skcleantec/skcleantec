import { Router } from 'express';
import type { Request } from 'express';
import { purgeExpiredInspectionChecklists } from '../inquiry-inspection/inquiryInspection.retention.service.js';

const router = Router();

function verifyInspectionRetentionCronSecret(req: Request): boolean {
  const secret = process.env.INSPECTION_RETENTION_CRON_SECRET?.trim();
  if (!secret) return false;
  const auth = req.headers.authorization;
  if (auth === `Bearer ${secret}`) return true;
  const header = req.headers['x-cron-secret'];
  return typeof header === 'string' && header.trim() === secret;
}

/** POST — Railway/UptimeRobot 등 외부 스케줄러용 (INSPECTION_RETENTION_CRON_SECRET) */
router.post('/inspection-retention', async (req, res) => {
  if (!verifyInspectionRetentionCronSecret(req)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const dryRun = req.query.dryRun === '1' || req.query.dryRun === 'true';
  try {
    const result = await purgeExpiredInspectionChecklists({ dryRun });
    console.info('[inspection-retention] cron', result);
    res.json(result);
  } catch (e) {
    console.error('[inspection-retention] cron failed', e);
    res.status(500).json({ error: '보관 만료 처리에 실패했습니다.' });
  }
});

export default router;
