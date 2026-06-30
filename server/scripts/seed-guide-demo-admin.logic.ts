/**
 * cbiseo 가이드 데모 — 관리자 Phase 1 (A1~A8)
 */
import type { PrismaClient } from '@prisma/client';
import { ORDER_FORM_PENDING_PLACEHOLDER_ADDRESS } from '../src/lib/orderFormPendingAddress.js';
import { allocateNextInquiryNumber } from '../src/modules/inquiries/inquiryNumber.js';
import { addDaysToKstYmd, kstTodayYmd } from '../src/modules/inquiries/inquiryListDateRange.js';
import { getDefaultOperatingCompanyId } from '../src/modules/operating-companies/operatingCompany.service.js';
import { guideDemoTenantId, guideDemoTeamLeaderEmail, resolveGuideDemoLeaderEmail } from './guide-demo/tenantScope.js';
import {
  GUIDE_DEMO_MARKETER_EMAIL,
  GUIDE_DEMO_TAG,
} from './guide-demo/constants.js';
import { purgeGuideDemoAdminSeed } from './guide-demo/purge.js';
import {
  buildAdminFollowupScenarios,
  buildAdminInquiryScenarios,
  type GuideDemoInquiryScenario,
} from './guide-demo/scenarios.admin.js';

function kstNoon(dayOffset: number): Date {
  const ymd = addDaysToKstYmd(kstTodayYmd(), dayOffset);
  return new Date(`${ymd}T12:00:00+09:00`);
}

function kstYmd(dayOffset: number): string {
  return addDaysToKstYmd(kstTodayYmd(), dayOffset);
}

function phoneForScenario(id: string): string {
  const tail = id.replace(/\D/g, '').slice(-4).padStart(4, '0');
  return `010-8${tail.slice(0, 3)}-${tail.slice(1)}`;
}

type SeedContext = {
  tenantId: string;
  operatingCompanyId: string | null;
  adminId: string;
  marketerId: string;
  leaderByEmail: Map<string, string>;
  todayYmd: string;
};

async function resolveSeedContext(prisma: PrismaClient): Promise<SeedContext> {
  const admin = await prisma.user.findFirst({
    where: { tenantId: guideDemoTenantId(), role: 'ADMIN', isActive: true },
    orderBy: { createdAt: 'asc' },
  });
  if (!admin) throw new Error('SK클린텍 ADMIN 계정이 없습니다. npm run db:seed 를 먼저 실행하세요.');

  const marketer =
    (await prisma.user.findFirst({
      where: { tenantId: guideDemoTenantId(), email: GUIDE_DEMO_MARKETER_EMAIL, isActive: true },
    })) ??
    (await prisma.user.findFirst({
      where: { tenantId: guideDemoTenantId(), role: 'MARKETER', isActive: true },
    }));
  if (!marketer) throw new Error('마케터 계정이 없습니다.');

  const leaders = await prisma.user.findMany({
    where: { tenantId: guideDemoTenantId(), role: 'TEAM_LEADER', isActive: true },
    select: { id: true, email: true },
  });
  const leaderByEmail = new Map(leaders.map((l) => [l.email.toLowerCase(), l.id]));
  for (const l of leaders) {
    if (!leaderByEmail.has(l.email)) leaderByEmail.set(l.email, l.id);
  }
  const primaryLeader = leaders.find((l) => l.email === guideDemoTeamLeaderEmail());
  if (primaryLeader) leaderByEmail.set('cbiseo', primaryLeader.id);

  const operatingCompanyId = await getDefaultOperatingCompanyId(prisma, guideDemoTenantId());

  return {
    tenantId: guideDemoTenantId(),
    operatingCompanyId,
    adminId: admin.id,
    marketerId: marketer.id,
    leaderByEmail,
    todayYmd: kstTodayYmd(),
  };
}

async function seedInquiryScenario(
  prisma: PrismaClient,
  ctx: SeedContext,
  s: GuideDemoInquiryScenario,
): Promise<void> {
  const createdById = s.registrar === 'marketer' ? ctx.marketerId : ctx.adminId;
  const createdAt = kstNoon(s.createdDayOffset);
  const preferredDate = kstNoon(s.preferredDayOffset);
  const total = s.serviceTotalAmount ?? s.areaPyeong * 18_000;
  const deposit = 200_000;
  const balance = Math.max(0, total - deposit);
  const phone = phoneForScenario(s.id);
  const memo = `${GUIDE_DEMO_TAG} ${s.code} ${s.label}`;

  await prisma.$transaction(async (tx) => {
    let orderFormId: string | undefined;

    if (s.orderForm && s.orderToken) {
      const preferredDateStr = kstYmd(s.preferredDayOffset);
      const form = await tx.orderForm.create({
        data: {
          tenantId: ctx.tenantId,
          operatingCompanyId: ctx.operatingCompanyId,
          token: s.orderToken,
          customerName: s.customerName,
          customerPhone: phone,
          totalAmount: total,
          depositAmount: deposit,
          balanceAmount: balance,
          preferredDate: preferredDateStr,
          preferredTime: s.preferredTime,
          preferredTimeDetail: `${s.preferredTime} 희망`,
          areaPyeong: s.areaPyeong,
          areaBasis: '전용',
          createdById,
          createdAt,
          submittedAt: s.orderForm === 'submitted' ? createdAt : null,
        },
      });
      orderFormId = form.id;
    }

    const inquiryNumber = await allocateNextInquiryNumber(tx, ctx.tenantId);
    const address =
      s.orderForm === 'pending' ? ORDER_FORM_PENDING_PLACEHOLDER_ADDRESS : s.address;

    await tx.inquiry.create({
      data: {
        id: s.id,
        tenantId: ctx.tenantId,
        operatingCompanyId: ctx.operatingCompanyId,
        inquiryNumber,
        customerName: s.customerName,
        customerPhone: phone,
        customerEmail: `${s.customerName.replace(/\s/g, '')}@demo.example.com`,
        address,
        addressDetail: s.addressDetail ?? `${s.code} · ${s.label}`,
        areaPyeong: s.areaPyeong,
        areaBasis: '전용',
        propertyType: s.propertyType,
        roomCount: s.propertyType.includes('오피스텔') ? 1 : 3,
        bathroomCount: s.propertyType.includes('오피스텔') ? 1 : 2,
        kitchenCount: 1,
        preferredDate,
        preferredTime: s.preferredTime,
        preferredTimeDetail: `${s.preferredTime} 희망`,
        callAttempt: 1,
        memo,
        scheduleMemo: s.label,
        specialNotes: `가이드 데모 — ${s.label}. KST 기준일 ${ctx.todayYmd}.`,
        status: s.status,
        source: s.orderForm ? '발주서' : '전화',
        createdById,
        createdAt,
        orderFormId,
        serviceTotalAmount: total,
        serviceDepositAmount: deposit,
        serviceBalanceAmount: balance,
        externalTransferFee: s.externalTransferFee ?? null,
      },
    });

    if (s.teamLeaderEmails?.length) {
      for (let i = 0; i < s.teamLeaderEmails.length; i += 1) {
        const email = s.teamLeaderEmails[i]!;
        const teamLeaderId = leaderByEmailLookup(ctx, email);
        if (!teamLeaderId) continue;
        await tx.assignment.create({
          data: {
            tenantId: ctx.tenantId,
            inquiryId: s.id,
            teamLeaderId,
            assignedById: ctx.adminId,
            assignedAt: createdAt,
            sortOrder: i,
          },
        });
      }
    }

    if (s.withChangeLog) {
      const beforeYmd = kstYmd(s.preferredDayOffset - 2);
      const afterYmd = kstYmd(s.preferredDayOffset);
      await tx.inquiryChangeLog.create({
        data: {
          inquiryId: s.id,
          customerName: s.customerName,
          actorId: ctx.adminId,
          lines: [
            `청소 희망일: ${beforeYmd} → ${afterYmd}`,
            `총액: ${(total - 50_000).toLocaleString('ko-KR')}원 → ${total.toLocaleString('ko-KR')}원`,
          ],
        },
      });
    }
  });
}

function leaderByEmailLookup(ctx: SeedContext, email: string): string | undefined {
  const resolved = resolveGuideDemoLeaderEmail(email);
  return ctx.leaderByEmail.get(resolved.toLowerCase()) ?? ctx.leaderByEmail.get(resolved);
}

export async function runGuideDemoAdminSeed(
  prisma: PrismaClient,
  opts?: { skipPurge?: boolean },
): Promise<{
  purged: { inquiries: number; orderForms: number; followups: number };
  inquiryCount: number;
  followupCount: number;
}> {
  const purged = opts?.skipPurge ? { inquiries: 0, orderForms: 0, followups: 0 } : await purgeGuideDemoAdminSeed(prisma);
  const ctx = await resolveSeedContext(prisma);

  const inquiryScenarios = buildAdminInquiryScenarios();
  for (const s of inquiryScenarios) {
    await seedInquiryScenario(prisma, ctx, s);
  }

  const followupScenarios = buildAdminFollowupScenarios();
  for (const f of followupScenarios) {
    await prisma.orderFollowup.create({
      data: {
        id: f.id,
        tenantId: ctx.tenantId,
        customerName: f.customerName,
        customerPhone: f.customerPhone,
        status: f.status,
        deferCount: f.deferCount ?? 0,
        goldDb: f.goldDb ?? false,
        preferredMoveInCleaningDate: f.preferredMoveInCleaningDate ?? null,
        memo: `${GUIDE_DEMO_TAG} ${f.code} ${f.label}`,
        createdById: ctx.adminId,
        createdAt: kstNoon(f.createdDayOffset),
      },
    });
  }

  return {
    purged,
    inquiryCount: inquiryScenarios.length,
    followupCount: followupScenarios.length,
  };
}
