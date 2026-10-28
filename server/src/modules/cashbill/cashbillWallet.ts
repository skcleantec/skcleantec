import { prisma } from '../../lib/prisma.js';
import { CASHBILL_UNIT_PRICE_KRW, TAXINVOICE_UNIT_PRICE_KRW } from '../../lib/barobill/policy.js';
import type { WalletUsageType } from '../../lib/walletPolicy.js';
import { ensureTenantAlimtalkDefaults } from '../alimtalk/alimtalkWallet.service.js';
import { recordWalletUsage } from '../wallet/walletUsageLog.js';

export const CASHBILL_WALLET_SHORT_MESSAGE = '청소비서 지갑 잔액이 부족합니다. 충전해 주세요.';

async function debit(
  tenantId: string,
  amountKrw: number,
  type: WalletUsageType,
  refId: string,
): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const updated = await tx.$executeRaw`
      UPDATE tenant_alimtalk_wallets
      SET prepaid_balance_krw = prepaid_balance_krw - ${amountKrw},
          updated_at = NOW()
      WHERE tenant_id = ${tenantId}
        AND prepaid_balance_krw >= ${amountKrw}
    `;
    if (Number(updated) !== 1) return false;
    const wallet = await tx.tenantAlimtalkWallet.findUnique({
      where: { tenantId },
      select: { prepaidBalanceKrw: true },
    });
    await recordWalletUsage(tx, {
      tenantId,
      type,
      refId,
      amountKrw: -amountKrw,
      balanceAfterKrw: wallet?.prepaidBalanceKrw ?? 0,
    });
    return true;
  });
}

async function credit(tenantId: string, amountKrw: number, type: WalletUsageType, refId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const wallet = await tx.tenantAlimtalkWallet.update({
      where: { tenantId },
      data: { prepaidBalanceKrw: { increment: amountKrw } },
    });
    await recordWalletUsage(tx, {
      tenantId,
      type,
      refId,
      amountKrw,
      balanceAfterKrw: wallet.prepaidBalanceKrw,
    });
  });
}

export async function chargeCashbillWallet(
  tenantId: string,
  plan: string,
  refId: string,
  type: 'CASHBILL_ISSUE' | 'CASHBILL_CANCEL',
): Promise<boolean> {
  await ensureTenantAlimtalkDefaults(tenantId, plan);
  return debit(tenantId, CASHBILL_UNIT_PRICE_KRW, type, refId);
}

export async function refundCashbillWallet(tenantId: string, plan: string, refId: string): Promise<void> {
  await ensureTenantAlimtalkDefaults(tenantId, plan);
  await credit(tenantId, CASHBILL_UNIT_PRICE_KRW, 'CASHBILL_REFUND', refId);
}

export async function chargeTaxInvoiceWallet(tenantId: string, plan: string, refId: string): Promise<boolean> {
  await ensureTenantAlimtalkDefaults(tenantId, plan);
  return debit(tenantId, TAXINVOICE_UNIT_PRICE_KRW, 'TAXINVOICE_ISSUE', refId);
}

export async function refundTaxInvoiceWallet(tenantId: string, plan: string, refId: string): Promise<void> {
  await ensureTenantAlimtalkDefaults(tenantId, plan);
  await credit(tenantId, TAXINVOICE_UNIT_PRICE_KRW, 'TAXINVOICE_REFUND', refId);
}

export async function readCashbillWalletBalance(tenantId: string, plan: string): Promise<number> {
  await ensureTenantAlimtalkDefaults(tenantId, plan);
  const wallet = await prisma.tenantAlimtalkWallet.findUnique({
    where: { tenantId },
    select: { prepaidBalanceKrw: true },
  });
  return wallet?.prepaidBalanceKrw ?? 0;
}
