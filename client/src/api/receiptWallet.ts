import { getToken } from '../stores/auth';
import { API, apiErrorMessage } from './apiPrefix';

export type ReceiptWalletSummary = {
  balanceKrw: number;
  lowBalance: boolean;
  pendingChargeKrw: number;
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
  total: number;
  trend: { at: string; balanceAfterKrw: number }[];
}> {
  const qs = new URLSearchParams({ type, limit: String(limit), offset: String(offset) });
  const res = await fetch(`${API}/cashbill/wallet/ledger?${qs}`, { headers: headers() });
  if (!res.ok) throw new Error(await apiErrorMessage(res, '충전·사용 내역을 불러오지 못했습니다.'));
  return res.json() as Promise<{
    items: ReceiptWalletLedgerItem[];
    total: number;
    trend: { at: string; balanceAfterKrw: number }[];
  }>;
}
