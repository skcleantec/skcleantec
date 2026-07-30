/**
 * 셀프 가입 테넌트 coinGraceEndsAt 백필 (Free·유료 공통, 가입일 + 60일)
 * 실행: cd server && npx tsx scripts/_backfill-signup-coin-grace.ts
 *       cd server && npx tsx scripts/_backfill-signup-coin-grace.ts --apply
 */
import { prisma } from '../src/lib/prisma.js';
import { addDaysUtc } from '../src/modules/billing/tenantBilling.dates.js';
import { TENANT_SIGNUP_GRACE_DAYS } from '../src/modules/platform/tenantSignup.constants.js';
import { readSignupCoinGraceEndsAt } from '../src/modules/tenants/tenantSignupGrace.js';

const apply = process.argv.includes('--apply');

async function main() {
  const tenants = await prisma.tenant.findMany({
    where: {
      config: { path: ['signup', 'source'], equals: 'self_serve' },
    },
    select: {
      id: true,
      slug: true,
      plan: true,
      createdAt: true,
      trialEndsAt: true,
      config: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`\n=== coinGraceEndsAt 백필 (${apply ? 'APPLY' : 'DRY-RUN'}) — ${tenants.length}건 ===\n`);

  let skipped = 0;
  let updated = 0;

  for (const t of tenants) {
    const existing = readSignupCoinGraceEndsAt(t.config);
    if (existing) {
      skipped += 1;
      continue;
    }

    const graceEndsAt = t.trialEndsAt ?? addDaysUtc(t.createdAt, TENANT_SIGNUP_GRACE_DAYS);
    const prevConfig =
      t.config && typeof t.config === 'object' ? (t.config as Record<string, unknown>) : {};
    const prevSignup =
      prevConfig.signup && typeof prevConfig.signup === 'object'
        ? (prevConfig.signup as Record<string, unknown>)
        : {};

    console.log(
      `[${apply ? 'UPDATE' : 'WOULD'}] ${t.slug} plan=${t.plan} graceEndsAt=${graceEndsAt.toISOString()}`,
    );

    if (apply) {
      await prisma.tenant.update({
        where: { id: t.id },
        data: {
          config: {
            ...prevConfig,
            signup: {
              ...prevSignup,
              signupGraceDays: TENANT_SIGNUP_GRACE_DAYS,
              coinGraceEndsAt: graceEndsAt.toISOString(),
            },
          },
        },
      });
    }
    updated += 1;
  }

  console.log(`\n요약: skip=${skipped} update=${updated} total=${tenants.length}\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
