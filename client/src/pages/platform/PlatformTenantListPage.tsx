import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { listPlatformTenants, type PlatformTenantRow } from '../../api/platformTenants';
import { getPlatformToken } from '../../stores/platformAuth';
import {
  BTN_PRIMARY,
  BTN_SECONDARY,
  PlanBadge,
  StatusBadge,
} from '../../utils/platformUi';

export function PlatformTenantListPage() {
  const [items, setItems] = useState<PlatformTenantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filterPlan, setFilterPlan] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  useEffect(() => {
    const token = getPlatformToken();
    if (!token) return;
    listPlatformTenants(token)
      .then(setItems)
      .catch((e) => setError(e instanceof Error ? e.message : '조회 실패'))
      .finally(() => setLoading(false));
  }, []);

  const stats = useMemo(
    () => ({
      total: items.length,
      active: items.filter((i) => i.status === 'ACTIVE').length,
      trial: items.filter((i) => i.status === 'TRIAL').length,
      suspended: items.filter((i) => i.status === 'SUSPENDED').length,
    }),
    [items],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      const matchSearch =
        !q ||
        item.name.toLowerCase().includes(q) ||
        item.slug.toLowerCase().includes(q) ||
        (item.ownerLoginId?.toLowerCase().includes(q) ?? false) ||
        (item.adminLoginIds?.some((id) => id.toLowerCase().includes(q)) ?? false);
      const matchPlan = !filterPlan || item.plan === filterPlan;
      const matchStatus = !filterStatus || item.status === filterStatus;
      return matchSearch && matchPlan && matchStatus;
    });
  }, [items, search, filterPlan, filterStatus]);

  const hasFilters = Boolean(search || filterPlan || filterStatus);

  return (
    <div className="space-y-5 min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">업체 관리</h1>
          <p className="mt-0.5 text-sm text-gray-500">청소비서를 사용하는 업체를 관리합니다.</p>
        </div>
        <Link to="/platform/tenants/new" className={BTN_PRIMARY}>
          + 업체 개설
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
          <div className="mt-1 text-xs text-gray-500">전체 업체</div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="text-2xl font-bold text-emerald-600">{stats.active}</div>
          <div className="mt-1 text-xs text-gray-500">운영 중</div>
          <div className="mt-2">
            <StatusBadge status="ACTIVE" />
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="text-2xl font-bold text-amber-600">{stats.trial}</div>
          <div className="mt-1 text-xs text-gray-500">체험 중</div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="text-2xl font-bold text-red-500">{stats.suspended}</div>
          <div className="mt-1 text-xs text-gray-500">중지</div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400" aria-hidden>
            🔍
          </span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="업체명, 코드, 관리자 아이디 검색…"
            className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20"
          />
        </div>
        <select
          value={filterPlan}
          onChange={(e) => setFilterPlan(e.target.value)}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700"
        >
          <option value="">전체 플랜</option>
          <option value="starter">Starter</option>
          <option value="standard">Standard</option>
          <option value="premium">Premium</option>
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700"
        >
          <option value="">전체 상태</option>
          <option value="ACTIVE">운영</option>
          <option value="TRIAL">체험</option>
          <option value="SUSPENDED">중지</option>
        </select>
        {hasFilters ? (
          <button
            type="button"
            onClick={() => {
              setSearch('');
              setFilterPlan('');
              setFilterStatus('');
            }}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            초기화
          </button>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        {loading ? (
          <p className="p-8 text-center text-sm text-gray-500">불러오는 중…</p>
        ) : error ? (
          <p className="p-8 text-center text-sm text-red-600">{error}</p>
        ) : filtered.length === 0 ? (
          <p className="p-8 text-center text-sm text-gray-500">
            {hasFilters ? '검색 조건에 맞는 업체가 없습니다.' : '등록된 업체가 없습니다.'}
          </p>
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-medium text-gray-500">
                    <th className="px-4 py-3">업체</th>
                    <th className="px-4 py-3">플랜</th>
                    <th className="px-4 py-3">상태</th>
                    <th className="px-4 py-3">사용자</th>
                    <th className="px-4 py-3">접수</th>
                    <th className="px-4 py-3">개설일</th>
                    <th className="px-4 py-3">액션</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => (
                    <tr key={row.id} className="border-b border-gray-100 transition-colors hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-gray-900">{row.name}</div>
                        <div className="mt-0.5 font-mono text-xs text-gray-400">{row.slug}</div>
                      </td>
                      <td className="px-4 py-3">
                        <PlanBadge plan={row.plan} />
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={row.status} />
                      </td>
                      <td className="px-4 py-3 tabular-nums text-gray-700">{row.userCount}명</td>
                      <td className="px-4 py-3 tabular-nums text-gray-700">
                        {row.inquiryCount.toLocaleString()}건
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400">
                        {row.createdAt ? new Date(row.createdAt).toLocaleDateString('ko-KR') : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          to={`/platform/tenants/${row.id}`}
                          className={`${BTN_SECONDARY} inline-block px-3 py-1.5 text-xs`}
                        >
                          관리
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="divide-y divide-gray-100 lg:hidden">
              {filtered.map((row) => (
                <Link key={row.id} to={`/platform/tenants/${row.id}`} className="block p-4 hover:bg-gray-50">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-medium text-gray-900">{row.name}</div>
                      <div className="mt-0.5 font-mono text-xs text-gray-400">{row.slug}</div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <PlanBadge plan={row.plan} />
                      <StatusBadge status={row.status} />
                    </div>
                  </div>
                  <div className="mt-2 flex gap-3 text-xs text-gray-500">
                    <span>사용자 {row.userCount}명</span>
                    <span>접수 {row.inquiryCount.toLocaleString()}건</span>
                    {row.createdAt ? (
                      <span>{new Date(row.createdAt).toLocaleDateString('ko-KR')}</span>
                    ) : null}
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
