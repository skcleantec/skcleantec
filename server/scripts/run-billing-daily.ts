/**
 * 로컬·Railway cron — POST /api/admin/cron/billing-daily 와 동일 로직
 *   cd server && npm run cron:billing-daily
 *   cd server && npm run cron:billing-daily -- --dry-run
 */
import 'dotenv/config';
import { runBillingDailyJob } from '../src/modules/billing/tenantBilling.service.js';

const dryRun = process.argv.includes('--dry-run');

runBillingDailyJob({ dryRun })
  .then((result) => {
    console.log('[billing-daily]', result);
    process.exit(0);
  })
  .catch((e) => {
    console.error('[billing-daily] failed', e);
    process.exit(1);
  });
