import { Router } from 'express';
import type { Request } from 'express';
import { runAlimtalkScheduleD2Job } from './alimtalkScheduleD2.service.js';
import { syncBarobillAlimtalkTemplates } from './alimtalkBarobillSync.service.js';

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

/** POST — 매일 낮 12:00 KST 이후 (일정 확인 알림톡) */
router.post('/alimtalk-schedule-d2', async (req, res) => {
  if (!verifyAlimtalkCronSecret(req)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const dryRun = req.query.dryRun === '1' || req.query.dryRun === 'true';
  const skipTimeWindow =
    dryRun && (req.query.skipTimeWindow === '1' || req.query.skipTimeWindow === 'true');
  try {
    const result = await runAlimtalkScheduleD2Job({ dryRun, skipTimeWindow });
    console.info('[alimtalk-schedule-d2] cron', result);
    res.json(result);
  } catch (e) {
    console.error('[alimtalk-schedule-d2] cron failed', e);
    res.status(500).json({ error: '일정 확인 알림톡 작업에 실패했습니다.' });
  }
});

/** POST — 바로빌 승인 템플릿 동기화. 20시간 안이면 건너뛴다. */
router.post('/alimtalk-barobill-sync', async (req, res) => {
  if (!verifyAlimtalkCronSecret(req)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  try {
    const result = await syncBarobillAlimtalkTemplates();
    console.info('[alimtalk-barobill] cron', {
      skipped: result.skipped ?? null,
      saved: result.templates.filter((row) => row.saved).length,
      missing: result.missing.length,
      channelStatus: result.channelStatus,
      notified: result.notified,
      configGap: Boolean(result.configGap),
    });
    res.json(result);
  } catch (e) {
    console.error('[alimtalk-barobill] cron failed', e instanceof Error ? e.name : 'error');
    res.status(500).json({ error: '바로빌 템플릿 동기화에 실패했습니다.' });
  }
});

export default router;
