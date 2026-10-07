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
