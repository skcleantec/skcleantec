const API = '/api/public/billing/deposit-confirm';

export type DepositConfirmPreview = {
  isTest: boolean;
  alreadyPaid: boolean;
  canConfirm: boolean;
  tenantName: string;
  tenantSlug: string;
  amountKrw: number;
  dueDate: string | null;
  invoiceStatus: string;
  tenantActivated: boolean;
  otherOverdueCount: number;
  message: string;
};

export type DepositConfirmResult = DepositConfirmPreview & {
  confirmed: boolean;
};

async function readJson<T>(res: Response): Promise<T> {
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? '처리할 수 없습니다.');
  return data;
}

export async function fetchDepositConfirmPreview(token: string): Promise<DepositConfirmPreview> {
  const res = await fetch(`${API}?token=${encodeURIComponent(token)}`);
  return readJson<DepositConfirmPreview>(res);
}

export async function confirmDepositByEmailToken(token: string): Promise<DepositConfirmResult> {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  return readJson<DepositConfirmResult>(res);
}
