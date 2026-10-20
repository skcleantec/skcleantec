import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { authMiddleware, adminOnly, type AuthPayload } from '../auth/auth.middleware.js';
import { getTenantIdFromAuth } from '../tenants/tenant.middleware.js';
import { HouseholdLedgerValidationError } from './teamLeaderHouseholdLedger.errors.js';
import { listHouseholdLedgerEntries } from './teamLeaderHouseholdLedger.service.js';
import {
  listAdminHouseholdWageOverview,
  setHouseholdWageEditableByLeader,
  upsertHouseholdWageSetting,
} from './teamLeaderHouseholdWage.service.js';

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

router.get('/wage-settings', async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user;
  const tenantId = getTenantIdFromAuth(user);
  if (!tenantId) {
    res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
    return;
  }
  const data = await listAdminHouseholdWageOverview(prisma, tenantId);
  res.json(data);
});

router.put('/wage-policy', async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user;
  const tenantId = getTenantIdFromAuth(user);
  if (!tenantId) {
    res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
    return;
  }
  const raw = (req.body as { leaderCanEdit?: unknown } | null)?.leaderCanEdit;
  if (typeof raw !== 'boolean') {
    res.status(400).json({ error: '스위치를 켜거나 끄는지 알려 주세요.' });
    return;
  }
  try {
    const leaderCanEdit = await setHouseholdWageEditableByLeader(prisma, { tenantId, leaderCanEdit: raw });
    res.json({ leaderCanEdit });
  } catch (e) {
    if (e instanceof HouseholdLedgerValidationError) {
      res.status(e.status).json({ error: e.message });
      return;
    }
    console.error('[admin household-ledger PUT /wage-policy]', e);
    res.status(500).json({ error: '임금 설정을 저장하지 못했습니다.' });
  }
});

router.put('/wage-settings', async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user;
  const tenantId = getTenantIdFromAuth(user);
  if (!tenantId) {
    res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
    return;
  }
  const body = (req.body ?? {}) as Record<string, unknown>;
  const teamLeaderId = typeof body.teamLeaderId === 'string' ? body.teamLeaderId.trim() : '';
  if (!teamLeaderId) {
    res.status(400).json({ error: '팀장을 선택해 주세요.' });
    return;
  }
  const leader = await prisma.user.findFirst({
    where: { id: teamLeaderId, tenantId, role: 'TEAM_LEADER', isActive: true },
    select: { id: true },
  });
  if (!leader) {
    res.status(404).json({ error: '팀장을 찾을 수 없습니다.' });
    return;
  }
  try {
    const setting = await upsertHouseholdWageSetting(prisma, { tenantId, teamLeaderId, body });
    res.json({ teamLeaderId, setting });
  } catch (e) {
    if (e instanceof HouseholdLedgerValidationError) {
      res.status(e.status).json({ error: e.message });
      return;
    }
    console.error('[admin household-ledger PUT /wage-settings]', e);
    res.status(500).json({ error: '임금 설정을 저장하지 못했습니다.' });
  }
});

export default router;
