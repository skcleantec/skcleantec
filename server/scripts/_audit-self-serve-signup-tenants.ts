/**
 * 셀프 가입(/signup) 테넌트 — plan/status/trialEndsAt/모듈 정합성 점검
 * 실행: cd server && npx tsx scripts/_audit-self-serve-signup-tenants.ts
 */
import { prisma } from '../src/lib/prisma.js';
import { modulesForPlan } from '../src/modules/tenants/tenantFeatureCatalog.js';
import { TENANT_SIGNUP_PAID_TRIAL_DAYS } from '../src/modules/platform/tenantSignup.constants.js';
import { resolveTenantBillingOperationalStatus } from '../src/modules/billing/tenantBilling.operationalStatus.js';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

type SignupConfig = {
  source?: string;
  selectedPlan?: string;
  paidTrialDays?: number | null;
};

function readSignupConfig(raw: unknown): SignupConfig | null {
  if (!raw || typeof raw !== 'object') return null;
  const signup = (raw as { signup?: SignupConfig }).signup;
  return signup && typeof signup === 'object' ? signup : null;
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / MS_PER_DAY);
}

async function main() {
  const tenants = await prisma.tenant.findMany({
    where: {
      config: { path: ['signup', 'source'], equals: 'self_serve' },
    },
    select: {
      id: true,
      slug: true,
      plan: true,
      status: true,
      createdAt: true,
      trialEndsAt: true,
      prepaidConfirmedAt: true,
      serviceStartedAt: true,
      billingAccessBlockedAt: true,
      suspendReason: true,
      config: true,
      features: { where: { enabled: true }, select: { moduleId: true } },
      billingProfile: { select: { billingStartDate: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  console.log(`\n=== 셀프 가입 테넌트 점검 (최근 ${tenants.length}건) ===\n`);

  if (tenants.length === 0) {
    console.log('self_serve 가입 테넌트가 없습니다.');
    return;
  }

  let ok = 0;
  let warn = 0;
  let fail = 0;

  for (const t of tenants) {
    const signup = readSignupConfig(t.config);
    const selectedPlan = signup?.selectedPlan ?? t.plan;
    const isPaid = selectedPlan !== 'free';
    const expectedModules = new Set(modulesForPlan(selectedPlan));
    const actualModules = new Set(t.features.map((f) => f.moduleId));
    const issues: string[] = [];

    if (isPaid) {
      if (t.status !== 'TRIAL' && t.status !== 'ACTIVE' && t.status !== 'SUSPENDED') {
        issues.push(`status=${t.status} (유료 가입은 TRIAL/ACTIVE/SUSPENDED 예상)`);
      }
      if (!t.trialEndsAt) issues.push('trialEndsAt 없음');
      if (!t.prepaidConfirmedAt) issues.push('prepaidConfirmedAt 없음');
      if (t.trialEndsAt && t.prepaidConfirmedAt) {
        const trialDays = daysBetween(t.prepaidConfirmedAt, t.trialEndsAt);
        const cfgDays = signup?.paidTrialDays ?? TENANT_SIGNUP_PAID_TRIAL_DAYS;
        if (Math.abs(trialDays - cfgDays) > 1) {
          issues.push(`체험일수 ${trialDays}일 (기대 ${cfgDays}일)`);
        }
      }
    } else {
      if (t.status !== 'ACTIVE' && t.status !== 'SUSPENDED') {
        issues.push(`status=${t.status} (Free는 ACTIVE 예상)`);
      }
      if (t.trialEndsAt) issues.push('Free인데 trialEndsAt 있음');
      if (t.prepaidConfirmedAt) issues.push('Free인데 prepaidConfirmedAt 있음');
    }

    for (const m of expectedModules) {
      if (!actualModules.has(m)) issues.push(`모듈 누락: ${m}`);
    }
    for (const m of actualModules) {
      if (!expectedModules.has(m)) issues.push(`예상 외 모듈: ${m}`);
    }

    const op = resolveTenantBillingOperationalStatus({
      status: t.status,
      suspendReason: t.suspendReason,
      trialEndsAt: t.trialEndsAt,
      prepaidConfirmedAt: t.prepaidConfirmedAt,
      serviceStartedAt: t.serviceStartedAt,
      billingStartDate: t.billingProfile?.billingStartDate ?? null,
      billingAccessBlockedAt: t.billingAccessBlockedAt,
      hasOpenInvoice: false,
      hasOverdueInvoice: false,
    });

    const trialDetailHas7Only =
      op.code === 'TRIAL_PAID' && op.detail === '7일 환불 가능 기간' && isPaid;
    if (trialDetailHas7Only && t.trialEndsAt && t.prepaidConfirmedAt) {
      const d = daysBetween(t.prepaidConfirmedAt, t.trialEndsAt);
      if (d > 7) issues.push(`과금 UI detail이 7일 고정 (${d}일 체험)`);
    }

    const level = issues.length === 0 ? 'OK' : issues.some((i) => i.includes('누락') || i.includes('없음')) ? 'FAIL' : 'WARN';
    if (level === 'OK') ok += 1;
    else if (level === 'FAIL') fail += 1;
    else warn += 1;

    console.log(`[${level}] ${t.slug} plan=${t.plan} status=${t.status} modules=${actualModules.size}`);
    console.log(`       selectedPlan=${selectedPlan} trialEnds=${t.trialEndsAt?.toISOString() ?? 'null'}`);
    if (op.code === 'TRIAL_PAID') console.log(`       billing: ${op.label} — ${op.detail}`);
    if (issues.length) {
      for (const i of issues) console.log(`       ! ${i}`);
    }
    console.log('');
  }

  console.log(`요약: OK=${ok} WARN=${warn} FAIL=${fail} / total=${tenants.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
