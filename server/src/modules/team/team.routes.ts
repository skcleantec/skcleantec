import { Router } from 'express';
import { Prisma, UserRole } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import bcrypt from 'bcryptjs';
import { teamAuthMiddleware } from '../auth/auth.middleware.team.js';
import type { AuthPayload } from '../auth/auth.middleware.js';
import { happyCallDeadlineEnd, isHappyCallEligible } from '../inquiries/happyCall.helpers.js';
import inquiryCleaningPhotosTeamRoutes from '../inquiry-cleaning-photos/inquiryCleaningPhotos.team.routes.js';
import inquiryConsultationPhotosTeamRoutes from '../inquiry-consultation-photos/inquiryConsultationPhotos.team.routes.js';
import inquiryExtraChargesTeamRoutes from '../inquiry-extra-charges/inquiryExtraCharges.team.routes.js';
import inquiryAdditionalReceiptsTeamRoutes from '../inquiry-additional-receipts/inquiryAdditionalReceipts.team.routes.js';
import inquiryInspectionTeamRoutes from '../inquiry-inspection/inquiryInspection.team.routes.js';
import dbMarketplaceTeamRoutes from '../db-marketplace/dbMarketplace.team.routes.js';
import { inspectionChecklistListInclude } from '../inquiry-inspection/inquiryInspection.listInclude.js';
import {
  attachInspectionSummaries,
  attachInspectionSummaryToInquiry,
} from '../inquiry-inspection/inquiryInspection.summary.js';
import { csReportFullInclude } from '../cs/csReport.include.js';
import { serializeCsReportRow, serializeCsReportRows } from '../cs/csReport.serialize.js';
import { buildCsReportUpdateData } from '../cs/csReport.patch.js';
import { notifyCsReportNavBadges, getEmployedStaffUserIds } from '../realtime/navBadgeNotify.js';
import { notifyInboxRefresh } from '../realtime/inboxNotify.js';
import { notifyChangeLogToStaff } from '../realtime/changeLogNotify.js';
import { toChangeHistoryItemDto } from '../inquiry-change-logs/inquiryChangeLogs.helpers.js';
import { assignmentTeamLeaderSelect } from '../inquiries/assignmentTeamLeaderSelect.js';
import { orderFormTemplateSelect } from '../inquiries/inquiryDetailInclude.js';
import { resolveExternalSettlementPaidAt } from '../../lib/externalSettlementPaidAt.js';
import {
  parseSettlementListPaging,
  settlementPreferredRangeFromQuery,
} from './teamExternalSettlementRange.js';
import {
  computeSignedExternalFeeBeforeDate,
  fetchExternalSettlementInquiriesForCompanyPeriod,
  filterExternalSettlementItemsBySearch,
} from '../../lib/externalSettlementEffectiveDate.js';
import {
  parseCrewMeetingPatchBody,
  validateCrewMeetingTimeForInquiry,
} from '../inquiries/crewMeetingTime.helpers.js';
import {
  clearInquiryCrewMemberMeetingTimes,
  resolveCrewTeamMemberIdsFromNote,
  upsertInquiryMemberMeetingTimes,
} from '../inquiries/inquiryCrewMemberMeetingTime.service.js';
import { notifyAllActiveCrewGroupsRefresh } from '../crew/crewFieldRealtime.js';
import { tenantActiveTeamMemberWhere } from '../inquiries/crewMemberCapacity.helpers.js';
import { getTenantIdFromAuth } from '../tenants/tenant.middleware.js';
import { getTenantConfig } from '../tenants/tenantConfig.service.js';
import { getEffectiveEnabledModules } from '../tenants/tenantFeatures.service.js';
import { countPendingIssuancesForTeamLeader, listIssuancesByTeamLeader, parseEContractListQuery } from '../e-contract/eContract.service.js';
import { countDbListingPendingForExternalBuyer } from '../db-marketplace/dbMarketplace.service.js';
import {
  listTeamAssignmentsPaginated,
  parseTeamAssignmentListQuery,
} from './teamAssignmentList.js';
import {
  buildTeamLeaderInquiryBrandFilter,
  mergeInquiryWhere,
} from '../operating-companies/operatingCompanyAssignment.js';

const router = Router();

/** 팀장/타업체 C/S 목록: 배정 접수 연결 건 또는 관리자 전달(forwarded) 건 */
function teamCsAccessWhere(userId: string) {
  return {
    OR: [
      {
        inquiryId: { not: null },
        inquiry: {
          assignments: { some: { teamLeaderId: userId } },
        },
      },
      { forwardedToUserId: userId },
    ],
  };
}

/** 팀 스케줄 범위 — 관리자 스케줄 API와 동일하게 KST 하루 경계 */
const SCHEDULE_QUERY_YMD = /^\d{4}-\d{2}-\d{2}$/;

router.use(teamAuthMiddleware);

/** 팀 화면 기준 현재 사용자(프리뷰 매핑 반영) */
router.get('/me', async (req, res) => {
  const auth = (req as unknown as { user: AuthPayload }).user;
  const { userId } = auth;
  const viewer = (req as unknown as {
    teamViewer?: { role?: string; previewExternal?: boolean; previewTeamLeader?: boolean };
  }).teamViewer;
  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      role: true,
      name: true,
      nameEn: true,
      phone: true,
      vehicleNumber: true,
      allowSelfDayOffEdit: true,
      externalCompanyId: true,
      externalCompany: { select: { id: true, name: true } },
      staffIdCardUrl: true,
      hireDate: true,
      tenantId: true,
    },
  });
  if (!me) {
    res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    return;
  }
  const tenantId = getTenantIdFromAuth(auth) ?? me.tenantId ?? null;
  let tenant: { id: string; name: string; displayName: string } | null = null;
  let features: string[] = [];
  if (tenantId) {
    const t = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true, name: true } });
    if (t) {
      const cfg = await getTenantConfig(tenantId);
      tenant = { id: t.id, name: t.name, displayName: cfg.branding?.displayName?.trim() || t.name };
      features = await getEffectiveEnabledModules(tenantId);
    }
  }
  const { tenantId: _omitTenantId, ...meRest } = me;
  res.json({
    ...meRest,
    viewerRole: viewer?.role ?? me.role,
    previewExternal: Boolean(viewer?.previewExternal),
    previewTeamLeader: Boolean(viewer?.previewTeamLeader),
    tenant,
    features,
  });
});

const teamInquiryInclude = {
  createdBy: { select: { id: true, name: true, phone: true } },
  orderForm: {
    select: {
      id: true,
      submittedAt: true,
      customerSpecialNotes: true,
      customerAnswers: true,
      template: { select: orderFormTemplateSelect },
      createdBy: { select: { id: true, name: true, phone: true } },
    },
  },
  assignments: {
    orderBy: { sortOrder: 'asc' as const },
    select: {
      id: true,
      inquiryId: true,
      teamLeaderId: true,
      assignedAt: true,
      detailViewedAt: true,
      sortOrder: true,
      teamLeader: { select: assignmentTeamLeaderSelect },
      assignedBy: { select: { id: true, name: true } },
    },
  },
  extraCharges: {
    orderBy: { sortOrder: 'asc' as const },
    include: { createdBy: { select: { id: true, name: true } } },
  },
  additionalReceipts: {
    orderBy: { sortOrder: 'asc' as const },
    include: { createdBy: { select: { id: true, name: true } } },
  },
  changeLogs: {
    orderBy: { createdAt: 'desc' as const },
    take: 80,
    select: {
      id: true,
      createdAt: true,
      lines: true,
      actorId: true,
      actor: { select: { id: true, name: true } },
    },
  },
  inspectionChecklist: inspectionChecklistListInclude,
  crewMemberMeetingTimes: {
    select: { teamMemberId: true, meetingTime: true },
  },
} as const;

/**
 * `crew_member_note`(이름을 `/ , · |` 중 하나로 구분한 문자열)을 파싱해
 * 등록된 `TeamMember` 레코드의 이름과 매칭, 각 접수에 `crewMembers: [{name, phone}]`
 * 을 덧붙인다. 팀장이 현장 팀원에게 직접 연락할 수 있도록 이름·전화를 노출한다.
 */
function parseCrewNames(note: string | null | undefined): string[] {
  if (!note) return [];
  return note
    .split(/[,·/|]/g)
    .map((x) => x.trim())
    .filter(Boolean);
}

async function resolveTeamContextTenantId(user: AuthPayload): Promise<string | null> {
  if (user.tenantId) return user.tenantId;
  const row = await prisma.user.findUnique({
    where: { id: user.userId },
    select: { tenantId: true },
  });
  return row?.tenantId ?? null;
}

async function attachCrewMembers<
  T extends {
    crewMemberNote: string | null;
    crewMeetingTimeShared?: boolean;
    crewMeetingTime?: string | null;
    crewMemberMeetingTimes?: Array<{ teamMemberId: string; meetingTime: string }>;
  },
>(
  items: T[],
  tenantId: string,
): Promise<
  Array<
    T & {
      crewMembers: Array<{
        teamMemberId: string | null;
        name: string;
        phone: string | null;
        meetingTime: string | null;
      }>;
    }
  >
> {
  const allNames = new Set<string>();
  for (const it of items) {
    for (const n of parseCrewNames(it.crewMemberNote)) allNames.add(n);
  }
  if (allNames.size === 0) {
    return items.map((it) => ({ ...it, crewMembers: [] }));
  }
  const members = await prisma.teamMember.findMany({
    where: {
      name: { in: Array.from(allNames) },
      ...tenantActiveTeamMemberWhere(tenantId),
    },
    select: { id: true, name: true, phone: true, sortOrder: true, createdAt: true },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });
  const memberByName = new Map<string, { id: string; phone: string | null }>();
  for (const m of members) {
    const cur = memberByName.get(m.name);
    if (!cur) memberByName.set(m.name, { id: m.id, phone: m.phone ?? null });
    else if (!cur.phone && m.phone) memberByName.set(m.name, { id: cur.id, phone: m.phone });
  }
  return items.map((it) => {
    const shared = it.crewMeetingTimeShared !== false;
    const timeByMember = new Map(
      (it.crewMemberMeetingTimes ?? []).map((r) => [r.teamMemberId, r.meetingTime] as const),
    );
    return {
      ...it,
      crewMembers: parseCrewNames(it.crewMemberNote).map((name) => {
        const mem = memberByName.get(name);
        const teamMemberId = mem?.id ?? null;
        let meetingTime: string | null = null;
        if (shared) {
          meetingTime = it.crewMeetingTime ?? null;
        } else if (teamMemberId) {
          meetingTime = timeByMember.get(teamMemberId) ?? null;
        }
        return {
          teamMemberId,
          name,
          phone: mem?.phone ?? null,
          meetingTime,
        };
      }),
    };
  });
}

async function attachCrewMembersOne<T extends { crewMemberNote: string | null } | null>(
  item: T,
  tenantId: string,
) {
  if (!item) return null;
  const [enriched] = await attachCrewMembers([item], tenantId);
  if (!enriched) return null;
  if ('inspectionChecklist' in enriched) {
    return attachInspectionSummaryToInquiry(
      enriched as Parameters<typeof attachInspectionSummaryToInquiry>[0] & {
        crewMembers: Array<{
          teamMemberId: string | null;
          name: string;
          phone: string | null;
          meetingTime: string | null;
        }>;
      },
    );
  }
  return enriched;
}

type TeamProfessionalOption = {
  id: string;
  label: string;
  emoji: string | null;
  color: string | null;
};

/** `Inquiry.professionalOptionIds`(JSON) → 문자열 id 목록(중복 제거) */
function parseProfessionalOptionIdList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const v of raw) {
    if (typeof v === 'string') {
      const s = v.trim();
      if (s && !seen.has(s)) {
        seen.add(s);
        out.push(s);
      }
      continue;
    }
    if (v && typeof v === 'object' && typeof (v as { id?: unknown }).id === 'string') {
      const s = String((v as { id: string }).id).trim();
      if (s && !seen.has(s)) {
        seen.add(s);
        out.push(s);
      }
    }
  }
  return out;
}

/**
 * 접수의 `professionalOptionIds`(고객/마케터가 발주서에서 선택한 전문 시공)를
 * **테넌트 카탈로그 라벨**로 해석해 `professionalOptions`로 첨부한다.
 * - 팀장/타업체 상세 모달에서 라벨을 그대로 보여 줄 수 있게 한다.
 * - 카탈로그 조회는 `tenantId`로 스코프(멀티테넌트 안전).
 */
async function attachProfessionalOptions<T extends object>(
  items: T[],
  tenantId: string,
): Promise<Array<T & { professionalOptions: TeamProfessionalOption[] }>> {
  const idsOf = (it: T) =>
    parseProfessionalOptionIdList((it as { professionalOptionIds?: unknown }).professionalOptionIds);
  const allIds = new Set<string>();
  for (const it of items) {
    for (const id of idsOf(it)) allIds.add(id);
  }
  if (allIds.size === 0) {
    return items.map((it) => ({ ...it, professionalOptions: [] }));
  }
  const rows = await prisma.professionalSpecialtyOption.findMany({
    where: { tenantId, id: { in: Array.from(allIds) } },
    select: { id: true, label: true, emoji: true, color: true },
  });
  const byId = new Map(rows.map((r) => [r.id, r]));
  return items.map((it) => ({
    ...it,
    professionalOptions: idsOf(it)
      .map((id): TeamProfessionalOption | null => {
        const o = byId.get(id);
        return o ? { id: o.id, label: o.label, emoji: o.emoji ?? null, color: o.color ?? null } : null;
      })
      .filter((x): x is TeamProfessionalOption => x != null),
  }));
}

/** 팀장 GNB: 미읽 메시지 + 담당 미처리(접수) C/S + 미확인 배정(상세 미조회) — 한 요청으로 병렬 COUNT */
router.get('/nav-badges', async (req, res) => {
  const auth = (req as unknown as { user: AuthPayload }).user;
  const { userId, role } = auth;
  const tenantId = getTenantIdFromAuth(auth) ?? null;

  let marketplacePendingCount = 0;
  if (role === UserRole.EXTERNAL_PARTNER && tenantId) {
    const [features, me] = await Promise.all([
      getEffectiveEnabledModules(tenantId),
      prisma.user.findFirst({
        where: { id: userId, tenantId },
        select: { externalCompanyId: true },
      }),
    ]);
    if (features.includes('mod_db_marketplace') && me?.externalCompanyId) {
      marketplacePendingCount = await countDbListingPendingForExternalBuyer(
        tenantId,
        me.externalCompanyId,
      );
    }
  }

  const [unreadCount, csPendingCount, newAssignmentCount, eContractPendingCount] = await Promise.all([
    prisma.message.count({
      where: { receiverId: userId, readAt: null },
    }),
    prisma.csReport.count({
      where: {
        status: 'RECEIVED',
        ...teamCsAccessWhere(userId),
      },
    }),
    prisma.assignment.count({
      where: {
        teamLeaderId: userId,
        detailViewedAt: null,
        inquiry: {
          status: { notIn: ['CANCELLED', 'COMPLETED', 'ON_HOLD'] },
        },
      },
    }),
    role === UserRole.TEAM_LEADER ? countPendingIssuancesForTeamLeader(userId) : Promise.resolve(0),
  ]);
  res.json({ unreadCount, csPendingCount, newAssignmentCount, eContractPendingCount, marketplacePendingCount });
});

router.get('/e-contracts/issuances', async (req, res) => {
  const auth = (req as unknown as { user: AuthPayload }).user;
  if (auth.role !== UserRole.TEAM_LEADER) {
    res.status(403).json({ error: '팀장 전용 기능입니다.' });
    return;
  }
  try {
    const query = parseEContractListQuery(req.query as Record<string, unknown>);
    const result = await listIssuancesByTeamLeader(auth.userId, query);
    res.json({ items: result.items, total: result.total });
  } catch (e: unknown) {
    const code = (e as { code?: string })?.code;
    if (code === 'bad_request') {
      res.status(400).json({ error: '계정을 확인할 수 없습니다.' });
      return;
    }
    console.error('[team] e-contracts/issuances', e);
    res.status(500).json({ error: '목록을 불러오지 못했습니다.' });
  }
});

router.use('/inquiries/:inquiryId/cleaning-photos', inquiryCleaningPhotosTeamRoutes);
router.use('/inquiries/:inquiryId/inspection', inquiryInspectionTeamRoutes);
router.use('/inquiries/:inquiryId/consultation-photos', inquiryConsultationPhotosTeamRoutes);
router.use('/inquiries/:inquiryId/extra-charges', inquiryExtraChargesTeamRoutes);
router.use('/inquiries/:inquiryId/additional-receipts', inquiryAdditionalReceiptsTeamRoutes);
router.use('/db-marketplace', dbMarketplaceTeamRoutes);

/** 팀장: 접수 상세를 열어 확인한 것으로 표시 — 메뉴 미확인 배정 수 감소 */
router.post('/inquiries/:id/detail-viewed', async (req, res) => {
  const { userId } = (req as unknown as { user: AuthPayload }).user;
  const { id: inquiryId } = req.params;
  const row = await prisma.assignment.findFirst({
    where: { inquiryId, teamLeaderId: userId },
  });
  if (!row) {
    res.status(404).json({ error: '담당 접수를 찾을 수 없습니다.' });
    return;
  }
  await prisma.assignment.updateMany({
    where: { inquiryId, teamLeaderId: userId, detailViewedAt: null },
    data: { detailViewedAt: new Date() },
  });
  notifyInboxRefresh([userId]);
  res.json({ ok: true });
});

/** 담당 미처리(접수) C/S 건수 — 상단 메뉴 배지용 */
router.get('/cs/pending-count', async (req, res) => {
  const { userId } = (req as unknown as { user: AuthPayload }).user;
  const count = await prisma.csReport.count({
    where: {
      status: 'RECEIVED',
      ...teamCsAccessWhere(userId),
    },
  });
  res.json({ count });
});

/** 담당 접수와 연결된 C/S만 (배정 팀장 본인) */
router.get('/cs', async (req, res) => {
  const { userId } = (req as unknown as { user: AuthPayload }).user;
  const items = await prisma.csReport.findMany({
    where: teamCsAccessWhere(userId),
    orderBy: { createdAt: 'desc' },
    include: csReportFullInclude,
  });
  res.json({ items: serializeCsReportRows(items) });
});

/** 팀장/타업체: C/S 상세 열람 — 접수(RECEIVED)면 처리중(PROCESSING)으로 자동 전환(미확인 배지 해제) */
router.post('/cs/:id/acknowledge', async (req, res) => {
  const { userId } = (req as unknown as { user: AuthPayload }).user;
  const { id } = req.params;
  const report = await prisma.csReport.findFirst({
    where: { id, ...teamCsAccessWhere(userId) },
    include: csReportFullInclude,
  });
  if (!report) {
    res.status(404).json({ error: '담당 C/S를 찾을 수 없습니다.' });
    return;
  }
  if (report.status !== 'RECEIVED') {
    res.json(serializeCsReportRow(report));
    return;
  }
  const updated = await prisma.csReport.update({
    where: { id },
    data: { status: 'PROCESSING' },
    include: csReportFullInclude,
  });
  res.json(serializeCsReportRow(updated));
  void notifyCsReportNavBadges(updated.inquiryId, updated.forwardedToUserId ? [updated.forwardedToUserId] : [], report.tenantId);
});

/** 담당 C/S 수정 — 접수·처리중·완료만 (RECEIVED로는 변경 불가) */
router.patch('/cs/:id', async (req, res) => {
  const { userId } = (req as unknown as { user: AuthPayload }).user;
  const user = (req as unknown as { user: AuthPayload }).user;
  const { id } = req.params;
  const body = req.body as {
    status?: string;
    memo?: string | null;
    completionMethod?: string | null;
    asServiceDate?: string | null;
  };

  const report = await prisma.csReport.findFirst({
    where: {
      id,
      ...teamCsAccessWhere(userId),
    },
  });
  if (!report) {
    res.status(404).json({ error: '담당 C/S를 찾을 수 없습니다.' });
    return;
  }

  if (
    body.status != null &&
    body.status !== 'PROCESSING' &&
    body.status !== 'DONE' &&
    body.status !== report.status
  ) {
    res.status(400).json({ error: '팀장은 상태를 처리중·완료로만 바꿀 수 있습니다.' });
    return;
  }

  const built = buildCsReportUpdateData({ status: report.status }, body, user);
  if (!built.ok) {
    res.status(400).json({ error: built.error });
    return;
  }
  const updated = await prisma.csReport.update({
    where: { id },
    data: built.data,
    include: csReportFullInclude,
  });
  res.json(serializeCsReportRow(updated));
  void notifyCsReportNavBadges(updated.inquiryId, updated.forwardedToUserId ? [updated.forwardedToUserId] : [], updated.tenantId);
  if (Object.prototype.hasOwnProperty.call(built.data, 'asServiceDate')) {
    void getEmployedStaffUserIds(updated.tenantId).then((ids) => notifyInboxRefresh(ids));
  }
});

/** 해피콜 미완 건수 (마감 전 / 마감 후) — 팀장 본인 배정만 */
router.get('/happy-call-stats', async (req, res) => {
  const { userId } = (req as unknown as { user: AuthPayload }).user;
  const rows = await prisma.inquiry.findMany({
    where: {
      preferredDate: { not: null },
      happyCallCompletedAt: null,
      status: {
        notIn: ['CANCELLED', 'ON_HOLD', 'PENDING', 'DEPOSIT_PENDING', 'DEPOSIT_COMPLETED', 'ORDER_FORM_PENDING'],
      },
      assignments: { some: { teamLeaderId: userId } },
    },
    select: { preferredDate: true },
  });
  const now = new Date();
  let overdueCount = 0;
  let pendingBeforeDeadlineCount = 0;
  for (const r of rows) {
    if (!r.preferredDate) continue;
    if (now > happyCallDeadlineEnd(r.preferredDate)) overdueCount++;
    else pendingBeforeDeadlineCount++;
  }
  res.json({ overdueCount, pendingBeforeDeadlineCount });
});

/** 팀장만 — 담당 접수에 대해 해피콜 완료 처리 */
router.post('/inquiries/:id/happy-call-complete', async (req, res) => {
  const { userId } = (req as unknown as { user: AuthPayload }).user;
  const { id } = req.params;
  const inquiry = await prisma.inquiry.findFirst({
    where: {
      id,
      assignments: { some: { teamLeaderId: userId } },
    },
  });
  if (!inquiry) {
    res.status(404).json({ error: '담당 접수를 찾을 수 없습니다.' });
    return;
  }
  if (!isHappyCallEligible(inquiry.status, inquiry.preferredDate)) {
    res.status(400).json({ error: '해피콜을 등록할 수 없는 접수입니다.' });
    return;
  }
  if (inquiry.happyCallCompletedAt) {
    res.json({ ok: true, alreadyCompleted: true });
    return;
  }
  await prisma.inquiry.update({
    where: { id },
    data: { happyCallCompletedAt: new Date() },
  });
  res.json({ ok: true });
});

/** 팀장: 본인 배정 건 예약일 변경 */
router.patch('/inquiries/:id/preferred-date', async (req, res) => {
  const { userId } = (req as unknown as { user: AuthPayload }).user;
  const { id } = req.params;
  const body = req.body as { preferredDate?: string };
  const ymd = typeof body.preferredDate === 'string' ? body.preferredDate.trim() : '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
    res.status(400).json({ error: '예약일은 YYYY-MM-DD 형식이어야 합니다.' });
    return;
  }
  const preferredDate = new Date(`${ymd}T12:00:00+09:00`);
  if (Number.isNaN(preferredDate.getTime())) {
    res.status(400).json({ error: '유효한 예약일이 아닙니다.' });
    return;
  }
  const inquiry = await prisma.inquiry.findFirst({
    where: {
      id,
      assignments: { some: { teamLeaderId: userId } },
    },
    include: teamInquiryInclude,
  });
  if (!inquiry) {
    res.status(404).json({ error: '담당 접수를 찾을 수 없습니다.' });
    return;
  }
  if (inquiry.status === 'CANCELLED') {
    res.status(400).json({ error: '취소된 접수는 예약일을 변경할 수 없습니다.' });
    return;
  }
  const beforeYmd = inquiry.preferredDate ? inquiry.preferredDate.toISOString().slice(0, 10) : null;
  if (beforeYmd === ymd) {
    const unchanged = await prisma.inquiry.findUnique({
      where: { id },
      include: teamInquiryInclude,
    });
    res.json(await attachCrewMembersOne(unchanged, inquiry.tenantId));
    return;
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.inquiry.update({
      where: { id },
      data: { preferredDate },
    });
    await tx.inquiryChangeLog.create({
      data: {
        inquiryId: id,
        customerName: inquiry.customerName,
        actorId: userId,
        lines: [`청소 희망일: ${beforeYmd ?? '(없음)'} → ${ymd}`],
      },
    });
    return tx.inquiry.findUnique({
      where: { id },
      include: teamInquiryInclude,
    });
  });
  notifyChangeLogToStaff({
    tenantId: inquiry.tenantId,
    customerName: inquiry.customerName,
    inquiryId: id,
    lines: [`청소 희망일: ${beforeYmd ?? '(없음)'} → ${ymd}`],
  });
  res.json(await attachCrewMembersOne(updated, inquiry.tenantId));
});

/** 팀장: 오전 희망 접수일 때만 크루 현장 일정에 노출할 미팅 시각(KST, HH:mm) — 공용 또는 팀원별 */
router.patch('/inquiries/:id/crew-meeting-time', async (req, res) => {
  try {
    const { userId } = (req as unknown as { user: AuthPayload }).user;
    const { id } = req.params;
    const parsed = parseCrewMeetingPatchBody(req.body);
    if (!parsed.ok) {
      res.status(400).json({ error: parsed.error });
      return;
    }
    const patch = parsed.value;
    const inquiry = await prisma.inquiry.findFirst({
      where: {
        id,
        assignments: { some: { teamLeaderId: userId } },
      },
      select: {
        id: true,
        tenantId: true,
        customerName: true,
        status: true,
        preferredTime: true,
        betweenScheduleSlot: true,
        crewMemberNote: true,
        crewMeetingTime: true,
        crewMeetingTimeShared: true,
        crewMemberMeetingTimes: { select: { teamMemberId: true, meetingTime: true, teamMember: { select: { name: true } } } },
      },
    });
    if (!inquiry) {
      res.status(404).json({ error: '담당 접수를 찾을 수 없습니다.' });
      return;
    }
    if (inquiry.status === 'CANCELLED') {
      res.status(400).json({ error: '취소된 접수입니다.' });
      return;
    }

    const fmt = (v: string | null) => v ?? '(미지정)';
    const logLines: string[] = [];

    if (patch.mode === 'shared') {
      const chk = validateCrewMeetingTimeForInquiry(
        inquiry.preferredTime,
        inquiry.betweenScheduleSlot,
        patch.crewMeetingTime,
      );
      if (!chk.ok) {
        res.status(400).json({ error: chk.error });
        return;
      }
      const next = patch.crewMeetingTime;
      const modeChanged = inquiry.crewMeetingTimeShared === false;
      if (!modeChanged && inquiry.crewMeetingTime === next && inquiry.crewMemberMeetingTimes.length === 0) {
        const unchanged = await prisma.inquiry.findUnique({
          where: { id },
          include: teamInquiryInclude,
        });
        res.json(await attachCrewMembersOne(unchanged, inquiry.tenantId));
        return;
      }
      if (modeChanged) {
        logLines.push('현장 미팅(크루): 개별 → 공용');
      }
      logLines.push(`현장 미팅(크루·공용): ${fmt(inquiry.crewMeetingTime)} → ${fmt(next)}`);

      const updated = await prisma.$transaction(async (tx) => {
        await clearInquiryCrewMemberMeetingTimes(tx, id);
        await tx.inquiry.update({
          where: { id },
          data: {
            crewMeetingTimeShared: true,
            crewMeetingTime: next,
            crewMeetingTimeUpdatedAt: new Date(),
          },
        });
        await tx.inquiryChangeLog.create({
          data: {
            inquiryId: id,
            customerName: inquiry.customerName,
            actorId: userId,
            lines: logLines,
          },
        });
        return tx.inquiry.findUnique({
          where: { id },
          include: teamInquiryInclude,
        });
      });
      void notifyAllActiveCrewGroupsRefresh(inquiry.tenantId).catch((e) =>
        console.error('[crew-meeting-time] crew refresh', e),
      );
      void notifyCsReportNavBadges(id, undefined, inquiry.tenantId).catch((e) =>
        console.error('[crew-meeting-time] staff/leaders nav refresh', e),
      );
      notifyChangeLogToStaff({
        tenantId: inquiry.tenantId,
        customerName: inquiry.customerName,
        inquiryId: id,
        lines: logLines,
      });
      res.json(await attachCrewMembersOne(updated, inquiry.tenantId));
      return;
    }

    // individual mode
    const allowed = await resolveCrewTeamMemberIdsFromNote(
      prisma,
      inquiry.tenantId,
      inquiry.crewMemberNote,
    );
    if (allowed.length === 0) {
      res.status(400).json({ error: '투입 팀원이 없습니다. 접수에 팀원을 먼저 지정해 주세요.' });
      return;
    }
    const allowedSet = new Set(allowed.map((x) => x.teamMemberId));
    for (const row of patch.memberTimes) {
      if (!allowedSet.has(row.teamMemberId)) {
        res.status(400).json({ error: '투입되지 않은 팀원에게는 미팅 시각을 지정할 수 없습니다.' });
        return;
      }
      const chk = validateCrewMeetingTimeForInquiry(
        inquiry.preferredTime,
        inquiry.betweenScheduleSlot,
        row.meetingTime,
      );
      if (!chk.ok) {
        res.status(400).json({ error: chk.error });
        return;
      }
    }
    if (patch.memberTimes.length !== allowed.length) {
      res.status(400).json({ error: '투입 팀원 전원의 미팅 시각을 입력해 주세요.' });
      return;
    }
    const nameById = new Map(allowed.map((x) => [x.teamMemberId, x.name] as const));
    const beforeById = new Map(
      inquiry.crewMemberMeetingTimes.map((r) => [r.teamMemberId, r.meetingTime] as const),
    );
    const modeChanged = inquiry.crewMeetingTimeShared !== false;
    if (modeChanged) {
      logLines.push('현장 미팅(크루): 공용 → 개별');
      if ((inquiry.crewMeetingTime ?? '').trim()) {
        logLines.push(`현장 미팅(크루·공용 해제): ${fmt(inquiry.crewMeetingTime)}`);
      }
    }
    for (const row of patch.memberTimes) {
      const name = nameById.get(row.teamMemberId) ?? row.teamMemberId;
      const before = beforeById.get(row.teamMemberId) ?? null;
      if (before !== row.meetingTime) {
        logLines.push(`현장 미팅(크루·${name}): ${fmt(before)} → ${fmt(row.meetingTime)}`);
      }
    }
    if (logLines.length === 0) {
      const unchanged = await prisma.inquiry.findUnique({
        where: { id },
        include: teamInquiryInclude,
      });
      res.json(await attachCrewMembersOne(unchanged, inquiry.tenantId));
      return;
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.inquiry.update({
        where: { id },
        data: {
          crewMeetingTimeShared: false,
          crewMeetingTime: null,
          crewMeetingTimeUpdatedAt: new Date(),
        },
      });
      await upsertInquiryMemberMeetingTimes(tx, inquiry.tenantId, id, patch.memberTimes);
      await tx.inquiryChangeLog.create({
        data: {
          inquiryId: id,
          customerName: inquiry.customerName,
          actorId: userId,
          lines: logLines,
        },
      });
      return tx.inquiry.findUnique({
        where: { id },
        include: teamInquiryInclude,
      });
    });
    void notifyAllActiveCrewGroupsRefresh(inquiry.tenantId).catch((e) =>
      console.error('[crew-meeting-time] crew refresh', e),
    );
    void notifyCsReportNavBadges(id, undefined, inquiry.tenantId).catch((e) =>
      console.error('[crew-meeting-time] staff/leaders nav refresh', e),
    );
    notifyChangeLogToStaff({
      tenantId: inquiry.tenantId,
      customerName: inquiry.customerName,
      inquiryId: id,
      lines: logLines,
    });
    res.json(await attachCrewMembersOne(updated, inquiry.tenantId));
  } catch (e: unknown) {
    console.error('[PATCH /team/inquiries/:id/crew-meeting-time]', e);
    const msg = e instanceof Error ? e.message : String(e);
    const prismaSchemaHint =
      e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2022'
        ? true
        : e instanceof Prisma.PrismaClientValidationError
          ? true
          : /crew_meeting|crewMeetingTime|Unknown field|Unknown arg/i.test(msg);
    if (prismaSchemaHint) {
      res.status(500).json({
        error:
          'DB에 미팅 시각 컬럼(crew_meeting_time)이 없거나 Prisma 스키마가 맞지 않습니다. 운영 DB에 마이그레이션을 적용하고(npx prisma migrate deploy) 서버를 재시작한 뒤 다시 시도해 주세요.',
      });
      return;
    }
    res.status(500).json({ error: '미팅 시각 저장 중 서버 오류가 발생했습니다.' });
  }
});

/** 접수 취소(관리자/마케터만, 비밀번호 확인 필수) */
router.post('/inquiries/:id/cancel', async (req, res) => {
  const viewer = (req as unknown as {
    teamViewer?: { userId: string; role: string };
    user: AuthPayload;
  }).teamViewer;
  const actorId = viewer?.userId ?? (req as unknown as { user: AuthPayload }).user.userId;
  const actorRole = viewer?.role ?? (req as unknown as { user: AuthPayload }).user.role;
  if (actorRole !== 'ADMIN' && actorRole !== 'MARKETER') {
    res.status(403).json({ error: '취소는 관리자/마케터만 처리할 수 있습니다.' });
    return;
  }
  const authUser = (req as unknown as { user: AuthPayload }).user;
  const tenantId = await resolveTeamContextTenantId(authUser);
  if (!tenantId) {
    res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
    return;
  }
  const { id } = req.params;
  const body = req.body as { password?: string };
  const password = typeof body.password === 'string' ? body.password : '';
  if (!password.trim()) {
    res.status(400).json({ error: '비밀번호를 입력해 주세요.' });
    return;
  }
  const me = await prisma.user.findUnique({
    where: { id: actorId },
    select: { passwordHash: true },
  });
  if (!me || !(await bcrypt.compare(password, me.passwordHash))) {
    res.status(403).json({ error: '비밀번호가 올바르지 않습니다.' });
    return;
  }
  const inquiry = await prisma.inquiry.findFirst({
    where: { id, tenantId },
    include: {
      assignments: {
        include: { teamLeader: { select: assignmentTeamLeaderSelect } },
      },
    },
  });
  if (!inquiry) {
    res.status(404).json({ error: '담당 접수를 찾을 수 없습니다.' });
    return;
  }
  if (inquiry.status === 'CANCELLED') {
    res.json({ ok: true, alreadyCancelled: true });
    return;
  }
  const ext = inquiry.assignments.find((a) => a.teamLeader.role === 'EXTERNAL_PARTNER');
  const snapCid = ext?.teamLeader.externalCompanyId;
  await prisma.inquiry.update({
    where: { id },
    data: {
      status: 'CANCELLED',
      happyCallCompletedAt: null,
      ...(snapCid ? { cancelFeeExternalCompany: { connect: { id: snapCid } } } : {}),
    },
  });
  await prisma.inquiryChangeLog.create({
    data: {
      inquiryId: inquiry.id,
      customerName: inquiry.customerName,
      actorId,
      lines: ['관리자/마케터 취소 처리'],
    },
  });
  notifyChangeLogToStaff({
    tenantId,
    customerName: inquiry.customerName,
    inquiryId: inquiry.id,
    lines: ['관리자/마케터 취소 처리'],
  });
  const staff = await prisma.user.findMany({
    where: { tenantId, isActive: true, role: { in: ['ADMIN', 'MARKETER'] } },
    select: { id: true },
  });
  const assignees = inquiry.assignments.map((a) => a.teamLeaderId);
  notifyInboxRefresh([...new Set([...staff.map((s) => s.id), ...assignees])]);
  res.json({ ok: true });
});

/** 팀장 본인 담당 접수의 변경 이력 — 미확인 수(종 아이콘 배지) */
router.get('/inquiry-change-logs/unseen-count', async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user;
  const { userId } = user;
  const tenantId = await resolveTeamContextTenantId(user);
  if (!tenantId) {
    res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
    return;
  }
  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { changeLogSeenAt: true },
  });
  const seenAt = dbUser?.changeLogSeenAt ?? null;
  const baseWhere: Prisma.InquiryChangeLogWhereInput = {
    inquiry: { tenantId, assignments: { some: { teamLeaderId: userId } } },
  };
  const [count, latest] = await Promise.all([
    prisma.inquiryChangeLog.count({
      where: { AND: [baseWhere, seenAt ? { createdAt: { gt: seenAt } } : {}] },
    }),
    prisma.inquiryChangeLog.findFirst({
      where: baseWhere,
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    }),
  ]);
  res.json({
    count,
    seenAt: seenAt ? seenAt.toISOString() : null,
    latestAt: latest?.createdAt ? latest.createdAt.toISOString() : null,
  });
});

/** 팀장: 변경 이력 확인(읽음) 처리 */
router.post('/inquiry-change-logs/mark-seen', async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user;
  const tenantId = await resolveTeamContextTenantId(user);
  if (!tenantId) {
    res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
    return;
  }
  const now = new Date();
  await prisma.user.update({ where: { id: user.userId }, data: { changeLogSeenAt: now } });
  res.json({ ok: true, seenAt: now.toISOString() });
});

/** 팀장: 본인 담당 접수 변경 이력 목록(페이지) */
router.get('/inquiry-change-logs', async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user;
  const { userId } = user;
  const tenantId = await resolveTeamContextTenantId(user);
  if (!tenantId) {
    res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
    return;
  }
  const take = Math.min(500, Math.max(1, parseInt(String(req.query.limit ?? '50'), 10) || 50));
  const skip = Math.max(0, parseInt(String(req.query.offset ?? '0'), 10) || 0);
  const where: Prisma.InquiryChangeLogWhereInput = {
    inquiry: { tenantId, assignments: { some: { teamLeaderId: userId } } },
  };
  const [rows, total] = await Promise.all([
    prisma.inquiryChangeLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take,
      skip,
      include: {
        inquiry: { select: { customerName: true } },
        actor: { select: { name: true } },
      },
    }),
    prisma.inquiryChangeLog.count({ where }),
  ]);
  const items = rows.map((r) => toChangeHistoryItemDto(r, r.actor?.name ?? null));
  res.json({ items, total });
});

/** 팀장: 본인 담당 단일 접수 상세 (변경 이력 종 → 접수 이동용 딥링크) */
router.get('/inquiries/:id', async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user;
  const { userId } = user;
  const { id } = req.params;
  const tenantId = await resolveTeamContextTenantId(user);
  if (!tenantId) {
    res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
    return;
  }
  const row = await prisma.inquiry.findFirst({
    where: { id, tenantId, assignments: { some: { teamLeaderId: userId } } },
    include: teamInquiryInclude,
  });
  if (!row) {
    res.status(404).json({ error: '담당 접수를 찾을 수 없습니다.' });
    return;
  }
  const [item] = await attachProfessionalOptions(await attachCrewMembers([row], tenantId), tenantId);
  res.json(attachInspectionSummaryToInquiry(item));
});

router.get('/inquiries', async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user;
  const { userId } = user;
  const tenantId = await resolveTeamContextTenantId(user);
  if (!tenantId) {
    res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
    return;
  }
  const brandScope = await buildTeamLeaderInquiryBrandFilter(prisma, tenantId, userId);
  const hasPaging = typeof req.query.limit === 'string';
  if (!hasPaging) {
    const rows = await prisma.inquiry.findMany({
      where: mergeInquiryWhere(
        {
          tenantId,
          assignments: {
            some: { teamLeaderId: userId },
          },
        },
        brandScope,
      ),
      orderBy: { preferredDate: 'asc' },
      include: teamInquiryInclude,
    });
    const items = await attachProfessionalOptions(await attachCrewMembers(rows, tenantId), tenantId);
    res.json({
      items: attachInspectionSummaries(
        items as Array<Parameters<typeof attachInspectionSummaries>[0][number]>,
      ),
    });
    return;
  }
  try {
    const parsed = parseTeamAssignmentListQuery(req.query as Record<string, unknown>);
    const { items, total } = await listTeamAssignmentsPaginated(
      prisma,
      userId,
      parsed,
      {
        teamInquiryInclude,
        attachCrewMembers: async (rows) =>
          attachProfessionalOptions(await attachCrewMembers(rows, tenantId), tenantId),
      },
      brandScope ? { AND: [{ tenantId }, brandScope] } : { tenantId },
    );
    res.json({
      items: attachInspectionSummaries(
        items as Array<Parameters<typeof attachInspectionSummaries>[0][number]>,
      ),
      total,
    });
  } catch (e) {
    console.error('[GET /team/inquiries]', e);
    res.status(500).json({ error: '배정 목록을 불러오지 못했습니다.' });
  }
});

router.get('/schedule', async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user;
  const { userId } = user;
  const tenantId = await resolveTeamContextTenantId(user);
  if (!tenantId) {
    res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
    return;
  }
  const { start, end } = req.query as { start?: string; end?: string };
  const now = new Date();
  let startDate: Date;
  let endDate: Date;
  if (
    typeof start === 'string' &&
    SCHEDULE_QUERY_YMD.test(start) &&
    typeof end === 'string' &&
    SCHEDULE_QUERY_YMD.test(end)
  ) {
    startDate = new Date(`${start}T00:00:00+09:00`);
    endDate = new Date(`${end}T23:59:59.999+09:00`);
  } else {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  }

  const brandScope = await buildTeamLeaderInquiryBrandFilter(prisma, tenantId, userId);
  const rows = await prisma.inquiry.findMany({
    where: mergeInquiryWhere(
      {
        tenantId,
        preferredDate: { gte: startDate, lte: endDate },
        status: { notIn: ['CANCELLED', 'ON_HOLD'] },
        assignments: {
          some: { teamLeaderId: userId },
        },
      },
      brandScope,
    ),
    orderBy: [{ preferredDate: 'asc' }, { preferredTime: 'asc' }],
    include: teamInquiryInclude,
  });
  const items = await attachProfessionalOptions(await attachCrewMembers(rows, tenantId), tenantId);
  res.json({
    items: attachInspectionSummaries(
      items as Array<Parameters<typeof attachInspectionSummaries>[0][number]>,
    ),
  });
});

/**
 * 타업체(EXTERNAL_PARTNER) 본인 정산 조회
 * - 월별 합계(예약일 기준)
 * - 건수(정상/취소)
 * - 접수 상세 목록(수수료 포함, 취소는 음수 반영)
 */
router.get('/external-settlement', async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user;
  const previewStaff = user.role === 'ADMIN' || user.role === 'MARKETER';
  if (user.role !== 'EXTERNAL_PARTNER' && !previewStaff) {
    res.status(403).json({ error: '타업체 계정(또는 개발자 프리뷰)만 접근할 수 있습니다.' });
    return;
  }
  const routeTenantId = previewStaff
    ? getTenantIdFromAuth(user) ?? (await resolveTeamContextTenantId(user))
    : await resolveTeamContextTenantId(user);
  if (!routeTenantId) {
    res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
    return;
  }
  const queryCompanyId = typeof req.query.externalCompanyId === 'string'
    ? req.query.externalCompanyId.trim()
    : '';
  const queryCompanyName = typeof req.query.externalCompanyName === 'string'
    ? req.query.externalCompanyName.trim()
    : '';
  let companyId: string | null = null;
  let companyName: string | null = null;
  if (user.role === 'EXTERNAL_PARTNER') {
    const me = await prisma.user.findUnique({
      where: { id: user.userId },
      select: {
        externalCompanyId: true,
        externalCompany: { select: { id: true, name: true } },
      },
    });
    companyId = me?.externalCompanyId ?? null;
    companyName = me?.externalCompany?.name ?? null;
  } else if (previewStaff) {
    let company = queryCompanyId
      ? await prisma.externalCompany.findFirst({
          where: { id: queryCompanyId, isActive: true, tenantId: routeTenantId },
          select: { id: true, name: true },
        })
      : null;
    if (!company && queryCompanyName) {
      company = await prisma.externalCompany.findFirst({
        where: { isActive: true, name: queryCompanyName, tenantId: routeTenantId },
        select: { id: true, name: true },
      });
    }
    if (!company && !queryCompanyName) {
      company = await prisma.externalCompany.findFirst({
        where: { isActive: true, name: '클린느', tenantId: routeTenantId },
        select: { id: true, name: true },
      });
    }
    if (!company) {
      company = await prisma.externalCompany.findFirst({
        where: { isActive: true, tenantId: routeTenantId },
        orderBy: { name: 'asc' },
        select: { id: true, name: true },
      });
    }
    companyId = company?.id ?? null;
    companyName = company?.name ?? null;
  }
  if (!companyId) {
    res.status(400).json({ error: '타업체 정보가 연결되지 않은 계정입니다.' });
    return;
  }

  const q = req.query as Record<string, unknown>;
  const { from, to, loYmd, hiYmd } = settlementPreferredRangeFromQuery({
    datePreset: typeof q.datePreset === 'string' ? q.datePreset : undefined,
    month: typeof q.month === 'string' ? q.month : undefined,
    day: typeof q.day === 'string' ? q.day : undefined,
    from: typeof q.from === 'string' ? q.from : undefined,
    to: typeof q.to === 'string' ? q.to : undefined,
  });
  const { itemsLimit, itemsOffset, payLimit, payOffset } = parseSettlementListPaging(q);
  const searchRaw = typeof q.search === 'string' ? q.search.trim() : '';

  const { activeRows, cancelledRows } = await fetchExternalSettlementInquiriesForCompanyPeriod({
    tenantId: routeTenantId,
    externalCompanyId: companyId,
    from,
    to,
    includeAssignmentLabels: true,
  });

  type Item = {
    inquiryId: string;
    inquiryNumber: string | null;
    customerName: string;
    address: string;
    addressDetail: string | null;
    preferredDate: string | null;
    status: string;
    isCancelled: boolean;
    feeAmount: number;
    signedFeeAmount: number;
    assignedExternalLabel: string | null;
  };

  const items: Item[] = [];
  let inquiryCount = 0;
  let cancelledInquiryCount = 0;
  let totalFee = 0;
  let periodPositiveFee = 0;
  let periodNegativeFee = 0;

  for (const row of activeRows) {
    const fee = row.externalTransferFee ?? 0;
    const ext = row.assignments.find(
      (a) => a.teamLeader.role === 'EXTERNAL_PARTNER' && a.teamLeader.externalCompanyId === companyId
    );
    items.push({
      inquiryId: row.id,
      inquiryNumber: row.inquiryNumber ?? null,
      customerName: row.customerName,
      address: row.address,
      addressDetail: row.addressDetail ?? null,
      preferredDate: row.preferredDate ? row.preferredDate.toISOString() : null,
      status: row.status,
      isCancelled: false,
      feeAmount: fee,
      signedFeeAmount: fee,
      assignedExternalLabel: ext?.teamLeader.externalCompany?.name ?? ext?.teamLeader.name ?? null,
    });
    inquiryCount += 1;
    totalFee += fee;
    periodPositiveFee += fee;
  }

  for (const row of cancelledRows) {
    const fee = row.externalTransferFee ?? 0;
    const sign = -1;
    const ext = row.assignments.find(
      (a) => a.teamLeader.role === 'EXTERNAL_PARTNER' && a.teamLeader.externalCompanyId === companyId
    );
    items.push({
      inquiryId: row.id,
      inquiryNumber: row.inquiryNumber ?? null,
      customerName: row.customerName,
      address: row.address,
      addressDetail: row.addressDetail ?? null,
      preferredDate: row.preferredDate ? row.preferredDate.toISOString() : null,
      status: row.status,
      isCancelled: true,
      feeAmount: fee,
      signedFeeAmount: sign * fee,
      assignedExternalLabel: ext?.teamLeader.externalCompany?.name ?? ext?.teamLeader.name ?? null,
    });
    cancelledInquiryCount += 1;
    totalFee += sign * fee;
    periodNegativeFee += fee;
  }

  items.sort((a, b) => {
    const da = a.preferredDate ?? '';
    const db = b.preferredDate ?? '';
    return db.localeCompare(da);
  });

  const filteredItems = filterExternalSettlementItemsBySearch(items, searchRaw);

  const signedBeforeRange = await computeSignedExternalFeeBeforeDate({
    tenantId: routeTenantId,
    externalCompanyId: companyId,
    before: from,
  });

  const paidBeforeAgg = await prisma.externalCompanySettlementPayment.aggregate({
    where: { externalCompanyId: companyId, paidAt: { lt: from } },
    _sum: { amount: true },
  });
  const paidBeforeRange = paidBeforeAgg._sum.amount ?? 0;

  const paymentRows = await prisma.externalCompanySettlementPayment.findMany({
    where: { externalCompanyId: companyId, paidAt: { gte: from, lte: to } },
    orderBy: [{ paidAt: 'desc' }],
    select: {
      id: true,
      amount: true,
      paidAt: true,
      memo: true,
      actor: { select: { id: true, name: true, role: true } },
    },
  });
  const periodPaidAgg = await prisma.externalCompanySettlementPayment.aggregate({
    where: { externalCompanyId: companyId, paidAt: { gte: from, lte: to } },
    _sum: { amount: true },
  });
  const periodPaidAmount = periodPaidAgg._sum.amount ?? 0;
  const carryOverAmount = signedBeforeRange - paidBeforeRange;
  const payableAmount = carryOverAmount + totalFee;
  const remainingAmount = payableAmount - periodPaidAmount;

  /** 이후 UI: 올해(KST) 기준 요약 / 최근 1회 정산 */
  const kstYmd = (d: Date) => d.toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10);
  const summaryYear = kstYmd(new Date()).slice(0, 4);
  const yFromYmd = `${summaryYear}-01-01`;
  const yToYmd = `${summaryYear}-12-31`;
  const yearFromDt = new Date(`${yFromYmd}T00:00:00+09:00`);
  const yearToDt = new Date(`${yToYmd}T23:59:59.999+09:00`);

  const extSomeActive = {
    assignments: {
      some: { teamLeader: { role: 'EXTERNAL_PARTNER' as const, externalCompanyId: companyId } },
    },
  };
  const [
    activeYearAgg,
    cancelledYearAgg,
    activeBeforeYearAgg,
    cancelledBeforeYearAgg,
    paidBeforeYearAgg,
    yearPaidInYearAgg,
    lastPaymentRow,
  ] = await Promise.all([
    prisma.inquiry.aggregate({
      where: {
        externalTransferFee: { not: null },
        preferredDate: { gte: yearFromDt, lte: yearToDt },
        status: { notIn: ['CANCELLED', 'ON_HOLD'] },
        ...extSomeActive,
      },
      _sum: { externalTransferFee: true },
    }),
    prisma.inquiry.aggregate({
      where: {
        status: 'CANCELLED',
        externalTransferFee: { not: null },
        preferredDate: { gte: yearFromDt, lte: yearToDt },
        OR: [
          { cancelFeeExternalCompanyId: companyId },
          {
            assignments: {
              some: {
                teamLeader: { role: 'EXTERNAL_PARTNER' as const, externalCompanyId: companyId },
              },
            },
          },
        ],
      },
      _sum: { externalTransferFee: true },
    }),
    prisma.inquiry.aggregate({
      where: {
        externalTransferFee: { not: null },
        preferredDate: { lt: yearFromDt },
        status: { notIn: ['CANCELLED', 'ON_HOLD'] },
        ...extSomeActive,
      },
      _sum: { externalTransferFee: true },
    }),
    prisma.inquiry.aggregate({
      where: {
        status: 'CANCELLED',
        externalTransferFee: { not: null },
        preferredDate: { lt: yearFromDt },
        OR: [
          { cancelFeeExternalCompanyId: companyId },
          {
            assignments: {
              some: {
                teamLeader: { role: 'EXTERNAL_PARTNER' as const, externalCompanyId: companyId },
              },
            },
          },
        ],
      },
      _sum: { externalTransferFee: true },
    }),
    prisma.externalCompanySettlementPayment.aggregate({
      where: { externalCompanyId: companyId, paidAt: { lt: yearFromDt } },
      _sum: { amount: true },
    }),
    prisma.externalCompanySettlementPayment.aggregate({
      where: { externalCompanyId: companyId, paidAt: { gte: yearFromDt, lte: yearToDt } },
      _sum: { amount: true },
    }),
    prisma.externalCompanySettlementPayment.findFirst({
      where: { externalCompanyId: companyId },
      orderBy: { paidAt: 'desc' },
      select: { amount: true, paidAt: true },
    }),
  ]);

  const yearTotalFee =
    (activeYearAgg._sum.externalTransferFee ?? 0) - (cancelledYearAgg._sum.externalTransferFee ?? 0);
  const signedBeforeYear =
    (activeBeforeYearAgg._sum.externalTransferFee ?? 0) - (cancelledBeforeYearAgg._sum.externalTransferFee ?? 0);
  const paidBeforeYear = paidBeforeYearAgg._sum.amount ?? 0;
  const yearCarryOverAmount = signedBeforeYear - paidBeforeYear;
  const yearPeriodPaidAmount = yearPaidInYearAgg._sum.amount ?? 0;
  const yearPayableAmount = yearCarryOverAmount + yearTotalFee;
  const yearRemainingAmount = yearPayableAmount - yearPeriodPaidAmount;
  const lastSettlementPayment = lastPaymentRow
    ? { amount: lastPaymentRow.amount, paidAt: lastPaymentRow.paidAt.toISOString() }
    : null;

  /** 정산완료내역 "처리 후" — 관리자 집계(첫 외부담당 귀속)와 동일한 누적 인정액을 기준으로, 전체 정산을 시점순 누적 */
  const [activeRowsCumulative, cancelledRowsCumulative, allPaymentsChrono] = await Promise.all([
    prisma.inquiry.findMany({
      where: {
        externalTransferFee: { not: null },
        status: { notIn: ['CANCELLED', 'ON_HOLD'] },
        assignments: {
          some: { teamLeader: { role: 'EXTERNAL_PARTNER', externalCompanyId: { not: null } } },
        },
      },
      select: {
        externalTransferFee: true,
        assignments: {
          orderBy: { sortOrder: 'asc' as const },
          select: { teamLeader: { select: { role: true, externalCompanyId: true } } },
        },
      },
    }),
    prisma.inquiry.findMany({
      where: {
        status: 'CANCELLED',
        externalTransferFee: { not: null },
        OR: [
          { cancelFeeExternalCompanyId: { not: null } },
          {
            assignments: {
              some: { teamLeader: { role: 'EXTERNAL_PARTNER', externalCompanyId: { not: null } } },
            },
          },
        ],
      },
      select: {
        externalTransferFee: true,
        cancelFeeExternalCompanyId: true,
        assignments: {
          orderBy: { sortOrder: 'asc' as const },
          select: { teamLeader: { select: { role: true, externalCompanyId: true } } },
        },
      },
    }),
    prisma.externalCompanySettlementPayment.findMany({
      where: { externalCompanyId: companyId },
      orderBy: [{ paidAt: 'asc' as const }, { id: 'asc' as const }],
      select: { id: true, amount: true },
    }),
  ]);

  let cumulativeNetSigned = 0;
  for (const r of activeRowsCumulative) {
    const ext = r.assignments.find(
      (a) => a.teamLeader.role === 'EXTERNAL_PARTNER' && a.teamLeader.externalCompanyId
    );
    const cid = ext?.teamLeader.externalCompanyId ?? null;
    if (cid === companyId) cumulativeNetSigned += r.externalTransferFee ?? 0;
  }
  for (const r of cancelledRowsCumulative) {
    const ext = r.assignments.find(
      (a) => a.teamLeader.role === 'EXTERNAL_PARTNER' && a.teamLeader.externalCompanyId
    );
    const cid = r.cancelFeeExternalCompanyId ?? ext?.teamLeader.externalCompanyId ?? null;
    if (cid === companyId) cumulativeNetSigned -= r.externalTransferFee ?? 0;
  }

  const outstandingAfterByPaymentId = new Map<string, number>();
  let paidRunning = 0;
  for (const p of allPaymentsChrono) {
    paidRunning += p.amount;
    outstandingAfterByPaymentId.set(p.id, cumulativeNetSigned - paidRunning);
  }

  const paymentsFull = paymentRows.map((r) => ({
    id: r.id,
    amount: r.amount,
    paidAt: r.paidAt.toISOString(),
    memo: r.memo ?? null,
    actorName: r.actor?.name ?? null,
    actorRole: r.actor?.role ?? null,
    outstandingAfterCumulative: outstandingAfterByPaymentId.get(r.id) ?? 0,
  }));
  const itemsTotal = filteredItems.length;
  const paymentsTotal = paymentsFull.length;

  res.json({
    month: loYmd.slice(0, 7),
    from: loYmd,
    to: hiYmd,
    externalCompanyId: companyId,
    externalCompanyName: companyName,
    inquiryCount,
    cancelledInquiryCount,
    totalCount: inquiryCount + cancelledInquiryCount,
    totalFee,
    periodPositiveFee,
    periodNegativeFee,
    carryOverAmount,
    payableAmount,
    periodPaidAmount,
    remainingAmount,
    summaryYear,
    yFromYmd,
    yToYmd,
    yearTotalFee,
    yearCarryOverAmount,
    yearPayableAmount,
    yearPeriodPaidAmount,
    yearRemainingAmount,
    lastSettlementPayment,
    itemsTotal,
    paymentsTotal,
    payments: paymentsFull.slice(payOffset, payOffset + payLimit),
    items: filteredItems.slice(itemsOffset, itemsOffset + itemsLimit),
  });
});

/** 관리자/마케터: 타업체 정산완료(부분 지급) 기록 */
router.post('/external-settlement/payments', async (req, res) => {
  const viewer = (req as unknown as {
    teamViewer?: { userId: string; role: string };
    user: AuthPayload;
  }).teamViewer;
  const actorId = viewer?.userId ?? (req as unknown as { user: AuthPayload }).user.userId;
  const actorRole = viewer?.role ?? (req as unknown as { user: AuthPayload }).user.role;
  if (actorRole !== 'ADMIN' && actorRole !== 'MARKETER') {
    res.status(403).json({ error: '정산완료 기록은 관리자/마케터만 처리할 수 있습니다.' });
    return;
  }
  const body = req.body as { externalCompanyId?: string; amount?: number; memo?: string; paidDate?: string };
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
    where: { id: externalCompanyId, isActive: true },
    select: { id: true },
  });
  if (!co) {
    res.status(404).json({ error: '타업체를 찾을 수 없습니다.' });
    return;
  }
  const row = await prisma.externalCompanySettlementPayment.create({
    data: {
      externalCompanyId,
      amount: amountInt,
      memo: memo || null,
      actorId,
      paidAt: paidResolved.paidAt,
    },
    select: { id: true, amount: true, paidAt: true },
  });
  res.json({ ok: true, payment: { id: row.id, amount: row.amount, paidAt: row.paidAt.toISOString() } });
});

export default router;
