import { Router } from 'express';
import type { Request } from 'express';
import { syncOpenCashbillStates } from './cashbillIssue.service.js';
import { syncOpenTaxInvoiceStates } from '../taxinvoice/taxInvoice.service.js';
import { sendDueCertExpiryMails } from '../taxinvoice/taxInvoiceCert.service.js';

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
    let certMail: { sent: number } | { error: true } = { sent: 0 };
    try {
      certMail = { sent: await sendDueCertExpiryMails() };
    } catch (err) {
      console.error('[cashbill-states] cert mail', err instanceof Error ? err.name : 'error');
      certMail = { error: true };
    }
    console.info('[cashbill-states] cron', { cashbill, taxInvoice, certMail });
    res.json({ cashbill, taxInvoice, certMail });
  } catch (err) {
    console.error('[cashbill-states] cron failed', err instanceof Error ? err.name : 'error');
    res.status(500).json({ error: '현금영수증 상태 조회에 실패했습니다.' });
  }
});

export default router;
