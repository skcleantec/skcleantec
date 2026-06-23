import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  listPlatformDbMarketplace,
  platformResumeDbListing,
  platformSuspendDbListing,
  type PlatformDbMarketplaceListItem,
} from '../../api/platformDbMarketplace';
import { getPlatformToken } from '../../stores/platformAuth';
import { BTN_DANGER, BTN_PRIMARY, BTN_SECONDARY } from '../../utils/platformUi';

const STATUS_LABEL: Record<string, string> = {
  OPEN: '게시 중',
  PENDING_SELLER: '인계 대기',
  CONFIRMED: '확정',
  EXPIRED: '만료',
};

function statusBadgeClass(status: string): string {
  if (status === 'OPEN') return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200';
  if (status === 'PENDING_SELLER') return 'bg-amber-50 text-amber-800 ring-1 ring-amber-200';
  if (status === 'CONFIRMED') return 'bg-sky-50 text-sky-800 ring-1 ring-sky-200';
  if (status === 'EXPIRED') return 'bg-gray-100 text-gray-600 ring-1 ring-gray-200';
  return 'bg-gray-100 text-gray-600 ring-1 ring-gray-200';
}

export function PlatformDbMarketplacePage() {
  const [items, setItems] = useState<PlatformDbMarketplaceListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    const token = getPlatformToken();
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const rows = await listPlatformDbMarketplace(token);
      setItems(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : '조회 실패');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((row) => {
      const matchStatus = !statusFilter || row.status === statusFilter;
      const matchSearch =
        !q ||
        row.tenantName.toLowerCase().includes(q) ||
        row.tenantSlug.toLowerCase().includes(q) ||
        row.id.toLowerCase().includes(q);
      return matchStatus && matchSearch;
    });
  }, [items, search, statusFilter]);

  const stats = useMemo(
    () => ({
      open: items.filter((i) => i.status === 'OPEN').length,
      pending: items.filter((i) => i.status === 'PENDING_SELLER').length,
      suspended: items.filter((i) => i.platformSuspendedAt && i.status !== 'CONFIRMED').length,
    }),
    [items],
  );

  const runSuspend = async (row: PlatformDbMarketplaceListItem) => {
    const token = getPlatformToken();
    if (!token || !window.confirm(`「${row.tenantName}」 게시 건을 플랫폼 중지할까요?`)) return;
    setBusyId(row.id);
    try {
      await platformSuspendDbListing(token, row.id);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : '중지 실패');
    } finally {
      setBusyId(null);
    }
  };

  const runResume = async (row: PlatformDbMarketplaceListItem) => {
    const token = getPlatformToken();
    if (!token || !window.confirm(`「${row.tenantName}」 게시 건의 플랫폼 중지를 해제할까요?`)) return;
    setBusyId(row.id);
    try {
      await platformResumeDbListing(token, row.id);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : '해제 실패');
    } finally {
      setBusyId(null);
    }
  };

  const canToggleSuspend = (row: PlatformDbMarketplaceListItem) =>
    row.status === 'OPEN' || row.status === 'PENDING_SELLER';

  return (
    <div className="min-w-0 space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">정보공유 관리</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          업체별 DB 마켓 게시 현황입니다. 고객 PII는 표시하지 않습니다.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="text-2xl font-bold text-emerald-600 tabular-nums">{stats.open}</div>
          <div className="mt-1 text-xs text-gray-500">게시 중</div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="text-2xl font-bold text-amber-600 tabular-nums">{stats.pending}</div>
          <div className="mt-1 text-xs text-gray-500">인계 대기</div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 col-span-2 sm:col-span-1">
          <div className="text-2xl font-bold text-red-600 tabular-nums">{stats.suspended}</div>
          <div className="mt-1 text-xs text-gray-500">플랫폼 중지</div>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-4">
        <label className="flex min-w-[140px] flex-1 flex-col gap-1 text-xs text-gray-600">
          업체명·slug 검색
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            placeholder="검색"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-gray-600">
          상태
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">전체</option>
            <option value="OPEN">게시 중</option>
            <option value="PENDING_SELLER">인계 대기</option>
            <option value="CONFIRMED">확정</option>
            <option value="EXPIRED">만료</option>
          </select>
        </label>
        <button type="button" className={BTN_SECONDARY} onClick={() => void load()} disabled={loading}>
          새로고침
        </button>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-center text-xs text-gray-600">
              <th className="px-3 py-2.5 font-medium">판매 업체</th>
              <th className="px-3 py-2.5 font-medium">상태</th>
              <th className="px-3 py-2.5 font-medium">표시금액</th>
              <th className="px-3 py-2.5 font-medium">게시일</th>
              <th className="px-3 py-2.5 font-medium">구매자</th>
              <th className="px-3 py-2.5 font-medium">플랫폼</th>
              <th className="px-3 py-2.5 font-medium">조치</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-gray-500">
                  불러오는 중…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-gray-500">
                  표시할 항목이 없습니다.
                </td>
              </tr>
            ) : (
              filtered.map((row) => (
                <tr key={row.id} className="border-b border-gray-100 text-center hover:bg-gray-50">
                  <td className="px-3 py-2.5">
                    <div className="font-medium text-gray-900">{row.tenantName}</div>
                    <div className="text-xs text-gray-500">{row.tenantSlug}</div>
                  </td>
                  <td className="px-3 py-2.5">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass(row.status)}`}
                    >
                      {STATUS_LABEL[row.status] ?? row.status}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 tabular-nums">
                    {row.displayAmount != null ? `${row.displayAmount.toLocaleString('ko-KR')}원` : '-'}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-gray-600">
                    {row.publishedAt
                      ? new Date(row.publishedAt).toLocaleDateString('ko-KR')
                      : '-'}
                  </td>
                  <td className="px-3 py-2.5 text-xs">
                    {row.buyerTenantName
                      ? row.buyerTenantName
                      : row.buyerKind === 'EXTERNAL_COMPANY'
                        ? '타업체'
                        : '-'}
                  </td>
                  <td className="px-3 py-2.5 text-xs">
                    {row.platformSuspendedAt ? (
                      <span className="font-medium text-red-600">중지됨</span>
                    ) : (
                      <span className="text-gray-500">정상</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    {canToggleSuspend(row) ? (
                      row.platformSuspendedAt ? (
                        <button
                          type="button"
                          className={BTN_PRIMARY}
                          disabled={busyId === row.id}
                          onClick={() => void runResume(row)}
                        >
                          해제
                        </button>
                      ) : (
                        <button
                          type="button"
                          className={BTN_DANGER}
                          disabled={busyId === row.id}
                          onClick={() => void runSuspend(row)}
                        >
                          중지
                        </button>
                      )
                    ) : (
                      <span className="text-xs text-gray-400">-</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-500">
        최대 200건까지 표시됩니다. CONFIRMED·EXPIRED 건은 중지 조작이 불가합니다.
      </p>
    </div>
  );
}
