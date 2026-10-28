import type { Prisma } from '@prisma/client';
import type { WalletUsageType } from '../../lib/walletPolicy.js';

export async function recordWalletUsage(
  tx: Prisma.TransactionClient,
  input: { tenantId: string; type: WalletUsageType; refId: string | null; amountKrw: number; balanceAfterKrw: number },
): Promise<void> {
  await tx.tenantWalletUsageLog.create({
    data: {
      tenantId: input.tenantId,
      type: input.type,
      refId: input.refId,
      amountKrw: input.amountKrw,
      balanceAfterKrw: input.balanceAfterKrw,
    },
  });
}
