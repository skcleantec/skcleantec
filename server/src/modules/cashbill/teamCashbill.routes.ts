import { Router, type Response } from 'express';
import type { AuthPayload } from '../auth/auth.middleware.js';
import { requireTenantIdFromAuth } from '../tenants/tenantScope.helpers.js';
import { CashbillIssueError } from './cashbillIssue.service.js';
import {
  listTeamCashbillIssues,
  requestTeamCashbillCancel,
  teamCashbillShareLink,
  teamCashbillViewLink,
  requestTeamCashbillCharge,
  teamCashbillAccess,
  teamCashbillPrefill,
  teamIssueCashbill,
} from './teamCashbill.service.js';

const router = Router();

function sendError(res: Response, err: unknown, fallback: string): void {
  if (err instanceof CashbillIssueError) {
    const hidden = err.code === 'simplified' || err.message.includes('바로빌');
    res.status(err.statusCode).json({
      error: hidden ? '지금은 발행할 수 없습니다. 사무실에 문의해 주세요.' : err.message,
      code: err.code,
    });
    return;
  }
  console.error('[team-cashbill]', err instanceof Error ? err.name : 'error');
  res.status(500).json({ error: fallback });
}

router.get('/access', async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user;
  const tenantId = await requireTenantIdFromAuth(res, user);
  if (!tenantId) return;
  res.json(await teamCashbillAccess(tenantId, user.userId));
});

router.get('/prefill', async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user;
  const tenantId = await requireTenantIdFromAuth(res, user);
  if (!tenantId) return;
  const inquiryId = typeof req.query.inquiryId === 'string' ? req.query.inquiryId : '';
  try {
    res.json(await teamCashbillPrefill(tenantId, user.userId, inquiryId || null));
  } catch (err) {
    sendError(res, err, '발행 정보를 불러오지 못했습니다.');
  }
});

router.get('/issues', async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user;
  const tenantId = await requireTenantIdFromAuth(res, user);
  if (!tenantId) return;
  try {
    res.json(await listTeamCashbillIssues(tenantId, user.userId));
  } catch (err) {
    sendError(res, err, '발행 내역을 불러오지 못했습니다.');
  }
});

router.post('/issues', async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user;
  const tenantId = await requireTenantIdFromAuth(res, user);
  if (!tenantId) return;
  const body = req.body as {
    inquiryId?: string | null;
    operatingCompanyId?: string;
    amount?: number;
    identity?: string;
    customerName?: string;
    extraReason?: string;
    requestId?: string;
    usage?: unknown;
    taxKind?: unknown;
  };
  try {
    res.status(201).json(await teamIssueCashbill(tenantId, user.userId, body));
  } catch (err) {
    sendError(res, err, '현금영수증을 발행하지 못했습니다.');
  }
});

router.get('/issues/:id/view', async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user;
  const tenantId = await requireTenantIdFromAuth(res, user);
  if (!tenantId) return;
  try {
    res.json(await teamCashbillViewLink(tenantId, user.userId, req.params.id));
  } catch (err) {
    sendError(res, err, '영수증을 열지 못했습니다.');
  }
});

router.get('/issues/:id/share', async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user;
  const tenantId = await requireTenantIdFromAuth(res, user);
  if (!tenantId) return;
  try {
    res.json(await teamCashbillShareLink(tenantId, user.userId, req.params.id));
  } catch (err) {
    sendError(res, err, '영수증 주소를 받지 못했습니다.');
  }
});

router.post('/issues/:id/cancel-request', async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user;
  const tenantId = await requireTenantIdFromAuth(res, user);
  if (!tenantId) return;
  try {
    res.json(await requestTeamCashbillCancel(tenantId, user.userId, req.params.id));
  } catch (err) {
    sendError(res, err, '취소 요청을 보내지 못했습니다.');
  }
});

router.post('/charge-request', async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user;
  const tenantId = await requireTenantIdFromAuth(res, user);
  if (!tenantId) return;
  try {
    res.json(await requestTeamCashbillCharge(tenantId, user.userId));
  } catch (err) {
    sendError(res, err, '충전 요청을 보내지 못했습니다.');
  }
});

export default router;
