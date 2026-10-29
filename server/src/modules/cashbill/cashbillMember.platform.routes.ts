import { Router } from 'express';
import { platformAuthMiddleware } from '../platform/platformAuth.middleware.js';
import {
  approveBarobillMember,
  CashbillMemberError,
  checkStaleBarobillProcessing,
  completeBarobillLink,
  listBarobillMembersForPlatform,
  rejectBarobillMember,
  releaseStaleBarobillProcessing,
} from './cashbillMember.service.js';
import { listCashbillPlatformHolds } from './cashbillIssue.service.js';

const router = Router();
router.use(platformAuthMiddleware);

router.get('/members', async (req, res) => {
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 30));
  const offset = Math.max(0, Number(req.query.offset) || 0);
  try {
    const page = await listBarobillMembersForPlatform({
      env: typeof req.query.env === 'string' ? req.query.env : undefined,
      status: typeof req.query.status === 'string' ? req.query.status : undefined,
      datePreset: typeof req.query.datePreset === 'string' ? req.query.datePreset : 'all',
      month: typeof req.query.month === 'string' ? req.query.month : undefined,
      day: typeof req.query.day === 'string' ? req.query.day : undefined,
      tenantId: typeof req.query.tenantId === 'string' ? req.query.tenantId : undefined,
      limit,
      offset,
    });
    res.json(page);
  } catch (err) {
    console.error('[cashbill] platform list', err instanceof Error ? err.name : 'error');
    res.status(500).json({ error: '회원사 목록을 불러오지 못했습니다.' });
  }
});

router.post('/members/:id/link-complete', async (req, res) => {
  const id = String(req.params.id ?? '').trim();
  const barobillUserId = typeof req.body?.barobillUserId === 'string' ? req.body.barobillUserId : '';
  try {
    res.json(await completeBarobillLink(id, barobillUserId));
  } catch (err) {
    if (err instanceof CashbillMemberError) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    console.error('[cashbill] link-complete', err instanceof Error ? err.name : 'error');
    res.status(500).json({ error: '처리완료에 실패했습니다.' });
  }
});

function platformUserId(req: { platformUser?: { platformUserId?: string } }): string {
  return req.platformUser?.platformUserId ?? '';
}

function sendMemberError(res: import('express').Response, err: unknown, fallback: string): void {
  if (err instanceof CashbillMemberError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  console.error('[cashbill] platform', err instanceof Error ? err.name : 'error');
  res.status(500).json({ error: fallback });
}

router.post('/members/:id/approve', async (req, res) => {
  const id = String(req.params.id ?? '').trim();
  const actor = platformUserId(req as unknown as { platformUser?: { platformUserId?: string } });
  if (!actor) {
    res.status(401).json({ error: '플랫폼 로그인이 필요합니다.' });
    return;
  }
  try {
    res.json(await approveBarobillMember(id, actor));
  } catch (err) {
    sendMemberError(res, err, '승인에 실패했습니다.');
  }
});

router.post('/members/:id/reject', async (req, res) => {
  const id = String(req.params.id ?? '').trim();
  const actor = platformUserId(req as unknown as { platformUser?: { platformUserId?: string } });
  if (!actor) {
    res.status(401).json({ error: '플랫폼 로그인이 필요합니다.' });
    return;
  }
  const reason = typeof req.body?.rejectReason === 'string' ? req.body.rejectReason : '';
  try {
    res.json(await rejectBarobillMember(id, actor, reason));
  } catch (err) {
    sendMemberError(res, err, '반려에 실패했습니다.');
  }
});

router.get('/holds', async (_req, res) => {
  try {
    res.json({ items: await listCashbillPlatformHolds() });
  } catch (err) {
    sendMemberError(res, err, '발급 보류 알림을 불러오지 못했습니다.');
  }
});

router.post('/members/:id/check-member', async (req, res) => {
  const id = String(req.params.id ?? '').trim();
  try {
    res.json(await checkStaleBarobillProcessing(id));
  } catch (err) {
    sendMemberError(res, err, '회원 여부를 확인하지 못했습니다.');
  }
});

router.post('/members/:id/release-processing', async (req, res) => {
  const id = String(req.params.id ?? '').trim();
  try {
    res.json(await releaseStaleBarobillProcessing(id));
  } catch (err) {
    sendMemberError(res, err, '검토 중으로 되돌리지 못했습니다.');
  }
});

export default router;
