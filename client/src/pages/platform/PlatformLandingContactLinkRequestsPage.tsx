import { useCallback, useEffect, useState } from 'react';
import { usePlatformTokenOrThrow } from '../../api/platformPlanUpgrade';
import {
  PlatformLandingLinkRequestCard,
  type LandingLinkRequestCardRow,
} from '../../components/platform/PlatformLandingLinkRequestCard';
import { BTN_PRIMARY, BTN_SECONDARY } from '../../utils/platformUi';

const API = '/api/platform/landing-contact-link-requests';

async function listRows(token: string, pendingOnly: boolean): Promise<LandingLinkRequestCardRow[]> {
  const q = pendingOnly ? '?status=PENDING' : '';
  const res = await fetch(`${API}${q}`, { headers: { Authorization: `Bearer ${token}` } });
  const data = (await res.json()) as { items?: LandingLinkRequestCardRow[]; error?: string };
  if (!res.ok) throw new Error(data.error ?? '조회에 실패했습니다.');
  return data.items ?? [];
}

async function review(token: string, id: string, approve: boolean, grantedCount?: number, adminNote?: string) {
  const res = await fetch(`${API}/${encodeURIComponent(id)}/${approve ? 'approve' : 'reject'}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(approve ? { grantedCount } : { adminNote }),
  });
  const data = (await res.json()) as { error?: string };
  if (!res.ok) throw new Error(data.error ?? '처리에 실패했습니다.');
}

export function PlatformLandingContactLinkRequestsPage() {
  const [items, setItems] = useState<LandingLinkRequestCardRow[]>([]);
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

  const act = async (id: string, approve: boolean, count?: number, reason?: string) => {
    setBusyId(id);
    setError('');
    try {
      const token = usePlatformTokenOrThrow();
      if (!approve && !reason?.trim()) {
        setError('반려 사유를 적어 주세요.');
        return;
      }
      await review(token, id, approve, count, reason);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '처리 실패');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="min-w-0 max-w-[760px] space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">문의 링크 신청</h1>
        <p className="mt-1 text-fluid-sm text-slate-600">
          업체가 링크 구매를 누르면 여기에 들어옵니다. 늘릴 개수를 정하고 승인하면, 그 개수 × 월 5,000원이 아직 청구서가 없는 이번 달 이용료부터 더해집니다.
        </p>
      </div>
      <div className="flex gap-2">
        <button type="button" className={`${pendingOnly ? BTN_PRIMARY : BTN_SECONDARY} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2`} onClick={() => setPendingOnly(true)}>
          대기
        </button>
        <button type="button" className={`${!pendingOnly ? BTN_PRIMARY : BTN_SECONDARY} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2`} onClick={() => setPendingOnly(false)}>
          전체
        </button>
      </div>
      {error ? <p className="text-fluid-sm text-red-700">{error}</p> : null}
      {loading ? <p className="text-fluid-sm text-slate-500">불러오는 중…</p> : null}
      {!loading && items.length === 0 ? <p className="text-fluid-sm text-slate-500">신청이 없습니다.</p> : null}
      <ul className="space-y-3">
        {items.map((row) => (
          <li key={row.id}>
            <PlatformLandingLinkRequestCard
              row={row}
              busy={busyId === row.id}
              onApprove={(count) => void act(row.id, true, count)}
              onReject={(reason) => void act(row.id, false, undefined, reason)}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
