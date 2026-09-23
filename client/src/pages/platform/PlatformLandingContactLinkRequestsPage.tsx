import { useCallback, useEffect, useState } from 'react';
import { usePlatformTokenOrThrow } from '../../api/platformPlanUpgrade';
import { BTN_DANGER, BTN_PRIMARY, BTN_SECONDARY } from '../../utils/platformUi';

type Row = {
  id: string;
  tenantName: string;
  tenantSlug: string;
  requestedCount: number;
  status: string;
  message: string | null;
  createdAt: string;
};

const API = '/api/platform/landing-contact-link-requests';

async function listRows(token: string, pendingOnly: boolean): Promise<Row[]> {
  const q = pendingOnly ? '?status=PENDING' : '';
  const res = await fetch(`${API}${q}`, { headers: { Authorization: `Bearer ${token}` } });
  const data = (await res.json()) as { items?: Row[]; error?: string };
  if (!res.ok) throw new Error(data.error ?? '조회에 실패했습니다.');
  return data.items ?? [];
}

async function review(token: string, id: string, approve: boolean, grantedCount?: number) {
  const res = await fetch(`${API}/${encodeURIComponent(id)}/${approve ? 'approve' : 'reject'}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(approve ? { grantedCount } : {}),
  });
  const data = (await res.json()) as { error?: string };
  if (!res.ok) throw new Error(data.error ?? '처리에 실패했습니다.');
}

export function PlatformLandingContactLinkRequestsPage() {
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pendingOnly, setPendingOnly] = useState(true);
  const [grantCounts, setGrantCounts] = useState<Record<string, number>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = usePlatformTokenOrThrow();
      setItems(await listRows(token, pendingOnly));
    } catch (e) {
      setError(e instanceof Error ? e.message : '조회 실패');
    } finally {
      setLoading(false);
    }
  }, [pendingOnly]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (id: string, approve: boolean) => {
    setBusyId(id);
    setError('');
    try {
      const token = usePlatformTokenOrThrow();
      const granted = grantCounts[id] ?? 1;
      if (approve && (!Number.isFinite(granted) || granted < 1 || granted > 50)) {
        setError('늘릴 개수는 1개에서 50개까지 정해 주세요.');
        return;
      }
      await review(token, id, approve, granted);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '처리 실패');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="min-w-0 space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">문의 링크 신청</h1>
        <p className="mt-1 text-fluid-sm text-slate-600">
          업체가 링크 구매를 누르면 여기에 들어옵니다. 늘릴 개수를 정하고 승인하면, 그 개수 × 월 5,000원이 아직 청구서가 없는 이번 달 이용료부터 더해집니다.
        </p>
      </div>
      <div className="flex gap-2">
        <button type="button" className={`${pendingOnly ? BTN_PRIMARY : BTN_SECONDARY} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none`} onClick={() => setPendingOnly(true)}>
          대기
        </button>
        <button type="button" className={`${!pendingOnly ? BTN_PRIMARY : BTN_SECONDARY} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none`} onClick={() => setPendingOnly(false)}>
          전체
        </button>
      </div>
      {error ? <p className="text-fluid-sm text-red-700">{error}</p> : null}
      {loading ? <p className="text-fluid-sm text-slate-500">불러오는 중…</p> : null}
      {!loading && items.length === 0 ? <p className="text-fluid-sm text-slate-500">신청이 없습니다.</p> : null}
      <ul className="space-y-2">
        {items.map((row) => (
          <li key={row.id} className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-fluid-sm font-medium text-slate-900">
              {row.tenantName} <span className="font-normal text-slate-500">({row.tenantSlug})</span>
            </p>
            <p className="mt-1 text-fluid-xs text-slate-600">
              {row.status === 'PENDING' ? '개수 미정' : `${row.requestedCount}개`} · {row.status}
              {row.message ? ` · ${row.message}` : ''}
            </p>
            {row.status === 'PENDING' ? (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <label className="text-fluid-xs text-slate-700">
                  몇 개
                  <input
                    className="ml-2 w-16 min-h-9 rounded-lg border border-slate-200 px-2 py-1 text-fluid-xs text-slate-900 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                    type="number"
                    min={1}
                    max={50}
                    value={grantCounts[row.id] ?? 1}
                    onChange={(e) => setGrantCounts((prev) => ({ ...prev, [row.id]: Number(e.target.value) }))}
                  />
                </label>
                <button type="button" className={`${BTN_PRIMARY} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50`} disabled={busyId === row.id} onClick={() => void act(row.id, true)}>
                  승인
                </button>
                <button type="button" className={`${BTN_DANGER} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50`} disabled={busyId === row.id} onClick={() => void act(row.id, false)}>
                  반려
                </button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
