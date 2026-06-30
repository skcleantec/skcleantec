/**
 * Phase 4 — Premium (A14~A16): 광고비 · 급여·정산 · 전자계약
 */
import {
  EContractAudience,
  EContractIssuanceStatus,
  EContractVersionStatus,
  type PrismaClient,
} from '@prisma/client';
import { ensureDefaultAdChannelsForTenant } from '../src/modules/advertising/defaultAdChannels.js';
import { computeEContractContentHash } from '../src/modules/e-contract/eContract.contentHash.js';
import { ensureDefaultFieldDefinitions } from '../src/modules/e-contract/eContractFieldDefinition.service.js';
import {
  addDaysToKstYmd,
  kstTodayYmd,
} from '../src/modules/inquiries/inquiryListDateRange.js';
import { DEFAULT_TENANT_ID } from '../src/modules/tenants/tenant.constants.js';
import {
  GUIDE_DEMO_ECONTRACT_DEF_ID,
  GUIDE_DEMO_ECONTRACT_VERSION_ID,
  GUIDE_DEMO_MARKETER_EMAIL,
  GUIDE_DEMO_PREMIUM_TAG,
  guideDemoAdSessionId,
  guideDemoEContractIssuanceId,
  guideDemoEContractSubmissionId,
  guideDemoEContractToken,
  guideDemoPayrollMonthAdjustId,
  guideDemoPayrollSettlementId,
} from './guide-demo/constants.js';
import { purgeGuideDemoPremiumSeed } from './guide-demo/purge.js';
import { TEAM_HELPDESK_LEADER_EMAIL } from './seed-team-helpdesk-cbiseo.logic.js';

const DEMO_ECONTRACT_BODY = `# 가이드 데모 · 팀원 근로계약서

본 계약은 SK클린텍 현장 팀원 [[EC_SIGNER_NAME]]님과 체결하는 샘플 문서입니다.

- 근무: 청소 현장 투입
- 급여: 건별 일당 (별도 급여표 참고)

[[EC_SIGNATURE]]
[[EC_CONTRACT_DATE]]
`;

function kstDateTime(dayOffset: number, hour = 18, minute = 0): Date {
  const ymd = addDaysToKstYmd(kstTodayYmd(), dayOffset);
  return new Date(`${ymd}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00+09:00`);
}

async function ensurePremiumModules(prisma: PrismaClient): Promise<void> {
  for (const moduleId of ['mod_advertising', 'mod_payroll', 'mod_e_contract'] as const) {
    await prisma.tenantFeature.upsert({
      where: { tenantId_moduleId: { tenantId: DEFAULT_TENANT_ID, moduleId } },
      update: { enabled: true },
      create: { tenantId: DEFAULT_TENANT_ID, moduleId, enabled: true },
    });
  }
}

async function seedAdvertising(
  prisma: PrismaClient,
  marketerId: string,
  adminId: string,
): Promise<{ sessionCount: number; spendLineCount: number }> {
  await ensureDefaultAdChannelsForTenant(prisma, DEFAULT_TENANT_ID);

  const channels = await prisma.adChannel.findMany({
    where: { tenantId: DEFAULT_TENANT_ID, name: { in: ['네이버', '인스타그램', '배너'] } },
    select: { id: true, name: true },
  });
  const channelByName = new Map(channels.map((c) => [c.name, c.id]));
  const naverId = channelByName.get('네이버');
  const instaId = channelByName.get('인스타그램');
  const bannerId = channelByName.get('배너');
  if (!naverId || !instaId || !bannerId) {
    throw new Error('기본 광고 채널(네이버·인스타그램·배너)이 없습니다.');
  }

  const session1Start = kstDateTime(-5, 9, 0);
  const session1End = kstDateTime(-5, 17, 30);
  const session2Start = kstDateTime(-2, 10, 0);
  const session2End = kstDateTime(-2, 16, 0);
  const session3Start = kstDateTime(-1, 14, 0);
  const session3End = kstDateTime(-1, 18, 0);

  await prisma.adWorkSession.create({
    data: {
      id: guideDemoAdSessionId(1),
      tenantId: DEFAULT_TENANT_ID,
      userId: marketerId,
      startedAt: session1Start,
      endedAt: session1End,
      bookingDenominatorCount: 12,
      bookingDenominatorManual: false,
      spendLines: {
        create: [
          { channelId: naverId, amount: 185_000, soomgoReceivedCount: 8 },
          { channelId: instaId, amount: 92_000 },
        ],
      },
    },
  });

  await prisma.adWorkSession.create({
    data: {
      id: guideDemoAdSessionId(2),
      tenantId: DEFAULT_TENANT_ID,
      userId: marketerId,
      startedAt: session2Start,
      endedAt: session2End,
      bookingDenominatorCount: 6,
      spendLines: {
        create: [{ channelId: bannerId, amount: 55_000 }],
      },
    },
  });

  await prisma.adWorkSession.create({
    data: {
      id: guideDemoAdSessionId(3),
      tenantId: DEFAULT_TENANT_ID,
      userId: adminId,
      startedAt: session3Start,
      endedAt: session3End,
      bookingDenominatorCount: 4,
      spendLines: {
        create: [{ channelId: naverId, amount: 40_000 }],
      },
    },
  });

  return { sessionCount: 3, spendLineCount: 4 };
}

async function seedPayroll(
  prisma: PrismaClient,
  adminId: string,
  teamMemberIds: { minsSu: string; jiHyun: string },
  marketerId: string,
): Promise<{ teamSettlements: number; marketerSettlements: number }> {
  const monthKey = kstTodayYmd().slice(0, 7);

  await prisma.teamMemberPayrollMonthAdjust.upsert({
    where: {
      teamMemberId_monthKey: { teamMemberId: teamMemberIds.minsSu, monthKey },
    },
    update: { extraWorkDays: 2 },
    create: {
      id: guideDemoPayrollMonthAdjustId(),
      teamMemberId: teamMemberIds.minsSu,
      monthKey,
      extraWorkDays: 2,
    },
  });

  await prisma.teamMemberPayrollSettlement.create({
    data: {
      id: guideDemoPayrollSettlementId(1),
      teamMemberId: teamMemberIds.minsSu,
      monthKey,
      amount: 1_950_000,
      actorId: adminId,
      settledAt: kstDateTime(0, 11, 0),
    },
  });

  await prisma.teamMemberPayrollSettlement.create({
    data: {
      id: guideDemoPayrollSettlementId(2),
      teamMemberId: teamMemberIds.jiHyun,
      monthKey,
      amount: 1_620_000,
      actorId: adminId,
      settledAt: kstDateTime(-1, 15, 30),
    },
  });

  await prisma.user.update({
    where: { id: marketerId },
    data: { payrollMonthlySalary: 2_800_000 },
  });

  await prisma.marketerPayrollSettlement.create({
    data: {
      id: guideDemoPayrollSettlementId(3),
      userId: marketerId,
      monthKey,
      openingCarryForward: 0,
      scheduledMonthlySalary: 2_800_000,
      settledAmount: 2_800_000,
      memo: `${GUIDE_DEMO_PREMIUM_TAG} 이번 달 정산 샘플`,
      actorId: adminId,
      settledAt: kstDateTime(0, 10, 0),
    },
  });

  return { teamSettlements: 2, marketerSettlements: 1 };
}

async function seedEContract(
  prisma: PrismaClient,
  adminId: string,
  teamMembers: { minsSu: string; jiHyun: string; taeHo: string },
): Promise<{ issuanceCount: number }> {
  await ensureDefaultFieldDefinitions(DEFAULT_TENANT_ID, EContractAudience.TEAM_MEMBER);

  const title = '가이드 데모 · 팀원 근로계약서';
  const bodyDisplayHtml = DEMO_ECONTRACT_BODY.replace(/\r\n/g, '\n');
  const contentHash = computeEContractContentHash({
    publishedOrdinal: 1,
    titleSnapshot: title,
    bodyCanonical: bodyDisplayHtml,
    schema: 'display_v2',
  });
  const publishedAt = kstDateTime(-7, 10, 0);

  await prisma.eContractDefinition.create({
    data: {
      id: GUIDE_DEMO_ECONTRACT_DEF_ID,
      tenantId: DEFAULT_TENANT_ID,
      title,
      description: `${GUIDE_DEMO_PREMIUM_TAG} 팀원 체결 데모`,
      audience: EContractAudience.TEAM_MEMBER,
      createdById: adminId,
    },
  });

  await prisma.eContractVersion.create({
    data: {
      id: GUIDE_DEMO_ECONTRACT_VERSION_ID,
      definitionId: GUIDE_DEMO_ECONTRACT_DEF_ID,
      status: EContractVersionStatus.PUBLISHED,
      publishedOrdinal: 1,
      titleSnapshot: title,
      bodyMarkdown: DEMO_ECONTRACT_BODY,
      bodyDisplayHtml,
      contentHash,
      publishedAt,
      publishedById: adminId,
    },
  });

  await prisma.eContractIssuance.create({
    data: {
      id: guideDemoEContractIssuanceId(1),
      token: guideDemoEContractToken(1),
      definitionId: GUIDE_DEMO_ECONTRACT_DEF_ID,
      versionId: GUIDE_DEMO_ECONTRACT_VERSION_ID,
      teamMemberId: teamMembers.minsSu,
      recipientLabel: '민수',
      status: EContractIssuanceStatus.PENDING,
      notes: `${GUIDE_DEMO_PREMIUM_TAG} 서명 대기`,
      createdAt: kstDateTime(-2, 9, 0),
    },
  });

  await prisma.eContractIssuance.create({
    data: {
      id: guideDemoEContractIssuanceId(2),
      token: guideDemoEContractToken(2),
      definitionId: GUIDE_DEMO_ECONTRACT_DEF_ID,
      versionId: GUIDE_DEMO_ECONTRACT_VERSION_ID,
      teamMemberId: teamMembers.jiHyun,
      recipientLabel: '지현',
      status: EContractIssuanceStatus.OPENED,
      notes: `${GUIDE_DEMO_PREMIUM_TAG} 열람 완료`,
      createdAt: kstDateTime(-3, 14, 0),
    },
  });

  const signedIssuanceId = guideDemoEContractIssuanceId(3);
  await prisma.eContractIssuance.create({
    data: {
      id: signedIssuanceId,
      token: guideDemoEContractToken(3),
      definitionId: GUIDE_DEMO_ECONTRACT_DEF_ID,
      versionId: GUIDE_DEMO_ECONTRACT_VERSION_ID,
      teamMemberId: teamMembers.taeHo,
      recipientLabel: '태호',
      status: EContractIssuanceStatus.SIGNED,
      notes: `${GUIDE_DEMO_PREMIUM_TAG} 체결 완료`,
      createdAt: kstDateTime(-5, 11, 0),
    },
  });

  await prisma.eContractSubmission.create({
    data: {
      id: guideDemoEContractSubmissionId(),
      issuanceId: signedIssuanceId,
      versionId: GUIDE_DEMO_ECONTRACT_VERSION_ID,
      signedAt: kstDateTime(-4, 16, 20),
      versionContentHash: contentHash,
      payload: {
        '[[EC_SIGNER_NAME]]': '태호',
        '[[EC_SIGNER_PHONE]]': '010-7000-1002',
      },
      mergedContractHtml: bodyDisplayHtml.replace('[[EC_SIGNER_NAME]]', '태호'),
    },
  });

  return { issuanceCount: 3 };
}

export function guideDemoPremiumUrls(baseUrl = 'https://cbiseo.com'): {
  label: string;
  url: string;
}[] {
  return [
    { label: '전자계약 · 서명 대기', url: `${baseUrl}/e-contract/sign/${guideDemoEContractToken(1)}?tenant=sk` },
    { label: '전자계약 · 열람 완료', url: `${baseUrl}/e-contract/sign/${guideDemoEContractToken(2)}?tenant=sk` },
    { label: '전자계약 · 체결 완료', url: `${baseUrl}/e-contract/sign/${guideDemoEContractToken(3)}?tenant=sk` },
  ];
}

export async function runGuideDemoPremiumSeed(
  prisma: PrismaClient,
): Promise<{
  purged: Record<string, number>;
  advertising: { sessionCount: number; spendLineCount: number };
  payroll: { teamSettlements: number; marketerSettlements: number; monthKey: string };
  eContract: { issuanceCount: number };
  premiumUrls: ReturnType<typeof guideDemoPremiumUrls>;
}> {
  const purged = await purgeGuideDemoPremiumSeed(prisma);
  await ensurePremiumModules(prisma);

  const admin = await prisma.user.findFirst({
    where: { tenantId: DEFAULT_TENANT_ID, role: 'ADMIN', isActive: true },
    orderBy: { createdAt: 'asc' },
  });
  if (!admin) throw new Error('ADMIN 계정이 없습니다.');

  const marketer =
    (await prisma.user.findFirst({
      where: { tenantId: DEFAULT_TENANT_ID, email: GUIDE_DEMO_MARKETER_EMAIL, isActive: true },
    })) ??
    (await prisma.user.findFirst({
      where: { tenantId: DEFAULT_TENANT_ID, role: 'MARKETER', isActive: true },
    }));
  if (!marketer) throw new Error('마케터 계정이 없습니다.');

  const leader = await prisma.user.findFirst({
    where: { tenantId: DEFAULT_TENANT_ID, email: TEAM_HELPDESK_LEADER_EMAIL, isActive: true },
  });
  if (!leader) {
    throw new Error('cbiseo 팀장 계정이 없습니다. --phase=team 을 먼저 실행하세요.');
  }

  const team = await prisma.team.findUnique({ where: { teamLeaderId: leader.id } });
  if (!team) throw new Error('cbiseo 팀이 없습니다. --phase=team 을 먼저 실행하세요.');

  const members = await prisma.teamMember.findMany({
    where: { tenantId: DEFAULT_TENANT_ID, teamId: team.id, isActive: true },
    select: { id: true, name: true },
  });
  const byName = new Map(members.map((m) => [m.name, m.id]));
  const minsSu = byName.get('민수');
  const jiHyun = byName.get('지현');
  const taeHo = byName.get('태호');
  if (!minsSu || !jiHyun || !taeHo) {
    throw new Error('cbiseo 팀원(민수·지현·태호)이 필요합니다. --phase=team 을 먼저 실행하세요.');
  }

  const monthKey = kstTodayYmd().slice(0, 7);

  const advertising = await seedAdvertising(prisma, marketer.id, admin.id);
  const payroll = await seedPayroll(
    prisma,
    admin.id,
    { minsSu, jiHyun },
    marketer.id,
  );
  const eContract = await seedEContract(prisma, admin.id, { minsSu, jiHyun, taeHo });

  return {
    purged,
    advertising,
    payroll: { ...payroll, monthKey },
    eContract,
    premiumUrls: guideDemoPremiumUrls(),
  };
}
