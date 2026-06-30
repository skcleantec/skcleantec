/**
 * Phase 2 — 팀장 확장 시나리오 ([가이드데모 cbiseo 팀장])
 */
import {
  CleaningPhotoPhase,
  InquiryInspectionStatus,
  InquiryStatus,
  type PrismaClient,
} from '@prisma/client';
import { allocateNextInquiryNumber } from '../src/modules/inquiries/inquiryNumber.js';
import { addDaysToKstYmd, kstTodayYmd } from '../src/modules/inquiries/inquiryListDateRange.js';
import { getDefaultOperatingCompanyId } from '../src/modules/operating-companies/operatingCompany.service.js';
import { guideDemoTenantId, guideDemoTeamLeaderEmail, resolveGuideDemoLeaderEmail } from './guide-demo/tenantScope.js';
import { getOrCreateInspectionChecklist } from '../src/modules/inquiry-inspection/inquiryInspection.service.js';
import { GUIDE_DEMO_TEAM_TAG, guideDemoTeamInquiryId } from './guide-demo/constants.js';
import { purgeGuideDemoTeamSeed } from './guide-demo/purge.js';

const CREW_NAMES = ['민수', '지현', '태호'] as const;
const DEMO_PHOTO_URL = 'https://res.cloudinary.com/demo/image/upload/sample.jpg';

type TeamScenario = {
  id: string;
  code: string;
  label: string;
  customerName: string;
  status: InquiryStatus;
  preferredDayOffset: number;
  preferredTime: string;
  detailViewed?: boolean;
  happyCallDone?: boolean;
  noCrew?: boolean;
  crewMeetingTime?: string | null;
  extraCharges?: { description: string; amount: number }[];
  cleaningBefore?: number;
  cleaningAfter?: number;
  inspection?: 'draft' | 'completed';
  changeLog?: boolean;
  teamLeaderEmail?: string;
  secondTeamLeaderEmail?: string;
};

function kstNoon(dayOffset: number): Date {
  const ymd = addDaysToKstYmd(kstTodayYmd(), dayOffset);
  return new Date(`${ymd}T12:00:00+09:00`);
}

function buildTeamScenarios(): TeamScenario[] {
  return [
    {
      id: guideDemoTeamInquiryId(1),
      code: 'B-01',
      label: '해피콜 마감 초과',
      customerName: '해피콜초과',
      status: InquiryStatus.ASSIGNED,
      preferredDayOffset: 0,
      preferredTime: '오전',
      happyCallDone: false,
      detailViewed: true,
      teamLeaderEmail: 'cbiseo',
    },
    {
      id: guideDemoTeamInquiryId(2),
      code: 'B-02',
      label: '해피콜 마감 전',
      customerName: '해피콜전',
      status: InquiryStatus.ASSIGNED,
      preferredDayOffset: 3,
      preferredTime: '오후',
      happyCallDone: false,
      teamLeaderEmail: 'cbiseo',
    },
    {
      id: guideDemoTeamInquiryId(3),
      code: 'B-03',
      label: '추가결재 2건',
      customerName: '추가결재',
      status: InquiryStatus.IN_PROGRESS,
      preferredDayOffset: 0,
      preferredTime: '오후',
      teamLeaderEmail: 'cbiseo',
      extraCharges: [
        { description: '에어컨 분해', amount: 80_000 },
        { description: '주차 할인', amount: -10_000 },
      ],
    },
    {
      id: guideDemoTeamInquiryId(4),
      code: 'B-04',
      label: '청소전만 촬영',
      customerName: '전사진만',
      status: InquiryStatus.IN_PROGRESS,
      preferredDayOffset: 0,
      preferredTime: '오전',
      teamLeaderEmail: 'cbiseo',
      cleaningBefore: 2,
    },
    {
      id: guideDemoTeamInquiryId(5),
      code: 'B-05',
      label: '전후 사진 완료',
      customerName: '전후완료',
      status: InquiryStatus.COMPLETED,
      preferredDayOffset: -1,
      preferredTime: '오후',
      teamLeaderEmail: 'cbiseo',
      cleaningBefore: 2,
      cleaningAfter: 2,
    },
    {
      id: guideDemoTeamInquiryId(6),
      code: 'B-06',
      label: '검수 진행중',
      customerName: '검수중',
      status: InquiryStatus.IN_PROGRESS,
      preferredDayOffset: -1,
      preferredTime: '오전',
      teamLeaderEmail: 'cbiseo',
      inspection: 'draft',
    },
    {
      id: guideDemoTeamInquiryId(7),
      code: 'B-07',
      label: '검수 완료',
      customerName: '검수완료',
      status: InquiryStatus.COMPLETED,
      preferredDayOffset: -2,
      preferredTime: '오후',
      teamLeaderEmail: 'cbiseo',
      inspection: 'completed',
    },
    {
      id: guideDemoTeamInquiryId(8),
      code: 'B-08',
      label: '2팀장 동시',
      customerName: '이중배정',
      status: InquiryStatus.ASSIGNED,
      preferredDayOffset: 1,
      preferredTime: '오전',
      teamLeaderEmail: 'cbiseo',
      secondTeamLeaderEmail: 'team1@skcleanteck.com',
    },
    {
      id: guideDemoTeamInquiryId(9),
      code: 'B-09',
      label: '크루 0명',
      customerName: '크루없음',
      status: InquiryStatus.ASSIGNED,
      preferredDayOffset: 2,
      preferredTime: '오후',
      teamLeaderEmail: 'cbiseo',
      noCrew: true,
    },
    {
      id: guideDemoTeamInquiryId(10),
      code: 'B-10',
      label: '변경이력 WS',
      customerName: '변경알림',
      status: InquiryStatus.ASSIGNED,
      preferredDayOffset: 1,
      preferredTime: '오전',
      teamLeaderEmail: 'cbiseo',
      changeLog: true,
    },
    {
      id: guideDemoTeamInquiryId(11),
      code: 'B-11',
      label: 'team1 단독',
      customerName: '팀원일',
      status: InquiryStatus.ASSIGNED,
      preferredDayOffset: 0,
      preferredTime: '오후',
      teamLeaderEmail: 'team1@skcleanteck.com',
      crewMeetingTime: '09:30',
    },
    {
      id: guideDemoTeamInquiryId(12),
      code: 'B-12',
      label: '취소건',
      customerName: '취소데모',
      status: InquiryStatus.CANCELLED,
      preferredDayOffset: 2,
      preferredTime: '오전',
      teamLeaderEmail: 'cbiseo',
    },
  ];
}

export async function runGuideDemoTeamSeed(
  prisma: PrismaClient,
): Promise<{ purged: number; inquiryCount: number }> {
  const purged = await purgeGuideDemoTeamSeed(prisma);

  const admin = await prisma.user.findFirst({
    where: { tenantId: guideDemoTenantId(), role: 'ADMIN', isActive: true },
    orderBy: { createdAt: 'asc' },
  });
  if (!admin) throw new Error('ADMIN 계정이 없습니다.');

  const leaders = await prisma.user.findMany({
    where: { tenantId: guideDemoTenantId(), role: 'TEAM_LEADER', isActive: true },
    select: { id: true, email: true },
  });
  const leaderByEmail = new Map(leaders.map((l) => [l.email.toLowerCase(), l.id]));
  const primaryLeader = leaders.find((l) => l.email === guideDemoTeamLeaderEmail());
  if (primaryLeader) leaderByEmail.set('cbiseo', primaryLeader.id);
  const cbiseo = primaryLeader;

  const operatingCompanyId = await getDefaultOperatingCompanyId(prisma, guideDemoTenantId());
  const scenarios = buildTeamScenarios();
  const today = kstTodayYmd();

  for (const s of scenarios) {
    const preferredDate = kstNoon(s.preferredDayOffset);
    const assignedAt = kstNoon(Math.min(s.preferredDayOffset, 0));
    const phoneSuffix = s.id.slice(-4);
    const crewNote = s.noCrew ? null : CREW_NAMES.join('·');
    const serviceTotal = 32 * 25_000;

    const leaderEmails = [s.teamLeaderEmail, s.secondTeamLeaderEmail].filter(Boolean) as string[];

    await prisma.$transaction(async (tx) => {
      const inquiryNumber = await allocateNextInquiryNumber(tx, guideDemoTenantId());
      await tx.inquiry.create({
        data: {
          id: s.id,
          tenantId: guideDemoTenantId(),
          operatingCompanyId,
          inquiryNumber,
          customerName: s.customerName,
          customerPhone: `010-7${phoneSuffix.slice(0, 3)}-${phoneSuffix.slice(1)}`,
          address: '서울 강남구 테헤란로 152',
          addressDetail: `${s.code} · ${s.label}`,
          areaPyeong: 32,
          propertyType: '아파트',
          roomCount: 3,
          bathroomCount: 2,
          kitchenCount: 1,
          preferredDate,
          preferredTime: s.preferredTime,
          preferredTimeDetail: `${s.preferredTime} 희망`,
          memo: `${GUIDE_DEMO_TEAM_TAG} ${s.code} ${s.label}`,
          scheduleMemo: s.label,
          specialNotes: `가이드 팀장 데모 — ${s.label}. KST ${today}.`,
          status: s.status,
          source: '전화',
          createdById: admin.id,
          createdAt: assignedAt,
          serviceTotalAmount: serviceTotal,
          serviceDepositAmount: 200_000,
          serviceBalanceAmount: Math.max(0, serviceTotal - 200_000),
          crewMemberCount: s.noCrew ? 0 : CREW_NAMES.length,
          crewMemberNote: crewNote,
          crewMeetingTime: s.crewMeetingTime ?? null,
          crewMeetingTimeShared: true,
          happyCallCompletedAt: s.happyCallDone ? new Date() : null,
        },
      });

      for (let i = 0; i < leaderEmails.length; i += 1) {
        const key = resolveGuideDemoLeaderEmail(leaderEmails[i]!);
        const tlId = leaderByEmail.get(key.toLowerCase()) ?? leaderByEmail.get(key);
        if (!tlId) continue;
        await tx.assignment.create({
          data: {
            tenantId: guideDemoTenantId(),
            inquiryId: s.id,
            teamLeaderId: tlId,
            assignedById: admin.id,
            assignedAt,
            sortOrder: i,
            detailViewedAt: s.detailViewed ? assignedAt : null,
            noCrewMembers: s.noCrew ?? false,
          },
        });
      }

      if (s.extraCharges?.length) {
        for (let i = 0; i < s.extraCharges.length; i += 1) {
          const c = s.extraCharges[i]!;
          await tx.inquiryExtraCharge.create({
            data: {
              inquiryId: s.id,
              description: c.description,
              amount: c.amount,
              sortOrder: i,
              createdById: admin.id,
            },
          });
        }
      }

      if (s.changeLog) {
        await tx.inquiryChangeLog.create({
          data: {
            inquiryId: s.id,
            customerName: s.customerName,
            actorId: admin.id,
            lines: ['스케줄 메모: (없음) → 고객 요청 반영', '특이사항: 주차 B2'],
          },
        });
      }

      if (s.cleaningBefore) {
        for (let i = 0; i < s.cleaningBefore; i += 1) {
          await tx.inquiryCleaningPhoto.create({
            data: {
              inquiryId: s.id,
              phase: CleaningPhotoPhase.BEFORE,
              cloudinaryPublicId: `guide-demo/${s.code}-before-${i}`,
              secureUrl: DEMO_PHOTO_URL,
              uploadedById: admin.id,
            },
          });
        }
      }
      if (s.cleaningAfter) {
        for (let i = 0; i < s.cleaningAfter; i += 1) {
          await tx.inquiryCleaningPhoto.create({
            data: {
              inquiryId: s.id,
              phase: CleaningPhotoPhase.AFTER,
              cloudinaryPublicId: `guide-demo/${s.code}-after-${i}`,
              secureUrl: DEMO_PHOTO_URL,
              uploadedById: admin.id,
            },
          });
        }
      }
    });

    const primaryLeader = leaderEmails[0]
      ? (() => {
          const key = resolveGuideDemoLeaderEmail(leaderEmails[0]);
          return leaderByEmail.get(key.toLowerCase()) ?? leaderByEmail.get(key);
        })()
      : cbiseo?.id;
    if (s.inspection && primaryLeader) {
      await getOrCreateInspectionChecklist({
        inquiryId: s.id,
        tenantId: guideDemoTenantId(),
        teamLeaderId: primaryLeader,
        roomCount: 3,
        isOneRoom: false,
        kitchenCount: 1,
        bathroomCount: 2,
        customerName: s.customerName,
        preferredDate,
      });
      if (s.inspection === 'completed') {
        await prisma.inquiryInspectionChecklist.updateMany({
          where: { inquiryId: s.id, tenantId: guideDemoTenantId() },
          data: {
            status: InquiryInspectionStatus.COMPLETED,
            completedAt: new Date(),
            consentPersonalInfo: true,
            consentThirdParty: true,
            consentScopeConfirm: true,
            consentLeaderLiability: true,
            leaderNotes: '가이드 데모 — 검수 완료',
            signatureSecureUrl: DEMO_PHOTO_URL,
            signaturePublicId: 'guide-demo/signature',
          },
        });
      }
    }
  }

  return { purged, inquiryCount: scenarios.length };
}
