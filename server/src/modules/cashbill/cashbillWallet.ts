import { prisma } from '../../lib/prisma.js';
import { CASHBILL_UNIT_PRICE_KRW } from '../../lib/barobill/policy.js';
import { ensureTenantAlimtalkDefaults } from '../alimtalk/alimtalkWallet.service.js';

export const CASHBILL_WALLET_SHORT_MESSAGE = '청소비서 지갑 잔액이 부족합니다. 충전해 주세요.';

async function writeWalletLog(tenantId: string, amountKrw: number, memo: string): Promise<void> {
  const wallet = await prisma.tenantAlimtalkWallet.findUnique({
    where: { tenantId },
    select: { prepaidBalanceKrw: true },
  });
  await prisma.alimtalkWalletChargeLog.create({
    data: {
      tenantId,
      amountKrw,
      balanceAfterKrw: wallet?.prepaidBalanceKrw ?? 0,
      memo,
    },
  });
}

/** 성공 건만 22원. 잔액이 부족하면 false. */
export async function chargeCashbillWallet(tenantId: string, plan: string): Promise<boolean> {
  await ensureTenantAlimtalkDefaults(tenantId, plan);
  const updated = await prisma.$executeRaw`
    UPDATE tenant_alimtalk_wallets
    SET prepaid_balance_krw = prepaid_balance_krw - ${CASHBILL_UNIT_PRICE_KRW},
        updated_at = NOW()
    WHERE tenant_id = ${tenantId}
      AND prepaid_balance_krw >= ${CASHBILL_UNIT_PRICE_KRW}
  `;
  if (Number(updated) !== 1) return false;
  await writeWalletLog(tenantId, -CASHBILL_UNIT_PRICE_KRW, '현금영수증');
  return true;
}

export async function refundCashbillWallet(tenantId: string, plan: string): Promise<void> {
  await ensureTenantAlimtalkDefaults(tenantId, plan);
  await prisma.tenantAlimtalkWallet.update({
    where: { tenantId },
    data: { prepaidBalanceKrw: { increment: CASHBILL_UNIT_PRICE_KRW } },
  });
  await writeWalletLog(tenantId, CASHBILL_UNIT_PRICE_KRW, '현금영수증 차감 취소');
}

export async function readCashbillWalletBalance(tenantId: string, plan: string): Promise<number> {
  await ensureTenantAlimtalkDefaults(tenantId, plan);
  const wallet = await prisma.tenantAlimtalkWallet.findUnique({
    where: { tenantId },
    select: { prepaidBalanceKrw: true },
  });
  return wallet?.prepaidBalanceKrw ?? 0;
}
