import { prisma } from '../../lib/prisma.js';

export type ChargeReceiptKind = 'paid' | 'grant' | 'clawback' | 'card' | 'other';

export type ChargeReceiptEnrichInput = {
  id: string;
  amountKrw: number;
  createdAt: Date;
  kind: ChargeReceiptKind;
};

export type ChargeTaxInvoiceInfo = {
  status: 'PENDING' | 'ISSUED' | 'FAILED' | 'SKIPPED' | 'NONE' | 'AWAITING';
  ntsConfirmNum: string | null;
  paymentId: string | null;
  walletInvoiceId: string | null;
  label: string;
  canView: boolean;
};

export type ChargeCardReceiptInfo = {
  paymentId: string | null;
  approvalNo: string | null;
} | null;

export type EnrichedChargeReceipt = {
  taxInvoice: ChargeTaxInvoiceInfo;
  cardReceipt: ChargeCardReceiptInfo;
};

function labelFor(status: ChargeTaxInvoiceInfo['status'], tenantFacing: boolean): string {
  if (status === 'ISSUED') return '발행됨';
  if (status === 'AWAITING') return '확인 전';
  if (status === 'PENDING' || (status === 'FAILED' && tenantFacing)) return '발행 준비 중';
  if (status === 'FAILED') return '발행 실패';
  if (status === 'SKIPPED') return '해당 없음';
  return '해당 없음';
}

function noneResult(label = '해당 없음'): EnrichedChargeReceipt {
  return {
    taxInvoice: {
      status: 'NONE',
      ntsConfirmNum: null,
      paymentId: null,
      walletInvoiceId: null,
      label,
      canView: false,
    },
    cardReceipt: null,
  };
}

/** 충전 신청 대기 — 입금 확인 전 */
export function awaitingChargeRequestReceipt(): EnrichedChargeReceipt {
  return {
    taxInvoice: {
      status: 'AWAITING',
      ntsConfirmNum: null,
      paymentId: null,
      walletInvoiceId: null,
      label: '확인 전',
      canView: false,
    },
    cardReceipt: null,
  };
}

/**
 * 충전 로그 ↔ 입금(지갑) 건을 금액·시각으로 매칭해 세금계산서/카드 영수증 정보를 붙인다.
 * tenantFacing=true 이면 실패도 「발행 준비 중」으로만 보이게 한다.
 */
export async function enrichChargesWithReceipts(
  tenantId: string,
  logs: ChargeReceiptEnrichInput[],
  opts?: { tenantFacing?: boolean },
): Promise<EnrichedChargeReceipt[]> {
  const tenantFacing = opts?.tenantFacing === true;
  if (logs.length === 0) return [];

  const payments = await prisma.usageFeeCardPayment.findMany({
    where: {
      tenantId,
      goodsName: '청소비서 지갑',
      status: 'APPROVED',
    },
    orderBy: { paidAt: 'desc' },
    take: Math.max(40, logs.length * 3),
    select: {
      id: true,
      payMethod: true,
      supplyAmountKrw: true,
      paidAt: true,
      approvalNo: true,
      platformWalletInvoice: {
        select: {
          id: true,
          status: true,
          ntsSendKey: true,
        },
      },
    },
  });

  const usedPaymentIds = new Set<string>();

  return logs.map((log) => {
    if (log.kind === 'grant' || log.kind === 'clawback' || log.kind === 'other') {
      return noneResult('해당 없음');
    }

    const match = payments.find((p) => {
      if (usedPaymentIds.has(p.id)) return false;
      if (p.supplyAmountKrw !== log.amountKrw) return false;
      const delta = Math.abs(p.paidAt.getTime() - log.createdAt.getTime());
      if (delta > 5 * 60_000) return false;
      if (log.kind === 'card') return p.payMethod === 'KEYIN' || p.payMethod === 'PAY_WINDOW';
      if (log.kind === 'paid') return p.payMethod === 'BANK';
      return true;
    });

    if (match) usedPaymentIds.add(match.id);

    if (log.kind === 'card' || (match && (match.payMethod === 'KEYIN' || match.payMethod === 'PAY_WINDOW'))) {
      return {
        taxInvoice: {
          status: 'NONE',
          ntsConfirmNum: null,
          paymentId: match?.id ?? null,
          walletInvoiceId: null,
          label: '해당 없음(카드)',
          canView: false,
        },
        cardReceipt: match ? { paymentId: match.id, approvalNo: match.approvalNo } : null,
      };
    }

    const wi = match?.platformWalletInvoice;
    if (!wi) {
      const status = log.kind === 'paid' ? ('PENDING' as const) : ('NONE' as const);
      return {
        taxInvoice: {
          status,
          ntsConfirmNum: null,
          paymentId: match?.id ?? null,
          walletInvoiceId: null,
          label: labelFor(status, tenantFacing),
          canView: false,
        },
        cardReceipt: null,
      };
    }

    let status = wi.status as ChargeTaxInvoiceInfo['status'];
    if (tenantFacing && status === 'FAILED') status = 'PENDING';
    const publicStatus = tenantFacing && wi.status === 'FAILED' ? ('PENDING' as const) : status;

    return {
      taxInvoice: {
        status: publicStatus,
        ntsConfirmNum: wi.status === 'ISSUED' ? wi.ntsSendKey : null,
        paymentId: match?.id ?? null,
        walletInvoiceId: wi.id,
        label: labelFor(wi.status === 'FAILED' && tenantFacing ? 'PENDING' : (wi.status as ChargeTaxInvoiceInfo['status']), tenantFacing),
        canView: wi.status === 'ISSUED',
      },
      cardReceipt: null,
    };
  });
}
