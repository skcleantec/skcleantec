/**
 * 로컬·Railway cron — POST /api/admin/cron/happy-call-reminders 와 동일 로직
 *   cd server && npm run cron:happy-call-reminders
 *   cd server && npm run cron:happy-call-reminders -- --dry-run
 */
import 'dotenv/config';
import { runHappyCallReminderJob } from '../src/modules/notifications/happyCallReminder.service.js';

const dryRun = process.argv.includes('--dry-run');

runHappyCallReminderJob({ dryRun })
  .then((result) => {
    console.log('[happy-call-reminders]', result);
    process.exit(0);
  })
  .catch((e) => {
    console.error('[happy-call-reminders] failed', e);
    process.exit(1);
  });
