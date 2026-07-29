import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import type { AuthPayload } from '../auth/auth.middleware.js';
import { getTenantIdFromAuth } from '../tenants/tenant.middleware.js';
import {
  buildHouseholdLedgerPrefillOptions,
  HouseholdLedgerAccessError,
} from './teamLeaderHouseholdLedgerPrefill.service.js';
import {
  createHouseholdLedgerEntry,
  deleteHouseholdLedgerEntry,
  householdLedgerCategoriesResponse,
  HouseholdLedgerValidationError,
  listHouseholdLedgerEntries,
  updateHouseholdLedgerEntry,
} from './teamLeaderHouseholdLedger.service.js';
import { syncHouseholdLedgerFromAssignments } from './teamLeaderHouseholdLedgerSync.service.js';

const router = Router();

function requireTeamLeader(req: import('express').Request, res: import('express').Response): AuthPayload | null {
  const user = (req as unknown as { user: AuthPayload }).user;
  if (user.role !== 'TEAM_LEADER') {
    res.status(403).json({ error: '팀장 전용 메뉴입니다.' });
    return null;
  }
  return user;
}

router.get('/categories', async (req, res) => {
  const user = requireTeamLeader(req, res);
  if (!user) return;
  res.json(householdLedgerCategoriesResponse());
});

router.get('/entries', async (req, res) => {
  const user = requireTeamLeader(req, res);
  if (!user) return;
  const tenantId = getTenantIdFromAuth(user);
  if (!tenantId) {
    res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
    return;
  }
  try {
    const data = await listHouseholdLedgerEntries(prisma, {
      tenantId,
      teamLeaderId: user.userId,
      query: req.query as Record<string, unknown>,
    });
    res.json(data);
  } catch (e) {
    console.error('[household-ledger GET /entries]', e);
    res.status(500).json({ error: '목록 조회에 실패했습니다.' });
  }
});

router.get('/prefill/:inquiryId', async (req, res) => {
  const user = requireTeamLeader(req, res);
  if (!user) return;
  const tenantId = getTenantIdFromAuth(user);
  if (!tenantId) {
    res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
    return;
  }
  try {
    const data = await buildHouseholdLedgerPrefillOptions(prisma, {
      tenantId,
      teamLeaderId: user.userId,
      inquiryId: req.params.inquiryId,
    });
    res.json({
      ...data,
      suggestedOccurredOn: data.suggestedOccurredOn.toISOString().slice(0, 10),
    });
  } catch (e) {
    if (e instanceof HouseholdLedgerAccessError) {
      res.status(e.status).json({ error: e.message });
      return;
    }
    console.error('[household-ledger GET /prefill]', e);
    res.status(500).json({ error: '접수 정보를 불러오지 못했습니다.' });
  }
});

router.post('/sync-assignments', async (req, res) => {
  const user = requireTeamLeader(req, res);
  if (!user) return;
  const tenantId = getTenantIdFromAuth(user);
  if (!tenantId) {
    res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
    return;
  }
  try {
    const result = await syncHouseholdLedgerFromAssignments(prisma, {
      tenantId,
      teamLeaderId: user.userId,
    });
    res.json(result);
  } catch (e) {
    console.error('[household-ledger POST /sync-assignments]', e);
    res.status(500).json({ error: '배정 접수 불러오기에 실패했습니다.' });
  }
});

router.post('/entries', async (req, res) => {
  const user = requireTeamLeader(req, res);
  if (!user) return;
  const tenantId = getTenantIdFromAuth(user);
  if (!tenantId) {
    res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
    return;
  }
  try {
    const item = await createHouseholdLedgerEntry(prisma, {
      tenantId,
      teamLeaderId: user.userId,
      body: req.body as Record<string, unknown>,
    });
    res.status(201).json({ item });
  } catch (e) {
    if (e instanceof HouseholdLedgerValidationError) {
      res.status(e.status).json({ error: e.message });
      return;
    }
    if (e instanceof HouseholdLedgerAccessError) {
      res.status(e.status).json({ error: e.message });
      return;
    }
    console.error('[household-ledger POST /entries]', e);
    res.status(500).json({ error: '저장에 실패했습니다.' });
  }
});

router.patch('/entries/:id', async (req, res) => {
  const user = requireTeamLeader(req, res);
  if (!user) return;
  const tenantId = getTenantIdFromAuth(user);
  if (!tenantId) {
    res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
    return;
  }
  try {
    const item = await updateHouseholdLedgerEntry(prisma, {
      tenantId,
      teamLeaderId: user.userId,
      entryId: req.params.id,
      body: req.body as Record<string, unknown>,
    });
    res.json({ item });
  } catch (e) {
    if (e instanceof HouseholdLedgerValidationError) {
      res.status(e.status).json({ error: e.message });
      return;
    }
    if (e instanceof HouseholdLedgerAccessError) {
      res.status(e.status).json({ error: e.message });
      return;
    }
    console.error('[household-ledger PATCH /entries/:id]', e);
    res.status(500).json({ error: '수정에 실패했습니다.' });
  }
});

router.delete('/entries/:id', async (req, res) => {
  const user = requireTeamLeader(req, res);
  if (!user) return;
  const tenantId = getTenantIdFromAuth(user);
  if (!tenantId) {
    res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
    return;
  }
  try {
    await deleteHouseholdLedgerEntry(prisma, {
      tenantId,
      teamLeaderId: user.userId,
      entryId: req.params.id,
    });
    res.json({ ok: true });
  } catch (e) {
    if (e instanceof HouseholdLedgerValidationError) {
      res.status(e.status).json({ error: e.message });
      return;
    }
    console.error('[household-ledger DELETE /entries/:id]', e);
    res.status(500).json({ error: '삭제에 실패했습니다.' });
  }
});

export default router;
