import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  approvePlatformPlanUpgradeRequest,
  listPlatformPlanUpgradeRequests,
  rejectPlatformPlanUpgradeRequest,
  usePlatformTokenOrThrow,
} from '../../api/platformPlanUpgrade';
import type { TenantPlanUpgradeRequestRow } from '../../api/tenantPlanUpgrade';
import { BTN_DANGER, BTN_PRIMARY, BTN_SECONDARY, PlanBadge } from '../../utils/platformUi';

function formatKo(iso: string) {
  return new Date(iso).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
}

export function PlatformPlanUpgradeRequestsPage() {
  const [items, setItems] = useState<TenantPlanUpgradeRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'PENDING' | 'ALL'>('PENDING');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = usePlatformTokenOrThrow();
      const rows = await listPlatformPlanUpgradeRequests(
        token,
        filter === 'PENDING' ? 'PENDING' : undefined,
      );
      setItems(filter === 'PENDING' ? rows : rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : '조회 실패');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  const review = async (id: string, action: 'approve' | 'reject') => {
    const note =
      action === 'reject'
        ? window.prompt('반려 사유 (선택)') ?? undefined
        : window.prompt('승인 메모 (선택)') ?? undefined;
    if (action === 'reject' && note === null) return;
    setBusyId(id);
    try {
      const token = usePlatformTokenOrThrow();
      if (action === 'approve') {
        await approvePlatformPlanUpgradeRequest(token, id, note || undefined);
      } else {
        await rejectPlatformPlanUpgradeRequest(token, id, note || undefined);
      }
      await load();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '처리 실패');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5 min-w-0">
      <div className="border-b border-slate-200 pb-4">
        <div className="flex flex-wrap items-center gap-2 text-fluid-sm text-slate-500">
          <Link to="/platform/tenants" className="hover:text-slate-800">
            업체 관리
          </Link>
          <span>/</span>
          <span className="text-slate-900">유료 플랜 전환 신청</span>
        </div>
        <h1 className="mt-2 text-fluid-lg font-semibold text-slate-900">유료 플랜 전환 승인</h1>
        <p className="mt-1 text-fluid-xs text-slate-500">
          셀프 가입(Free) 업체의 유료 플랜 신청을 검토합니다. 승인 시 7일 체험이 시작됩니다.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={filter === 'PENDING' ? BTN_PRIMARY : BTN_SECONDARY}
          onClick={() => setFilter('PENDING')}
        >
          대기 중
        </button>
        <button
          type="button"
          className={filter === 'ALL' ? BTN_PRIMARY : BTN_SECONDARY}
          onClick={() => setFilter('ALL')}
        >
          전체
        </button>
        <button type="button" className={BTN_SECONDARY} onClick={() => void load()}>
          새로고침
        </button>
      </div>

      {error ? <p className="text-fluid-sm text-red-600">{error}</p> : null}
      {loading ? <p className="text-fluid-sm text-slate-500">불러오는 중…</p> : null}

      {!loading && items.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-8 text-center text-fluid-sm text-slate-500">
          {filter === 'PENDING' ? '대기 중인 신청이 없습니다.' : '신청 내역이 없습니다.'}
        </p>
      ) : null}

      <ul className="space-y-3">
        {items.map((row) => (
          <li key={row.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <p className="text-fluid-sm font-semibold text-slate-900">
                  {row.tenantName}{' '}
                  <span className="font-mono text-fluid-xs font-normal text-slate-500">({row.tenantSlug})</span>
                </p>
                <p className="text-fluid-xs text-slate-600">
                  <PlanBadge plan={row.currentPlan} /> → <PlanBadge plan={row.requestedPlan} />
                </p>
                {row.message ? (
                  <p className="text-fluid-2xs text-slate-600">신청 메모: {row.message}</p>
                ) : null}
                <p className="text-fluid-2xs text-slate-500">
                  신청 {formatKo(row.createdAt)}
                  {row.requesterName ? ` · ${row.requesterName}` : ''}
                  {row.status !== 'PENDING' && row.reviewedAt ? ` · 처리 ${formatKo(row.reviewedAt)}` : ''}
                </p>
                {row.adminNote ? (
                  <p className="text-fluid-2xs text-slate-600">플랫폼 메모: {row.adminNote}</p>
                ) : null}
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <Link to={`/platform/tenants/${row.tenantId}`} className={BTN_SECONDARY}>
                  업체 상세
                </Link>
                {row.status === 'PENDING' ? (
                  <>
                    <button
                      type="button"
                      className={BTN_PRIMARY}
                      disabled={busyId === row.id}
                      onClick={() => void review(row.id, 'approve')}
                    >
                      승인
                    </button>
                    <button
                      type="button"
                      className={BTN_DANGER}
                      disabled={busyId === row.id}
                      onClick={() => void review(row.id, 'reject')}
                    >
                      반려
                    </button>
                  </>
                ) : (
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-fluid-2xs text-slate-700">{row.status}</span>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
