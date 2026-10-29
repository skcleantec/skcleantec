import { Router, type Response } from 'express';
import { authMiddleware, type AuthPayload } from '../auth/auth.middleware.js';
import { requireTenantAuth } from '../tenants/tenant.middleware.js';
import { requireTenantIdFromAuth } from '../tenants/tenantScope.helpers.js';
import { requireFeature } from '../tenants/requireTenantFeature.js';
import { CASHBILL_MODULE_ID } from '../../lib/barobill/policy.js';
import {
  cancelCashbillIssue,
  cashbillReissueSource,
  cashbillCustomerUrl,
  cashbillPrintUrl,
  CashbillIssueError,
  issueCashbill,
  linkCashbillInquiry,
  listCashbillIssues,
  searchCashbillInquiries,
} from './cashbillIssue.service.js';
import { getReceiptWalletSummary, listReceiptWalletLedger, parseWalletLedgerFilter } from '../wallet/receiptWallet.service.js';

const router = Router();
router.use(authMiddleware, requireTenantAuth, requireFeature(CASHBILL_MODULE_ID));

function staff(res: Response, user: AuthPayload): boolean {
  if (user.role !== 'ADMIN' && user.role !== 'MARKETER') {
    res.status(403).json({ error: '관리자와 마케터만 이용할 수 있습니다.' });
    return false;
  }
  return true;
}

function sendError(res: Response, err: unknown, fallback: string): void {
  if (err instanceof CashbillIssueError) {
    res.status(err.statusCode).json({ error: err.message, code: err.code });
    return;
  }
  console.error('[cashbill-issue]', err instanceof Error ? err.name : 'error');
  res.status(500).json({ error: fallback });
}

router.get('/inquiry-search', async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user;
  if (!staff(res, user)) return;
  const tenantId = await requireTenantIdFromAuth(res, user);
  if (!tenantId) return;
  const q = typeof req.query.q === 'string' ? req.query.q : '';
  try {
    res.json({ items: await searchCashbillInquiries(tenantId, q) });
  } catch (err) {
    sendError(res, err, '접수를 검색하지 못했습니다.');
  }
});

router.get('/issues', async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user;
  if (!staff(res, user)) return;
  const tenantId = await requireTenantIdFromAuth(res, user);
  if (!tenantId) return;
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 30));
  const offset = Math.max(0, Number(req.query.offset) || 0);
  try {
    res.json(await listCashbillIssues(tenantId, {
      datePreset: typeof req.query.datePreset === 'string' ? req.query.datePreset : 'all',
      month: typeof req.query.month === 'string' ? req.query.month : undefined,
      day: typeof req.query.day === 'string' ? req.query.day : undefined,
      state: typeof req.query.state === 'string' ? req.query.state : undefined,
      operatingCompanyId: typeof req.query.brandId === 'string' ? req.query.brandId : undefined,
      q: typeof req.query.q === 'string' ? req.query.q : undefined,
      limit,
      offset,
    }));
  } catch (err) {
    sendError(res, err, '현금영수증 목록을 불러오지 못했습니다.');
  }
});

router.post('/issues', async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user;
  if (!staff(res, user)) return;
  const tenantId = await requireTenantIdFromAuth(res, user);
  if (!tenantId) return;
  try {
    res.json(await issueCashbill(tenantId, user.userId, req.body ?? {}));
  } catch (err) {
    sendError(res, err, '현금영수증 발급에 실패했습니다.');
  }
});

router.post('/issues/:issueId/inquiry', async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user;
  if (!staff(res, user)) return;
  const tenantId = await requireTenantIdFromAuth(res, user);
  if (!tenantId) return;
  const body = (req.body ?? {}) as { inquiryId?: unknown };
  const inquiryId = typeof body.inquiryId === 'string' ? body.inquiryId : '';
  if (!inquiryId.trim()) {
    res.status(400).json({ error: '연결할 접수를 선택해 주세요.' });
    return;
  }
  try {
    await linkCashbillInquiry(tenantId, String(req.params.issueId ?? ''), inquiryId);
    res.json({ ok: true });
  } catch (err) {
    sendError(res, err, '접수를 연결하지 못했습니다.');
  }
});

router.get('/issues/:issueId/source', async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user;
  if (!staff(res, user)) return;
  const tenantId = await requireTenantIdFromAuth(res, user);
  if (!tenantId) return;
  try {
    res.json(await cashbillReissueSource(tenantId, String(req.params.issueId ?? '')));
  } catch (err) {
    sendError(res, err, '다시 발행할 내용을 불러오지 못했습니다.');
  }
});

router.get('/issues/:issueId/mail-url', async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user;
  if (!staff(res, user)) return;
  const tenantId = await requireTenantIdFromAuth(res, user);
  if (!tenantId) return;
  try {
    const kind = req.query.kind === 'print' ? 'print' : 'mail';
    const url = kind === 'print'
      ? await cashbillPrintUrl(tenantId, String(req.params.issueId ?? ''))
      : await cashbillCustomerUrl(tenantId, String(req.params.issueId ?? ''));
    res.json({ url });
  } catch (err) {
    sendError(res, err, '영수증 주소를 받지 못했습니다.');
  }
});

router.post('/issues/:issueId/cancel', async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user;
  if (!staff(res, user)) return;
  const tenantId = await requireTenantIdFromAuth(res, user);
  if (!tenantId) return;
  const requestId = typeof req.body?.requestId === 'string' ? req.body.requestId : undefined;
  try {
    res.json(await cancelCashbillIssue(tenantId, user.userId, req.params.issueId, requestId));
  } catch (err) {
    sendError(res, err, '현금영수증 취소에 실패했습니다.');
  }
});

router.get('/wallet', async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user;
  if (!staff(res, user)) return;
  const tenantId = await requireTenantIdFromAuth(res, user);
  if (!tenantId) return;
  const summary = await getReceiptWalletSummary(tenantId);
  if (!summary) {
    res.status(404).json({ error: '업체를 찾을 수 없습니다.' });
    return;
  }
  res.json(summary);
});

router.get('/wallet/ledger', async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user;
  if (!staff(res, user)) return;
  const tenantId = await requireTenantIdFromAuth(res, user);
  if (!tenantId) return;
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 30));
  const offset = Math.max(0, Number(req.query.offset) || 0);
  const filter = parseWalletLedgerFilter(req.query.type);
  res.json(await listReceiptWalletLedger(tenantId, filter, limit, offset));
});

export default router;
