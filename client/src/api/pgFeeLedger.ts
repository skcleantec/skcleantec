import { API } from './apiPrefix';

export type PgFeeLedgerItem = {
  tenantId: string;
  onboardingId: string | null;
  name: string;
  feeBps: number;
  feeIsCustom: boolean;
  deleted: boolean;
  amountWon: number;
  merchantFeeWon: number;
  serviceBridgeWon: number;
  marginWon: number;
  approvedCount: number;
  cancelCount: number;
};

export type PgFeeLedger = {
  canManage: boolean;
  serviceBridgeBps: number;
  defaultMerchantBps: number;
  summary: {
    amountWon: number;
    merchantFeeWon: number;
    serviceBridgeWon: number;
    marginWon: number;
    approvedCount: number;
    cancelCount: number;
  };
  total: number;
  items: PgFeeLedgerItem[];
  merchants: Array<{ tenantId: string; name: string; deleted: boolean }>;
};

export type PgFeeLedgerParams = {
  datePreset: string;
  month?: string;
  day?: string;
  tenantId?: string;
  limit: number;
  offset: number;
};

async function parseError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string };
    return body.error || `요청 실패 (${res.status})`;
  } catch {
    return `요청 실패 (${res.status})`;
  }
}

function queryString(params: PgFeeLedgerParams): string {
  const q = new URLSearchParams();
  q.set('datePreset', params.datePreset);
  if (params.month) q.set('month', params.month);
  if (params.day) q.set('day', params.day);
  if (params.tenantId) q.set('tenantId', params.tenantId);
  q.set('limit', String(params.limit));
  q.set('offset', String(params.offset));
  return q.toString();
}

export function createPgFeeLedgerApi(basePath: string, token: () => string) {
  const headers = () => ({ Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' });
  return {
    async load(params: PgFeeLedgerParams): Promise<PgFeeLedger> {
      const res = await fetch(`${API}${basePath}?${queryString(params)}`, { headers: headers() });
      if (!res.ok) throw new Error(await parseError(res));
      return res.json() as Promise<PgFeeLedger>;
    },
    async saveFee(tenantId: string, feePercent: number): Promise<void> {
      const res = await fetch(`${API}${basePath}/${encodeURIComponent(tenantId)}`, {
        method: 'PATCH',
        headers: headers(),
        body: JSON.stringify({ feePercent }),
      });
      if (!res.ok) throw new Error(await parseError(res));
    },
    async remove(tenantId: string, password: string): Promise<void> {
      const res = await fetch(`${API}${basePath}/${encodeURIComponent(tenantId)}/delete`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ password }),
      });
      if (!res.ok) throw new Error(await parseError(res));
    },
  };
}
