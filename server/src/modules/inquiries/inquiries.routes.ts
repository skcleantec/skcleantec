import { Router } from 'express';
import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import type { Prisma, InquiryStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { ShortTtlCache } from '../../lib/shortTtlCache.js';
import { authMiddleware, adminOrMarketer, type AuthPayload } from '../auth/auth.middleware.js';
import { getTenantIdFromAuth } from '../tenants/tenant.middleware.js';
import { isTeamPreviewAdminEmail } from '../auth/teamPreview.helpers.js';
import {
  createdAtRangeFromQuery,
  kstDayRangeYmd,
  kstMonthRangeYm,
} from './inquiryListDateRange.js';
import { recordInquiryStatusEvent, recordInquiryStatusTransition } from './inquiryStatusEvent.js';
import {
  createdAtRangeFromListQuery,
  parseKstHourQuery,
} from '../ops-analytics/kstHourListFilter.js';
import { inquiryIdsMatchingStatusEventKstHour } from '../ops-analytics/kstHourFilterQueries.js';
import {
  fetchInquiryListPageSorted,
  whereInquiryOrderFormPendingSubmit,
} from './inquiryListSort.helpers.js';
import {
  buildMarketerOverview,
  buildMarketerDailyOverview,
  whereInquiryAttributedToMarketer,
  whereMarketerStatsInquiriesOnDay,
} from './inquiryMarketerOverview.js';
import {
  applyProfOptionAmountsToInquiry,
  clearProfOptionsAmountReviewPending,
  shouldClearProfOptionsAmountReviewOnPatch,
} from './inquiryProfOptionsAmount.service.js';
import {
  buildAmountDateChangeLines,
  buildInquiryPatchData,
  projectAfterPatch,
} from './inquiryPatch.helpers.js';
import {
  attachInternalCustomerToneForRole,
  canEditInternalCustomerTone,
  internalCustomerToneDisplay,
  mapInquiriesInternalToneForRole,
  parseInternalCustomerToneInput,
} from './internalCustomerTone.js';
import { isSideCleaningPreferredTime } from '../schedule/scheduleSlot.helpers.js';
import {
  filterExistingProfessionalOptionSelections,
  parseProfessionalOptionSelectionsRaw,
  serializeProfessionalOptionSelectionsJson,
} from '../orderform/specialtyOptions.js';
import { resolveOneRoomSpecialNotes } from '../orderform/orderFormOneRoom.js';
import { ensureReviewPaybackToken } from '../review-payback/reviewPayback.service.js';
import { allocateNextInquiryNumber } from './inquiryNumber.js';
import {
  mapOperatingCompanyResolveError,
  resolveInquiryOperatingCompanyId,
  validateInquiryOperatingCompanyChange,
} from '../operating-companies/operatingCompanyResolve.service.js';
import {
  assertTeamLeadersMatchInquiryBrand,
  OperatingCompanyAssignmentError,
} from '../operating-companies/operatingCompanyAssignment.js';
import {
  assertInquiryTeamLeaderAssignmentZones,
  ServiceZoneAssignmentError,
} from '../service-zones/serviceZoneAssignment.js';
import { dateToYmdKst, isUserEmployedOnYmd, kstTodayYmd } from '../users/userEmployment.js';
import inquiryCleaningPhotosAdminRoutes from '../inquiry-cleaning-photos/inquiryCleaningPhotos.admin.routes.js';
import inquiryConsultationPhotosAdminRoutes from '../inquiry-consultation-photos/inquiryConsultationPhotos.admin.routes.js';
import inquiryExtraChargesAdminRoutes from '../inquiry-extra-charges/inquiryExtraCharges.admin.routes.js';
import inquiryAdditionalReceiptsAdminRoutes from '../inquiry-additional-receipts/inquiryAdditionalReceipts.admin.routes.js';
import inquiryInspectionAdminRoutes from '../inquiry-inspection/inquiryInspection.admin.routes.js';
import { buildInquiryPatchCrewRosterAckMessages } from './crewRosterAckMessages.js';
import { isCrewRosterChanged } from './crewMemberNoteCompare.js';
import {
  clearInquiryCrewMemberMeetingTimes,
  inquiryHasAnyCrewMeetingTime,
} from './inquiryCrewMemberMeetingTime.service.js';
import { assignmentTeamLeaderSelect } from './assignmentTeamLeaderSelect.js';
import { notifyCsReportNavBadges } from '../realtime/navBadgeNotify.js';
import { notifyInquiryCelebrate } from '../realtime/inquiryCelebrateNotify.js';
import { syncInquiryAddressGeo } from './inquiryAddressGeoSync.js';
import { validateInquiryAddressForStatus } from '../../lib/orderFormPendingAddress.js';
import { scheduleBackgroundGeoHydrate } from './inquiryAddressGeoHydrate.js';
import { attachDistanceFromJuanForInquiry } from './inquiryJuanDistance.js';
import { notifyAfterInquiryPatch } from '../push/inquiryTeamWebPush.js';
import {
  notifyAllActiveCrewGroupsRefresh,
  notifyAllActiveCrewRosterAck,
  notifyTeamLeaderUsersRosterAck,
} from '../crew/crewFieldRealtime.js';
import { notifyStaffInboxRefresh } from '../realtime/navBadgeNotify.js';
import { notifyChangeLogToStaff } from '../realtime/changeLogNotify.js';
import { inquiryDetailInclude, operatingCompanySummarySelect } from './inquiryDetailInclude.js';
import { inspectionChecklistListInclude } from '../inquiry-inspection/inquiryInspection.listInclude.js';
import {
  attachInspectionSummaries,
  whereInspectionStatusFilter,
} from '../inquiry-inspection/inquiryInspection.summary.js';
import { isFeatureEnabled } from '../tenants/tenantFeatures.service.js';
import { handlePostSwapCrewWithPartner } from './inquiryCrewPartnerSwap.handler.js';
import {
  attachTenantShareMetaToInquiries,
  attachTenantShareMetaToInquiry,
} from '../tenant-partners/tenantInquiryShareMeta.js';
import { stampTenantShareCancelFeeDirection } from '../tenant-partners/tenantPartnerSettlement.service.js';
import { syncTenantShareAfterInquiryPatch } from '../tenant-partners/tenantInquirySync.service.js';

function normalizeTeamLeaderIds(raw: unknown): string[] {
  if (raw == null) return [];
  if (typeof raw === 'string') {
    const id = raw.trim();
    return id ? [id] : [];
  }
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of raw) {
    const id = typeof x === 'string' ? x.trim() : String(x ?? '').trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/** 관리자 본인 비밀번호 확인 — 실패 시 res 전송 후 false */
async function verifyAdminPasswordForRequest(
  req: Request,
  res: Response,
  passwordRaw: unknown
): Promise<boolean> {
  const password = passwordRaw != null ? String(passwordRaw) : '';
  if (!password) {
    res.status(400).json({ error: '비밀번호를 입력해주세요.' });
    return false;
  }
  const user = (req as unknown as { user: AuthPayload }).user;
  const dbUser = await prisma.user.findUnique({ where: { id: user.userId } });
  if (!dbUser) {
    res.status(401).json({ error: '사용자를 찾을 수 없습니다.' });
    return false;
  }
  const valid = await bcrypt.compare(password, dbUser.passwordHash);
  if (!valid) {
    res.status(401).json({ error: '비밀번호가 일치하지 않습니다.' });
    return false;
  }
  return true;
}

const router = Router();

/** 원격 DB 왕복 완화 — 탭 전환·WS 재조회 시 25초 이내 캐시 재사용 */
const marketerOverviewCache = new ShortTtlCache<Awaited<ReturnType<typeof buildMarketerOverview>>>(25_000);

router.use(authMiddleware);
router.use(adminOrMarketer);

/** 마케터별 이번 달·오늘 예약완료(RECEIVED) — 서비스접수와 동일(접수일·접수자, KST) */
router.get('/marketer-overview', async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user;
  const tenantId = getTenantIdFromAuth(user);
  if (!tenantId) {
    res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
    return;
  }
  try {
    const cacheKey = `mo:${tenantId}`;
    const cached = marketerOverviewCache.get(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }
    const data = await buildMarketerOverview(tenantId);
    marketerOverviewCache.set(cacheKey, data);
    res.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('marketer-overview error:', msg, err);
    const hint =
      process.env.NODE_ENV !== 'production'
        ? `${msg}`
        : '마케터별 집계를 불러올 수 없습니다.';
    res.status(500).json({ error: hint });
  }
});

/** 마케터별 월간 일별 예약완료(RECEIVED) — 서비스접수와 동일(접수일, KST) */
router.get('/marketer-daily-overview', async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user;
  const tenantId = getTenantIdFromAuth(user);
  if (!tenantId) {
    res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
    return;
  }
  const marketerId = typeof req.query.marketerId === 'string' ? req.query.marketerId.trim() : '';
  const month = typeof req.query.month === 'string' ? req.query.month.trim() : '';
  if (!marketerId || !/^\d{4}-\d{2}$/.test(month)) {
    res.status(400).json({ error: 'marketerId와 month(YYYY-MM)가 필요합니다.' });
    return;
  }
  try {
    const data = await buildMarketerDailyOverview(tenantId, marketerId, month);
    if (!data) {
      res.status(404).json({ error: '마케터를 찾을 수 없거나 집계할 수 없습니다.' });
      return;
    }
    res.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('marketer-daily-overview error:', msg, err);
    const hint =
      process.env.NODE_ENV !== 'production'
        ? `${msg}`
        : '일별 접수 집계를 불러올 수 없습니다.';
    res.status(500).json({ error: hint });
  }
});

router.get('/', async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user;
  const tenantId = getTenantIdFromAuth(user);
  if (!tenantId) {
    res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
    return;
  }
  const inspectionModuleEnabled = await isFeatureEnabled(tenantId, 'mod_inspection');
  const {
    status,
    limit = '200',
    offset = '0',
    search,
    datePreset,
    month,
    day,
    createdById,
    marketerStatsDay,
    teamLeaderId,
    operatingCompanyId,
    scheduleMonth,
    scheduleDay,
    inspectionStatus,
    fromYmd,
    toYmd,
    kstHour: kstHourRaw,
    statusEvent,
  } = req.query;
  const CREATED_BY_FILTER_UNASSIGNED = '__unassigned__';
  const statsDayRaw =
    typeof marketerStatsDay === 'string' ? marketerStatsDay.trim() : '';
  const statsMarketerId =
    typeof createdById === 'string' ? createdById.trim() : '';
  const useMarketerStatsDay =
    /^\d{4}-\d{2}-\d{2}$/.test(statsDayRaw) &&
    Boolean(statsMarketerId) &&
    statsMarketerId !== CREATED_BY_FILTER_UNASSIGNED &&
    (user.role === 'ADMIN' || user.role === 'MARKETER');

  const range = useMarketerStatsDay
    ? null
    : createdAtRangeFromListQuery({
        datePreset: typeof datePreset === 'string' ? datePreset : undefined,
        month: typeof month === 'string' ? month : undefined,
        day: typeof day === 'string' ? day : undefined,
        fromYmd: typeof fromYmd === 'string' ? fromYmd : undefined,
        toYmd: typeof toYmd === 'string' ? toYmd : undefined,
      });

  const kstHour = parseKstHourQuery(kstHourRaw);
  const statusEventFilter =
    typeof statusEvent === 'string' && statusEvent.trim() ? statusEvent.trim() : undefined;

  const andClauses: Prisma.InquiryWhereInput[] = [{ tenantId }];
  if (useMarketerStatsDay) {
    const statsWhere = whereMarketerStatsInquiriesOnDay(statsMarketerId, statsDayRaw);
    if (statsWhere) {
      andClauses.push(statsWhere);
    }
  } else if (range) {
    andClauses.push({ createdAt: { gte: range.gte, lte: range.lte } });
  }
  if (!useMarketerStatsDay && statusEventFilter && kstHour !== undefined && range) {
    const matchedIds = await inquiryIdsMatchingStatusEventKstHour({
      tenantId,
      gte: range.gte,
      lte: range.lte,
      kstHour,
      status: statusEventFilter,
    });
    andClauses.push({
      id: { in: matchedIds.length > 0 ? matchedIds : ['00000000-0000-0000-0000-000000000000'] },
    });
  }
  if (!useMarketerStatsDay && status && typeof status === 'string') {
    const raw = status.trim();
    if (raw.includes(',')) {
      const parts = raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean) as InquiryStatus[];
      if (parts.length === 1) {
        andClauses.push({ status: parts[0] });
      } else if (parts.length > 1) {
        andClauses.push({ status: { in: parts } });
      }
    } else {
      andClauses.push({ status: raw as InquiryStatus });
    }
  }
  if (search && typeof search === 'string' && search.trim()) {
    const s = search.trim();
    andClauses.push({
      OR: [
        { customerName: { contains: s } },
        { customerPhone: { contains: s } },
        { inquiryNumber: { contains: s } },
      ],
    });
  }
  /** 마케터: 본인 접수(또는 구 데이터 발주서 작성자)만. 관리자: 선택 시 해당 사용자 기준 또는 미지정 */
  if (!useMarketerStatsDay) {
    if (
      (user.role === 'ADMIN' || user.role === 'MARKETER') &&
      typeof createdById === 'string' &&
      createdById.trim()
    ) {
      const cid = createdById.trim();
      if (cid === CREATED_BY_FILTER_UNASSIGNED) {
        /** 접수 등록자 없음·발주서 미연결(화면상 접수자 '-') */
        andClauses.push({
          createdById: null,
          orderFormId: null,
        });
      } else {
        andClauses.push(whereInquiryAttributedToMarketer(cid));
      }
    }
  }

  const TEAM_LEADER_FILTER_UNASSIGNED = '__unassigned__';
  if (typeof teamLeaderId === 'string' && teamLeaderId.trim()) {
    const tid = teamLeaderId.trim();
    if (tid === TEAM_LEADER_FILTER_UNASSIGNED) {
      andClauses.push({ assignments: { none: {} } });
    } else {
      andClauses.push({ assignments: { some: { teamLeaderId: tid } } });
    }
  }

  if (typeof operatingCompanyId === 'string' && operatingCompanyId.trim()) {
    andClauses.push({ operatingCompanyId: operatingCompanyId.trim() });
  }

  if (
    inspectionModuleEnabled &&
    user.role === 'ADMIN' &&
    typeof inspectionStatus === 'string' &&
    inspectionStatus.trim()
  ) {
    const inspectionWhere = whereInspectionStatusFilter(inspectionStatus);
    if (inspectionWhere) andClauses.push(inspectionWhere);
  }

  /** 예약일(희망일 preferredDate) — KST. scheduleDay가 있으면 월보다 우선. 미제출은 pinPendingWhere 로 상단 고정. */
  if (
    !useMarketerStatsDay &&
    typeof scheduleDay === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(scheduleDay.trim())
  ) {
    const r = kstDayRangeYmd(scheduleDay.trim());
    if (r) {
      andClauses.push({
        AND: [{ preferredDate: { not: null } }, { preferredDate: { gte: r.gte, lte: r.lte } }],
      });
    }
  } else if (
    !useMarketerStatsDay &&
    typeof scheduleMonth === 'string' &&
    /^\d{4}-\d{2}$/.test(scheduleMonth.trim())
  ) {
    const r = kstMonthRangeYm(scheduleMonth.trim());
    if (r) {
      andClauses.push({
        AND: [{ preferredDate: { not: null } }, { preferredDate: { gte: r.gte, lte: r.lte } }],
      });
    }
  }

  const where: Prisma.InquiryWhereInput = andClauses.length > 0 ? { AND: andClauses } : {};
  const listInclude = {
    operatingCompany: { select: operatingCompanySummarySelect },
    createdBy: { select: { id: true, name: true } },
    assignments: {
      orderBy: { sortOrder: 'asc' as const },
      include: { teamLeader: { select: assignmentTeamLeaderSelect } },
    },
    orderForm: {
      select: {
        id: true,
        token: true,
        reviewPaybackToken: true,
        totalAmount: true,
        depositAmount: true,
        balanceAmount: true,
        submittedAt: true,
        customerSpecialNotes: true,
        createdBy: { select: { id: true, name: true, role: true } },
      },
    },
    // changeLogs·extraCharges·additionalReceipts 는 편집 모달에서만 쓰므로 목록에서 제외(경량화).
    // 편집 진입 시 GET /:id (inquiryDetailInclude) 로 보강한다.
    inspectionChecklist: inspectionChecklistListInclude,
  } as const;

  const parsedLimit = parseInt(limit as string, 10);
  const parsedOffset = parseInt(offset as string, 10);
  const take = Number.isFinite(parsedLimit)
    ? Math.min(100, Math.max(1, parsedLimit))
    : 200;
  const skip = Number.isFinite(parsedOffset) ? Math.max(0, parsedOffset) : 0;

  /** 마케터 집계 drill-down 제외 — 접수일·예약일·상태 등 어떤 필터여도 미제출은 목록 최상단 고정 */
  let pinPendingWhere: Prisma.InquiryWhereInput | null = null;
  if (!useMarketerStatsDay) {
    const pinClauses: Prisma.InquiryWhereInput[] = [{ tenantId }, whereInquiryOrderFormPendingSubmit()];
    if (
      (user.role === 'ADMIN' || user.role === 'MARKETER') &&
      typeof createdById === 'string' &&
      createdById.trim()
    ) {
      const cid = createdById.trim();
      if (cid === CREATED_BY_FILTER_UNASSIGNED) {
        pinClauses.push({ createdById: null, orderFormId: null });
      } else {
        pinClauses.push(whereInquiryAttributedToMarketer(cid));
      }
    }
    pinPendingWhere = { AND: pinClauses };
  }

  const { items: itemsRaw, total } = await fetchInquiryListPageSorted(prisma, {
    where,
    pinPendingWhere,
    include: listInclude,
    take,
    skip,
  });
  /** 레거시 발주서 — 접수 목록 메시지 복사 시 페이백 토큰 lazy 발급 */
  const itemsWithPaybackToken = await Promise.all(
    itemsRaw.map(async (row) => {
      if (!row.orderForm?.id) return row;
      const paybackToken =
        row.orderForm.reviewPaybackToken ??
        (await ensureReviewPaybackToken(prisma, row.orderForm.id, tenantId));
      if (paybackToken === row.orderForm.reviewPaybackToken) return row;
      return { ...row, orderForm: { ...row.orderForm, reviewPaybackToken: paybackToken } };
    }),
  );
  // 좌표 캐시가 있는 건 즉시 반환(빠름). 신규(미좌표) 건만 백그라운드에서 카카오로 채워
  // DB에 저장 → 다음 로드부터 저장된 좌표가 즉시 표시된다.
  const itemsWithDistance = itemsWithPaybackToken.map((row) => attachDistanceFromJuanForInquiry(row));
  const itemsWithShare = await attachTenantShareMetaToInquiries(tenantId, itemsWithDistance);
  const itemsWithInspection = attachInspectionSummaries(itemsWithShare);
  res.json({
    items: mapInquiriesInternalToneForRole(itemsWithInspection, user.role),
    total,
  });
  scheduleBackgroundGeoHydrate(prisma, itemsWithPaybackToken, { maxUniqueQueries: 18 });
});

/** 관리자만 — 접수일(createdAt) KST 하루 단위 영구 삭제 (배정·이력·현장사진 연쇄 삭제) */
router.post('/admin/bulk-delete-by-day', adminOrMarketer, async (req, res) => {
  const auth = (req as unknown as { user: AuthPayload }).user;
  const tenantId = getTenantIdFromAuth(auth);
  if (!tenantId) {
    res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
    return;
  }
  const body = req.body as { day?: string; password?: unknown };
  const day = typeof body.day === 'string' ? body.day.trim() : '';
  const range = kstDayRangeYmd(day);
  if (!range) {
    res.status(400).json({ error: '날짜는 YYYY-MM-DD 형식이어야 합니다.' });
    return;
  }
  if (!(await verifyAdminPasswordForRequest(req, res, body.password))) return;
  const del = await prisma.inquiry.deleteMany({
    where: { tenantId, createdAt: { gte: range.gte, lte: range.lte } },
  });
  res.json({ deleted: del.count });
});

/** 관리자만 — 접수일(createdAt) KST 해당 월 영구 삭제 */
router.post('/admin/bulk-delete-by-month', adminOrMarketer, async (req, res) => {
  const auth = (req as unknown as { user: AuthPayload }).user;
  const tenantId = getTenantIdFromAuth(auth);
  if (!tenantId) {
    res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
    return;
  }
  const body = req.body as { month?: string; password?: unknown };
  const month = typeof body.month === 'string' ? body.month.trim() : '';
  const range = kstMonthRangeYm(month);
  if (!range) {
    res.status(400).json({ error: '월은 YYYY-MM 형식이어야 합니다.' });
    return;
  }
  if (!(await verifyAdminPasswordForRequest(req, res, body.password))) return;
  const del = await prisma.inquiry.deleteMany({
    where: { tenantId, createdAt: { gte: range.gte, lte: range.lte } },
  });
  res.json({ deleted: del.count });
});

/** 단일 접수 상세 (목록 항목과 동일 include — 딥링크·C/S 연결 등) */
router.get('/:id', async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user;
  const tenantId = getTenantIdFromAuth(user);
  if (!tenantId) {
    res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
    return;
  }
  const { id } = req.params;
  const inquiry = await prisma.inquiry.findFirst({
    where: { id, tenantId },
    include: inquiryDetailInclude,
  });
  if (!inquiry) {
    res.status(404).json({ error: '문의를 찾을 수 없습니다.' });
    return;
  }
  await syncInquiryAddressGeo(prisma, id);
  const inquiryFresh = await prisma.inquiry.findFirst({
    where: { id, tenantId },
    include: inquiryDetailInclude,
  });
  if (!inquiryFresh) {
    res.status(404).json({ error: '문의를 찾을 수 없습니다.' });
    return;
  }
  const detail = attachInternalCustomerToneForRole(
    attachDistanceFromJuanForInquiry(inquiryFresh),
    user.role,
  );
  res.json(await attachTenantShareMetaToInquiry(tenantId, detail));
});

/** 접수별 현장 청소 전·후 사진 (Cloudinary) — 목록·업로드·삭제 */
router.use('/:inquiryId/cleaning-photos', inquiryCleaningPhotosAdminRoutes);
router.use('/:inquiryId/inspection', inquiryInspectionAdminRoutes);
router.use('/:inquiryId/consultation-photos', inquiryConsultationPhotosAdminRoutes);
router.use('/:inquiryId/extra-charges', inquiryExtraChargesAdminRoutes);
router.use('/:inquiryId/additional-receipts', inquiryAdditionalReceiptsAdminRoutes);

/** 같은 예약일 다른 접수와 팀원 투입(인원·이름) 맞바꿈 — 드롭다운으로는 가용 인원 부족할 때 사용 */
router.post('/:id/swap-crew-with-partner', handlePostSwapCrewWithPartner);

/** 관리자만 — 비밀번호 확인 후 접수 영구 삭제 */
router.delete('/:id', adminOrMarketer, async (req, res) => {
  const auth = (req as unknown as { user: AuthPayload }).user;
  const tenantId = getTenantIdFromAuth(auth);
  if (!tenantId) {
    res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
    return;
  }
  const { id } = req.params;
  const body = req.body as { password?: string };
  if (!(await verifyAdminPasswordForRequest(req, res, body.password))) return;

  const existing = await prisma.inquiry.findFirst({ where: { id, tenantId } });
  if (!existing) {
    res.status(404).json({ error: '문의를 찾을 수 없습니다.' });
    return;
  }

  const actor = (req as unknown as { user: AuthPayload }).user;
  await prisma.$transaction(async (tx) => {
    await tx.inquiryChangeLog.create({
      data: {
        inquiryId: existing.id,
        customerName: existing.customerName,
        actorId: actor?.userId ?? null,
        lines: [`접수 삭제: ${existing.customerName} (${existing.inquiryNumber ?? existing.id})`],
      },
    });
    await tx.inquiry.delete({ where: { id } });
  });
  notifyChangeLogToStaff({
    tenantId,
    customerName: existing.customerName,
    inquiryId: null,
    lines: [`접수 삭제: ${existing.customerName} (${existing.inquiryNumber ?? existing.id})`],
  });
  res.json({ ok: true });
});

/** 관리자·마케터: 고객 선택 전문 시공 옵션 단가 → 추가 청소(extraCharges) 반영 */
router.post('/:id/apply-prof-option-amounts', async (req, res) => {
  const { id } = req.params;
  const user = (req as unknown as { user: AuthPayload }).user;
  const tenantId = getTenantIdFromAuth(user);
  if (!tenantId) {
    res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
    return;
  }
  if (user.role !== 'ADMIN' && user.role !== 'MARKETER') {
    res.status(403).json({ error: '권한이 없습니다.' });
    return;
  }
  try {
    const result = await applyProfOptionAmountsToInquiry({
      tenantId,
      inquiryId: id,
      actorId: user.userId,
    });
    res.json(result);
  } catch (e) {
    if (e instanceof Error && e.message === 'NOT_FOUND') {
      res.status(404).json({ error: '문의를 찾을 수 없습니다.' });
      return;
    }
    console.error('[inquiries apply-prof-option-amounts]', e);
    res.status(500).json({ error: '옵션 금액 반영에 실패했습니다.' });
  }
});

router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const body = req.body as Record<string, unknown>;
  const user = (req as unknown as { user: AuthPayload }).user;
  const tenantId = getTenantIdFromAuth(user);
  if (!tenantId) {
    res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
    return;
  }
  const inquiry = await prisma.inquiry.findFirst({
    where: { id, tenantId },
    include: {
      orderForm: {
        select: { id: true, createdById: true, submittedAt: true, customerSpecialNotes: true },
      },
      assignments: {
        orderBy: { sortOrder: 'asc' },
        include: { teamLeader: { select: assignmentTeamLeaderSelect } },
      },
    },
  });
  if (!inquiry) {
    res.status(404).json({ error: '문의를 찾을 수 없습니다.' });
    return;
  }

  /** 클라이언트가 teamLeaderIds를 보낸 경우에만 분배(Assignment) 동기화 — 배열이 아닌 형태도 normalize에서 처리 */
  let wantsTeamSync = Object.prototype.hasOwnProperty.call(body, 'teamLeaderIds');
  let teamLeaderIds = normalizeTeamLeaderIds(body.teamLeaderIds);

  if (Object.prototype.hasOwnProperty.call(body, 'internalCustomerTone')) {
    if (!canEditInternalCustomerTone(user.role)) {
      res.status(403).json({ error: '내부 고객 표시를 변경할 권한이 없습니다.' });
      return;
    }
    const parsedTone = parseInternalCustomerToneInput(body.internalCustomerTone);
    if (!parsedTone) {
      res.status(400).json({ error: '내부 고객 표시 값이 올바르지 않습니다.' });
      return;
    }
  }

  const data = buildInquiryPatchData(body);
  const tentativeMergedStatus: InquiryStatus =
    data.status !== undefined ? (data.status as InquiryStatus) : inquiry.status;
  const mergedAddress =
    data.address !== undefined
      ? typeof data.address === 'string'
        ? data.address
        : inquiry.address
      : inquiry.address;
  const addressStatusError = validateInquiryAddressForStatus(
    tentativeMergedStatus,
    mergedAddress,
  );
  if (addressStatusError) {
    res.status(400).json({ error: addressStatusError });
    return;
  }

  /** 취소·보류: 담당 팀장·팀원 없이 유지(배정 행 삭제, 팀원 필드 비움). teamLeaderIds 없이 PATCH만 와도 동기화되도록 wantsTeamSync 강제 */
  if (tentativeMergedStatus === 'CANCELLED' || tentativeMergedStatus === 'ON_HOLD') {
    wantsTeamSync = true;
    teamLeaderIds = [];
    data.crewMemberCount = null;
    data.crewMemberNote = null;
  }

  if (tentativeMergedStatus !== 'CANCELLED' && inquiry.status === 'CANCELLED') {
    data.cancelFeeExternalCompany = { disconnect: true };
  } else if (tentativeMergedStatus === 'CANCELLED' && inquiry.status !== 'CANCELLED') {
    const ext = inquiry.assignments.find((a) => a.teamLeader.role === 'EXTERNAL_PARTNER');
    const snapCid = ext?.teamLeader.externalCompanyId;
    if (typeof snapCid === 'string' && snapCid.length > 0) {
      data.cancelFeeExternalCompany = { connect: { id: snapCid } };
    }
  }
  if (Object.prototype.hasOwnProperty.call(body, 'createdById')) {
    if (user.role !== 'ADMIN') {
      res.status(403).json({ error: '담당 마케터 변경은 관리자만 가능합니다.' });
      return;
    }
    const rawCb = body.createdById;
    const nextCreatedById = rawCb == null || rawCb === '' ? null : String(rawCb);
    if (nextCreatedById) {
      const owner = await prisma.user.findFirst({
        where: { id: String(nextCreatedById), tenantId },
        select: { id: true, role: true, isActive: true },
      });
      if (!owner || !owner.isActive || (owner.role !== 'ADMIN' && owner.role !== 'MARKETER')) {
        res.status(400).json({ error: '담당 마케터는 활성 관리자/마케터만 선택할 수 있습니다.' });
        return;
      }
    }
  }

  let operatingCompanyChanged = false;
  if (Object.prototype.hasOwnProperty.call(body, 'operatingCompanyId')) {
    const nextOcId =
      body.operatingCompanyId == null || body.operatingCompanyId === ''
        ? null
        : String(body.operatingCompanyId);
    if (!nextOcId) {
      res.status(400).json({ error: '영업 업체는 비울 수 없습니다.' });
      return;
    }
    if (nextOcId !== inquiry.operatingCompanyId) {
      try {
        await validateInquiryOperatingCompanyChange({
          tx: prisma,
          tenantId,
          userId: user.userId,
          userRole: user.role as import('@prisma/client').UserRole,
          nextOperatingCompanyId: nextOcId,
        });
      } catch (e) {
        const mapped = mapOperatingCompanyResolveError(e);
        if (mapped) {
          res.status(mapped.status).json({ error: mapped.message });
          return;
        }
        throw e;
      }
      data.operatingCompany = { connect: { id: nextOcId } };
      operatingCompanyChanged = true;
    }
  }

  let assigneesForLog: Array<{
    id: string;
    role: string;
    name: string;
    externalCompanyId: string | null;
    externalCompany: { name: string } | null;
  }> = [];
  if (wantsTeamSync) {
    if (
      teamLeaderIds.length > 0 &&
      (tentativeMergedStatus === 'PENDING' ||
        tentativeMergedStatus === 'DEPOSIT_COMPLETED' ||
        tentativeMergedStatus === 'ORDER_FORM_PENDING')
    ) {
      res.status(400).json({
        error:
          '대기·입금완료·미제출(발주서 고객 작성 대기)인 건은 분배할 수 없습니다. 발주서 제출 후 접수로 바뀌면 분배할 수 있습니다.',
      });
      return;
    }
    if (teamLeaderIds.length > 0 && tentativeMergedStatus === 'DEPOSIT_PENDING') {
      res.status(400).json({
        error: '입금대기인 건에는 분배할 수 없습니다. 입금 완료 후 발주서 생성·대기 전환 뒤 진행하세요.',
      });
      return;
    }
    if (teamLeaderIds.length > 0) {
      const assignees = await prisma.user.findMany({
        where: {
          id: { in: teamLeaderIds },
          tenantId,
          isActive: true,
          role: { in: ['TEAM_LEADER', 'EXTERNAL_PARTNER', 'ADMIN'] },
        },
        select: {
          id: true,
          role: true,
          name: true,
          email: true,
          hireDate: true,
          resignationDate: true,
          externalCompanyId: true,
          externalCompany: { select: { name: true } },
        },
      });
      if (assignees.length !== teamLeaderIds.length) {
        res.status(400).json({ error: '유효한 팀장 또는 타업체 계정을 찾을 수 없습니다.' });
        return;
      }
      // ADMIN이 배정 대상으로 왔다면 team-preview-admin(개발자)인 경우에만 허용한다.
      for (const a of assignees) {
        if (a.role === 'ADMIN' && !isTeamPreviewAdminEmail(a.email)) {
          res.status(400).json({ error: '관리자는 팀장으로 배정할 수 없습니다.' });
          return;
        }
      }
      for (const a of assignees) {
        if (a.role === 'EXTERNAL_PARTNER' && !a.externalCompanyId) {
          res.status(400).json({ error: '타업체 계정에 소속 업체가 없습니다. 관리자에게 문의하세요.' });
          return;
        }
      }
      const inquiryOcId =
        data.operatingCompany && 'connect' in data.operatingCompany
          ? String((data.operatingCompany as { connect: { id: string } }).connect.id)
          : inquiry.operatingCompanyId;
      try {
        await assertTeamLeadersMatchInquiryBrand({
          db: prisma,
          tenantId,
          inquiryOperatingCompanyId: inquiryOcId,
          assignees,
        });
      } catch (e) {
        if (e instanceof OperatingCompanyAssignmentError) {
          res.status(400).json({ error: e.message });
          return;
        }
        throw e;
      }
      const mergedAddress =
        data.address !== undefined
          ? typeof data.address === 'string'
            ? data.address
            : inquiry.address
          : inquiry.address;
      const assignmentServiceZoneId =
        typeof body.assignmentServiceZoneId === 'string'
          ? body.assignmentServiceZoneId.trim()
          : '';
      try {
        await assertInquiryTeamLeaderAssignmentZones({
          db: prisma,
          tenantId,
          inquiryAddress: mergedAddress,
          inquiryId: inquiry.id,
          teamLeaderIds,
          internalTeamLeaderIds: assignees
            .filter((a) => a.role === 'TEAM_LEADER' || a.role === 'ADMIN')
            .map((a) => a.id),
          assignmentServiceZoneId: assignmentServiceZoneId || null,
        });
      } catch (e) {
        if (e instanceof ServiceZoneAssignmentError) {
          res.status(400).json({ error: e.message });
          return;
        }
        throw e;
      }
      const mergedPd =
        data.preferredDate !== undefined
          ? (data.preferredDate as Date | null)
          : inquiry.preferredDate;
      const assignYmd = mergedPd ? dateToYmdKst(new Date(mergedPd)) : kstTodayYmd();
      for (const l of assignees) {
        if (l.role !== 'TEAM_LEADER') continue;
        if (!isUserEmployedOnYmd(l.hireDate, l.resignationDate, assignYmd)) {
          res.status(400).json({
            error: '선택한 팀장 중 해당 예약일에 배정할 수 없는 계정이 있습니다.',
          });
          return;
        }
      }
      assigneesForLog = assignees;
    }
  }

  if (body.professionalOptionIds !== undefined) {
    const raw = parseProfessionalOptionSelectionsRaw(body.professionalOptionIds);
    const filtered = await filterExistingProfessionalOptionSelections(prisma, tenantId, raw);
    data.professionalOptionIds = serializeProfessionalOptionSelectionsJson(filtered);
  }
  if (data.crewMemberCount !== undefined && data.crewMemberCount !== null) {
    const n = Number(data.crewMemberCount);
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      res.status(400).json({ error: '팀원 인원은 0~100 사이로 입력해주세요.' });
      return;
    }
  }

  const mergedPreferredDate =
    data.preferredDate !== undefined
      ? (data.preferredDate as Date | null)
      : inquiry.preferredDate;
  const mergedCrew =
    data.crewMemberCount !== undefined
      ? (data.crewMemberCount as number | null)
      : inquiry.crewMemberCount;
  const mergedStatus = data.status !== undefined ? (data.status as InquiryStatus) : inquiry.status;
  const mergedCustomerName =
    data.customerName !== undefined ? String(data.customerName ?? '').trim() : inquiry.customerName;
  const mergedCustomerPhone =
    data.customerPhone !== undefined ? String(data.customerPhone ?? '').trim() : inquiry.customerPhone;
  const mergedClaimMemo =
    data.claimMemo !== undefined ? String(data.claimMemo ?? '').trim() : String(inquiry.claimMemo ?? '').trim();

  const mergedCrewMemberNote =
    data.crewMemberNote !== undefined ? (data.crewMemberNote as string | null) : inquiry.crewMemberNote;
  const crewRosterChanged = isCrewRosterChanged(
    inquiry.crewMemberNote,
    inquiry.crewMemberCount,
    mergedCrewMemberNote,
    mergedCrew,
  );
  /** 팀원(투입) 메모·인원 변경 시 현장 미팅 시각은 팀장이 다시 넣도록 초기화 */
  let crewRosterAckMessages: { messageKo: string; messageTh: string } | null = null;
  if (crewRosterChanged) {
    data.crewMeetingTime = null;
    data.crewMeetingTimeUpdatedAt = null;
    const hadPrevMeeting = await inquiryHasAnyCrewMeetingTime(
      prisma,
      id,
      inquiry.crewMeetingTime,
    );
    crewRosterAckMessages = buildInquiryPatchCrewRosterAckMessages(inquiry.crewMemberNote, mergedCrewMemberNote, {
      customerName: String(inquiry.customerName ?? ''),
      hadPrevMeeting,
    });
  }

  const mergedTime =
    data.preferredTime !== undefined
      ? String(data.preferredTime)
      : String(inquiry.preferredTime ?? '');
  if (!isSideCleaningPreferredTime(mergedTime)) {
    data.betweenScheduleSlot = null;
  }
  if (data.betweenScheduleSlot != null && !isSideCleaningPreferredTime(mergedTime)) {
    res.status(400).json({ error: '사이청소 접수만 오전/오후 일정을 확정할 수 있습니다.' });
    return;
  }

  if (wantsTeamSync && teamLeaderIds.length > 0 && data.status === undefined) {
    data.status = 'ASSIGNED';
  }

  if (Object.keys(data).length === 0 && !wantsTeamSync) {
    const unchanged = await prisma.inquiry.findUnique({
      where: { id },
      include: inquiryDetailInclude,
    });
    res.json(
      unchanged
        ? attachInternalCustomerToneForRole(attachDistanceFromJuanForInquiry(unchanged), user.role)
        : unchanged,
    );
    return;
  }

  const beforeSnap = {
    preferredDate: inquiry.preferredDate,
    serviceTotalAmount: inquiry.serviceTotalAmount,
    serviceDepositAmount: inquiry.serviceDepositAmount,
    serviceBalanceAmount: inquiry.serviceBalanceAmount,
  };
  const afterSnap = projectAfterPatch(inquiry, data);
  const lines = buildAmountDateChangeLines(beforeSnap, afterSnap);
  const fmtBetween = (v: string | null | undefined) =>
    v == null || v === '' ? '미확정' : String(v);
  let mergedBetween =
    data.betweenScheduleSlot !== undefined
      ? (data.betweenScheduleSlot as string | null)
      : inquiry.betweenScheduleSlot;
  if (!isSideCleaningPreferredTime(mergedTime)) {
    mergedBetween = null;
  }
  if (fmtBetween(inquiry.betweenScheduleSlot) !== fmtBetween(mergedBetween)) {
    lines.push(`사이청소 일정 확정: ${fmtBetween(inquiry.betweenScheduleSlot)} → ${fmtBetween(mergedBetween)}`);
  }
  const fmtText = (v: unknown) => (v == null || v === '' ? '(없음)' : String(v));
  const fmtNum = (v: unknown) => (v == null || v === '' ? '(없음)' : String(v));
  const fmtStatus = (v: unknown) => {
    const m: Record<string, string> = {
      PENDING: '대기',
      RECEIVED: '접수',
      DEPOSIT_PENDING: '입금대기',
      DEPOSIT_COMPLETED: '입금완료',
      ORDER_FORM_PENDING: '미제출',
      ASSIGNED: '분배완료',
      IN_PROGRESS: '진행중',
      COMPLETED: '완료',
      ON_HOLD: '보류',
      CANCELLED: '취소',
      CS_PROCESSING: 'C/S 처리중',
    };
    if (v == null || v === '') return '(없음)';
    const s = String(v);
    return m[s] ?? s;
  };
  const fmtDate = (v: unknown) => {
    if (!v) return '(없음)';
    const d = v instanceof Date ? v : new Date(String(v));
    if (Number.isNaN(d.getTime())) return '(없음)';
    return d.toISOString().slice(0, 10);
  };
  const pushIfChanged = (label: string, before: unknown, after: unknown, fmt = fmtText) => {
    if (before === after) return;
    if (String(before ?? '') === String(after ?? '')) return;
    lines.push(`${label}: ${fmt(before)} → ${fmt(after)}`);
  };

  if (data.customerName !== undefined) pushIfChanged('고객명', inquiry.customerName, data.customerName);
  if (data.nickname !== undefined) pushIfChanged('닉네임', inquiry.nickname, data.nickname);
  if (data.customerPhone !== undefined) pushIfChanged('연락처', inquiry.customerPhone, data.customerPhone);
  if (data.customerPhone2 !== undefined) pushIfChanged('보조 연락처', inquiry.customerPhone2, data.customerPhone2);
  if (data.address !== undefined) pushIfChanged('주소', inquiry.address, data.address);
  if (data.addressDetail !== undefined) pushIfChanged('상세주소', inquiry.addressDetail, data.addressDetail);
  if (data.areaPyeong !== undefined) pushIfChanged('평수', inquiry.areaPyeong, data.areaPyeong, fmtNum);
  if (data.areaBasis !== undefined) pushIfChanged('평수 기준', inquiry.areaBasis, data.areaBasis);
  if (data.exclusiveAreaSqm !== undefined)
    pushIfChanged('참고 전용면적(㎡)', inquiry.exclusiveAreaSqm, data.exclusiveAreaSqm, fmtNum);
  if (data.propertyType !== undefined) pushIfChanged('건물 유형', inquiry.propertyType, data.propertyType);
  if (data.isOneRoom !== undefined) {
    const fmtOneRoom = (v: unknown) => (v ? '원룸' : '(아님)');
    pushIfChanged('원룸', inquiry.isOneRoom, data.isOneRoom, fmtOneRoom);
  }
  if (data.roomCount !== undefined) pushIfChanged('방', inquiry.roomCount, data.roomCount, fmtNum);
  if (data.bathroomCount !== undefined) pushIfChanged('화장실', inquiry.bathroomCount, data.bathroomCount, fmtNum);
  if (data.balconyCount !== undefined) pushIfChanged('베란다', inquiry.balconyCount, data.balconyCount, fmtNum);
  if (data.kitchenCount !== undefined) pushIfChanged('주방', inquiry.kitchenCount, data.kitchenCount, fmtNum);
  if (data.preferredTime !== undefined) pushIfChanged('희망 시간대', inquiry.preferredTime, data.preferredTime);
  if (data.preferredTimeDetail !== undefined)
    pushIfChanged('희망 시간 상세', inquiry.preferredTimeDetail, data.preferredTimeDetail);
  if (data.buildingType !== undefined) pushIfChanged('건물 구분', inquiry.buildingType, data.buildingType);
  if (data.moveInDate !== undefined) pushIfChanged('이사일', inquiry.moveInDate, data.moveInDate, fmtDate);
  if (data.moveInDateUndecided !== undefined) {
    const fmtU = (v: unknown) => (v ? '미정' : '일자 지정');
    pushIfChanged('이사일(미정)', inquiry.moveInDateUndecided, data.moveInDateUndecided, fmtU);
  }
  if (data.specialNotes !== undefined) pushIfChanged('특이사항', inquiry.specialNotes, data.specialNotes);
  if (data.memo !== undefined) pushIfChanged('메모', inquiry.memo, data.memo);
  if (data.scheduleMemo !== undefined) pushIfChanged('일정 메모', inquiry.scheduleMemo, data.scheduleMemo);
  if (data.consultationMemo !== undefined)
    pushIfChanged('상담·마케터 메모', inquiry.consultationMemo, data.consultationMemo);
  if (data.internalCustomerTone !== undefined) {
    pushIfChanged(
      '내부 표시',
      inquiry.internalCustomerTone,
      data.internalCustomerTone,
      (v) => internalCustomerToneDisplay((v as import('@prisma/client').InternalCustomerTone) ?? 'NORMAL'),
    );
  }
  if (data.claimMemo !== undefined) pushIfChanged('클레임 메모', inquiry.claimMemo, data.claimMemo);
  if (data.status !== undefined) pushIfChanged('상태', inquiry.status, data.status, fmtStatus);
  /**
   * 취소확인(가상 상태) 처리 로그:
   * - 클라이언트는 status=CANCELLED + happyCallCompletedAt=now 로 보냄
   * - 이를 명시 문구로 남겨 변경이력을 쉽게 식별
   */
  if (
    data.status === 'CANCELLED' &&
    inquiry.status === 'CANCELLED' &&
    inquiry.happyCallCompletedAt == null &&
    data.happyCallCompletedAt != null
  ) {
    lines.push('관리자 취소확인 처리');
  }
  if (data.crewMemberCount !== undefined)
    pushIfChanged('팀원 인원', inquiry.crewMemberCount, data.crewMemberCount, fmtNum);
  if (data.crewMemberNote !== undefined) pushIfChanged('팀원 메모', inquiry.crewMemberNote, data.crewMemberNote);
  if (crewRosterChanged) {
    const hadMeeting = await inquiryHasAnyCrewMeetingTime(prisma, id, inquiry.crewMeetingTime);
    if (hadMeeting) {
      lines.push('현장 미팅(크루): 팀원 구성 변경으로 미팅 시각 초기화');
    }
  }
  if (operatingCompanyChanged && data.operatingCompany && 'connect' in data.operatingCompany) {
    const nextOcId = String((data.operatingCompany as { connect: { id: string } }).connect.id);
    const ocIds = [inquiry.operatingCompanyId, nextOcId].filter(Boolean) as string[];
    const ocRows =
      ocIds.length > 0
        ? await prisma.operatingCompany.findMany({
            where: { tenantId, id: { in: ocIds } },
            select: { id: true, name: true },
          })
        : [];
    const ocNameById = new Map(ocRows.map((r) => [r.id, r.name] as const));
    const beforeLabel = ocNameById.get(inquiry.operatingCompanyId) ?? inquiry.operatingCompanyId;
    const afterLabel = ocNameById.get(nextOcId) ?? nextOcId;
    if (beforeLabel !== afterLabel) {
      lines.push(`영업 브랜드: ${beforeLabel} → ${afterLabel}`);
    }
  }
  if (Object.prototype.hasOwnProperty.call(body, 'createdById')) {
    const rawCb = body.createdById;
    const nextCreatedByIdForLog = rawCb == null || rawCb === '' ? null : String(rawCb);
    const ids = [inquiry.createdById, nextCreatedByIdForLog]
      .map((x) => (x == null ? '' : String(x).trim()))
      .filter(Boolean);
    const byId = new Map<string, string>();
    if (ids.length > 0) {
      const users = await prisma.user.findMany({
        where: { id: { in: ids } },
        select: { id: true, name: true, role: true },
      });
      for (const u of users) {
        byId.set(u.id, u.role === 'ADMIN' ? `관리자(${u.name})` : u.name);
      }
    }
    const beforeLabel =
      inquiry.createdById == null ? '(없음)' : byId.get(inquiry.createdById) ?? inquiry.createdById;
    const nextId = nextCreatedByIdForLog;
    const afterLabel = nextId == null ? '(없음)' : byId.get(nextId) ?? nextId;
    if (beforeLabel !== afterLabel) lines.push(`담당 마케터: ${beforeLabel} → ${afterLabel}`);
  }
  if (data.externalTransferFee !== undefined)
    pushIfChanged('타업체 수수료', inquiry.externalTransferFee, data.externalTransferFee, fmtNum);
  if (data.professionalOptionIds !== undefined) {
    const before = Array.isArray(inquiry.professionalOptionIds) ? inquiry.professionalOptionIds : [];
    const after = Array.isArray(data.professionalOptionIds) ? data.professionalOptionIds : [];
    const beforeTxt = before.length > 0 ? before.join(', ') : '(없음)';
    const afterTxt = after.length > 0 ? after.join(', ') : '(없음)';
    if (beforeTxt !== afterTxt) lines.push(`전문 작업 옵션: ${beforeTxt} → ${afterTxt}`);
  }
  if (wantsTeamSync) {
    const toLeaderLabel = (u: { name: string; role: string; externalCompany: { name: string } | null }) =>
      u.role === 'EXTERNAL_PARTNER'
        ? `[타업체] ${u.externalCompany?.name ?? u.name}`
        : u.name;
    const beforeTeam = inquiry.assignments.map((a) => toLeaderLabel(a.teamLeader));
    const assigneeMap = new Map(assigneesForLog.map((u) => [u.id, u] as const));
    const afterTeam = teamLeaderIds
      .map((id) => assigneeMap.get(id))
      .filter((u): u is NonNullable<typeof u> => Boolean(u))
      .map((u) => toLeaderLabel(u));
    const beforeTxt = beforeTeam.length > 0 ? beforeTeam.join(' · ') : '미배정';
    const afterTxt = afterTeam.length > 0 ? afterTeam.join(' · ') : '미배정';
    // 첫 배정(미배정 → 배정)은 변경 이력으로 보지 않는다. 이미 배정된 뒤 바뀐 경우(교체·해제)만 기록.
    if (beforeTeam.length > 0 && beforeTxt !== afterTxt) {
      lines.push(`팀장 배정: ${beforeTxt} → ${afterTxt}`);
    }
  }

  if (shouldClearProfOptionsAmountReviewOnPatch(inquiry, data)) {
    data.profOptionsAmountReviewPending = false;
  }

  try {
    let createdCsReport = false;
    await prisma.$transaction(async (tx) => {
      const updateData: Prisma.InquiryUpdateInput = { ...data };
      const statusAfterPatch =
        updateData.status !== undefined ? (updateData.status as InquiryStatus) : inquiry.status;
      if (statusAfterPatch === 'DEPOSIT_PENDING' && inquiry.inquiryNumber == null) {
        updateData.inquiryNumber = await allocateNextInquiryNumber(
          tx,
          tenantId,
          inquiry.operatingCompanyId,
        );
      }
      /** 구데이터: 제출 발주서인데 고객 특이사항이 접수 specialNotes에만 있음 → 관리자가 팀 공유 메모를 처음 저장할 때 발주서 customer_special_notes로 옮김 */
      if (updateData.specialNotes !== undefined && inquiry.orderForm?.id && inquiry.orderForm.submittedAt) {
        const prevSn = String(inquiry.specialNotes ?? '').trim();
        const nextRaw = updateData.specialNotes;
        const nextSn =
          nextRaw === null || nextRaw === undefined ? '' : String(nextRaw).trim();
        const formCustEmpty = !String(inquiry.orderForm.customerSpecialNotes ?? '').trim();
        if (formCustEmpty && prevSn && nextSn && nextSn !== prevSn) {
          await tx.orderForm.update({
            where: { id: inquiry.orderForm.id },
            data: { customerSpecialNotes: prevSn },
          });
        }
      }
      if (updateData.isOneRoom !== undefined && inquiry.orderForm?.id) {
        const nextOneRoom = Boolean(updateData.isOneRoom);
        const currentNotes =
          inquiry.orderForm.customerSpecialNotes?.trim() ||
          inquiry.specialNotes?.trim() ||
          '';
        const syncedNotes = resolveOneRoomSpecialNotes(currentNotes, nextOneRoom);
        await tx.orderForm.update({
          where: { id: inquiry.orderForm.id },
          data: { customerSpecialNotes: syncedNotes },
        });
      }
      if (Object.keys(updateData).length > 0) {
        await tx.inquiry.update({ where: { id }, data: updateData });
      }
      if (crewRosterChanged) {
        await clearInquiryCrewMemberMeetingTimes(tx, id);
      }
      if (mergedStatus !== inquiry.status) {
        await recordInquiryStatusTransition(tx, {
          tenantId,
          inquiryId: id,
          previousStatus: inquiry.status,
          nextStatus: mergedStatus,
          actorId: user?.userId ?? null,
        });
      }
      if (wantsTeamSync) {
        await tx.assignment.deleteMany({ where: { inquiryId: id } });
        if (teamLeaderIds.length > 0) {
          await tx.assignment.createMany({
            data: teamLeaderIds.map((teamLeaderId, sortOrder) => ({
              tenantId,
              inquiryId: id,
              teamLeaderId,
              assignedById: user.userId,
              sortOrder,
            })),
          });
        }
      }
      if (lines.length > 0) {
        await tx.inquiryChangeLog.create({
          data: {
            inquiryId: id,
            customerName: inquiry.customerName,
            actorId: user?.userId ?? null,
            lines,
          },
        });
      }

      /**
       * 접수 상태가 C/S 처리중이면 C/S 관리에 반드시 노출되도록 보장한다.
       * (직접 클레임 등록 시 상태만 바뀌고 C/S 목록 누락되는 케이스 방지)
       */
      if (mergedStatus === 'CANCELLED' && inquiry.status !== 'CANCELLED') {
        await stampTenantShareCancelFeeDirection(tx, id);
      }
      if (mergedStatus === 'CS_PROCESSING') {
        const openCsCount = await tx.csReport.count({
          where: {
            inquiryId: id,
            status: { not: 'DONE' },
          },
        });
        if (openCsCount === 0) {
          await tx.csReport.create({
            data: {
              tenantId,
              inquiryId: id,
              customerName: mergedCustomerName || inquiry.customerName,
              customerPhone: mergedCustomerPhone || inquiry.customerPhone,
              content: mergedClaimMemo || '접수 목록에서 C/S 처리중으로 전환된 건입니다.',
              imageUrls: [],
              status: 'RECEIVED',
            },
          });
          createdCsReport = true;
        }
      }
    });
    if (createdCsReport) {
      void notifyCsReportNavBadges(id, undefined, tenantId);
    }
    if (wantsTeamSync || operatingCompanyChanged) {
      const leaderIds = new Set<string>();
      for (const a of inquiry.assignments) leaderIds.add(a.teamLeaderId);
      if (wantsTeamSync) {
        for (const tid of teamLeaderIds) leaderIds.add(tid);
      }
      void notifyStaffInboxRefresh(tenantId, [...leaderIds]);
    }
    if (lines.length > 0) {
      notifyChangeLogToStaff({ tenantId, customerName: inquiry.customerName, inquiryId: id, lines });
    }
  } catch (e) {
    console.error('PATCH inquiry transaction:', e);
    res.status(500).json({ error: '저장 중 오류가 발생했습니다.' });
    return;
  }

  const patchChangedKeys = Object.keys(data);

  if (data.address !== undefined || data.addressDetail !== undefined) {
    await syncInquiryAddressGeo(prisma, id);
  }

  const updated = await prisma.inquiry.findUnique({
    where: { id },
    include: inquiryDetailInclude,
  });
  if (!updated) {
    res.status(404).json({ error: '문의를 찾을 수 없습니다.' });
    return;
  }
  if (patchChangedKeys.length > 0) {
    try {
      await syncTenantShareAfterInquiryPatch({
        inquiryId: id,
        viewerTenantId: tenantId,
        actorId: user.userId,
        changedKeys: patchChangedKeys,
        inquiryAfter: updated,
      });
    } catch (e) {
      console.error('[tenant-share-sync]', e);
    }
  }
  if (data.consultationMemo !== undefined) {
    const leaderIds = updated.assignments.map((a) => a.teamLeaderId);
    void notifyStaffInboxRefresh(tenantId, leaderIds);
  }
  void notifyAfterInquiryPatch({
    inquiryBefore: {
      assignments: inquiry.assignments.map((a) => ({ teamLeaderId: a.teamLeaderId })),
    },
    inquiryAfter: {
      id: updated.id,
      inquiryNumber: updated.inquiryNumber,
      customerName: updated.customerName,
      assignments: updated.assignments.map((a) => ({ teamLeaderId: a.teamLeaderId })),
    },
    lines,
  }).catch((e) => console.error('[inquiry-notify] notifyAfterInquiryPatch', e));

  const crewFieldNotify =
    data.preferredDate !== undefined ||
    data.crewMemberNote !== undefined ||
    data.crewMemberCount !== undefined ||
    data.status !== undefined ||
    wantsTeamSync;
  if (crewFieldNotify) {
    void notifyAllActiveCrewGroupsRefresh(tenantId).catch((e) => console.error('[crew-field-notify]', e));
  }
  if (crewRosterAckMessages) {
    void notifyAllActiveCrewRosterAck(tenantId, crewRosterAckMessages).catch((e) =>
      console.error('[crew-roster-ack]', e),
    );
    const rosterLeaderIds = updated.assignments.map((a) => a.teamLeaderId);
    notifyTeamLeaderUsersRosterAck(rosterLeaderIds, crewRosterAckMessages);
  }

  const patched = attachInternalCustomerToneForRole(
    attachDistanceFromJuanForInquiry(updated),
    user.role,
  );
  res.json(await attachTenantShareMetaToInquiry(tenantId, patched));
});

const CREATE_STATUSES: InquiryStatus[] = [
  'PENDING',
  'RECEIVED',
  'DEPOSIT_PENDING',
  'DEPOSIT_COMPLETED',
  'ORDER_FORM_PENDING',
  'ASSIGNED',
  'IN_PROGRESS',
  'COMPLETED',
  'ON_HOLD',
  'CANCELLED',
  'CS_PROCESSING',
];

router.post('/', async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const user = (req as unknown as { user: AuthPayload }).user;
  const tenantId = getTenantIdFromAuth(user);
  if (!tenantId) {
    res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
    return;
  }
  const rawStatus = body.status != null ? String(body.status) : '';
  const status: InquiryStatus =
    rawStatus && CREATE_STATUSES.includes(rawStatus as InquiryStatus)
      ? (rawStatus as InquiryStatus)
      : 'RECEIVED';

  const createAddress = String(body.address ?? '').trim();
  const createAddressError = validateInquiryAddressForStatus(status, createAddress);
  if (createAddressError) {
    res.status(400).json({ error: createAddressError });
    return;
  }

  let crewMemberCount: number | null = null;
  if (body.crewMemberCount !== undefined && body.crewMemberCount !== null && body.crewMemberCount !== '') {
    const n = Number(body.crewMemberCount);
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      res.status(400).json({ error: '팀원 인원은 0~100 사이로 입력해주세요.' });
      return;
    }
    crewMemberCount = Math.floor(n);
  }

  const preferredDate = body.preferredDate ? new Date(body.preferredDate as string) : null;

  let operatingCompanyId: string;
  try {
    operatingCompanyId = await prisma.$transaction(async (tx) =>
      resolveInquiryOperatingCompanyId({
        tx,
        tenantId,
        userId: user?.userId,
        userRole: user?.role as import('@prisma/client').UserRole | undefined,
        bodyOperatingCompanyId: body.operatingCompanyId,
      }),
    );
  } catch (e) {
    const mapped = mapOperatingCompanyResolveError(e);
    if (mapped) {
      res.status(mapped.status).json({ error: mapped.message });
      return;
    }
    throw e;
  }

  const inquiry = await prisma.$transaction(async (tx) => {
    const inquiryNumber =
      status === 'DEPOSIT_PENDING'
        ? await allocateNextInquiryNumber(tx, tenantId, operatingCompanyId)
        : null;
    return tx.inquiry.create({
      data: {
        tenantId,
        operatingCompanyId,
        inquiryNumber,
        createdById: user?.userId ?? null,
        customerName: String(body.customerName ?? ''),
        nickname: body.nickname ? String(body.nickname) : null,
        customerPhone: String(body.customerPhone ?? ''),
        customerPhone2: body.customerPhone2 ? String(body.customerPhone2) : null,
        address: String(body.address ?? ''),
        addressDetail: body.addressDetail ? String(body.addressDetail) : null,
        areaPyeong: body.areaPyeong != null ? Number(body.areaPyeong) : null,
        areaBasis: body.areaBasis ? String(body.areaBasis) : null,
        exclusiveAreaSqm: (() => {
          const v = body.exclusiveAreaSqm;
          if (v == null || v === '') return null;
          const n = Number(v);
          return Number.isFinite(n) && n > 0 ? n : null;
        })(),
        propertyType: body.propertyType ? String(body.propertyType) : null,
        roomCount: body.roomCount != null ? Number(body.roomCount) : null,
        bathroomCount: body.bathroomCount != null ? Number(body.bathroomCount) : null,
        balconyCount: body.balconyCount != null ? Number(body.balconyCount) : null,
        preferredDate,
        preferredTime: body.preferredTime ? String(body.preferredTime) : null,
        preferredTimeDetail: body.preferredTimeDetail ? String(body.preferredTimeDetail) : null,
        callAttempt: body.callAttempt != null ? Number(body.callAttempt) : null,
        memo: body.memo ? String(body.memo) : null,
        source: body.source ? String(body.source) : '전화',
        status,
        crewMemberCount,
      },
    });
  });
  await recordInquiryStatusEvent(prisma, {
    tenantId,
    inquiryId: inquiry.id,
    status: inquiry.status,
    actorId: user?.userId ?? null,
    occurredAt: inquiry.createdAt,
  });
  void notifyInquiryCelebrate({
    tenantId,
    createdById: inquiry.createdById,
    customerName: inquiry.customerName,
    inquiryNumber: inquiry.inquiryNumber,
    source: inquiry.source,
  });
  await syncInquiryAddressGeo(prisma, inquiry.id);
  const createdOut = await prisma.inquiry.findUnique({
    where: { id: inquiry.id },
    include: inquiryDetailInclude,
  });
  if (!createdOut) {
    res.status(500).json({ error: '접수 생성 후 조회에 실패했습니다.' });
    return;
  }
  res.status(201).json(
    attachInternalCustomerToneForRole(attachDistanceFromJuanForInquiry(createdOut), user.role),
  );
});

export default router;
