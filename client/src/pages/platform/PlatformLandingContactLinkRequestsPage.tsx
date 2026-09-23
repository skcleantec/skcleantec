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

async function review(token: string, id: string, approve: boolean) {
  const res = await fetch(`${API}/${encodeURIComponent(id)}/${approve ? 'approve' : 'reject'}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
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
      await review(token, id, approve);
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
          무료 2개를 넘는 짧은 문의 링크 자리입니다. 승인하면 업체는 링크를 만들 수 있고, 켜 둔 유료 링크 1개당 월 5,000원이 이용료에 더해집니다.
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
              {row.requestedCount}개 · {row.status}
              {row.message ? ` · ${row.message}` : ''}
            </p>
            {row.status === 'PENDING' ? (
              <div className="mt-2 flex gap-2">
                <button type="button" className={`${BTN_PRIMARY} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none`} disabled={busyId === row.id} onClick={() => void act(row.id, true)}>
                  승인
                </button>
                <button type="button" className={`${BTN_DANGER} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 focus-visible:ring-offset-2 disabled:pointer-events-none`} disabled={busyId === row.id} onClick={() => void act(row.id, false)}>
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
