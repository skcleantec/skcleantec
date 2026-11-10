import { issuePlatformCashbill } from '../../api/platformReceipts';

/** CashbillIssueForm → adapter.issue() 에 전달되는 공통 바디 */
export type CashbillAdapterIssueBody = {
  amount: number;
  usage: 'phone' | 'biz' | 'voluntary';
  identity?: string;
  taxKind: 'taxable' | 'exempt';
  itemName: string;
  tradeDate: string;
  email?: string;
  customerName?: string;
  internalMemo?: string;
  /** 플랫폼 전용: 업체 ID */
  tenantId?: string;
};

export type CashbillIssuerAdapter = {
  mode: 'tenant' | 'platform';
  useWallet: boolean;
  allowInquiry: boolean;
  issue: (body: CashbillAdapterIssueBody) => Promise<{ id: string }>;
};

export function createPlatformCashbillAdapter(): CashbillIssuerAdapter {
  return {
    mode: 'platform',
    useWallet: false,
    allowInquiry: false,
    issue: async (body) => {
      const row = await issuePlatformCashbill({
        tenantId: body.tenantId,
        identity: body.identity,
        usage: body.usage,
        taxKind: body.taxKind,
        amountKrw: body.amount,
        itemName: body.itemName,
        tradeDate: body.tradeDate,
        email: body.email,
        buyerName: body.customerName,
        memo: body.internalMemo,
      });
      return { id: row.id };
    },
  };
}
