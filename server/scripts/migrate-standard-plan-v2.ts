/**
 * Standard 플랜 기능 재배분 마이그레이션 (2026-06)
 *
 * - Premium 전용 기능(파트너·DB·텔레CRM·급여·전자계약) 사용 중인 Standard → Premium 승격
 * - 그 외 Standard → 새 플랜 기본 모듈로 재설정 (광고비 on, 파트너·DB off)
 *
 * 실행:
 *   cd server && npx tsx scripts/migrate-standard-plan-v2.ts          # dry-run
 *   cd server && npx tsx scripts/migrate-standard-plan-v2.ts --apply    # 적용
 */
import '../src/env.js';
import { prisma } from '../src/lib/prisma.js';
import { getEffectiveEnabledModules } from '../src/modules/tenants/tenantFeatures.service.js';
import { resetTenantFeaturesFromPlan } from '../src/modules/platform/tenantProvisioning.service.js';
import { modulesForPlan } from '../src/modules/tenants/tenantFeatureCatalog.js';

const PREMIUM_ONLY_MODULES = [
  'mod_tenant_exchange',
  'mod_telecrm',
  'mod_payroll',
  'mod_e_contract',
] as const;

type MigrationAction = 'upgrade_premium' | 'reset_standard';

type TenantRow = {
  id: string;
  slug: string;
  name: string;
  plan: string;
  status: string;
};

async function premiumUsageSignals(tenantId: string) {
  const [
    partnershipCount,
    dbListingCount,
    telecrmSessionCount,
    telecrmQuoteCount,
    eContractCount,
    payrollBatchCount,
  ] = await Promise.all([
    prisma.tenantPartnership.count({
      where: {
        OR: [{ tenantLowId: tenantId }, { tenantHighId: tenantId }],
        status: { in: ['ACTIVE', 'PENDING', 'SUSPENDED'] },
      },
    }),
    prisma.inquiryDbListing.count({ where: { tenantId } }),
    prisma.telecrmCallSession.count({ where: { tenantId } }),
    prisma.telecrmConsultationQuote.count({ where: { tenantId } }),
    prisma.eContractDefinition.count({ where: { tenantId } }),
    prisma.teamLeaderPayrollPayment.count({ where: { user: { tenantId } } }),
  ]);

  return {
    partnershipCount,
    dbListingCount,
    telecrmSessionCount,
    telecrmQuoteCount,
    eContractCount,
    payrollBatchCount,
  };
}

async function decideAction(tenant: TenantRow): Promise<{
  action: MigrationAction | 'skip';
  reason: string;
  signals?: Awaited<ReturnType<typeof premiumUsageSignals>>;
}> {
  if (tenant.plan !== 'standard') {
    return { action: 'skip', reason: `plan=${tenant.plan}` };
  }

  const [effective, signals] = await Promise.all([
    getEffectiveEnabledModules(tenant.id),
    premiumUsageSignals(tenant.id),
  ]);

  const usesPremiumData =
    signals.partnershipCount > 0 ||
    signals.telecrmSessionCount > 0 ||
    signals.telecrmQuoteCount > 0 ||
    signals.eContractCount > 0 ||
    signals.payrollBatchCount > 0;

  const hasPremiumModuleEffective = PREMIUM_ONLY_MODULES.some((m) => effective.includes(m));

  if (usesPremiumData || hasPremiumModuleEffective) {
    const parts: string[] = [];
    if (signals.partnershipCount > 0) parts.push(`파트너 ${signals.partnershipCount}건`);
    if (signals.telecrmSessionCount > 0) parts.push(`텔레CRM 통화 ${signals.telecrmSessionCount}건`);
    if (signals.telecrmQuoteCount > 0) parts.push(`견적 ${signals.telecrmQuoteCount}건`);
    if (signals.eContractCount > 0) parts.push(`전자계약 ${signals.eContractCount}건`);
    if (signals.payrollBatchCount > 0) parts.push(`급여지급 ${signals.payrollBatchCount}건`);
    if (parts.length === 0 && hasPremiumModuleEffective) {
      parts.push(`Premium 모듈 활성: ${PREMIUM_ONLY_MODULES.filter((m) => effective.includes(m)).join(', ')}`);
    }
    return {
      action: 'upgrade_premium',
      reason: parts.join(' · ') || 'Premium 기능 사용',
      signals,
    };
  }

  return { action: 'reset_standard', reason: '새 Standard 기본 모듈 적용' };
}

async function applyPlanUpdatedAt(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { config: true },
  });
  const config = (tenant?.config ?? {}) as Record<string, unknown>;
  const subscription = (config.subscription ?? {}) as Record<string, unknown>;
  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      config: {
        ...config,
        subscription: {
          ...subscription,
          planUpdatedAt: new Date().toISOString(),
          planMigration: 'standard-plan-v2-20260623',
        },
      },
    },
  });
}

async function main() {
  const apply = process.argv.includes('--apply');
  console.log(`=== Standard 플랜 v2 마이그레이션 (${apply ? 'APPLY' : 'DRY-RUN'}) ===\n`);

  const tenants = await prisma.tenant.findMany({
    select: { id: true, slug: true, name: true, plan: true, status: true },
    orderBy: { slug: 'asc' },
  });

  let upgraded = 0;
  let resetStandard = 0;
  let syncedOther = 0;
  let skipped = 0;

  for (const tenant of tenants) {
    const decision = await decideAction(tenant);

    if (decision.action === 'skip') {
      if (apply) {
        console.log(`[${tenant.slug}] plan=${tenant.plan} → 플랜 기본 모듈 동기화`);
        await resetTenantFeaturesFromPlan(tenant.id);
        await applyPlanUpdatedAt(tenant.id);
        syncedOther += 1;
      } else {
        console.log(`[${tenant.slug}] plan=${tenant.plan} → 동기화 예정 (Standard 외)`);
        syncedOther += 1;
      }
      skipped += 1;
      continue;
    }

    const before = await getEffectiveEnabledModules(tenant.id);
    console.log(`[${tenant.slug}] ${tenant.name} (${tenant.status})`);
    console.log(`  → ${decision.action}: ${decision.reason}`);

    if (apply) {
      if (decision.action === 'upgrade_premium') {
        await prisma.tenant.update({
          where: { id: tenant.id },
          data: { plan: 'premium' },
        });
        await resetTenantFeaturesFromPlan(tenant.id);
        await applyPlanUpdatedAt(tenant.id);
        upgraded += 1;
      } else {
        await resetTenantFeaturesFromPlan(tenant.id);
        await applyPlanUpdatedAt(tenant.id);
        resetStandard += 1;
      }
    } else {
      if (decision.action === 'upgrade_premium') upgraded += 1;
      else resetStandard += 1;
    }

    const afterPlan = decision.action === 'upgrade_premium' ? 'premium' : tenant.plan;
    const afterModules = modulesForPlan(afterPlan);
    const removed = PREMIUM_ONLY_MODULES.filter(
      (m) => before.includes(m) && !afterModules.includes(m),
    );
    const added = afterModules.filter((m) => !before.includes(m));
    if (removed.length) console.log(`  제거 예정: ${removed.join(', ')}`);
    if (added.length) console.log(`  추가 예정: ${added.join(', ')}`);
    console.log('');
  }

  console.log('--- 요약 ---');
  console.log(`Premium 승격: ${upgraded}`);
  console.log(`Standard 재설정: ${resetStandard}`);
  console.log(`기타 플랜 동기화: ${syncedOther}`);
  console.log(`처리 대상(전체): ${tenants.length}`);
  if (!apply) {
    console.log('\n적용하려면: npx tsx scripts/migrate-standard-plan-v2.ts --apply');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
