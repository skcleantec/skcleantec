import { Router, type Request, type Response } from 'express';
import { prisma } from '../../lib/prisma.js';
import { teamAuthMiddleware } from '../auth/auth.middleware.team.js';
import type { AuthPayload } from '../auth/auth.middleware.js';
import { isFeatureEnabled } from '../tenants/tenantFeatures.service.js';
import { requireTenantIdFromAuth } from '../tenants/tenantScope.helpers.js';
import {
  cancelExpectation,
  claimDeposit,
  declineDeposit,
  listMyClaimInquiries,
  listOpenForLeader,
  readExpectation,
  saveExpectation,
} from './bankDepositTeam.service.js';

const router = Router();
router.use(teamAuthMiddleware);

function userOf(req: Request): AuthPayload | undefined {
  return (req as Request & { user?: AuthPayload }).user;
}

function featureOff(res: Response): void {
  res.status(403).json({
    error: '이 업체에서 사용하지 않는 기능입니다.',
    code: 'feature_disabled',
    moduleId: 'mod_bank_deposit',
  });
}

async function ready(req: Request, res: Response) {
  const user = userOf(req);
  if (!user || user.role !== 'TEAM_LEADER') {
    res.status(403).json({ error: '팀장 권한이 필요합니다.' });
    return null;
  }
  const tenantId = await requireTenantIdFromAuth(res, user);
  if (!tenantId) return null;
  if (!(await isFeatureEnabled(tenantId, 'mod_bank_deposit'))) {
    featureOff(res);
    return null;
  }
  return { user, tenantId };
}

router.get('/bank-deposits/open', async (req, res) => {
  const gate = await ready(req, res);
  if (!gate) return;
  res.json(await listOpenForLeader(prisma, gate.tenantId, gate.user.userId));
});

router.get('/bank-deposits/:id/my-inquiries', async (req, res) => {
  const gate = await ready(req, res);
  if (!gate) return;
  const listed = await listMyClaimInquiries(prisma, gate.tenantId, gate.user.userId, req.params.id);
  if (!listed) {
    res.status(404).json({ error: '입금을 찾지 못했어요.' });
    return;
  }
  res.json(listed);
});

router.post('/bank-deposits/:id/claim', async (req, res) => {
  const gate = await ready(req, res);
  if (!gate) return;
  const body = (req.body ?? {}) as { inquiryId?: unknown; kind?: unknown; mismatchReason?: unknown; note?: unknown };
  const inquiryId = typeof body.inquiryId === 'string' ? body.inquiryId.trim() : '';
  const kind = body.kind === 'BALANCE' || body.kind === 'TOTAL' ? body.kind : null;
  const mismatchReason = typeof body.mismatchReason === 'string' ? body.mismatchReason.trim() : null;
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 200) : null;
  if (!inquiryId || !kind) {
    res.status(400).json({ error: '접수와 잔금·총액 구분이 필요해요.' });
    return;
  }
  const leader = await prisma.user.findFirst({
    where: { id: gate.user.userId, tenantId: gate.tenantId, role: 'TEAM_LEADER' },
    select: { name: true },
  });
  if (!leader) {
    res.status(403).json({ error: '팀장 권한이 필요합니다.' });
    return;
  }
  const result = await claimDeposit(prisma, {
    tenantId: gate.tenantId,
    teamLeaderId: gate.user.userId,
    teamLeaderName: leader.name,
    depositId: req.params.id,
    inquiryId,
    kind,
    mismatchReason,
    note,
  });
  if ('error' in result && result.error === 'missing') {
    res.status(404).json({ error: '입금을 찾지 못했어요.' });
    return;
  }
  if ('error' in result && result.error === 'forbidden') {
    res.status(403).json({ error: '내게 배정된 접수만 연결할 수 있어요.' });
    return;
  }
  if ('error' in result && result.error === 'bad_kind') {
    res.status(400).json({ error: '잔금 또는 총액만 연결할 수 있어요.' });
    return;
  }
  if ('error' in result && result.error === 'mismatch') {
    res.status(400).json({ error: '잔금과 금액이 다르면 이유를 골라 주세요.' });
    return;
  }
  if ('error' in result && result.error === 'resolved') {
    res.status(409).json({ resolvedByName: result.resolvedByName });
    return;
  }
  res.json({ ok: true });
});

router.post('/bank-deposits/:id/decline', async (req, res) => {
  const gate = await ready(req, res);
  if (!gate) return;
  const result = await declineDeposit(prisma, gate.tenantId, gate.user.userId, req.params.id);
  if ('error' in result) {
    res.status(404).json({ error: '입금을 찾지 못했어요.' });
    return;
  }
  res.json({ ok: true });
});

router.get('/inquiries/:inquiryId/deposit-expectation', async (req, res) => {
  const gate = await ready(req, res);
  if (!gate) return;
  const result = await readExpectation(prisma, gate.tenantId, gate.user.userId, req.params.inquiryId);
  if ('error' in result && result.error === 'forbidden') {
    res.status(403).json({ error: '내게 배정된 접수만 볼 수 있어요.' });
    return;
  }
  if ('error' in result) {
    res.status(404).json({ error: '접수를 찾지 못했어요.' });
    return;
  }
  res.json(result);
});

router.put('/inquiries/:inquiryId/deposit-expectation', async (req, res) => {
  const gate = await ready(req, res);
  if (!gate) return;
  const body = (req.body ?? {}) as { depositorName?: unknown; amountWon?: unknown };
  const depositorName = typeof body.depositorName === 'string' ? body.depositorName : '';
  const amountWon = typeof body.amountWon === 'number' ? Math.trunc(body.amountWon) : Number(body.amountWon);
  const result = await saveExpectation(prisma, {
    tenantId: gate.tenantId,
    teamLeaderId: gate.user.userId,
    inquiryId: req.params.inquiryId,
    depositorName,
    amountWon: Number.isFinite(amountWon) ? amountWon : 0,
  });
  if ('error' in result && result.error === 'forbidden') {
    res.status(403).json({ error: '내게 배정된 접수만 적을 수 있어요.' });
    return;
  }
  if ('error' in result && result.error === 'bad') {
    res.status(400).json({ error: '입금자명과 금액을 적어 주세요.' });
    return;
  }
  if ('error' in result) {
    res.status(409).json({ error: '대기를 저장하지 못했어요.' });
    return;
  }
  res.json(result);
});

router.delete('/inquiries/:inquiryId/deposit-expectation', async (req, res) => {
  const gate = await ready(req, res);
  if (!gate) return;
  const result = await cancelExpectation(prisma, gate.tenantId, gate.user.userId, req.params.inquiryId);
  if ('error' in result) {
    res.status(403).json({ error: '내게 배정된 접수만 취소할 수 있어요.' });
    return;
  }
  res.json({ ok: true });
});

export default router;
