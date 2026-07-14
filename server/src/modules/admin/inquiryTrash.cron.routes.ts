import { Router } from 'express';
import type { Request } from 'express';
import { purgeExpiredInquiryTrash } from '../inquiries/inquiryTrash.service.js';

const router = Router();

function verifyInquiryTrashCronSecret(req: Request): boolean {
  const secret = process.env.INQUIRY_TRASH_CRON_SECRET?.trim();
  if (!secret) return false;
  const auth = req.headers.authorization;
  if (auth === `Bearer ${secret}`) return true;
  const header = req.headers['x-cron-secret'];
  return typeof header === 'string' && header.trim() === secret;
}

/** POST — Railway/UptimeRobot 등 외부 스케줄러용 (INQUIRY_TRASH_CRON_SECRET) */
router.post('/inquiry-trash-purge', async (req, res) => {
  if (!verifyInquiryTrashCronSecret(req)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const dryRun = req.query.dryRun === '1' || req.query.dryRun === 'true';
  try {
    const result = await purgeExpiredInquiryTrash({ dryRun });
    console.info('[inquiry-trash-purge] cron', result);
    res.json(result);
  } catch (e) {
    console.error('[inquiry-trash-purge] cron failed', e);
    res.status(500).json({ error: '휴지통 만료 처리에 실패했습니다.' });
  }
});

export default router;
