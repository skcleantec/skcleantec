/**
 * Phase 2 — 크루 현장 일정 (C1~C3)
 */
import bcrypt from 'bcryptjs';
import type { PrismaClient } from '@prisma/client';
import { allocateNextInquiryNumber } from '../src/modules/inquiries/inquiryNumber.js';
import { addDaysToKstYmd, kstTodayYmd } from '../src/modules/inquiries/inquiryListDateRange.js';
import { getDefaultOperatingCompanyId } from '../src/modules/operating-companies/operatingCompany.service.js';
import { guideDemoTenantId, guideDemoTeamLeaderEmail } from './guide-demo/tenantScope.js';
import {
  GUIDE_DEMO_CREW_GROUP_ID,
  GUIDE_DEMO_CREW_LOGIN_ID,
  GUIDE_DEMO_TAG,
  guideDemoCrewInquiryId,
} from './guide-demo/constants.js';
import { purgeGuideDemoCrewSeed } from './guide-demo/purge.js';

function kstNoon(dayOffset: number): Date {
  const ymd = addDaysToKstYmd(kstTodayYmd(), dayOffset);
  return new Date(`${ymd}T12:00:00+09:00`);
}

export async function runGuideDemoCrewSeed(
  prisma: PrismaClient,
  opts?: { password?: string },
): Promise<{ purged: number; inquiryCount: number; crewLoginId: string }> {
  const purged = await purgeGuideDemoCrewSeed(prisma);
  const password = opts?.password ?? '1234';

  const leader = await prisma.user.findFirst({
    where: { tenantId: guideDemoTenantId(), email: guideDemoTeamLeaderEmail(), isActive: true },
  });
  if (!leader) {
    throw new Error('cbiseo 팀장 계정이 없습니다. team phase를 먼저 실행하세요.');
  }

  const team = await prisma.team.findUnique({ where: { teamLeaderId: leader.id } });
  if (!team) throw new Error('cbiseo 팀이 없습니다.');

  const members = await prisma.teamMember.findMany({
    where: { tenantId: guideDemoTenantId(), teamId: team.id, isActive: true },
    orderBy: { sortOrder: 'asc' },
    take: 3,
  });
  if (members.length < 2) {
    throw new Error('cbiseo 팀원이 2명 이상 필요합니다.');
  }

  const hash = await bcrypt.hash(password, 10);
  await prisma.teamCrewGroup.upsert({
    where: { id: GUIDE_DEMO_CREW_GROUP_ID },
    update: {
      name: '가이드데모 크루',
      loginId: GUIDE_DEMO_CREW_LOGIN_ID,
      passwordHash: hash,
      isActive: true,
      availabilityMode: 'ROSTER',
    },
    create: {
      id: GUIDE_DEMO_CREW_GROUP_ID,
      tenantId: guideDemoTenantId(),
      name: '가이드데모 크루',
      loginId: GUIDE_DEMO_CREW_LOGIN_ID,
      passwordHash: hash,
      isActive: true,
      availabilityMode: 'ROSTER',
    },
  });

  for (let i = 0; i < members.length; i += 1) {
    const m = members[i]!;
    await prisma.teamCrewGroupMember.upsert({
      where: { groupId_teamMemberId: { groupId: GUIDE_DEMO_CREW_GROUP_ID, teamMemberId: m.id } },
      update: { isGroupLeader: i === 0 },
      create: {
        groupId: GUIDE_DEMO_CREW_GROUP_ID,
        teamMemberId: m.id,
        isGroupLeader: i === 0,
      },
    });
  }

  const todayYmd = kstTodayYmd();
  const todayDate = new Date(`${todayYmd}T12:00:00+09:00`);
  for (const m of members.slice(0, 2)) {
    await prisma.teamCrewGroupDayRoster.upsert({
      where: {
        groupId_date_teamMemberId: {
          groupId: GUIDE_DEMO_CREW_GROUP_ID,
          date: todayDate,
          teamMemberId: m.id,
        },
      },
      update: { isStandby: false },
      create: {
        groupId: GUIDE_DEMO_CREW_GROUP_ID,
        date: todayDate,
        teamMemberId: m.id,
        isStandby: false,
      },
    });
  }

  const admin = await prisma.user.findFirst({
    where: { tenantId: guideDemoTenantId(), role: 'ADMIN', isActive: true },
    orderBy: { createdAt: 'asc' },
  });
  if (!admin) throw new Error('ADMIN 계정이 없습니다.');

  const operatingCompanyId = await getDefaultOperatingCompanyId(prisma, guideDemoTenantId());
  const crewNames = members.slice(0, 2).map((m) => m.name).join('·');

  const scenarios = [
    {
      id: guideDemoCrewInquiryId(1),
      code: 'C1',
      label: '오늘·미팅 09:00',
      customerName: '크루현장1',
      crewMeetingTime: '09:00',
      cleaningBefore: 0,
      cleaningAfter: 0,
    },
    {
      id: guideDemoCrewInquiryId(2),
      code: 'C2',
      label: '오늘·전사진만',
      customerName: '크루현장2',
      crewMeetingTime: '13:00',
      cleaningBefore: 1,
      cleaningAfter: 0,
    },
  ] as const;

  for (const s of scenarios) {
    const preferredDate = kstNoon(0);
    const phoneSuffix = s.id.slice(-4);
    await prisma.$transaction(async (tx) => {
      const inquiryNumber = await allocateNextInquiryNumber(tx, guideDemoTenantId());
      await tx.inquiry.create({
        data: {
          id: s.id,
          tenantId: guideDemoTenantId(),
          operatingCompanyId,
          inquiryNumber,
          customerName: s.customerName,
          customerPhone: `010-6${phoneSuffix.slice(0, 3)}-${phoneSuffix.slice(1)}`,
          address: '서울 송파구 올림픽로 300',
          addressDetail: `${s.code} · ${s.label}`,
          areaPyeong: 30,
          propertyType: '아파트',
          roomCount: 3,
          bathroomCount: 2,
          kitchenCount: 1,
          preferredDate,
          preferredTime: '오전',
          preferredTimeDetail: '09:00~12:00',
          memo: `${GUIDE_DEMO_TAG} 크루 ${s.code} ${s.label}`,
          status: 'IN_PROGRESS',
          source: '전화',
          createdById: admin.id,
          serviceTotalAmount: 550_000,
          serviceDepositAmount: 200_000,
          serviceBalanceAmount: 350_000,
          crewMemberCount: 2,
          crewMemberNote: crewNames,
          crewMeetingTime: s.crewMeetingTime,
          crewMeetingTimeShared: true,
        },
      });
      await tx.assignment.create({
        data: {
          tenantId: guideDemoTenantId(),
          inquiryId: s.id,
          teamLeaderId: leader.id,
          assignedById: admin.id,
          sortOrder: 0,
        },
      });
      if (s.cleaningBefore > 0) {
        await tx.inquiryCleaningPhoto.create({
          data: {
            inquiryId: s.id,
            phase: 'BEFORE',
            cloudinaryPublicId: `guide-demo/crew-${s.code}-before`,
            secureUrl: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
            uploadedById: admin.id,
          },
        });
      }
    });
  }

  return {
    purged,
    inquiryCount: scenarios.length,
    crewLoginId: GUIDE_DEMO_CREW_LOGIN_ID,
  };
}
