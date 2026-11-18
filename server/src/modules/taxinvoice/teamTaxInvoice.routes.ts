import { Router, type Response } from 'express';
import type { AuthPayload } from '../auth/auth.middleware.js';
import { requireTenantIdFromAuth } from '../tenants/tenantScope.helpers.js';
import { TaxInvoiceError } from './taxInvoice.service.js';
import {
  listTeamTaxInvoices,
  requestTeamTaxInvoiceCert,
  requestTeamTaxInvoiceCharge,
  requestTeamTaxInvoiceOffice,
  teamIssueTaxInvoice,
  teamTaxInvoiceAccess,
  teamTaxInvoicePrefill,
  teamTaxInvoiceShareLink,
  teamTaxInvoiceViewLink,
} from './teamTaxInvoice.service.js';

const router = Router();

function sendError(res: Response, err: unknown, fallback: string): void {
  if (err instanceof TaxInvoiceError) {
    const hidden = err.message.includes('바로빌');
    res.status(err.statusCode).json({
      error: hidden ? '지금은 발행할 수 없습니다. 사무실에 문의해 주세요.' : err.message,
      code: err.code,
    });
    return;
  }
  console.error('[team-taxinvoice]', err instanceof Error ? err.name : 'error');
  res.status(500).json({ error: fallback });
}

router.get('/access', async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user;
  const tenantId = await requireTenantIdFromAuth(res, user);
  if (!tenantId) return;
  try {
    res.json(await teamTaxInvoiceAccess(tenantId, user.userId));
  } catch (err) {
    sendError(res, err, '영수증을 사용할 수 없습니다.');
  }
});

router.get('/prefill', async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user;
  const tenantId = await requireTenantIdFromAuth(res, user);
  if (!tenantId) return;
  const inquiryId = typeof req.query.inquiryId === 'string' ? req.query.inquiryId : '';
  try {
    res.json(await teamTaxInvoicePrefill(tenantId, user.userId, inquiryId || null));
  } catch (err) {
    sendError(res, err, '발행 정보를 불러오지 못했습니다.');
  }
});

router.get('/issues', async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user;
  const tenantId = await requireTenantIdFromAuth(res, user);
  if (!tenantId) return;
  try {
    res.json(await listTeamTaxInvoices(tenantId, user.userId));
  } catch (err) {
    sendError(res, err, '발행 내역을 불러오지 못했습니다.');
  }
});

router.post('/issues', async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user;
  const tenantId = await requireTenantIdFromAuth(res, user);
  if (!tenantId) return;
  try {
    res.status(201).json(await teamIssueTaxInvoice(tenantId, user.userId, req.body ?? {}));
  } catch (err) {
    sendError(res, err, '세금계산서를 발행하지 못했습니다.');
  }
});

router.get('/issues/:id/view', async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user;
  const tenantId = await requireTenantIdFromAuth(res, user);
  if (!tenantId) return;
  try {
    res.json(await teamTaxInvoiceViewLink(tenantId, user.userId, req.params.id));
  } catch (err) {
    sendError(res, err, '영수증을 열지 못했습니다.');
  }
});

router.get('/issues/:id/share', async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user;
  const tenantId = await requireTenantIdFromAuth(res, user);
  if (!tenantId) return;
  try {
    res.json(await teamTaxInvoiceShareLink(tenantId, user.userId, req.params.id));
  } catch (err) {
    sendError(res, err, '영수증 주소를 받지 못했습니다.');
  }
});

router.post('/issues/:id/office-request', async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user;
  const tenantId = await requireTenantIdFromAuth(res, user);
  if (!tenantId) return;
  try {
    res.json(await requestTeamTaxInvoiceOffice(tenantId, user.userId, req.params.id));
  } catch (err) {
    sendError(res, err, '요청을 보내지 못했습니다.');
  }
});

router.post('/charge-request', async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user;
  const tenantId = await requireTenantIdFromAuth(res, user);
  if (!tenantId) return;
  try {
    res.json(await requestTeamTaxInvoiceCharge(tenantId, user.userId));
  } catch (err) {
    sendError(res, err, '충전 요청을 보내지 못했습니다.');
  }
});

router.post('/cert-request', async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user;
  const tenantId = await requireTenantIdFromAuth(res, user);
  if (!tenantId) return;
  try {
    res.json(await requestTeamTaxInvoiceCert(tenantId, user.userId));
  } catch (err) {
    sendError(res, err, '등록 요청을 보내지 못했습니다.');
  }
});

export default router;
