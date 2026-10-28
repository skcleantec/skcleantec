import { Router } from 'express';
import type { Request } from 'express';
import { syncOpenCashbillStates } from './cashbillIssue.service.js';
import { syncOpenTaxInvoiceStates } from '../taxinvoice/taxInvoice.service.js';

const router = Router();

function verifyCronSecret(req: Request): boolean {
  const secret = process.env.HAPPY_CALL_CRON_SECRET?.trim() || process.env.BILLING_CRON_SECRET?.trim();
  if (!secret) return false;
  const auth = req.headers.authorization;
  if (auth === `Bearer ${secret}`) return true;
  const header = req.headers['x-cron-secret'];
  return typeof header === 'string' && header.trim() === secret;
}

router.post('/cashbill-states', async (req, res) => {
  if (!verifyCronSecret(req)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  try {
    const cashbill = await syncOpenCashbillStates();
    let taxInvoice: { checked: number; updated: number } | { error: true } = { checked: 0, updated: 0 };
    try {
      taxInvoice = await syncOpenTaxInvoiceStates();
    } catch (err) {
      console.error('[cashbill-states] tax invoice', err instanceof Error ? err.name : 'error');
      taxInvoice = { error: true };
    }
    console.info('[cashbill-states] cron', { cashbill, taxInvoice });
    res.json({ cashbill, taxInvoice });
  } catch (err) {
    console.error('[cashbill-states] cron failed', err instanceof Error ? err.name : 'error');
    res.status(500).json({ error: '현금영수증 상태 조회에 실패했습니다.' });
  }
});

export default router;
