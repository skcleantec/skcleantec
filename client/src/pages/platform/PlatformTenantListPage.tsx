import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listPlatformTenants, type PlatformTenantRow } from '../../api/platformTenants';
import { getPlatformToken } from '../../stores/platformAuth';

const STATUS_LABEL: Record<string, string> = {
  TRIAL: '체험',
  ACTIVE: '운영',
  SUSPENDED: '중지',
};

export function PlatformTenantListPage() {
  const [items, setItems] = useState<PlatformTenantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = getPlatformToken();
    if (!token) return;
    listPlatformTenants(token)
      .then(setItems)
      .catch((e) => setError(e instanceof Error ? e.message : '조회 실패'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4 min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-fluid-lg font-semibold text-gray-900">업체 목록</h1>
        <Link
          to="/platform/tenants/new"
          className="inline-flex items-center px-3 py-2 bg-gray-800 text-white text-fluid-sm rounded hover:bg-gray-900"
        >
          업체 개설
        </Link>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {loading ? (
          <p className="p-8 text-center text-fluid-sm text-gray-500">불러오는 중…</p>
        ) : error ? (
          <p className="p-8 text-center text-fluid-sm text-red-600">{error}</p>
        ) : items.length === 0 ? (
          <p className="p-8 text-center text-fluid-sm text-gray-500">등록된 업체가 없습니다.</p>
        ) : (
          <>
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full table-fixed border-collapse text-fluid-sm">
                <thead>
                  <tr className="bg-gray-100 border-b border-gray-200">
                    <th className="px-3 py-2 text-center">업체명</th>
                    <th className="px-3 py-2 text-center w-28">코드</th>
                    <th className="px-3 py-2 text-center w-28">관리자</th>
                    <th className="px-3 py-2 text-center w-24">플랜</th>
                    <th className="px-3 py-2 text-center w-20">상태</th>
                    <th className="px-3 py-2 text-center w-16">사용자</th>
                    <th className="px-3 py-2 text-center w-16">접수</th>
                    <th className="px-3 py-2 text-center w-20">상세</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row) => (
                    <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-3 py-2 text-center truncate" title={row.name}>
                        {row.name}
                      </td>
                      <td className="px-3 py-2 text-center font-mono text-fluid-xs">{row.slug}</td>
                      <td className="px-3 py-2 text-center font-mono text-fluid-xs">
                        {(row.adminLoginIds && row.adminLoginIds.length > 0
                          ? row.adminLoginIds.join(', ')
                          : row.ownerLoginId) ?? '—'}
                      </td>
                      <td className="px-3 py-2 text-center capitalize">{row.plan}</td>
                      <td className="px-3 py-2 text-center">{STATUS_LABEL[row.status] ?? row.status}</td>
                      <td className="px-3 py-2 text-center tabular-nums">{row.userCount}</td>
                      <td className="px-3 py-2 text-center tabular-nums">{row.inquiryCount}</td>
                      <td className="px-3 py-2 text-center">
                        <Link to={`/platform/tenants/${row.id}`} className="text-blue-600 hover:underline">
                          보기
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="lg:hidden divide-y divide-gray-100">
              {items.map((row) => (
                <Link
                  key={row.id}
                  to={`/platform/tenants/${row.id}`}
                  className="block p-4 hover:bg-gray-50"
                >
                  <div className="font-medium text-gray-900">{row.name}</div>
                  <div className="text-fluid-xs text-gray-500 mt-1">
                    {row.slug}
                    {(row.adminLoginIds?.length ? row.adminLoginIds.join(', ') : row.ownerLoginId)
                      ? ` · ${row.adminLoginIds?.length ? row.adminLoginIds.join(', ') : row.ownerLoginId}`
                      : ''}{' '}
                    · {row.plan} · {STATUS_LABEL[row.status] ?? row.status}
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
