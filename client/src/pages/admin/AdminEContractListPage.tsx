import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getToken } from '../../stores/auth';
import {
  createEContractDefinition,
  listEContractDefinitions,
  type EContractDefinitionListItem,
} from '../../api/adminEContract';

export function AdminEContractListPage() {
  const token = getToken();
  const [rows, setRows] = useState<EContractDefinitionListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    if (!token) {
      setLoading(false);
      setRows([]);
      return;
    }
    setLoading(true);
    setErr(null);
    try {
      const data = await listEContractDefinitions(token);
      setRows(data.definitions);
    } catch (e) {
      setErr(e instanceof Error ? e.message : '불러오지 못했습니다.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const onCreate = async () => {
    if (!token) return;
    const t = newTitle.trim();
    if (!t) return;
    setCreating(true);
    setErr(null);
    try {
      await createEContractDefinition(token, { title: t });
      setNewTitle('');
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : '등록하지 못했습니다.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-w-0 w-full max-w-full px-4 sm:px-0">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-fluid-xl font-semibold text-gray-900">전자계약</h1>
        </div>
      </div>

      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="text-fluid-sm font-medium text-gray-800">새 계약서</div>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="예: 팀장 용역 계약"
            className="min-w-0 flex-1 rounded-md border border-gray-300 px-3 py-2 text-fluid-sm"
          />
          <button
            type="button"
            disabled={creating || !newTitle.trim()}
            onClick={() => void onCreate()}
            className="rounded-lg bg-gray-900 px-4 py-2 text-fluid-sm font-medium text-white disabled:opacity-50"
          >
            등록
          </button>
        </div>
      </div>

      {err ? (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-fluid-sm text-red-800">{err}</div>
      ) : null}

      <div className="hidden lg:block">
        <div className="w-full min-w-0 max-w-full overflow-x-auto overscroll-x-contain">
          <table className="w-full table-fixed border-collapse border border-gray-200 bg-white text-fluid-sm">
            <colgroup>
              <col style={{ width: '28%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '18%' }} />
              <col style={{ width: '30%' }} />
            </colgroup>
            <thead>
              <tr className="bg-gray-100">
                <th className="border-b border-gray-200 px-2 py-2 text-center text-fluid-xs font-medium text-gray-700">
                  제목
                </th>
                <th className="border-b border-gray-200 px-2 py-2 text-center text-fluid-xs font-medium text-gray-700">
                  최신 배포
                </th>
                <th className="border-b border-gray-200 px-2 py-2 text-center text-fluid-xs font-medium text-gray-700">
                  버전 수
                </th>
                <th className="border-b border-gray-200 px-2 py-2 text-center text-fluid-xs font-medium text-gray-700">
                  발급 수
                </th>
                <th className="border-b border-gray-200 px-2 py-2 text-center text-fluid-xs font-medium text-gray-700">
                  관리
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-2 py-8 text-center text-gray-500">
                    불러오는 중…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-2 py-8 text-center text-gray-500">
                    <div>등록된 계약서가 없습니다.</div>
                  </td>
                </tr>
              ) : (
                rows.map((d) => {
                  const latest = d.versions[0];
                  return (
                    <tr key={d.id} className="group border-b border-gray-100 hover:bg-gray-50">
                      <td className="truncate px-2 py-2 text-center" title={d.title}>
                        {d.isArchived ? <span className="mr-1 text-fluid-2xs text-amber-700">보관</span> : null}
                        <Link
                          to={`/admin/team-leaders/e-contracts/definition/${d.id}`}
                          className="font-medium text-blue-700 hover:underline"
                        >
                          {d.title}
                        </Link>
                      </td>
                      <td className="px-2 py-2 text-center tabular-nums">
                        {latest?.publishedOrdinal != null ? (
                          <>
                            <span className="font-semibold text-gray-900">v{latest.publishedOrdinal}</span>
                            {latest.publishedAt ? (
                              <div className="text-fluid-2xs text-gray-500">
                                {new Date(latest.publishedAt).toLocaleString('ko-KR')}
                              </div>
                            ) : null}
                          </>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-2 py-2 text-center tabular-nums">{d._count.versions}</td>
                      <td className="px-2 py-2 text-center tabular-nums">{d._count.issuances}</td>
                      <td className="px-2 py-2 text-center">
                        <Link
                          to={`/admin/team-leaders/e-contracts/definition/${d.id}`}
                          className="text-blue-700 hover:underline"
                        >
                          상세·버전·발급
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-3 lg:hidden">
        {loading ? (
          <div className="rounded-lg border border-gray-200 bg-white p-6 text-center text-fluid-sm text-gray-500">
            불러오는 중…
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-white p-6 text-center text-fluid-sm text-gray-500">
            등록된 계약서가 없습니다.
          </div>
        ) : (
          rows.map((d) => {
            const latest = d.versions[0];
            return (
              <div key={d.id} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    {d.isArchived ? (
                      <span className="mb-1 inline-block rounded bg-amber-50 px-1.5 py-0.5 text-fluid-2xs text-amber-800">
                        보관
                      </span>
                    ) : null}
                    <Link to={`/admin/team-leaders/e-contracts/definition/${d.id}`} className="block truncate font-semibold text-blue-800">
                      {d.title}
                    </Link>
                    <div className="mt-2 text-fluid-2xs text-gray-600">
                      최신 배포{' '}
                      {latest?.publishedOrdinal != null ? (
                        <>
                          <span className="font-medium text-gray-900">v{latest.publishedOrdinal}</span>
                          {latest.publishedAt ? ` · ${new Date(latest.publishedAt).toLocaleString('ko-KR')}` : null}
                        </>
                      ) : (
                        <span className="text-gray-400">없음</span>
                      )}
                    </div>
                    <div className="mt-1 text-fluid-2xs text-gray-500">
                      버전 {d._count.versions} · 발급 {d._count.issuances}
                    </div>
                  </div>
                  <Link
                    to={`/admin/team-leaders/e-contracts/definition/${d.id}`}
                    className="shrink-0 rounded-md border border-gray-300 px-3 py-1 text-fluid-xs text-gray-800"
                  >
                    열기
                  </Link>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
