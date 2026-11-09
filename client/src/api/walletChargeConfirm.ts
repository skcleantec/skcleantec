const API = '/api/public/wallet/charge-confirm';

export type WalletChargeConfirmPreview = {
  alreadyProcessed: boolean;
  canConfirm: boolean;
  tenantName: string;
  tenantSlug: string;
  supplyAmountKrw: number;
  vatAmountKrw: number;
  payAmountKrw: number;
  memo: string | null;
  requesterName: string | null;
  requestedAt: string;
  status: string;
  message: string;
  balanceAfterKrw: number | null;
  taxInvoiceStatus: 'PENDING' | 'ISSUED' | 'FAILED' | 'SKIPPED' | null;
  taxInvoiceLabel: string | null;
};

export type WalletChargeConfirmResult = WalletChargeConfirmPreview & {
  confirmed: boolean;
};

async function readJson<T>(res: Response): Promise<T> {
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? '처리할 수 없습니다.');
  return data;
}

export async function fetchWalletChargeConfirmPreview(
  token: string,
): Promise<WalletChargeConfirmPreview> {
  const res = await fetch(`${API}?token=${encodeURIComponent(token)}`);
  return readJson<WalletChargeConfirmPreview>(res);
}

export async function confirmWalletChargeByEmailToken(
  token: string,
): Promise<WalletChargeConfirmResult> {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  return readJson<WalletChargeConfirmResult>(res);
}
