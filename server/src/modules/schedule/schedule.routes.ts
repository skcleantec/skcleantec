import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { authMiddleware, adminOnly } from '../auth/auth.middleware.js';
import { adminOrMarketer } from '../auth/auth.middleware.js';
import { resolveLeaderMorningAfternoon, resolveMemberAvailable } from './scheduleDayAvailability.helpers.js';
import { countAvailableFieldStaffOnDate, tenantActiveTeamMemberWhere } from '../inquiries/crewMemberCapacity.helpers.js';
import { dateToYmdKst, isUserEmployedOnYmd } from '../users/userEmployment.js';
import { assignmentTeamLeaderSelect } from '../inquiries/assignmentTeamLeaderSelect.js';
import {
  hydrateMissingGeoForInquiryListItems,
  mergeRefreshedInquiryGeoFields,
} from '../inquiries/inquiryAddressGeoHydrate.js';
import { attachDistanceFromJuanForInquiry } from '../inquiries/inquiryJuanDistance.js';
import { mapInquiriesInternalToneForRole } from '../inquiries/internalCustomerTone.js';
import { enrichInquiriesProfOptionsReviewStatus } from '../inquiries/inquiryProfOptionsAmount.service.js';
import type { AuthPayload } from '../auth/auth.middleware.js';
import { kstDayRangeYmd, kstMonthRangeYm, kstTodayYmd } from '../inquiries/inquiryListDateRange.js';
import { resolveTenantIdFromAuth } from '../tenants/tenant.middleware.js';
import { attachTenantShareMetaToInquiries } from '../tenant-partners/tenantInquiryShareMeta.js';
import { attachDbListingMetaToInquiries } from '../db-marketplace/dbMarketplaceInquiryMeta.js';

const router = Router();

async function tenantFromReq(req: import('express').Request, res: import('express').Response): Promise<string | null> {
  const tenantId = await resolveTenantIdFromAuth((req as unknown as { user: AuthPayload }).user);
  if (!tenantId) {
    res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
    return null;
  }
  return tenantId;
}

router.use(authMiddleware);
router.use(adminOrMarketer);

const YMD = /^\d{4}-\d{2}-\d{2}$/;

/**
 * 스케줄 월/주 목록용 select.
 * `ScheduleInquiryDetailModal`이 목록에서 받은 `item`으로 폼을 채운 뒤 저장할 때
 * 누락 필드가 빈 값으로 PATCH 되어 메모·특이사항·평수 등이 DB에서 지워지지 않도록
 * 상세 저장에 쓰는 필드는 non-lite include와 동일하게 맞춘다.
 */
const scheduleListSelectLite = {
  id: true,
  inquiryNumber: true,
  customerName: true,
  nickname: true,
  customerPhone: true,
  customerPhone2: true,
  source: true,
  address: true,
  addressDetail: true,
  addressGeoQuery: true,
  addressGeoLat: true,
  addressGeoLng: true,
  areaPyeong: true,
  areaBasis: true,
  exclusiveAreaSqm: true,
  propertyType: true,
  isOneRoom: true,
  roomCount: true,
  bathroomCount: true,
  balconyCount: true,
  kitchenCount: true,
  buildingType: true,
  moveInDate: true,
  moveInDateUndecided: true,
  preferredDate: true,
  preferredTime: true,
  preferredTimeDetail: true,
  betweenScheduleSlot: true,
  status: true,
  happyCallCompletedAt: true,
  memo: true,
  specialNotes: true,
  scheduleMemo: true,
  consultationMemo: true,
  internalCustomerTone: true,
  crewMemberCount: true,
  crewMemberNote: true,
  noCrewMembers: true,
  professionalOptionIds: true,
  profOptionsAmountReviewPending: true,
  serviceTotalAmount: true,
  serviceDepositAmount: true,
  serviceBalanceAmount: true,
  externalTransferFee: true,
  operatingCompanyId: true,
  operatingCompany: {
    select: {
      id: true,
      name: true,
      slug: true,
      isActive: true,
      config: true,
    },
  },
  createdBy: { select: { id: true, name: true } },
  orderForm: {
    select: {
      id: true,
      totalAmount: true,
      depositAmount: true,
      balanceAmount: true,
      submittedAt: true,
      customerSpecialNotes: true,
      createdBy: { select: { id: true, name: true } },
    },
  },
  assignments: {
    orderBy: { sortOrder: 'asc' },
    select: {
      id: true,
      sortOrder: true,
      teamLeader: { select: assignmentTeamLeaderSelect },
    },
  },
} as const;

/** preferredDate 조회 — 하루 단위는 KST(Asia/Seoul)와 동일하게 맞춤 (말일 일정 누락 방지) */
function rangeFromQuery(start?: string, end?: string) {
  if (start && YMD.test(start) && end && YMD.test(end)) {
    const startBounds = kstDayRangeYmd(start)!;
    const endBounds = kstDayRangeYmd(end)!;
    return {
      startDate: startBounds.gte,
      endDate: endBounds.lte,
    };
  }
  const monthRange = kstMonthRangeYm(kstTodayYmd().slice(0, 7))!;
  return {
    startDate: monthRange.gte,
    endDate: monthRange.lte,
  };
}

router.get('/', async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user;
  const tenantId = await tenantFromReq(req, res);
  if (!tenantId) return;
  const { start, end, lite } = req.query as { start?: string; end?: string; lite?: string };
  const useLite = lite === '1' || lite === 'true';
  const { startDate, endDate } = rangeFromQuery(
    typeof start === 'string' ? start : undefined,
    typeof end === 'string' ? end : undefined
  );

  const baseArgs = {
    where: {
      tenantId,
      preferredDate: { gte: startDate, lte: endDate },
      /** 취소·보류·대기 포함 — 화면에서 배지로 구분(가용 집계는 schedule-stats에서 취소·보류 제외) */
    },
    orderBy: [{ preferredDate: 'asc' as const }, { preferredTime: 'asc' as const }],
  };

  const itemsRaw = useLite
    ? await prisma.inquiry.findMany({
        ...baseArgs,
        select: scheduleListSelectLite,
      })
    : await prisma.inquiry.findMany({
        ...baseArgs,
        include: {
          operatingCompany: {
            select: { id: true, name: true, slug: true, isActive: true, config: true },
          },
          createdBy: { select: { id: true, name: true } },
          assignments: {
            orderBy: { sortOrder: 'asc' },
            include: { teamLeader: { select: assignmentTeamLeaderSelect } },
          },
          orderForm: {
            select: {
              id: true,
              totalAmount: true,
              depositAmount: true,
              balanceAmount: true,
              submittedAt: true,
              customerSpecialNotes: true,
              createdBy: { select: { id: true, name: true } },
            },
          },
          extraCharges: {
            orderBy: { sortOrder: 'asc' },
            include: { createdBy: { select: { id: true, name: true } } },
          },
          additionalReceipts: {
            orderBy: { sortOrder: 'asc' },
            include: { createdBy: { select: { id: true, name: true } } },
          },
        },
      });
  /** 스케줄 월 단위: changeLogs·카카오 지오는 상세/접수 API에 맡겨 첫 페인트 지연 방지 */
  const touched = await hydrateMissingGeoForInquiryListItems(prisma, itemsRaw, {
    maxUniqueQueries: 0,
  });
  const items = await mergeRefreshedInquiryGeoFields(prisma, itemsRaw, touched);

  const itemsWithDistance = items.map((row) => attachDistanceFromJuanForInquiry(row));
  const itemsWithShare = await attachTenantShareMetaToInquiries(tenantId, itemsWithDistance);
  const itemsWithDbListing = await attachDbListingMetaToInquiries(tenantId, itemsWithShare);
  const itemsWithProfReview = await enrichInquiriesProfOptionsReviewStatus(prisma, itemsWithDbListing);
  res.json({
    items: mapInquiriesInternalToneForRole(itemsWithProfReview, user.role),
  });
});

/** 관리자: 해당일 일정 마감(범위별 잔여 슬롯·TO 조정) */
router.post('/closures', authMiddleware, adminOnly, async (req, res) => {
  const tenantId = await tenantFromReq(req, res);
  if (!tenantId) return;
  const { date, scope } = req.body as {
    date?: string;
    scope?: 'FULL' | 'MORNING' | 'AFTERNOON';
  };
  if (!date || !YMD.test(date)) {
    res.status(400).json({ error: '유효한 날짜(yyyy-mm-dd)가 필요합니다.' });
    return;
  }
  const scopeVal =
    scope === 'MORNING' || scope === 'AFTERNOON' || scope === 'FULL' ? scope : 'FULL';
  const d = new Date(`${date}T12:00:00+09:00`);
  await prisma.scheduleDayClosure.upsert({
    where: { tenantId_date: { tenantId, date: d } },
    create: { tenantId, date: d, scope: scopeVal },
    update: { scope: scopeVal },
  });
  res.json({ ok: true });
});

router.delete('/closures', authMiddleware, adminOnly, async (req, res) => {
  const tenantId = await tenantFromReq(req, res);
  if (!tenantId) return;
  const { date } = req.query as { date?: string };
  if (!date || !YMD.test(date)) {
    res.status(400).json({ error: '유효한 날짜(yyyy-mm-dd)가 필요합니다.' });
    return;
  }
  const d = new Date(`${date}T12:00:00+09:00`);
  await prisma.scheduleDayClosure.deleteMany({ where: { tenantId, date: d } });
  res.json({ ok: true });
});

/** 관리자: 해당일 가용 팀장·팀원 편집용 데이터 */
router.get('/day-availability', async (req, res) => {
  const tenantId = await tenantFromReq(req, res);
  if (!tenantId) return;
  const { date } = req.query as { date?: string };
  if (!date || !YMD.test(date)) {
    res.status(400).json({ error: 'date(yyyy-mm-dd)가 필요합니다.' });
    return;
  }
  const d = new Date(`${date}T12:00:00+09:00`);

  const [teamLeadersRaw, members, leaderDayOffs, leaderSlots, memberSlots, closure] = await Promise.all([
    prisma.user.findMany({
      where: { tenantId, role: 'TEAM_LEADER', isActive: true },
      select: { id: true, name: true, hireDate: true, resignationDate: true },
      orderBy: { name: 'asc' },
    }),
    prisma.teamMember.findMany({
      where: tenantActiveTeamMemberWhere(tenantId),
      select: { id: true, name: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    }),
    prisma.userDayOff.findMany({
      where: { date: d, teamLeader: { tenantId } },
      select: { teamLeaderId: true },
    }),
    prisma.scheduleDayLeaderSlot.findMany({ where: { tenantId, date: d } }),
    prisma.scheduleDayTeamMemberSlot.findMany({ where: { tenantId, date: d } }),
    prisma.scheduleDayClosure.findUnique({
      where: { tenantId_date: { tenantId, date: d } },
      select: { scope: true },
    }),
  ]);

  const ymdForDay = dateToYmdKst(d);
  const teamLeaders = teamLeadersRaw.filter((u) =>
    isUserEmployedOnYmd(u.hireDate, u.resignationDate, ymdForDay)
  );

  const offLeaderIds = new Set(leaderDayOffs.map((x) => x.teamLeaderId));
  const leaderSlotMap = new Map(leaderSlots.map((r) => [r.teamLeaderId, r]));
  const memberSlotMap = new Map(memberSlots.map((r) => [r.teamMemberId, r]));

  const memberIds = members.map((m) => m.id);
  const memberDayOffRows =
    memberIds.length > 0
      ? await prisma.teamMemberDayOff.findMany({
          where: { date: d, teamMemberId: { in: memberIds } },
          select: { teamMemberId: true },
        })
      : [];
  const memberOffSet = new Set(memberDayOffRows.map((x) => x.teamMemberId));

  const teamLeadersOut = teamLeaders.map((u) => {
    const o = leaderSlotMap.get(u.id);
    const hasOff = offLeaderIds.has(u.id);
    const slots = resolveLeaderMorningAfternoon(
      hasOff,
      o ? { morningAvailable: o.morningAvailable, afternoonAvailable: o.afternoonAvailable } : null
    );
    return {
      id: u.id,
      name: u.name,
      hasUserDayOff: hasOff,
      morningAvailable: slots.morning,
      afternoonAvailable: slots.afternoon,
      note: o?.note ?? null,
      hasOverride: Boolean(o),
    };
  });

  const membersOut = members.map((m) => {
    const o = memberSlotMap.get(m.id);
    const hasOff = memberOffSet.has(m.id);
    const avail = resolveMemberAvailable(hasOff, o != null ? o.available : null);
    return {
      id: m.id,
      name: m.name,
      hasTeamMemberDayOff: hasOff,
      available: avail,
      note: o?.note ?? null,
      hasOverride: Boolean(o),
    };
  });

  let morningWorkingCount = 0;
  let afternoonWorkingCount = 0;
  for (const row of teamLeadersOut) {
    if (row.morningAvailable) morningWorkingCount += 1;
    if (row.afternoonAvailable) afternoonWorkingCount += 1;
  }

  const ymd = date;
  const crewAvailable = await countAvailableFieldStaffOnDate(prisma, ymd, tenantId);

  res.json({
    date: ymd,
    closureScope: closure?.scope ?? null,
    teamLeaders: teamLeadersOut,
    teamMembers: membersOut,
    summary: {
      morningWorkingCount,
      afternoonWorkingCount,
      crewAvailable,
    },
  });
});

/** 관리자: 해당일 가용 팀장·팀원 수동 설정(전체 교체) */
router.put('/day-availability', authMiddleware, adminOnly, async (req, res) => {
  const tenantId = await tenantFromReq(req, res);
  if (!tenantId) return;
  const body = req.body as {
    date?: string;
    leaders?: Array<{
      teamLeaderId: string;
      morningAvailable: boolean;
      afternoonAvailable: boolean;
      note?: string | null;
    }>;
    members?: Array<{
      teamMemberId: string;
      available: boolean;
      note?: string | null;
    }>;
  };
  if (!body.date || !YMD.test(body.date)) {
    res.status(400).json({ error: 'date(yyyy-mm-dd)가 필요합니다.' });
    return;
  }
  const d = new Date(`${body.date}T12:00:00+09:00`);
  const leaders = body.leaders ?? [];
  const members = body.members ?? [];

  const noteMax = 500;
  const trimNote = (n: string | null | undefined) => {
    const s = (n ?? '').trim();
    if (!s) return null;
    return s.length > noteMax ? s.slice(0, noteMax) : s;
  };

  await prisma.$transaction(async (tx) => {
    await tx.scheduleDayLeaderSlot.deleteMany({ where: { tenantId, date: d } });
    await tx.scheduleDayTeamMemberSlot.deleteMany({ where: { tenantId, date: d } });
    if (leaders.length > 0) {
      await tx.scheduleDayLeaderSlot.createMany({
        data: leaders.map((l) => ({
          tenantId,
          date: d,
          teamLeaderId: l.teamLeaderId,
          morningAvailable: l.morningAvailable,
          afternoonAvailable: l.afternoonAvailable,
          note: trimNote(l.note),
        })),
      });
    }
    if (members.length > 0) {
      await tx.scheduleDayTeamMemberSlot.createMany({
        data: members.map((m) => ({
          tenantId,
          date: d,
          teamMemberId: m.teamMemberId,
          available: m.available,
          note: trimNote(m.note),
        })),
      });
    }
  });

  res.json({ ok: true });
});

export default router;
