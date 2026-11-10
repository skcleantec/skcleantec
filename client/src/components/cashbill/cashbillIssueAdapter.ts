import {
  issuePlatformCashbill,
  listPlatformTaxInvoiceBuyers,
  upsertPlatformTaxInvoiceBuyer,
  updatePlatformTaxInvoiceBuyer,
  removePlatformTaxInvoiceBuyer,
} from '../../api/platformReceipts';
import { tenantTaxInvoiceBuyerApi, type TaxInvoiceBuyerApi } from '../../api/taxInvoiceBuyers';

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
  buyerApi: TaxInvoiceBuyerApi;
  issue: (body: CashbillAdapterIssueBody) => Promise<{ id: string }>;
};

export const tenantCashbillAdapter: CashbillIssuerAdapter = {
  mode: 'tenant',
  useWallet: true,
  allowInquiry: true,
  buyerApi: tenantTaxInvoiceBuyerApi,
  issue: async () => {
    throw new Error('tenant adapter는 issueCashbill 직접 호출을 씁니다.');
  },
};

export function createPlatformCashbillAdapter(): CashbillIssuerAdapter {
  const buyerApi: TaxInvoiceBuyerApi = {
    list: listPlatformTaxInvoiceBuyers,
    upsert: upsertPlatformTaxInvoiceBuyer,
    update: updatePlatformTaxInvoiceBuyer,
    remove: removePlatformTaxInvoiceBuyer,
  };
  return {
    mode: 'platform',
    useWallet: false,
    allowInquiry: false,
    buyerApi,
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
