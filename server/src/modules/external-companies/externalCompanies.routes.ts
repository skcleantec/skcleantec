import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../../lib/prisma.js';
import { authMiddleware, type AuthPayload } from '../auth/auth.middleware.js';
import { requireStaffPermission, staffMarketerRoleOnly } from '../auth/marketerPermission.middleware.js';
import { getTenantIdFromAuth } from '../tenants/tenant.middleware.js';
import { requireTenantIdFromAuth } from '../tenants/tenantScope.helpers.js';
import { resolveExternalSettlementPaidAt } from '../../lib/externalSettlementPaidAt.js';
import { loadMarketplaceConfirmedInquiryIdSet, loadMarketplaceExternalBuyerByInquiry } from '../db-marketplace/dbMarketplaceSettlementMeta.js';
import {
  hybridLegacySettlementFromShare,
  resolveExternalSettlementCompanyAttribution,
} from '../../lib/externalSettlementAttribution.js';
import { signedExternalSettlementFee } from '../../lib/externalSettlementSignedFee.js';
import {
  computeSignedExternalFeeBeforeDate,
  fetchExternalSettlementInquiriesForCompanyPeriod,
  filterExternalSettlementItemsBySearch,
  filterInquiriesByEffectiveSettlementDate,
  kstYmdFromDate,
  loadMarketplaceExternalConfirmAtMap,
  externalSettlementPeriodOrClause,
  resolveExternalSettlementEffectiveDate,
  endOfKstToday,
} from '../../lib/externalSettlementEffectiveDate.js';
import { resolveSettlementOperatingCompanyId } from '../../lib/externalSettlementOperatingCompanyScope.js';
import { EXTERNAL_PARTNER_PENDING_CONTACT_NAME } from '../onboarding/profileOnboarding.service.js';
import { assertValidTenantLoginId } from '../auth/tenantLoginId.js';
import { sumExternalSettlementSignedFeeByCompany, sumExternalSettlementPaidByCompany } from './externalSettlementOverview.service.js';
import {
  ExternalToPartnerMigrationError,
  linkExternalCompanyToPartnerTenant,
  listMigrationEligibleInquiries,
  migrateExternalInquiriesToHybridPartner,
} from './externalToPartnerMigration.service.js';
import {
  getExternalSettlementPayableFeesCached,
  invalidateExternalSettlementOverviewPayableCache,
} from './externalSettlementOverviewCache.js';

function buildExternalSettlementOverviewItems(
  companies: { id: string; name: string }[],
  signedByCompany: Map<string, number>,
  paidByCompany: Map<string, number>,
) {
  for (const c of companies) {
    if (!signedByCompany.has(c.id)) signedByCompany.set(c.id, 0);
  }
  return companies.map((c) => {
    const payableAmount = signedByCompany.get(c.id) ?? 0;
    const paidAmount = paidByCompany.get(c.id) ?? 0;
    return {
      externalCompanyId: c.id,
      companyName: c.name,
      payableAmount,
      paidAmount,
      remainingAmount: payableAmount - paidAmount,
    };
  });
}

const router = Router();

router.use(authMiddleware, staffMarketerRoleOnly);

const YMD = /^\d{4}-\d{2}-\d{2}$/;
const YM = /^\d{4}-\d{2}$/;

async function requireActiveExternalCompanyInTenant(
  res: import('express').Response,
  tenantId: string,
  id: string,
) {
  const co = await prisma.externalCompany.findFirst({
    where: { id, tenantId, isActive: true },
  });
  if (!co) {
    res.status(404).json({ error: '타업체를 찾을 수 없습니다.' });
    return null;
  }
  return co;
}

function kstYmd(d: Date): string {
  return d.toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10);
}

/** 타업체 목록 + 소속 로그인 계정 수 */
router.get('/', requireStaffPermission('admin.users'), async (req, res) => {
  const tenantId = await requireTenantIdFromAuth(res, (req as unknown as { user: AuthPayload }).user);
  if (!tenantId) return;

  const rows = await prisma.externalCompany.findMany({
    where: { tenantId, isActive: true },
    orderBy: { name: 'asc' },
    include: {
      _count: { select: { partnerUsers: true } },
      partnerUsers: {
        where: { isActive: true },
        select: { id: true, email: true, name: true, phone: true },
      },
      linkedPartnerTenant: { select: { id: true, name: true, slug: true } },
    },
  });
  res.json({
    items: rows.map((r) => ({
      id: r.id,
      name: r.name,
      bizNumber: r.bizNumber,
      phone: r.phone,
      memo: r.memo,
      partnerUserCount: r._count.partnerUsers,
      partnerUsers: r.partnerUsers,
      linkedPartnerTenant: r.linkedPartnerTenant
        ? {
            id: r.linkedPartnerTenant.id,
            name: r.linkedPartnerTenant.name,
            slug: r.linkedPartnerTenant.slug,
          }
        : null,
      promotedAt: r.promotedAt?.toISOString() ?? null,
      usageDisabledAt: r.usageDisabledAt?.toISOString() ?? null,
    })),
  });
});

/** 신규 배정·캘린더 등 선택 가능한 타업체 목록 */
router.get('/selectable', async (req, res) => {
  const tenantId = await requireTenantIdFromAuth(res, (req as unknown as { user: AuthPayload }).user);
  if (!tenantId) return;

  const rows = await prisma.externalCompany.findMany({
    where: { tenantId, isActive: true, usageDisabledAt: null },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
  res.json({ items: rows });
});

/** 타업체 id → 이름 조회 (사용 중지 포함, isActive=true 만) — 스케줄·캘린더 라벨용 */
router.get('/lookup', async (req, res) => {
  const tenantId = await requireTenantIdFromAuth(res, (req as unknown as { user: AuthPayload }).user);
  if (!tenantId) return;

  const idsRaw = typeof req.query.ids === 'string' ? req.query.ids : '';
  const ids = [...new Set(idsRaw.split(',').map((s) => s.trim()).filter(Boolean))];
  if (ids.length === 0) {
    res.json({ items: [] });
    return;
  }

  const rows = await prisma.externalCompany.findMany({
    where: { tenantId, isActive: true, id: { in: ids } },
    select: { id: true, name: true, usageDisabledAt: true },
    orderBy: { name: 'asc' },
  });
  res.json({
    items: rows.map((r) => ({
      id: r.id,
      name: r.name,
      usageDisabledAt: r.usageDisabledAt?.toISOString() ?? null,
    })),
  });
});

/**
 * 타업체 등록 + 로그인 계정 1개(EXTERNAL_PARTNER)
 * body: { name, bizNumber?, phone?, memo?, login: { email, password, contactName?, phone? } }
 * 관리자 필수: 업체명 + 로그인 아이디·비밀번호. 담당자·사업자 정보는 첫 로그인 온보딩.
 */
router.post('/', requireStaffPermission('admin.users'), async (req, res) => {
  const authUser = (req as unknown as { user: AuthPayload }).user;
  const tenantId = getTenantIdFromAuth(authUser);
  if (!tenantId) {
    res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
    return;
  }
  const body = req.body as {
    name?: string;
    bizNumber?: string;
    phone?: string;
    memo?: string;
    login?: { email?: string; password?: string; contactName?: string; phone?: string };
  };
  const name = String(body.name ?? '').trim();
  if (!name) {
    res.status(400).json({ error: '업체명을 입력해주세요.' });
    return;
  }
  const login = body.login;
  const password = login?.password != null ? String(login.password) : '';
  if (!password) {
    res.status(400).json({ error: '로그인 아이디·비밀번호를 입력해주세요.' });
    return;
  }
  let email: string;
  try {
    email = assertValidTenantLoginId(String(login?.email ?? ''));
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : '유효하지 않은 아이디입니다.' });
    return;
  }
  const contactNameRaw = String(login?.contactName ?? '').trim();
  const contactName = contactNameRaw || EXTERNAL_PARTNER_PENDING_CONTACT_NAME;
  const taken = await prisma.user.findUnique({
    where: { tenantId_email: { tenantId, email } },
  });
  if (taken) {
    res.status(400).json({ error: '이미 사용 중인 아이디입니다.' });
    return;
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const result = await prisma.$transaction(async (tx) => {
    const company = await tx.externalCompany.create({
      data: {
        tenantId,
        name,
        bizNumber: body.bizNumber ? String(body.bizNumber).trim() || null : null,
        phone: body.phone ? String(body.phone).trim() || null : null,
        memo: body.memo ? String(body.memo).trim() || null : null,
      },
    });
    const user = await tx.user.create({
      data: {
        tenantId,
        email,
        passwordHash,
        name: contactName,
        phone: login?.phone ? String(login.phone).trim() || null : null,
        role: 'EXTERNAL_PARTNER',
        externalCompanyId: company.id,
        profileCompletedAt: null,
      },
      select: { id: true, email: true, name: true, phone: true },
    });
    return { company, user };
  });
  res.status(201).json({
    company: {
      id: result.company.id,
      name: result.company.name,
      bizNumber: result.company.bizNumber,
      phone: result.company.phone,
      memo: result.company.memo,
    },
    user: result.user,
  });
});

router.patch('/:id', requireStaffPermission('admin.users'), async (req, res) => {
  const authUser = (req as unknown as { user: AuthPayload }).user;
  const tenantId = await requireTenantIdFromAuth(res, authUser);
  if (!tenantId) return;

  const { id } = req.params;
  const body = req.body as {
    name?: string;
    bizNumber?: string | null;
    phone?: string | null;
    memo?: string | null;
    usageDisabled?: boolean;
  };
  const existing = await requireActiveExternalCompanyInTenant(res, tenantId, id);
  if (!existing) return;
  const data: {
    name?: string;
    bizNumber?: string | null;
    phone?: string | null;
    memo?: string | null;
    usageDisabledAt?: Date | null;
    usageDisabledByUserId?: string | null;
  } = {};
  if (body.name != null) {
    const n = String(body.name).trim();
    if (!n) {
      res.status(400).json({ error: '업체명을 입력해주세요.' });
      return;
    }
    data.name = n;
  }
  if (body.bizNumber !== undefined) {
    data.bizNumber = body.bizNumber == null || String(body.bizNumber).trim() === '' ? null : String(body.bizNumber).trim();
  }
  if (body.phone !== undefined) {
    data.phone = body.phone == null || String(body.phone).trim() === '' ? null : String(body.phone).trim();
  }
  if (body.memo !== undefined) {
    data.memo = body.memo == null || String(body.memo).trim() === '' ? null : String(body.memo).trim();
  }
  if (body.usageDisabled !== undefined) {
    const disable = Boolean(body.usageDisabled);
    if (disable) {
      data.usageDisabledAt = new Date();
      data.usageDisabledByUserId = authUser.userId;
    } else {
      data.usageDisabledAt = null;
      data.usageDisabledByUserId = null;
    }
  }
  if (Object.keys(data).length === 0) {
    res.json({
      id: existing.id,
      name: existing.name,
      bizNumber: existing.bizNumber,
      phone: existing.phone,
      memo: existing.memo,
      usageDisabledAt: existing.usageDisabledAt?.toISOString() ?? null,
    });
    return;
  }
  const updated = await prisma.externalCompany.update({
    where: { id },
    data,
  });
  res.json({
    id: updated.id,
    name: updated.name,
    bizNumber: updated.bizNumber,
    phone: updated.phone,
    memo: updated.memo,
    usageDisabledAt: updated.usageDisabledAt?.toISOString() ?? null,
  });
});

/** 타업체 비활성 + 소속 계정 비활성 */
router.post('/:id/deactivate', requireStaffPermission('admin.users'), async (req, res) => {
  const tenantId = await requireTenantIdFromAuth(res, (req as unknown as { user: AuthPayload }).user);
  if (!tenantId) return;

  const { id } = req.params;
  const existing = await requireActiveExternalCompanyInTenant(res, tenantId, id);
  if (!existing) return;
  await prisma.$transaction(async (tx) => {
    await tx.externalCompany.update({ where: { id }, data: { isActive: false } });
    await tx.user.updateMany({
      where: { externalCompanyId: id, role: 'EXTERNAL_PARTNER' },
      data: { isActive: false },
    });
  });
  res.json({ ok: true });
});

/** 타업체 ↔ 정식 파트너 테넌트 연결 (승격) */
router.post('/:id/link-partner-tenant', requireStaffPermission('admin.users'), async (req, res) => {
  const authUser = (req as unknown as { user: AuthPayload }).user;
  const tenantId = await requireTenantIdFromAuth(res, authUser);
  if (!tenantId) return;

  const partnerTenantId =
    typeof (req.body as { partnerTenantId?: unknown }).partnerTenantId === 'string'
      ? String((req.body as { partnerTenantId: string }).partnerTenantId).trim()
      : '';
  if (!partnerTenantId) {
    res.status(400).json({ error: 'partnerTenantId가 필요합니다.' });
    return;
  }

  try {
    const result = await linkExternalCompanyToPartnerTenant({
      tenantId,
      externalCompanyId: req.params.id,
      partnerTenantId,
    });
    res.json(result);
  } catch (e) {
    if (e instanceof ExternalToPartnerMigrationError) {
      res.status(e.status).json({ error: e.message });
      return;
    }
    throw e;
  }
});

/** 타업체 → 파트너 DB 이관 대상 목록 */
router.get('/:id/migration-eligible-inquiries', requireStaffPermission('admin.users'), async (req, res) => {
  const tenantId = await requireTenantIdFromAuth(res, (req as unknown as { user: AuthPayload }).user);
  if (!tenantId) return;

  const operatingCompanyId =
    typeof req.query.operatingCompanyId === 'string' ? req.query.operatingCompanyId.trim() : undefined;

  try {
    const items = await listMigrationEligibleInquiries({
      tenantId,
      externalCompanyId: req.params.id,
      operatingCompanyId,
    });
    res.json({ items });
  } catch (e) {
    if (e instanceof ExternalToPartnerMigrationError) {
      res.status(e.status).json({ error: e.message });
      return;
    }
    throw e;
  }
});

/** 타업체 DB → 하이브리드 파트너 연계 일괄 이관 */
router.post('/:id/migrate-to-partner', requireStaffPermission('admin.users'), async (req, res) => {
  const authUser = (req as unknown as { user: AuthPayload }).user;
  const tenantId = await requireTenantIdFromAuth(res, authUser);
  if (!tenantId) return;

  const body = req.body as {
    inquiryIds?: string[];
    allEligible?: boolean;
    dryRun?: boolean;
  };

  try {
    const result = await migrateExternalInquiriesToHybridPartner({
      tenantId,
      userId: authUser.userId,
      externalCompanyId: req.params.id,
      inquiryIds: body.inquiryIds,
      allEligible: body.allEligible === true,
      dryRun: body.dryRun === true,
    });
    invalidateExternalSettlementOverviewPayableCache(tenantId);
    res.json(result);
  } catch (e) {
    if (e instanceof ExternalToPartnerMigrationError) {
      res.status(e.status).json({ error: e.message });
      return;
    }
    throw e;
  }
});

/** 업체·지급 누적만 (payable 집계 제외 — 목록 1차 렌더용) */
router.get('/settlement/company-overview-shell', requireStaffPermission('admin.externalSettlement'), async (req, res) => {
  const tenantId = await requireTenantIdFromAuth(res, (req as unknown as { user: AuthPayload }).user);
  if (!tenantId) return;

  const operatingCompanyId = await resolveSettlementOperatingCompanyId(
    res,
    tenantId,
    req.query.operatingCompanyId,
  );
  if (!operatingCompanyId) return;

  const [companies, paidByCompany] = await Promise.all([
    prisma.externalCompany.findMany({
      where: { tenantId, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    sumExternalSettlementPaidByCompany(prisma, tenantId, operatingCompanyId),
  ]);

  res.json({
    operatingCompanyId,
    items: companies.map((c) => ({
      externalCompanyId: c.id,
      companyName: c.name,
      paidAmount: paidByCompany.get(c.id) ?? 0,
    })),
  });
});

/** 업체별 누적 payable 집계 (45초 TTL 캐시, skipCache=1 로 강제 재집계) */
router.get('/settlement/company-overview-payable', requireStaffPermission('admin.externalSettlement'), async (req, res) => {
  const tenantId = await requireTenantIdFromAuth(res, (req as unknown as { user: AuthPayload }).user);
  if (!tenantId) return;

  const operatingCompanyId = await resolveSettlementOperatingCompanyId(
    res,
    tenantId,
    req.query.operatingCompanyId,
  );
  if (!operatingCompanyId) return;

  const skipCache = req.query.skipCache === '1';
  const signedByCompany = skipCache
    ? await sumExternalSettlementSignedFeeByCompany(prisma, tenantId, operatingCompanyId)
    : await getExternalSettlementPayableFeesCached(prisma, tenantId, operatingCompanyId);

  res.json({
    operatingCompanyId,
    fees: Object.fromEntries(signedByCompany),
  });
});

/** 업체별 누적 정산 요약 목록 (전체 기간, 레거시·호환) */
router.get('/settlement/company-overview-list', requireStaffPermission('admin.externalSettlement'), async (req, res) => {
  const tenantId = await requireTenantIdFromAuth(res, (req as unknown as { user: AuthPayload }).user);
  if (!tenantId) return;

  const operatingCompanyId = await resolveSettlementOperatingCompanyId(
    res,
    tenantId,
    req.query.operatingCompanyId,
  );
  if (!operatingCompanyId) return;

  const skipCache = req.query.skipCache === '1';
  const [companies, signedByCompany, paidByCompany] = await Promise.all([
    prisma.externalCompany.findMany({
      where: { tenantId, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    skipCache
      ? sumExternalSettlementSignedFeeByCompany(prisma, tenantId, operatingCompanyId)
      : getExternalSettlementPayableFeesCached(prisma, tenantId, operatingCompanyId),
    sumExternalSettlementPaidByCompany(prisma, tenantId, operatingCompanyId),
  ]);

  res.json({
    operatingCompanyId,
    items: buildExternalSettlementOverviewItems(companies, signedByCompany, paidByCompany),
  });
});

/**
 * 타업체별 수수료 집계 (기간: 예약일 우선 · 정보공유 인계 확정일 보조)
 * query: from, to (yyyy-mm-dd)
 */
router.get('/settlement/summary', requireStaffPermission('admin.externalSettlement'), async (req, res) => {
  const tenantId = await requireTenantIdFromAuth(res, (req as unknown as { user: AuthPayload }).user);
  if (!tenantId) return;

  const operatingCompanyId = await resolveSettlementOperatingCompanyId(
    res,
    tenantId,
    req.query.operatingCompanyId,
  );
  if (!operatingCompanyId) return;

  const from = typeof req.query.from === 'string' ? req.query.from.trim() : '';
  const to = typeof req.query.to === 'string' ? req.query.to.trim() : '';
  if (!YMD.test(from) || !YMD.test(to)) {
    res.status(400).json({ error: 'from, to는 YYYY-MM-DD 형식이 필요합니다.' });
    return;
  }
  const startDate = new Date(`${from}T00:00:00.000+09:00`);
  const endDate = new Date(`${to}T23:59:59.999+09:00`);

  const marketplaceListingsInRange = await prisma.inquiryDbListing.findMany({
    where: {
      tenantId,
      status: 'CONFIRMED',
      buyerKind: 'EXTERNAL_COMPANY',
      sellerConfirmedAt: { gte: startDate, lte: endDate },
    },
    select: { inquiryId: true },
  });
  const marketplaceInquiryIds = marketplaceListingsInRange.map((r) => r.inquiryId);

  const inquiriesRaw = await prisma.inquiry.findMany({
    where: {
      tenantId,
      operatingCompanyId,
      externalTransferFee: { not: null },
      status: { not: 'ON_HOLD' },
      OR: externalSettlementPeriodOrClause(startDate, endDate, marketplaceInquiryIds),
    },
    select: {
      id: true,
      inquiryNumber: true,
      customerName: true,
      externalTransferFee: true,
      preferredDate: true,
      status: true,
      cancelFeeExternalCompanyId: true,
      cancelFeeExternalCompany: { select: { id: true, name: true } },
      assignments: {
        orderBy: { sortOrder: 'asc' },
        select: {
          teamLeader: {
            select: {
              role: true,
              externalCompanyId: true,
              externalCompany: { select: { id: true, name: true } },
            },
          },
        },
      },
      tenantShareAsSource: {
        select: {
          syncStatus: true,
          settlementMode: true,
          settlementExternalCompanyId: true,
          settlementExternalCompany: { select: { id: true, name: true } },
        },
      },
    },
  });
  const summaryConfirmAtMap = await loadMarketplaceExternalConfirmAtMap(tenantId, {
    inquiryIds: inquiriesRaw.map((r) => r.id),
  });
  const inquiries = filterInquiriesByEffectiveSettlementDate(
    inquiriesRaw,
    summaryConfirmAtMap,
    startDate,
    endDate,
  );
  const marketplaceBuyerByInquiry = await loadMarketplaceExternalBuyerByInquiry(
    tenantId,
    inquiries.map((r) => r.id),
  );

  type Row = {
    externalCompanyId: string;
    companyName: string;
    /** 취소 제외 건수 */
    inquiryCount: number;
    /** 기간 내 취소 건수(정산 미반영·표시용) */
    cancelledInquiryCount: number;
    /** 활성 건 수수료 합(취소는 미수 0) */
    feeSum: number;
  };
  const byCompany = new Map<string, Row>();
  let unassignedFee = 0;
  let unassignedActive = 0;
  let unassignedCancelled = 0;

  for (const inq of inquiries) {
    const fee = inq.externalTransferFee ?? 0;
    const isCancelled = inq.status === 'CANCELLED';
    const attributed = resolveExternalSettlementCompanyAttribution(
      {
        id: inq.id,
        cancelFeeExternalCompanyId: inq.cancelFeeExternalCompanyId,
        cancelFeeExternalCompany: inq.cancelFeeExternalCompany,
        assignments: inq.assignments,
        hybridLegacySettlement: hybridLegacySettlementFromShare(inq.tenantShareAsSource),
      },
      isCancelled,
      marketplaceBuyerByInquiry.get(inq.id),
    );
    const cid = attributed?.companyId ?? null;
    const cname = attributed?.companyName ?? null;
    const signed = signedExternalSettlementFee(fee, isCancelled);
    if (cid && cname) {
      const prev = byCompany.get(cid);
      if (prev) {
        if (isCancelled) prev.cancelledInquiryCount += 1;
        else prev.inquiryCount += 1;
        prev.feeSum += signed;
      } else {
        byCompany.set(cid, {
          externalCompanyId: cid,
          companyName: cname,
          inquiryCount: isCancelled ? 0 : 1,
          cancelledInquiryCount: isCancelled ? 1 : 0,
          feeSum: signed,
        });
      }
    } else if (signed !== 0) {
      unassignedFee += signed;
      if (isCancelled) unassignedCancelled += 1;
      else unassignedActive += 1;
    } else if (isCancelled) {
      unassignedCancelled += 1;
    } else {
      unassignedActive += 1;
    }
  }

  const rows = [...byCompany.values()].sort((a, b) => b.feeSum - a.feeSum);
  const grandTotal = rows.reduce((s, r) => s + r.feeSum, 0) + unassignedFee;
  const unassignedTotalCount = unassignedActive + unassignedCancelled;

  res.json({
    operatingCompanyId,
    from,
    to,
    rows,
    unassigned:
      unassignedTotalCount > 0
        ? {
            inquiryCount: unassignedActive,
            cancelledInquiryCount: unassignedCancelled,
            feeSum: unassignedFee,
          }
        : null,
    grandTotal,
  });
});

/** 월별/업체별/전체 정산 요약 */
router.get('/settlement/monthly-overview', requireStaffPermission('admin.externalSettlement'), async (req, res) => {
  const tenantId = await requireTenantIdFromAuth(res, (req as unknown as { user: AuthPayload }).user);
  if (!tenantId) return;

  const operatingCompanyId = await resolveSettlementOperatingCompanyId(
    res,
    tenantId,
    req.query.operatingCompanyId,
  );
  if (!operatingCompanyId) return;

  const fromMonthRaw = typeof req.query.fromMonth === 'string' ? req.query.fromMonth.trim() : '';
  const toMonthRaw = typeof req.query.toMonth === 'string' ? req.query.toMonth.trim() : '';
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const fromMonth = YM.test(fromMonthRaw) ? fromMonthRaw : defaultMonth;
  const toMonth = YM.test(toMonthRaw) ? toMonthRaw : defaultMonth;
  const loMonth = fromMonth <= toMonth ? fromMonth : toMonth;
  const hiMonth = fromMonth <= toMonth ? toMonth : fromMonth;
  const startDate = new Date(`${loMonth}-01T00:00:00.000+09:00`);
  const [toY, toM] = hiMonth.split('-').map(Number);
  const endDate = new Date(new Date(toY, toM, 0).toISOString().slice(0, 10) + 'T23:59:59.999+09:00');
  const throughEnd = endOfKstToday();

  const marketplaceIdsInRange = await prisma.inquiryDbListing.findMany({
    where: {
      tenantId,
      status: 'CONFIRMED',
      buyerKind: 'EXTERNAL_COMPANY',
      sellerConfirmedAt: { gte: startDate, lte: endDate },
    },
    select: { inquiryId: true },
  });
  const marketplaceInquiryIds = marketplaceIdsInRange.map((r) => r.inquiryId);

  const inquiriesRaw = await prisma.inquiry.findMany({
    where: {
      tenantId,
      operatingCompanyId,
      externalTransferFee: { not: null },
      status: { not: 'ON_HOLD' },
      OR: externalSettlementPeriodOrClause(startDate, endDate, marketplaceInquiryIds),
    },
    select: {
      id: true,
      preferredDate: true,
      status: true,
      externalTransferFee: true,
      cancelFeeExternalCompanyId: true,
      cancelFeeExternalCompany: { select: { id: true, name: true } },
      assignments: {
        orderBy: { sortOrder: 'asc' },
        select: {
          teamLeader: {
            select: {
              role: true,
              externalCompanyId: true,
              externalCompany: { select: { id: true, name: true } },
            },
          },
        },
      },
      tenantShareAsSource: {
        select: {
          syncStatus: true,
          settlementMode: true,
          settlementExternalCompanyId: true,
          settlementExternalCompany: { select: { id: true, name: true } },
        },
      },
    },
  });
  const confirmAtMap = await loadMarketplaceExternalConfirmAtMap(tenantId, {
    inquiryIds: inquiriesRaw.map((r) => r.id),
  });
  const inquiries = filterInquiriesByEffectiveSettlementDate(
    inquiriesRaw,
    confirmAtMap,
    startDate,
    endDate,
  );
  const marketplaceBuyerByInquiry = await loadMarketplaceExternalBuyerByInquiry(
    tenantId,
    inquiries.map((r) => r.id),
  );

  const payments = await prisma.externalCompanySettlementPayment.findMany({
    where: {
      operatingCompanyId,
      paidAt: { gte: startDate, lte: endDate },
      externalCompany: { tenantId },
    },
    select: {
      externalCompanyId: true,
      amount: true,
      paidAt: true,
      externalCompany: { select: { id: true, name: true } },
    },
  });

  const companyNameById = new Map<string, string>();
  const payableByMonthCompany = new Map<string, number>();
  const paidByMonthCompany = new Map<string, number>();
  const monthSet = new Set<string>();

  for (const inq of inquiries) {
    const effective = resolveExternalSettlementEffectiveDate(
      inq.preferredDate,
      confirmAtMap.get(inq.id),
    );
    if (!effective || effective > throughEnd) continue;
    const monthKey = kstYmdFromDate(effective).slice(0, 7);
    monthSet.add(monthKey);
    const fee = inq.externalTransferFee ?? 0;
    const isCancelled = inq.status === 'CANCELLED';
    const attributed = resolveExternalSettlementCompanyAttribution(
      {
        id: inq.id,
        cancelFeeExternalCompanyId: inq.cancelFeeExternalCompanyId,
        cancelFeeExternalCompany: inq.cancelFeeExternalCompany,
        assignments: inq.assignments,
        hybridLegacySettlement: hybridLegacySettlementFromShare(inq.tenantShareAsSource),
      },
      isCancelled,
      marketplaceBuyerByInquiry.get(inq.id),
    );
    const cid = attributed?.companyId ?? null;
    const cname = attributed?.companyName ?? null;
    if (!cid || !cname) continue;
    companyNameById.set(cid, cname);
    const key = `${monthKey}|${cid}`;
    const prev = payableByMonthCompany.get(key) ?? 0;
    const signed = signedExternalSettlementFee(fee, isCancelled);
    payableByMonthCompany.set(key, prev + signed);
  }

  for (const p of payments) {
    const monthKey = kstYmd(p.paidAt).slice(0, 7);
    monthSet.add(monthKey);
    const cid = p.externalCompanyId;
    const cname = p.externalCompany?.name ?? null;
    if (cname) companyNameById.set(cid, cname);
    const key = `${monthKey}|${cid}`;
    paidByMonthCompany.set(key, (paidByMonthCompany.get(key) ?? 0) + p.amount);
  }

  const months = [...monthSet].filter((m) => m >= loMonth && m <= hiMonth).sort();
  const companyIds = [...companyNameById.keys()].sort((a, b) => {
    const an = companyNameById.get(a) ?? '';
    const bn = companyNameById.get(b) ?? '';
    return an.localeCompare(bn, 'ko-KR');
  });

  const carryOverByCompany = new Map<string, number>();
  await Promise.all(
    companyIds.map(async (cid) => {
      const [signedBefore, paidBeforeAgg] = await Promise.all([
        computeSignedExternalFeeBeforeDate({
          tenantId,
          externalCompanyId: cid,
          operatingCompanyId,
          before: startDate,
        }),
        prisma.externalCompanySettlementPayment.aggregate({
          where: { externalCompanyId: cid, operatingCompanyId, paidAt: { lt: startDate } },
          _sum: { amount: true },
        }),
      ]);
      carryOverByCompany.set(cid, signedBefore - (paidBeforeAgg._sum.amount ?? 0));
    }),
  );

  let cumulativeOverallRemaining = carryOverByCompany.size
    ? [...carryOverByCompany.values()].reduce((s, v) => s + v, 0)
    : 0;
  const cumulativeByCompany = new Map<string, number>(carryOverByCompany);
  const monthRows = months.map((month) => {
    const companies = companyIds
      .map((cid) => {
        const key = `${month}|${cid}`;
        const payableAmount = payableByMonthCompany.get(key) ?? 0;
        const paidAmount = paidByMonthCompany.get(key) ?? 0;
        const remainingAmount = payableAmount - paidAmount;
        if (payableAmount === 0 && paidAmount === 0) return null;
        const prev = cumulativeByCompany.get(cid) ?? 0;
        const cumulativeRemaining = prev + remainingAmount;
        cumulativeByCompany.set(cid, cumulativeRemaining);
        return {
          externalCompanyId: cid,
          companyName: companyNameById.get(cid) ?? cid,
          payableAmount,
          paidAmount,
          remainingAmount,
          cumulativeRemaining,
        };
      })
      .filter((x): x is NonNullable<typeof x> => Boolean(x));
    const totalPayable = companies.reduce((s, c) => s + c.payableAmount, 0);
    const totalPaid = companies.reduce((s, c) => s + c.paidAmount, 0);
    const totalRemaining = totalPayable - totalPaid;
    cumulativeOverallRemaining += totalRemaining;
    return {
      month,
      totalPayable,
      totalPaid,
      totalRemaining,
      cumulativeOverallRemaining,
      companies,
    };
  });

  const overallPayable = monthRows.reduce((s, r) => s + r.totalPayable, 0);
  const overallPaid = monthRows.reduce((s, r) => s + r.totalPaid, 0);

  res.json({
    operatingCompanyId,
    fromMonth: loMonth,
    toMonth: hiMonth,
    months: monthRows,
    overall: {
      payableAmount: overallPayable,
      paidAmount: overallPaid,
      remainingAmount: overallPayable - overallPaid,
    },
  });
});

/** 관리자: 특정 타업체 정산 지급 이력만 (접수 스캔 없음) */
router.get('/settlement/company-payments', requireStaffPermission('admin.externalSettlement'), async (req, res) => {
  const tenantId = await requireTenantIdFromAuth(res, (req as unknown as { user: AuthPayload }).user);
  if (!tenantId) return;

  const externalCompanyId =
    typeof req.query.externalCompanyId === 'string' ? req.query.externalCompanyId.trim() : '';
  if (!externalCompanyId) {
    res.status(400).json({ error: 'externalCompanyId가 필요합니다.' });
    return;
  }
  const company = await requireActiveExternalCompanyInTenant(res, tenantId, externalCompanyId);
  if (!company) return;
  const operatingCompanyId = await resolveSettlementOperatingCompanyId(
    res,
    tenantId,
    req.query.operatingCompanyId,
  );
  if (!operatingCompanyId) return;

  const fromRaw = typeof req.query.from === 'string' ? req.query.from.trim() : '';
  const toRaw = typeof req.query.to === 'string' ? req.query.to.trim() : '';
  const limitRaw = typeof req.query.limit === 'string' ? Number.parseInt(req.query.limit, 10) : 300;
  const limit = Number.isFinite(limitRaw) ? Math.min(500, Math.max(1, limitRaw)) : 300;

  const paidAtWhere: { gte?: Date; lte?: Date } = {};
  if (YMD.test(fromRaw)) {
    paidAtWhere.gte = new Date(`${fromRaw}T00:00:00+09:00`);
  }
  if (YMD.test(toRaw)) {
    paidAtWhere.lte = new Date(`${toRaw}T23:59:59.999+09:00`);
  }

  const paymentRows = await prisma.externalCompanySettlementPayment.findMany({
    where: {
      externalCompanyId,
      operatingCompanyId,
      externalCompany: { tenantId },
      ...(Object.keys(paidAtWhere).length > 0 ? { paidAt: paidAtWhere } : {}),
    },
    orderBy: [{ paidAt: 'desc' }],
    take: limit,
    select: {
      id: true,
      amount: true,
      paidAt: true,
      memo: true,
      actor: { select: { name: true, role: true } },
    },
  });

  res.json({
    externalCompanyId: company.id,
    externalCompanyName: company.name,
    operatingCompanyId,
    from: YMD.test(fromRaw) ? fromRaw : null,
    to: YMD.test(toRaw) ? toRaw : null,
    payments: paymentRows.map((r) => ({
      id: r.id,
      amount: r.amount,
      paidAt: r.paidAt.toISOString(),
      memo: r.memo ?? null,
      actorName: r.actor?.name ?? null,
      actorRole: r.actor?.role ?? null,
    })),
  });
});

/** 관리자: 특정 타업체 정산 상세(결제대상/정산완료/남은금액/히스토리) */
router.get('/settlement/company-detail', requireStaffPermission('admin.externalSettlement'), async (req, res) => {
  const tenantId = await requireTenantIdFromAuth(res, (req as unknown as { user: AuthPayload }).user);
  if (!tenantId) return;

  const externalCompanyId =
    typeof req.query.externalCompanyId === 'string' ? req.query.externalCompanyId.trim() : '';
  if (!externalCompanyId) {
    res.status(400).json({ error: 'externalCompanyId가 필요합니다.' });
    return;
  }
  const company = await requireActiveExternalCompanyInTenant(res, tenantId, externalCompanyId);
  if (!company) return;
  const operatingCompanyId = await resolveSettlementOperatingCompanyId(
    res,
    tenantId,
    req.query.operatingCompanyId,
  );
  if (!operatingCompanyId) return;
  const fromRaw = typeof req.query.from === 'string' ? req.query.from.trim() : '';
  const toRaw = typeof req.query.to === 'string' ? req.query.to.trim() : '';
  const now = new Date();
  const fallbackMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const fallbackFromYmd = `${fallbackMonth}-01`;
  const fromYmd = YMD.test(fromRaw) ? fromRaw : fallbackFromYmd;
  const toYmd = YMD.test(toRaw)
    ? toRaw
    : (() => {
        const tmp = new Date(`${fallbackFromYmd}T00:00:00+09:00`);
        const last = new Date(tmp.getFullYear(), tmp.getMonth() + 1, 0);
        return `${fallbackMonth}-${String(last.getDate()).padStart(2, '0')}`;
      })();
  const loYmd = fromYmd <= toYmd ? fromYmd : toYmd;
  const hiYmd = fromYmd <= toYmd ? toYmd : fromYmd;
  const from = new Date(`${loYmd}T00:00:00+09:00`);
  const to = new Date(`${hiYmd}T23:59:59.999+09:00`);
  const searchRaw = typeof req.query.search === 'string' ? req.query.search.trim() : '';

  const { activeRows, cancelledRows, confirmAtMap } = await fetchExternalSettlementInquiriesForCompanyPeriod({
    tenantId,
    externalCompanyId,
    operatingCompanyId,
    from,
    to,
  });
  let allItems = [
    ...activeRows.map((r) => {
      const effectiveAt = resolveExternalSettlementEffectiveDate(
        r.preferredDate,
        confirmAtMap.get(r.id),
      );
      return {
        inquiryId: r.id,
        inquiryNumber: r.inquiryNumber ?? null,
        customerName: r.customerName,
        address: r.address,
        addressDetail: r.addressDetail ?? null,
        preferredDate: r.preferredDate ? r.preferredDate.toISOString() : null,
        settlementEffectiveDate: effectiveAt?.toISOString() ?? null,
        status: r.status,
        isCancelled: false,
        feeAmount: r.externalTransferFee ?? 0,
        signedFeeAmount: r.externalTransferFee ?? 0,
        viaMarketplace: false as boolean,
      };
    }),
    ...cancelledRows.map((r) => {
      const effectiveAt = resolveExternalSettlementEffectiveDate(
        r.preferredDate,
        confirmAtMap.get(r.id),
      );
      return {
        inquiryId: r.id,
        inquiryNumber: r.inquiryNumber ?? null,
        customerName: r.customerName,
        address: r.address,
        addressDetail: r.addressDetail ?? null,
        preferredDate: r.preferredDate ? r.preferredDate.toISOString() : null,
        settlementEffectiveDate: effectiveAt?.toISOString() ?? null,
        status: r.status,
        isCancelled: true,
        feeAmount: r.externalTransferFee ?? 0,
        signedFeeAmount: signedExternalSettlementFee(r.externalTransferFee ?? 0, true),
        viaMarketplace: false as boolean,
      };
    }),
  ].sort((a, b) =>
    (b.settlementEffectiveDate ?? b.preferredDate ?? '').localeCompare(
      a.settlementEffectiveDate ?? a.preferredDate ?? '',
    ),
  );
  const marketplaceInquiryIds = await loadMarketplaceConfirmedInquiryIdSet(
    allItems.map((it) => it.inquiryId),
  );
  for (const it of allItems) {
    if (marketplaceInquiryIds.has(it.inquiryId)) it.viaMarketplace = true;
  }
  const items = filterExternalSettlementItemsBySearch(allItems, searchRaw);
  const inquiryCount = allItems.filter((it) => !it.isCancelled).length;
  const cancelledInquiryCount = allItems.filter((it) => it.isCancelled).length;
  const totalFee = allItems.reduce((sum, it) => sum + it.signedFeeAmount, 0);

  const signedBeforeRange = await computeSignedExternalFeeBeforeDate({
    tenantId,
    externalCompanyId,
    operatingCompanyId,
    before: from,
  });

  const paidBeforeAgg = await prisma.externalCompanySettlementPayment.aggregate({
    where: { externalCompanyId, operatingCompanyId, paidAt: { lt: from } },
    _sum: { amount: true },
  });
  const paidBeforeRange = paidBeforeAgg._sum.amount ?? 0;
  const paymentRows = await prisma.externalCompanySettlementPayment.findMany({
    where: { externalCompanyId, operatingCompanyId, paidAt: { gte: from, lte: to } },
    orderBy: [{ paidAt: 'desc' }],
    select: {
      id: true,
      amount: true,
      paidAt: true,
      memo: true,
      actor: { select: { name: true, role: true } },
    },
  });
  const periodPaidAgg = await prisma.externalCompanySettlementPayment.aggregate({
    where: { externalCompanyId, operatingCompanyId, paidAt: { gte: from, lte: to } },
    _sum: { amount: true },
  });
  const periodPaidAmount = periodPaidAgg._sum.amount ?? 0;
  const carryOverAmount = signedBeforeRange - paidBeforeRange;
  const payableAmount = carryOverAmount + totalFee;
  const remainingAmount = payableAmount - periodPaidAmount;

  res.json({
    operatingCompanyId,
    month: loYmd.slice(0, 7),
    from: loYmd,
    to: hiYmd,
    externalCompanyId: company.id,
    externalCompanyName: company.name,
    inquiryCount,
    cancelledInquiryCount,
    totalCount: inquiryCount + cancelledInquiryCount,
    totalFee,
    carryOverAmount,
    payableAmount,
    periodPaidAmount,
    remainingAmount,
    payments: paymentRows.map((r) => ({
      id: r.id,
      amount: r.amount,
      paidAt: r.paidAt.toISOString(),
      memo: r.memo ?? null,
      actorName: r.actor?.name ?? null,
      actorRole: r.actor?.role ?? null,
    })),
    items,
  });
});

/**
 * 업체별 수수료 누계(마지막 「정산완료」 이후 구간 + 예약일·정보공유 인계 확정일 기준 일·월·년)
 * 타업체(EXTERNAL_PARTNER) 배정 접수만, 수수료 입력 건만 합산
 */
router.get('/settlement/accruals', requireStaffPermission('admin.externalSettlement'), async (req, res) => {
  const tenantId = await requireTenantIdFromAuth(res, (req as unknown as { user: AuthPayload }).user);
  if (!tenantId) return;

  const operatingCompanyId = await resolveSettlementOperatingCompanyId(
    res,
    tenantId,
    req.query.operatingCompanyId,
  );
  if (!operatingCompanyId) return;

  const now = new Date();
  const todayYmd = kstYmd(now);
  const monthKey = todayYmd.slice(0, 7);
  const yearPrefix = todayYmd.slice(0, 4);

  const companies = await prisma.externalCompany.findMany({
    where: { tenantId, isActive: true },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });

  const resets = await prisma.externalCompanySettlementReset.findMany({
    where: { operatingCompanyId, externalCompany: { tenantId } },
    orderBy: { resetAt: 'desc' },
    select: { externalCompanyId: true, resetAt: true },
  });
  const lastResetByCompany = new Map<string, Date>();
  for (const r of resets) {
    const key = r.externalCompanyId;
    if (!lastResetByCompany.has(key)) {
      lastResetByCompany.set(key, r.resetAt);
    }
  }

  const accrualSelect = {
    id: true,
    preferredDate: true,
    externalTransferFee: true,
    createdAt: true,
    updatedAt: true,
    status: true,
    cancelFeeExternalCompanyId: true,
    assignments: {
      orderBy: { sortOrder: 'asc' as const },
      select: {
        teamLeader: { select: { role: true, externalCompanyId: true } },
      },
    },
  };

  const activeInquiries = await prisma.inquiry.findMany({
    where: {
      tenantId,
      operatingCompanyId,
      externalTransferFee: { not: null },
      status: { notIn: ['CANCELLED', 'ON_HOLD'] },
      assignments: {
        some: {
          teamLeader: { role: 'EXTERNAL_PARTNER', externalCompanyId: { not: null } },
        },
      },
    },
    select: accrualSelect,
  });

  const accrualConfirmAtMap = await loadMarketplaceExternalConfirmAtMap(tenantId, {
    inquiryIds: activeInquiries.map((inq) => inq.id),
  });
  const marketplaceBuyerByInquiry = await loadMarketplaceExternalBuyerByInquiry(
    tenantId,
    activeInquiries.map((inq) => inq.id),
  );

  type Acc = { sinceReset: number; today: number; month: number; year: number };
  const accByCompany = new Map<string, Acc>();
  for (const c of companies) {
    accByCompany.set(c.id, { sinceReset: 0, today: 0, month: 0, year: 0 });
  }

  const addSignedByEffective = (
    cid: string,
    fee: number,
    sign: 1 | -1,
    inq: { preferredDate: Date | null; id: string },
  ) => {
    const a = accByCompany.get(cid);
    if (!a) return;
    const effective = resolveExternalSettlementEffectiveDate(
      inq.preferredDate,
      accrualConfirmAtMap.get(inq.id),
    );
    if (!effective) return;
    const v = sign * fee;
    a.sinceReset += v;
    const pYmd = kstYmdFromDate(effective);
    if (pYmd === todayYmd) a.today += v;
    if (pYmd.slice(0, 7) === monthKey) a.month += v;
    if (pYmd.slice(0, 4) === yearPrefix) a.year += v;
  };

  for (const inq of activeInquiries) {
    const attributed = resolveExternalSettlementCompanyAttribution(
      inq,
      false,
      marketplaceBuyerByInquiry.get(inq.id),
    );
    const cid = attributed?.companyId ?? null;
    if (!cid || !accByCompany.has(cid)) continue;

    const fee = inq.externalTransferFee ?? 0;
    const lastReset = lastResetByCompany.get(cid) ?? new Date(0);
    const activeSinceReset = inq.createdAt > lastReset || inq.updatedAt > lastReset;
    if (!activeSinceReset) continue;

    addSignedByEffective(cid, fee, 1, inq);
  }

  const items = companies.map((c) => ({
    externalCompanyId: c.id,
    companyName: c.name,
    lastResetAt: lastResetByCompany.get(c.id)?.toISOString() ?? null,
    sinceResetTotal: accByCompany.get(c.id)!.sinceReset,
    todayTotal: accByCompany.get(c.id)!.today,
    monthTotal: accByCompany.get(c.id)!.month,
    yearTotal: accByCompany.get(c.id)!.year,
  }));

  res.json({ operatingCompanyId, todayYmd, monthKey, year: yearPrefix, items });
});

/** 정산 완료 후 누계 초기화(해당 업체·브랜드) */
router.post('/settlement/reset-accrual', requireStaffPermission('admin.externalSettlement'), async (req, res) => {
  const tenantId = await requireTenantIdFromAuth(res, (req as unknown as { user: AuthPayload }).user);
  if (!tenantId) return;

  const actorId = (req as unknown as { user: AuthPayload }).user.userId;
  const body = req.body as { externalCompanyId?: string; operatingCompanyId?: string };
  const id = typeof body.externalCompanyId === 'string' ? body.externalCompanyId.trim() : '';
  if (!id) {
    res.status(400).json({ error: 'externalCompanyId가 필요합니다.' });
    return;
  }
  const co = await requireActiveExternalCompanyInTenant(res, tenantId, id);
  if (!co) return;
  const operatingCompanyId = await resolveSettlementOperatingCompanyId(
    res,
    tenantId,
    body.operatingCompanyId,
  );
  if (!operatingCompanyId) return;
  await prisma.externalCompanySettlementReset.create({
    data: {
      externalCompanyId: id,
      operatingCompanyId,
      actorId,
    },
  });
  invalidateExternalSettlementOverviewPayableCache(tenantId, operatingCompanyId);
  res.json({ ok: true });
});

/** 관리자: 타업체 정산완료(부분/전체) 금액 기록 */
router.post('/settlement/payments', requireStaffPermission('admin.externalSettlement'), async (req, res) => {
  const tenantId = await requireTenantIdFromAuth(res, (req as unknown as { user: AuthPayload }).user);
  if (!tenantId) return;

  const actorId = (req as unknown as { user: AuthPayload }).user.userId;
  const body = req.body as {
    externalCompanyId?: string;
    operatingCompanyId?: string;
    amount?: number;
    memo?: string;
    paidDate?: string;
  };
  const externalCompanyId = typeof body.externalCompanyId === 'string' ? body.externalCompanyId.trim() : '';
  const amount = Number(body.amount);
  const memo = typeof body.memo === 'string' ? body.memo.trim() : '';
  const paidResolved = resolveExternalSettlementPaidAt(body.paidDate);
  if (!paidResolved.ok) {
    res.status(400).json({ error: paidResolved.error });
    return;
  }
  if (!externalCompanyId) {
    res.status(400).json({ error: 'externalCompanyId가 필요합니다.' });
    return;
  }
  if (!Number.isFinite(amount) || amount === 0) {
    res.status(400).json({
      error:
        '정산완료 금액은 0이 아닌 정수여야 합니다. 과납·오기입 보정은 마이너스 금액으로 입력할 수 있습니다.',
    });
    return;
  }
  const amountInt = Math.trunc(amount);
  const co = await prisma.externalCompany.findFirst({
    where: { id: externalCompanyId, tenantId, isActive: true },
    select: { id: true },
  });
  if (!co) {
    res.status(404).json({ error: '타업체를 찾을 수 없습니다.' });
    return;
  }
  const operatingCompanyId = await resolveSettlementOperatingCompanyId(
    res,
    tenantId,
    body.operatingCompanyId,
  );
  if (!operatingCompanyId) return;
  const row = await prisma.externalCompanySettlementPayment.create({
    data: {
      externalCompanyId,
      operatingCompanyId,
      amount: amountInt,
      memo: memo || null,
      actorId,
      paidAt: paidResolved.paidAt,
    },
    select: { id: true, amount: true, paidAt: true },
  });
  invalidateExternalSettlementOverviewPayableCache(tenantId, operatingCompanyId);
  res.json({
    ok: true,
    payment: {
      id: row.id,
      amount: row.amount,
      paidAt: row.paidAt.toISOString(),
    },
  });
});

export default router;
