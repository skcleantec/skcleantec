import { Router, type Response } from 'express';
import { authMiddleware, type AuthPayload } from '../auth/auth.middleware.js';
import { requireTenantAuth } from '../tenants/tenant.middleware.js';
import { requireTenantIdFromAuth } from '../tenants/tenantScope.helpers.js';
import { requireFeature } from '../tenants/requireTenantFeature.js';
import { CASHBILL_MODULE_ID } from '../../lib/barobill/policy.js';
import {
  cancelTaxInvoice,
  issueTaxInvoice,
  listTaxInvoices,
  taxInvoiceCustomerUrl,
  taxInvoicePrintUrl,
  searchTaxInvoiceInquiries,
  TaxInvoiceError,
} from './taxInvoice.service.js';
import { updateBarobillSupplier } from './taxInvoiceSupplier.service.js';

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
  if (err instanceof TaxInvoiceError) {
    res.status(err.statusCode).json({ error: err.message, code: err.code });
    return;
  }
  console.error('[tax-invoice]', err instanceof Error ? err.name : 'error');
  res.status(500).json({ error: fallback });
}

router.get('/inquiry-search', async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user;
  if (!staff(res, user)) return;
  const tenantId = await requireTenantIdFromAuth(res, user);
  if (!tenantId) return;
  const q = typeof req.query.q === 'string' ? req.query.q : '';
  const inquiryId = typeof req.query.inquiryId === 'string' ? req.query.inquiryId : '';
  try {
    res.json({ items: await searchTaxInvoiceInquiries(tenantId, q, inquiryId) });
  } catch (err) {
    sendError(res, err, '접수를 찾지 못했습니다.');
  }
});

router.get('/', async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user;
  if (!staff(res, user)) return;
  const tenantId = await requireTenantIdFromAuth(res, user);
  if (!tenantId) return;
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 30));
  const offset = Math.max(0, Number(req.query.offset) || 0);
  try {
    res.json(await listTaxInvoices(tenantId, {
      datePreset: typeof req.query.datePreset === 'string' ? req.query.datePreset : undefined,
      month: typeof req.query.month === 'string' ? req.query.month : undefined,
      day: typeof req.query.day === 'string' ? req.query.day : undefined,
      state: typeof req.query.state === 'string' ? req.query.state : undefined,
      operatingCompanyId: typeof req.query.brandId === 'string' ? req.query.brandId : undefined,
      q: typeof req.query.q === 'string' ? req.query.q : undefined,
      limit,
      offset,
    }));
  } catch (err) {
    sendError(res, err, '세금계산서 목록을 불러오지 못했습니다.');
  }
});

router.patch('/supplier', async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user;
  if (!staff(res, user)) return;
  const tenantId = await requireTenantIdFromAuth(res, user);
  if (!tenantId) return;
  const body = (req.body ?? {}) as Record<string, unknown>;
  const operatingCompanyId = String(body.operatingCompanyId ?? '');
  if (!operatingCompanyId) {
    res.status(400).json({ error: '브랜드를 지정해 주세요.' });
    return;
  }
  try {
    res.json(await updateBarobillSupplier(tenantId, operatingCompanyId, body));
  } catch (err) {
    sendError(res, err, '공급자 정보를 저장하지 못했습니다.');
  }
});

router.post('/', async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user;
  if (!staff(res, user)) return;
  const tenantId = await requireTenantIdFromAuth(res, user);
  if (!tenantId) return;
  try {
    res.json(await issueTaxInvoice(tenantId, user.userId, req.body ?? {}));
  } catch (err) {
    sendError(res, err, '세금계산서 발행에 실패했습니다.');
  }
});

router.get('/:issueId/mail-url', async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user;
  if (!staff(res, user)) return;
  const tenantId = await requireTenantIdFromAuth(res, user);
  if (!tenantId) return;
  try {
    const kind = req.query.kind === 'print' ? 'print' : 'mail';
    const url = kind === 'print'
      ? await taxInvoicePrintUrl(tenantId, String(req.params.issueId ?? ''))
      : await taxInvoiceCustomerUrl(tenantId, String(req.params.issueId ?? ''));
    res.json({ url });
  } catch (err) {
    sendError(res, err, '영수증 주소를 받지 못했습니다.');
  }
});

router.post('/:issueId/cancel', async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user;
  if (!staff(res, user)) return;
  const tenantId = await requireTenantIdFromAuth(res, user);
  if (!tenantId) return;
  try {
    res.json(await cancelTaxInvoice(tenantId, String(req.params.issueId ?? '')));
  } catch (err) {
    sendError(res, err, '세금계산서 취소에 실패했습니다.');
  }
});

export default router;
