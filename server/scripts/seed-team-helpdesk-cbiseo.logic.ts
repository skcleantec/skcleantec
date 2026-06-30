/**
 * 팀장 도움말·데모용 — cbiseo 팀장 + 다양한 현장 시나리오 접수
 * 재실행 시 동일 태그 메모 건 삭제 후 재생성 (멱등)
 */
import bcrypt from 'bcryptjs';
import {
  InquiryInspectionStatus,
  InquiryStatus,
  InternalCustomerTone,
  type PrismaClient,
} from '@prisma/client';
import { allocateNextInquiryNumber } from '../src/modules/inquiries/inquiryNumber.js';
import { addDaysToKstYmd, kstTodayYmd } from '../src/modules/inquiries/inquiryListDateRange.js';
import { getDefaultOperatingCompanyId } from '../src/modules/operating-companies/operatingCompany.service.js';
import { guideDemoTenantId, guideDemoTeamLeaderEmail } from './guide-demo/tenantScope.js';
import { getOrCreateInspectionChecklist } from '../src/modules/inquiry-inspection/inquiryInspection.service.js';

export const TEAM_HELPDESK_SEED_TAG = '[팀장도움말 cbiseo]';
export const TEAM_HELPDESK_LEADER_EMAIL = 'cbiseo';

const CREW_NAMES = ['민수', '지현', '태호', '수연'] as const;

type Scenario = {
  id: string;
  label: string;
  customerName: string;
  status: InquiryStatus;
  /** KST 오늘 기준 일수 (+/-) */
  preferredDayOffset: number;
  preferredTime: string;
  betweenScheduleSlot?: string | null;
  assignedDayOffset?: number;
  detailViewed?: boolean;
  happyCallDone?: boolean;
  noCrew?: boolean;
  crewMeetingTime?: string | null;
  crewMeetingShared?: boolean;
  perMemberMeeting?: Record<string, string>;
  externalTransferFee?: number | null;
  internalTone?: InternalCustomerTone;
  inspection?: 'none' | 'draft' | 'completed';
  changeLog?: boolean;
  propertyType?: string;
  areaPyeong?: number;
  roomCount?: number;
  bathroomCount?: number;
  kitchenCount?: number;
  isOneRoom?: boolean;
};

function kstNoon(dayOffset: number): Date {
  const ymd = addDaysToKstYmd(kstTodayYmd(), dayOffset);
  return new Date(`${ymd}T12:00:00+09:00`);
}

function inquiryUuid(n: number): string {
  return `b0000001-0000-4000-8000-${String(n).padStart(12, '0')}`;
}

function buildScenarios(): Scenario[] {
  return [
    {
      id: inquiryUuid(1),
      label: '오늘·신규배정(미확인)',
      customerName: '한서윤',
      status: InquiryStatus.ASSIGNED,
      preferredDayOffset: 0,
      preferredTime: '오전',
      detailViewed: false,
      happyCallDone: false,
      propertyType: '아파트',
      areaPyeong: 32,
      roomCount: 3,
      bathroomCount: 2,
      kitchenCount: 1,
    },
    {
      id: inquiryUuid(2),
      label: '오늘·진행중·해피콜완료',
      customerName: '오준혁',
      status: InquiryStatus.IN_PROGRESS,
      preferredDayOffset: 0,
      preferredTime: '오후',
      detailViewed: true,
      happyCallDone: true,
      crewMeetingTime: '13:30',
      propertyType: '아파트',
      areaPyeong: 28,
      roomCount: 3,
      bathroomCount: 1,
      kitchenCount: 1,
      inspection: 'draft',
    },
    {
      id: inquiryUuid(3),
      label: '오늘·사이청소',
      customerName: '임채린',
      status: InquiryStatus.ASSIGNED,
      preferredDayOffset: 0,
      preferredTime: '사이청소',
      betweenScheduleSlot: '오후',
      detailViewed: true,
      propertyType: '오피스텔',
      areaPyeong: 18,
      roomCount: 1,
      bathroomCount: 1,
      kitchenCount: 1,
      isOneRoom: true,
    },
    {
      id: inquiryUuid(4),
      label: '내일·일반배정',
      customerName: '신동욱',
      status: InquiryStatus.ASSIGNED,
      preferredDayOffset: 1,
      preferredTime: '오전',
      detailViewed: true,
      happyCallDone: false,
      propertyType: '빌라(연립)',
      areaPyeong: 24,
      roomCount: 2,
      bathroomCount: 1,
      kitchenCount: 1,
    },
    {
      id: inquiryUuid(5),
      label: '어제·청소완료·검수완료',
      customerName: '유나래',
      status: InquiryStatus.COMPLETED,
      preferredDayOffset: -1,
      preferredTime: '오후',
      detailViewed: true,
      happyCallDone: true,
      inspection: 'completed',
      propertyType: '아파트',
      areaPyeong: 35,
      roomCount: 4,
      bathroomCount: 2,
      kitchenCount: 1,
    },
    {
      id: inquiryUuid(6),
      label: '어제·완료·검수전',
      customerName: '정우진',
      status: InquiryStatus.COMPLETED,
      preferredDayOffset: -1,
      preferredTime: '오전',
      detailViewed: true,
      inspection: 'none',
      propertyType: '아파트',
      areaPyeong: 29,
      roomCount: 3,
      bathroomCount: 2,
      kitchenCount: 1,
    },
    {
      id: inquiryUuid(7),
      label: '3일후·팀원별미팅',
      customerName: '강하늘',
      status: InquiryStatus.ASSIGNED,
      preferredDayOffset: 3,
      preferredTime: '오전',
      crewMeetingShared: false,
      perMemberMeeting: { [CREW_NAMES[0]]: '08:30', [CREW_NAMES[1]]: '08:45', [CREW_NAMES[2]]: '09:00' },
      propertyType: '아파트',
      areaPyeong: 40,
      roomCount: 4,
      bathroomCount: 2,
      kitchenCount: 1,
    },
    {
      id: inquiryUuid(8),
      label: '단독현장(크루없음)',
      customerName: '배성호',
      status: InquiryStatus.ASSIGNED,
      preferredDayOffset: 2,
      preferredTime: '오후',
      noCrew: true,
      propertyType: '단독주택',
      areaPyeong: 52,
      roomCount: 5,
      bathroomCount: 3,
      kitchenCount: 1,
    },
    {
      id: inquiryUuid(9),
      label: '보류·일정미정',
      customerName: '문지후',
      status: InquiryStatus.ON_HOLD,
      preferredDayOffset: 5,
      preferredTime: '오전',
      propertyType: '아파트',
      areaPyeong: 31,
      roomCount: 3,
      bathroomCount: 2,
      kitchenCount: 1,
    },
    {
      id: inquiryUuid(10),
      label: '취소',
      customerName: '송예린',
      status: InquiryStatus.CANCELLED,
      preferredDayOffset: 4,
      preferredTime: '오후',
      propertyType: '아파트',
      areaPyeong: 26,
      roomCount: 3,
      bathroomCount: 1,
      kitchenCount: 1,
    },
    {
      id: inquiryUuid(11),
      label: 'C/S처리중',
      customerName: '홍길동',
      status: InquiryStatus.CS_PROCESSING,
      preferredDayOffset: -3,
      preferredTime: '오후',
      propertyType: '아파트',
      areaPyeong: 33,
      roomCount: 3,
      bathroomCount: 2,
      kitchenCount: 1,
    },
    {
      id: inquiryUuid(12),
      label: '타업체수수료',
      customerName: '피치앤',
      status: InquiryStatus.ASSIGNED,
      preferredDayOffset: 6,
      preferredTime: '오전',
      externalTransferFee: 180_000,
      propertyType: '상가',
      areaPyeong: 45,
      roomCount: 2,
      bathroomCount: 1,
      kitchenCount: 0,
    },
    {
      id: inquiryUuid(13),
      label: '내부고객·극악',
      customerName: '주의고객',
      status: InquiryStatus.ASSIGNED,
      preferredDayOffset: 1,
      preferredTime: '오후',
      internalTone: InternalCustomerTone.SEVERE,
      propertyType: '아파트',
      areaPyeong: 27,
      roomCount: 2,
      bathroomCount: 1,
      kitchenCount: 1,
    },
    {
      id: inquiryUuid(14),
      label: '변경이력있음',
      customerName: '이수정',
      status: InquiryStatus.ASSIGNED,
      preferredDayOffset: 0,
      preferredTime: '오후',
      changeLog: true,
      detailViewed: false,
      propertyType: '아파트',
      areaPyeong: 30,
      roomCount: 3,
      bathroomCount: 2,
      kitchenCount: 1,
    },
    {
      id: inquiryUuid(15),
      label: '이번주·대형',
      customerName: '장미래',
      status: InquiryStatus.IN_PROGRESS,
      preferredDayOffset: 4,
      preferredTime: '오전',
      propertyType: '아파트',
      areaPyeong: 48,
      roomCount: 4,
      bathroomCount: 3,
      kitchenCount: 2,
      inspection: 'draft',
    },
    {
      id: inquiryUuid(16),
      label: '지난주·완료',
      customerName: '노승민',
      status: InquiryStatus.COMPLETED,
      preferredDayOffset: -7,
      preferredTime: '오전',
      happyCallDone: true,
      propertyType: '빌라(연립)',
      areaPyeong: 22,
      roomCount: 2,
      bathroomCount: 1,
      kitchenCount: 1,
    },
    {
      id: inquiryUuid(17),
      label: '다음달·예약',
      customerName: '윤다온',
      status: InquiryStatus.RECEIVED,
      preferredDayOffset: 14,
      preferredTime: '오후',
      propertyType: '아파트',
      areaPyeong: 34,
      roomCount: 3,
      bathroomCount: 2,
      kitchenCount: 1,
    },
    {
      id: inquiryUuid(18),
      label: '오늘·4인투입',
      customerName: '서민재',
      status: InquiryStatus.ASSIGNED,
      preferredDayOffset: 0,
      preferredTime: '오전',
      crewMeetingTime: '08:00',
      propertyType: '아파트',
      areaPyeong: 38,
      roomCount: 4,
      bathroomCount: 2,
      kitchenCount: 1,
    },
    {
      id: inquiryUuid(19),
      label: '2일전·진행중',
      customerName: '최은별',
      status: InquiryStatus.IN_PROGRESS,
      preferredDayOffset: -2,
      preferredTime: '오후',
      propertyType: '오피스텔',
      areaPyeong: 20,
      roomCount: 1,
      bathroomCount: 1,
      kitchenCount: 1,
      isOneRoom: true,
    },
    {
      id: inquiryUuid(20),
      label: '10일후·장기',
      customerName: '김도하',
      status: InquiryStatus.ASSIGNED,
      preferredDayOffset: 10,
      preferredTime: '오전',
      propertyType: '아파트',
      areaPyeong: 36,
      roomCount: 3,
      bathroomCount: 2,
      kitchenCount: 1,
    },
  ];
}

export async function purgeTeamHelpdeskCbiseoSeed(prisma: PrismaClient): Promise<number> {
  const rows = await prisma.inquiry.findMany({
    where: { tenantId: guideDemoTenantId(), memo: { contains: TEAM_HELPDESK_SEED_TAG } },
    select: { id: true },
  });
  if (rows.length === 0) return 0;
  await prisma.inquiryChangeLog.deleteMany({
    where: { inquiryId: { in: rows.map((r) => r.id) } },
  });
  const deleted = await prisma.inquiry.deleteMany({
    where: { id: { in: rows.map((r) => r.id) } },
  });
  return deleted.count;
}

async function ensureLeader(prisma: PrismaClient, password: string) {
  const hash = await bcrypt.hash(password, 10);
  const leader = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: guideDemoTenantId(), email: guideDemoTeamLeaderEmail() } },
    update: {
      role: 'TEAM_LEADER',
      isActive: true,
      name: '최BI서(도움말)',
      phone: '010-0000-cbis',
    },
    create: {
      tenantId: guideDemoTenantId(),
      email: guideDemoTeamLeaderEmail(),
      passwordHash: hash,
      name: '최BI서(도움말)',
      phone: '010-0000-cbis',
      role: 'TEAM_LEADER',
    },
  });

  await prisma.team.upsert({
    where: { teamLeaderId: leader.id },
    update: { memo: `${TEAM_HELPDESK_SEED_TAG} 데모 팀` },
    create: {
      tenantId: guideDemoTenantId(),
      teamLeaderId: leader.id,
      memo: `${TEAM_HELPDESK_SEED_TAG} 데모 팀`,
    },
  });

  const team = await prisma.team.findUniqueOrThrow({ where: { teamLeaderId: leader.id } });
  for (let i = 0; i < CREW_NAMES.length; i += 1) {
    const name = CREW_NAMES[i]!;
    const existing = await prisma.teamMember.findFirst({
      where: { tenantId: guideDemoTenantId(), teamId: team.id, name },
    });
    if (existing) continue;
    await prisma.teamMember.create({
      data: {
        tenantId: guideDemoTenantId(),
        teamId: team.id,
        name,
        phone: `010-7000-${String(1000 + i)}`,
        sortOrder: i,
        isActive: true,
        payAmountPerJob: 150_000,
        monthlyPayDay: 10,
      },
    });
  }

  return leader;
}

async function ensureInspectionModule(prisma: PrismaClient) {
  await prisma.tenantFeature.upsert({
    where: {
      tenantId_moduleId: { tenantId: guideDemoTenantId(), moduleId: 'mod_inspection' },
    },
    update: { enabled: true },
    create: { tenantId: guideDemoTenantId(), moduleId: 'mod_inspection', enabled: true },
  });
  await prisma.tenantFeature.upsert({
    where: {
      tenantId_moduleId: { tenantId: guideDemoTenantId(), moduleId: 'mod_crew' },
    },
    update: { enabled: true },
    create: { tenantId: guideDemoTenantId(), moduleId: 'mod_crew', enabled: true },
  });
}

export async function runTeamHelpdeskCbiseoSeed(
  prisma: PrismaClient,
  opts?: { password?: string },
): Promise<{ leaderEmail: string; inquiryCount: number; purged: number }> {
  const password = opts?.password ?? '1234';
  const purged = await purgeTeamHelpdeskCbiseoSeed(prisma);
  await ensureInspectionModule(prisma);

  const admin = await prisma.user.findFirst({
    where: { tenantId: guideDemoTenantId(), role: 'ADMIN', isActive: true },
    orderBy: { createdAt: 'asc' },
  });
  if (!admin) {
    throw new Error('SK클린텍 테넌트에 ADMIN 계정이 없습니다.');
  }

  const leader = await ensureLeader(prisma, password);
  const operatingCompanyId = await getDefaultOperatingCompanyId(prisma, guideDemoTenantId());
  const team = await prisma.team.findUniqueOrThrow({ where: { teamLeaderId: leader.id } });
  const members = await prisma.teamMember.findMany({
    where: { tenantId: guideDemoTenantId(), teamId: team.id, isActive: true },
    select: { id: true, name: true },
  });
  const memberByName = new Map(members.map((m) => [m.name, m.id]));

  const scenarios = buildScenarios();
  const today = kstTodayYmd();

  for (const s of scenarios) {
    const preferredDate = kstNoon(s.preferredDayOffset);
    const assignedAt = kstNoon(s.assignedDayOffset ?? Math.min(s.preferredDayOffset, 0));
    const phoneSuffix = s.id.slice(-4);
    const crewNote = s.noCrew ? null : `${CREW_NAMES.slice(0, s.label.includes('4인') ? 4 : 3).join('·')}`;
    const serviceTotal = (s.areaPyeong ?? 30) * 25_000;

    await prisma.$transaction(async (tx) => {
      const existing = await tx.inquiry.findFirst({ where: { id: s.id, tenantId: guideDemoTenantId() } });
      if (existing) {
        await tx.inquiry.delete({ where: { id: s.id } });
      }

      const inquiryNumber = await allocateNextInquiryNumber(tx, guideDemoTenantId());
      await tx.inquiry.create({
        data: {
          id: s.id,
          tenantId: guideDemoTenantId(),
          operatingCompanyId,
          inquiryNumber,
          customerName: s.customerName,
          customerPhone: `010-9${phoneSuffix.slice(0, 3)}-${phoneSuffix.slice(1)}`,
          customerEmail: `${s.customerName.replace(/\s/g, '')}@example.com`,
          address: '서울 강남구 테헤란로 152',
          addressDetail: `${s.label} · ${TEAM_HELPDESK_SEED_TAG}`,
          areaPyeong: s.areaPyeong ?? 30,
          areaBasis: '전용',
          propertyType: s.propertyType ?? '아파트',
          isOneRoom: s.isOneRoom ?? false,
          roomCount: s.roomCount ?? 3,
          bathroomCount: s.bathroomCount ?? 2,
          kitchenCount: s.kitchenCount ?? 1,
          preferredDate,
          preferredTime: s.preferredTime,
          betweenScheduleSlot: s.betweenScheduleSlot ?? null,
          preferredTimeDetail: s.preferredTime === '사이청소' ? '11:00 퇴실 / 15:00 입실' : `${s.preferredTime} 희망`,
          callAttempt: 2,
          memo: `${TEAM_HELPDESK_SEED_TAG} ${s.label}`,
          scheduleMemo: s.label,
          specialNotes: `도움말 데모 — ${s.label}. KST 기준일 ${today}.`,
          status: s.status,
          source: '전화',
          createdById: admin.id,
          createdAt: assignedAt,
          serviceTotalAmount: serviceTotal,
          serviceDepositAmount: 200_000,
          serviceBalanceAmount: Math.max(0, serviceTotal - 200_000),
          crewMemberCount: s.noCrew ? 0 : crewNote?.split('·').length ?? 0,
          crewMemberNote: crewNote,
          crewMeetingTime: s.crewMeetingTime ?? null,
          crewMeetingTimeShared: s.crewMeetingShared ?? true,
          crewMeetingTimeUpdatedAt: s.crewMeetingTime ? new Date() : null,
          happyCallCompletedAt: s.happyCallDone ? new Date() : null,
          externalTransferFee: s.externalTransferFee ?? null,
          internalCustomerTone: s.internalTone ?? InternalCustomerTone.NORMAL,
        },
      });

      await tx.assignment.create({
        data: {
          tenantId: guideDemoTenantId(),
          inquiryId: s.id,
          teamLeaderId: leader.id,
          assignedById: admin.id,
          assignedAt,
          sortOrder: 0,
          detailViewedAt: s.detailViewed ? assignedAt : null,
          noCrewMembers: s.noCrew ?? false,
        },
      });

      if (s.perMemberMeeting && !s.noCrew) {
        for (const [name, meetingTime] of Object.entries(s.perMemberMeeting)) {
          const teamMemberId = memberByName.get(name);
          if (!teamMemberId) continue;
          await tx.inquiryCrewMemberMeetingTime.create({
            data: {
              tenantId: guideDemoTenantId(),
              inquiryId: s.id,
              teamMemberId,
              meetingTime,
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
            lines: [
              { field: '스케줄 메모', before: '(없음)', after: '오후 2시 → 3시로 변경 요청' },
              { field: '특이사항', before: '(없음)', after: '주차 B2 120번' },
            ],
          },
        });
      }
    });

    if (s.inspection === 'draft' || s.inspection === 'completed') {
      await getOrCreateInspectionChecklist({
        inquiryId: s.id,
        tenantId: guideDemoTenantId(),
        teamLeaderId: leader.id,
        roomCount: s.roomCount ?? 3,
        isOneRoom: s.isOneRoom ?? false,
        kitchenCount: s.kitchenCount ?? 1,
        bathroomCount: s.bathroomCount ?? 2,
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
            consentCustomerConfirm: true,
            consentCommercialUse: false,
            consentEmailDelivery: true,
            customerEmail: `${s.customerName}@example.com`,
            leaderNotes: '도움말 데모 — 검수 완료 샘플',
            signatureSecureUrl: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
            signaturePublicId: 'helpdesk/demo-signature',
          },
        });
      }
    }
  }

  return {
    leaderEmail: guideDemoTeamLeaderEmail(),
    inquiryCount: scenarios.length,
    purged,
  };
}
