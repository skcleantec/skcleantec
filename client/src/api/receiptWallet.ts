import { getToken } from '../stores/auth';
import { API, apiErrorMessage } from './apiPrefix';
import { openReceiptWindow } from '../components/receipts/receiptListDisplay';

export type TenantChargeTaxInvoice = {
  status: 'PENDING' | 'ISSUED' | 'FAILED' | 'SKIPPED' | 'NONE' | 'AWAITING';
  ntsConfirmNum: string | null;
  paymentId: string | null;
  walletInvoiceId: string | null;
  label: string;
  canView: boolean;
};

export type TenantChargeCardReceipt = {
  paymentId: string | null;
  approvalNo: string | null;
} | null;

export type ReceiptWalletSummary = {
  balanceKrw: number;
  lowBalance: boolean;
  pendingChargeKrw: number;
  pendingCharge?: { amountKrw: number; createdAt: string } | null;
  latestCharge?: {
    id: string;
    amountKrw: number;
    createdAt: string;
    taxInvoice: TenantChargeTaxInvoice;
  } | null;
  tenantName?: string;
  testAmountEnabled?: boolean;
  month: {
    cashbillCount: number;
    cashbillKrw: number;
    taxInvoiceCount: number;
    taxInvoiceKrw: number;
    alimtalkKrw: number;
  };
  bank: {
    bankName: string | null;
    accountNumber: string | null;
    accountHolder: string | null;
    paymentGuideText: string | null;
  };
};

export type ReceiptWalletLedgerItem = {
  id: string;
  kind: 'CHARGE' | 'USAGE';
  type: string | null;
  amountKrw: number;
  balanceAfterKrw: number;
  createdAt: string;
  memo: string | null;
  tenantLabel?: string | null;
  chargeKind?: string | null;
  taxInvoice?: TenantChargeTaxInvoice | null;
  cardReceipt?: TenantChargeCardReceipt;
};

export type ReceiptWalletPendingChargeRequest = {
  id: string;
  amountKrw: number;
  memo: string | null;
  createdAt: string;
  status: string;
  taxInvoice: TenantChargeTaxInvoice;
};

function headers(): HeadersInit {
  return { Authorization: `Bearer ${getToken() ?? ''}`, 'Content-Type': 'application/json' };
}

export async function fetchReceiptWallet(): Promise<ReceiptWalletSummary> {
  const res = await fetch(`${API}/cashbill/wallet`, { headers: headers() });
  if (!res.ok) throw new Error(await apiErrorMessage(res, '청소비서 지갑을 불러오지 못했습니다.'));
  return res.json() as Promise<ReceiptWalletSummary>;
}

export async function fetchReceiptWalletLedger(type: string, limit: number, offset: number): Promise<{
  items: ReceiptWalletLedgerItem[];
  pendingChargeRequests: ReceiptWalletPendingChargeRequest[];
  total: number;
  trend: { at: string; balanceAfterKrw: number }[];
}> {
  const qs = new URLSearchParams({ type, limit: String(limit), offset: String(offset) });
  const res = await fetch(`${API}/cashbill/wallet/ledger?${qs}`, { headers: headers() });
  if (!res.ok) throw new Error(await apiErrorMessage(res, '충전·사용 내역을 불러오지 못했습니다.'));
  const body = (await res.json()) as {
    items: ReceiptWalletLedgerItem[];
    pendingChargeRequests?: ReceiptWalletPendingChargeRequest[];
    total: number;
    trend: { at: string; balanceAfterKrw: number }[];
  };
  return {
    items: body.items,
    pendingChargeRequests: body.pendingChargeRequests ?? [],
    total: body.total,
    trend: body.trend,
  };
}

export async function openTenantWalletTaxInvoiceView(input: {
  walletInvoiceId?: string | null;
  paymentId?: string | null;
}): Promise<void> {
  const qs = new URLSearchParams();
  if (input.walletInvoiceId) qs.set('id', input.walletInvoiceId);
  if (input.paymentId) qs.set('paymentId', input.paymentId);
  const res = await fetch(`${API}/cashbill/wallet/tax-invoice-view-url?${qs}`, { headers: headers() });
  if (!res.ok) throw new Error(await apiErrorMessage(res, '영수증을 열 수 없습니다.'));
  const body = (await res.json()) as { url?: string };
  if (!body.url) throw new Error('영수증을 열 수 없습니다.');
  openReceiptWindow(body.url);
}
