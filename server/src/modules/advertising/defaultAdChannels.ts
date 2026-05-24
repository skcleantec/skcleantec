import type { Prisma } from '@prisma/client';

export const DEFAULT_AD_CHANNEL_NAMES = ['네이버', '인스타그램', '배너', '기타'] as const;

/** 테넌트별 기본 광고 채널(없을 때만 생성) */
export async function ensureDefaultAdChannelsForTenant(
  client: Prisma.TransactionClient | { adChannel: Prisma.TransactionClient['adChannel'] },
  tenantId: string,
): Promise<void> {
  let order = 0;
  for (const name of DEFAULT_AD_CHANNEL_NAMES) {
    const existing = await client.adChannel.findFirst({ where: { tenantId, name } });
    if (!existing) {
      await client.adChannel.create({ data: { tenantId, name, sortOrder: order++ } });
    } else {
      order = Math.max(order, existing.sortOrder + 1);
    }
  }
}
