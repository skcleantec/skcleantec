import { Router } from 'express';
import type { PlatformReferrerCommissionStatus, PlatformReferrerStatus, PlatformReferrerType } from '@prisma/client';
import { platformAuthMiddleware, platformSuperAdminOnly } from '../platform/platformAuth.middleware.js';
import {
  createPlatformReferrer,
  getPlatformReferrerDetail,
  listPlatformReferrers,
  listReferrerCommissions,
  listReferrerSignups,
  PlatformReferrerError,
  updatePlatformReferrer,
  updateReferrerCommissionStatuses,
} from './platformReferrer.service.js';

const router = Router();

router.use(platformAuthMiddleware);

router.get('/', async (req, res) => {
  try {
    const status =
      typeof req.query.status === 'string' && ['ACTIVE', 'SUSPENDED'].includes(req.query.status)
        ? (req.query.status as PlatformReferrerStatus)
        : undefined;
    const q = typeof req.query.q === 'string' ? req.query.q : undefined;
    const data = await listPlatformReferrers({ status, q });
    res.json(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : '조회에 실패했습니다.';
    res.status(400).json({ error: msg });
  }
});

router.post('/', platformSuperAdminOnly, async (req, res) => {
  try {
    const body = req.body as {
      type?: PlatformReferrerType;
      code?: string;
      displayName?: string;
      contactEmail?: string | null;
      contactPhone?: string | null;
      partnerTenantId?: string | null;
      commissionRateBps?: number;
      eligiblePlanIds?: string[] | null;
      memo?: string | null;
    };
    const type = body.type === 'PARTNER' ? 'PARTNER' : 'INDIVIDUAL';
    const item = await createPlatformReferrer({
      type,
      code: String(body.code ?? ''),
      displayName: String(body.displayName ?? ''),
      contactEmail: body.contactEmail,
      contactPhone: body.contactPhone,
      partnerTenantId: body.partnerTenantId,
      commissionRateBps: body.commissionRateBps,
      eligiblePlanIds: body.eligiblePlanIds,
      memo: body.memo,
    });
    res.status(201).json({ item });
  } catch (e) {
    const msg = e instanceof PlatformReferrerError ? e.message : e instanceof Error ? e.message : '등록에 실패했습니다.';
    res.status(400).json({ error: msg });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const item = await getPlatformReferrerDetail(req.params.id);
    res.json({ item });
  } catch (e) {
    const msg = e instanceof PlatformReferrerError ? e.message : e instanceof Error ? e.message : '조회에 실패했습니다.';
    res.status(e instanceof PlatformReferrerError ? 404 : 400).json({ error: msg });
  }
});

router.patch('/:id', platformSuperAdminOnly, async (req, res) => {
  try {
    const body = req.body as {
      displayName?: string;
      contactEmail?: string | null;
      contactPhone?: string | null;
      partnerTenantId?: string | null;
      commissionRateBps?: number;
      eligiblePlanIds?: string[] | null;
      status?: PlatformReferrerStatus;
      memo?: string | null;
    };
    const item = await updatePlatformReferrer(req.params.id, body);
    res.json({ item });
  } catch (e) {
    const msg = e instanceof PlatformReferrerError ? e.message : e instanceof Error ? e.message : '저장에 실패했습니다.';
    res.status(400).json({ error: msg });
  }
});

router.get('/:id/signups', async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    const data = await listReferrerSignups(req.params.id, limit, offset);
    res.json(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : '조회에 실패했습니다.';
    res.status(400).json({ error: msg });
  }
});

router.get('/:id/commissions', async (req, res) => {
  try {
    const status =
      typeof req.query.status === 'string' &&
      ['PENDING', 'APPROVED', 'PAID', 'REVERSED'].includes(req.query.status)
        ? (req.query.status as PlatformReferrerCommissionStatus)
        : undefined;
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    const data = await listReferrerCommissions(req.params.id, { status, limit, offset });
    res.json(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : '조회에 실패했습니다.';
    res.status(400).json({ error: msg });
  }
});

router.post('/:id/commissions/status', platformSuperAdminOnly, async (req, res) => {
  try {
    const body = req.body as {
      accrualIds?: string[];
      status?: PlatformReferrerCommissionStatus;
      paidMemo?: string | null;
    };
    const status = body.status;
    if (!status || !['PENDING', 'APPROVED', 'PAID', 'REVERSED'].includes(status)) {
      res.status(400).json({ error: '상태를 선택해 주세요.' });
      return;
    }
    const result = await updateReferrerCommissionStatuses({
      referrerId: req.params.id,
      accrualIds: Array.isArray(body.accrualIds) ? body.accrualIds.map(String) : [],
      status,
      paidMemo: body.paidMemo,
    });
    res.json(result);
  } catch (e) {
    const msg = e instanceof PlatformReferrerError ? e.message : e instanceof Error ? e.message : '처리에 실패했습니다.';
    res.status(400).json({ error: msg });
  }
});

export default router;
