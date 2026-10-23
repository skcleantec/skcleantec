import { prisma } from '../../lib/prisma.js';
import { DEFAULT_PLATFORM_CARD_COST_BPS, DEFAULT_TENANT_CARD_FEE_BPS } from './cardPaymentFee.js';

export async function getPlatformCardFeeRates() {
  const row = await prisma.platformCardPaymentSettings.upsert({
    where: { id: 'default' },
    create: {
      id: 'default',
      tenantFeeBps: DEFAULT_TENANT_CARD_FEE_BPS,
      platformCostBps: DEFAULT_PLATFORM_CARD_COST_BPS,
    },
    update: {},
  });
  return {
    tenantFeeBps: row.tenantFeeBps,
    platformCostBps: row.platformCostBps,
  };
}

/** 가맹점 수수료가 있으면 그 값, 없으면 플랫폼 기본. 서비스브릿지 원가는 공통. */
export async function resolveCardFeeRates(tenantId: string) {
  const rates = await getPlatformCardFeeRates();
  const row = await prisma.tenantPgOnboarding.findUnique({
    where: { tenantId },
    select: { feeBps: true, merchantDeletedAt: true },
  });
  return {
    tenantFeeBps: row?.feeBps ?? rates.tenantFeeBps,
    platformCostBps: rates.platformCostBps,
    deleted: Boolean(row?.merchantDeletedAt),
  };
}

export async function savePlatformCardFeeRates(input: {
  tenantFeeBps: number;
  platformCostBps: number;
}) {
  const tenantFeeBps = clampBps(input.tenantFeeBps);
  const platformCostBps = clampBps(input.platformCostBps);
  const row = await prisma.platformCardPaymentSettings.upsert({
    where: { id: 'default' },
    create: { id: 'default', tenantFeeBps, platformCostBps },
    update: { tenantFeeBps, platformCostBps },
  });
  return { tenantFeeBps: row.tenantFeeBps, platformCostBps: row.platformCostBps };
}

function clampBps(n: number): number {
  const v = Math.round(Number(n) || 0);
  if (v < 0) return 0;
  if (v > 10_000) return 10_000;
  return v;
}
