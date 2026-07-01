import { Router } from 'express';
import { authMiddleware, type AuthPayload } from '../auth/auth.middleware.js';
import { requireStaffPermission } from '../auth/marketerPermission.middleware.js';
import { requireFeature } from '../tenants/requireTenantFeature.js';
import { requireTenantIdFromAuth } from '../tenants/tenantScope.helpers.js';
import {
  acceptPartnership,
  listPartnershipsForTenant,
  lookupPartnerTenantBySlug,
  rejectPartnership,
  requestPartnership,
  suspendPartnership,
  TenantPartnershipError,
} from './tenantPartnership.service.js';
import {
  createTenantInquiryShare,
  TenantInquiryShareError,
} from './tenantInquiryShare.service.js';
import {
  buildSettlementExportCsv,
  getSettlementOverview,
  getSettlementPartnerDetail,
  recordSettlementPayment,
  resetSettlementAccrual,
  TenantPartnerSettlementError,
} from './tenantPartnerSettlement.service.js';
import type { TenantPartnerSettlementRole } from '@prisma/client';

const router = Router();

router.use(authMiddleware, requireStaffPermission('admin.tenantPartners'), requireFeature('mod_tenant_exchange'));

function mapError(res: import('express').Response, e: unknown): boolean {
  if (
    e instanceof TenantPartnershipError ||
    e instanceof TenantInquiryShareError ||
    e instanceof TenantPartnerSettlementError
  ) {
    res.status(e.status).json({ error: e.message });
    return true;
  }
  return false;
}

function parseSettlementRole(raw: unknown): TenantPartnerSettlementRole | null {
  return raw === 'SELLER' || raw === 'BUYER' ? raw : null;
}

/** 파트너 후보 조회 (업체 코드) */
router.get('/lookup/:slug', async (req, res) => {
  const tenantId = await requireTenantIdFromAuth(res, (req as unknown as { user: AuthPayload }).user);
  if (!tenantId) return;
  const slug = typeof req.params.slug === 'string' ? req.params.slug : '';
  try {
    const partner = await lookupPartnerTenantBySlug(tenantId, slug);
    res.json({ partner });
  } catch (e) {
    if (mapError(res, e)) return;
    throw e;
  }
});

/** 접수 DB 전달 (송신 테넌트 → ACTIVE 파트너 mirror 생성) */
router.post('/shares', async (req, res) => {
  const auth = (req as unknown as { user: AuthPayload }).user;
  const tenantId = await requireTenantIdFromAuth(res, auth);
  if (!tenantId) return;
  const body = req.body as {
    inquiryId?: unknown;
    partnershipId?: unknown;
    transferFee?: unknown;
    fieldMask?: unknown;
    fieldPreset?: unknown;
  };
  const inquiryId = typeof body.inquiryId === 'string' ? body.inquiryId.trim() : '';
  const partnershipId = typeof body.partnershipId === 'string' ? body.partnershipId.trim() : '';
  if (!inquiryId || !partnershipId) {
    res.status(400).json({ error: '접수와 파트너를 선택해 주세요.' });
    return;
  }
  let transferFee: number | null | undefined;
  if (body.transferFee === undefined || body.transferFee === null || body.transferFee === '') {
    transferFee = null;
  } else if (typeof body.transferFee === 'number' && Number.isFinite(body.transferFee)) {
    transferFee = body.transferFee;
  } else if (typeof body.transferFee === 'string' && body.transferFee.trim() !== '') {
    const n = parseInt(body.transferFee.replace(/,/g, ''), 10);
    if (Number.isNaN(n)) {
      res.status(400).json({ error: '수수료는 숫자로 입력해 주세요.' });
      return;
    }
    transferFee = n;
  } else {
    res.status(400).json({ error: '수수료 형식이 올바르지 않습니다.' });
    return;
  }
  try {
    const result = await createTenantInquiryShare({
      viewerTenantId: tenantId,
      viewerUserId: auth.userId,
      inquiryId,
      partnershipId,
      transferFee,
      fieldMask: body.fieldMask,
      fieldPreset: body.fieldPreset,
    });
    res.status(201).json(result);
  } catch (e) {
    if (mapError(res, e)) return;
    throw e;
  }
});

/** 정산 내역 CSV 다운로드 */
router.get('/settlement/export', async (req, res) => {
  const tenantId = await requireTenantIdFromAuth(res, (req as unknown as { user: AuthPayload }).user);
  if (!tenantId) return;
  const role = parseSettlementRole(req.query.role);
  const partnerTenantId =
    typeof req.query.partnerTenantId === 'string' ? req.query.partnerTenantId.trim() : '';
  if (!role || !partnerTenantId) {
    res.status(400).json({ error: 'role(SELLER|BUYER)와 partnerTenantId가 필요합니다.' });
    return;
  }
  const from = typeof req.query.from === 'string' ? req.query.from.trim() : undefined;
  const to = typeof req.query.to === 'string' ? req.query.to.trim() : undefined;
  try {
    const csv = await buildSettlementExportCsv({
      viewerTenantId: tenantId,
      role,
      partnerTenantId,
      from,
      to,
    });
    const filename = `tenant-partner-settlement-${role.toLowerCase()}-${partnerTenantId.slice(0, 8)}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (e) {
    if (mapError(res, e)) return;
    throw e;
  }
});

/** 판매(받을 금액) 파트너별 정산 요약 */
router.get('/settlement/seller-summary', async (req, res) => {
  const tenantId = await requireTenantIdFromAuth(res, (req as unknown as { user: AuthPayload }).user);
  if (!tenantId) return;
  try {
    const result = await getSettlementOverview(tenantId, 'SELLER');
    res.json({
      items: result.items.map((row) => ({
        ...row,
        payableAmount: row.accruedAmount,
      })),
    });
  } catch (e) {
    if (mapError(res, e)) return;
    throw e;
  }
});

/** 구매(지급할 금액) 파트너별 정산 요약 */
router.get('/settlement/buyer-summary', async (req, res) => {
  const tenantId = await requireTenantIdFromAuth(res, (req as unknown as { user: AuthPayload }).user);
  if (!tenantId) return;
  try {
    const result = await getSettlementOverview(tenantId, 'BUYER');
    res.json({ items: result.items });
  } catch (e) {
    if (mapError(res, e)) return;
    throw e;
  }
});

/** 파트너별 정산 상세(기간·내역·지급 이력) */
router.get('/settlement/partner-detail', async (req, res) => {
  const tenantId = await requireTenantIdFromAuth(res, (req as unknown as { user: AuthPayload }).user);
  if (!tenantId) return;
  const role = parseSettlementRole(req.query.role);
  const partnerTenantId =
    typeof req.query.partnerTenantId === 'string' ? req.query.partnerTenantId.trim() : '';
  if (!role || !partnerTenantId) {
    res.status(400).json({ error: 'role(SELLER|BUYER)와 partnerTenantId가 필요합니다.' });
    return;
  }
  const from = typeof req.query.from === 'string' ? req.query.from.trim() : undefined;
  const to = typeof req.query.to === 'string' ? req.query.to.trim() : undefined;
  try {
    const detail = await getSettlementPartnerDetail({
      viewerTenantId: tenantId,
      role,
      partnerTenantId,
      from,
      to,
    });
    res.json(detail);
  } catch (e) {
    if (mapError(res, e)) return;
    throw e;
  }
});

/** 정산 수금/지급 기록 */
router.post('/settlement/payments', async (req, res) => {
  const auth = (req as unknown as { user: AuthPayload }).user;
  const tenantId = await requireTenantIdFromAuth(res, auth);
  if (!tenantId) return;
  const body = req.body as {
    partnerTenantId?: unknown;
    role?: unknown;
    amount?: unknown;
    memo?: unknown;
    paidDate?: unknown;
  };
  const partnerTenantId =
    typeof body.partnerTenantId === 'string' ? body.partnerTenantId.trim() : '';
  const role = parseSettlementRole(body.role);
  const amount = Number(body.amount);
  const memo = typeof body.memo === 'string' ? body.memo : undefined;
  const paidDate = typeof body.paidDate === 'string' ? body.paidDate : undefined;
  if (!partnerTenantId || !role) {
    res.status(400).json({ error: '파트너와 역할(SELLER|BUYER)이 필요합니다.' });
    return;
  }
  try {
    const result = await recordSettlementPayment({
      viewerTenantId: tenantId,
      viewerUserId: auth.userId,
      partnerTenantId,
      role,
      amount,
      memo,
      paidDate,
    });
    res.json({ ok: true, ...result });
  } catch (e) {
    if (mapError(res, e)) return;
    throw e;
  }
});

/** 정산 누적 초기화 */
router.post('/settlement/reset-accrual', async (req, res) => {
  const auth = (req as unknown as { user: AuthPayload }).user;
  const tenantId = await requireTenantIdFromAuth(res, auth);
  if (!tenantId) return;
  const body = req.body as { partnerTenantId?: unknown; role?: unknown };
  const partnerTenantId =
    typeof body.partnerTenantId === 'string' ? body.partnerTenantId.trim() : '';
  const role = parseSettlementRole(body.role);
  if (!partnerTenantId || !role) {
    res.status(400).json({ error: '파트너와 역할(SELLER|BUYER)이 필요합니다.' });
    return;
  }
  try {
    const result = await resetSettlementAccrual({
      viewerTenantId: tenantId,
      viewerUserId: auth.userId,
      partnerTenantId,
      role,
    });
    res.json(result);
  } catch (e) {
    if (mapError(res, e)) return;
    throw e;
  }
});

/** 내 파트너십 목록 */
router.get('/', async (req, res) => {
  const tenantId = await requireTenantIdFromAuth(res, (req as unknown as { user: AuthPayload }).user);
  if (!tenantId) return;
  const items = await listPartnershipsForTenant(tenantId);
  res.json({ items });
});

/** 파트너 초대 (상대 slug) */
router.post('/request', async (req, res) => {
  const tenantId = await requireTenantIdFromAuth(res, (req as unknown as { user: AuthPayload }).user);
  if (!tenantId) return;
  const body = req.body as { partnerSlug?: unknown; memo?: unknown };
  const partnerSlug = typeof body.partnerSlug === 'string' ? body.partnerSlug.trim() : '';
  if (!partnerSlug) {
    res.status(400).json({ error: '상대 업체 코드를 입력해 주세요.' });
    return;
  }
  const memo = typeof body.memo === 'string' ? body.memo : undefined;
  try {
    const partnership = await requestPartnership(tenantId, partnerSlug, memo);
    res.status(201).json({ partnership });
  } catch (e) {
    if (mapError(res, e)) return;
    throw e;
  }
});

router.post('/:id/accept', async (req, res) => {
  const tenantId = await requireTenantIdFromAuth(res, (req as unknown as { user: AuthPayload }).user);
  if (!tenantId) return;
  const id = typeof req.params.id === 'string' ? req.params.id.trim() : '';
  try {
    const partnership = await acceptPartnership(id, tenantId);
    res.json({ partnership });
  } catch (e) {
    if (mapError(res, e)) return;
    throw e;
  }
});

router.post('/:id/reject', async (req, res) => {
  const tenantId = await requireTenantIdFromAuth(res, (req as unknown as { user: AuthPayload }).user);
  if (!tenantId) return;
  const id = typeof req.params.id === 'string' ? req.params.id.trim() : '';
  try {
    const partnership = await rejectPartnership(id, tenantId);
    res.json({ partnership });
  } catch (e) {
    if (mapError(res, e)) return;
    throw e;
  }
});

router.post('/:id/suspend', async (req, res) => {
  const tenantId = await requireTenantIdFromAuth(res, (req as unknown as { user: AuthPayload }).user);
  if (!tenantId) return;
  const id = typeof req.params.id === 'string' ? req.params.id.trim() : '';
  try {
    const partnership = await suspendPartnership(id, tenantId);
    res.json({ partnership });
  } catch (e) {
    if (mapError(res, e)) return;
    throw e;
  }
});

export default router;
