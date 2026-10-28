import { Router, type Response } from 'express';
import { authMiddleware, type AuthPayload } from '../auth/auth.middleware.js';
import { requireTenantAuth } from '../tenants/tenant.middleware.js';
import { requireTenantIdFromAuth } from '../tenants/tenantScope.helpers.js';
import { requireFeature } from '../tenants/requireTenantFeature.js';
import { CASHBILL_MODULE_ID } from '../../lib/barobill/policy.js';
import {
  cancelInquiryCashbill,
  CashbillIssueError,
  copyInquiryCashbillMail,
  getInquiryCashbill,
  issueInquiryCashbill,
  listCashbillIssues,
} from './cashbillIssue.service.js';

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
      limit,
      offset,
    }));
  } catch (err) {
    sendError(res, err, '현금영수증 목록을 불러오지 못했습니다.');
  }
});

router.get('/inquiries/:inquiryId', async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user;
  if (!staff(res, user)) return;
  const tenantId = await requireTenantIdFromAuth(res, user);
  if (!tenantId) return;
  try {
    res.json(await getInquiryCashbill(tenantId, req.params.inquiryId));
  } catch (err) {
    sendError(res, err, '현금영수증을 불러오지 못했습니다.');
  }
});

router.post('/inquiries/:inquiryId/issue', async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user;
  if (!staff(res, user)) return;
  const tenantId = await requireTenantIdFromAuth(res, user);
  if (!tenantId) return;
  try {
    res.json(await issueInquiryCashbill(tenantId, user.userId, req.params.inquiryId, req.body ?? {}));
  } catch (err) {
    sendError(res, err, '현금영수증 발급에 실패했습니다.');
  }
});

router.post('/inquiries/:inquiryId/cancel', async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user;
  if (!staff(res, user)) return;
  const tenantId = await requireTenantIdFromAuth(res, user);
  if (!tenantId) return;
  try {
    res.json(await cancelInquiryCashbill(tenantId, user.userId, req.params.inquiryId, req.body ?? {}));
  } catch (err) {
    sendError(res, err, '현금영수증 취소에 실패했습니다.');
  }
});

router.post('/inquiries/:inquiryId/issues/:issueId/mail', async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user;
  if (!staff(res, user)) return;
  const tenantId = await requireTenantIdFromAuth(res, user);
  if (!tenantId) return;
  try {
    res.json(await copyInquiryCashbillMail(tenantId, req.params.inquiryId, req.params.issueId));
  } catch (err) {
    sendError(res, err, '확인 주소를 만들지 못했습니다.');
  }
});

export default router;
