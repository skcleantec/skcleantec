import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { authMiddleware, adminOnly, type AuthPayload } from '../auth/auth.middleware.js';
import { getTenantIdFromAuth } from '../tenants/tenant.middleware.js';
import { listHouseholdLedgerEntries } from './teamLeaderHouseholdLedger.service.js';

const router = Router();
router.use(authMiddleware);
router.use(adminOnly);

/** 관리자 read-only — 팀장 개인 가계부 열람 */
router.get('/entries', async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user;
  const tenantId = getTenantIdFromAuth(user);
  if (!tenantId) {
    res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
    return;
  }
  const teamLeaderId =
    typeof req.query.teamLeaderId === 'string' ? req.query.teamLeaderId.trim() : '';
  if (!teamLeaderId) {
    res.status(400).json({ error: 'teamLeaderId가 필요합니다.' });
    return;
  }
  const leader = await prisma.user.findFirst({
    where: { id: teamLeaderId, tenantId, role: 'TEAM_LEADER', isActive: true },
    select: { id: true, name: true, email: true },
  });
  if (!leader) {
    res.status(404).json({ error: '팀장을 찾을 수 없습니다.' });
    return;
  }
  try {
    const data = await listHouseholdLedgerEntries(prisma, {
      tenantId,
      teamLeaderId,
      query: req.query as Record<string, unknown>,
    });
    res.json({ teamLeader: leader, ...data, readOnly: true });
  } catch (e) {
    console.error('[admin household-ledger GET /entries]', e);
    res.status(500).json({ error: '목록 조회에 실패했습니다.' });
  }
});

router.get('/team-leaders', async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user;
  const tenantId = getTenantIdFromAuth(user);
  if (!tenantId) {
    res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
    return;
  }
  const rows = await prisma.user.findMany({
    where: { tenantId, role: 'TEAM_LEADER', isActive: true },
    select: { id: true, name: true, email: true },
    orderBy: [{ name: 'asc' }, { email: 'asc' }],
  });
  res.json({ items: rows });
});

export default router;
