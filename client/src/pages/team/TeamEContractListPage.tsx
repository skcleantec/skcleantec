import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { listTeamEContractIssuances, type TeamLeaderEContractIssuanceItem } from '../../api/team';
import { clearTeamToken, getTeamToken } from '../../stores/teamAuth';
import { teamPreviewDepsKey } from '../../utils/teamPreviewQuery';
import { useInboxRealtime } from '../../hooks/useInboxRealtime';
import { useVisibilityInterval } from '../../hooks/useVisibilityInterval';
import { SyncHorizontalScroll } from '../../components/ui/SyncHorizontalScroll';
import { isAuthSessionExpiredError } from '../../api/auth';

function issuanceStatusKo(row: TeamLeaderEContractIssuanceItem): string {
  if (row.hasSigned || row.status === 'SIGNED') return '체결 완료';
  if (row.status === 'REVOKED') return '발급 취소';
  if (row.status === 'EXPIRED') return '만료됨';
  if (row.status === 'OPENED') return '열람됨';
  if (row.status === 'PENDING') return '대기';
  return row.status || '—';
}

function issuanceExpired(row: TeamLeaderEContractIssuanceItem): boolean {
  if (row.status === 'EXPIRED') return true;
  if (!row.expiresAt) return false;
  return new Date(row.expiresAt).getTime() < Date.now();
}

function canProceedToSign(row: TeamLeaderEContractIssuanceItem): boolean {
  if (row.definitionArchived || row.hasSigned || row.status === 'SIGNED') return false;
  if (row.status === 'REVOKED') return false;
  if (issuanceExpired(row)) return false;
  return row.status === 'PENDING' || row.status === 'OPENED';
}

function formatDt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function TeamEContractListPage() {
  const token = getTeamToken();
  const location = useLocation();
  const navigate = useNavigate();
  const previewKey = teamPreviewDepsKey(location.search);

  const [items, setItems] = useState<TeamLeaderEContractIssuanceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!token) return;
      if (!opts?.silent) setLoading(true);
      setError(null);
      try {
        const data = await listTeamEContractIssuances(token);
        setItems(data.items);
      } catch (e) {
        if (isAuthSessionExpiredError(e)) {
          clearTeamToken();
          navigate('/login', { replace: true, state: { sessionExpired: true } });
          return;
        }
        setItems([]);
        const msg =
          e instanceof Error
            ? e.message
            : typeof e === 'string'
              ? e
              : '목록을 불러오지 못했습니다.';
        setError(msg);
      } finally {
        if (!opts?.silent) setLoading(false);
      }
    },
    [token, navigate, previewKey],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const silentRefresh = useCallback(() => void load({ silent: true }), [load]);

  const { connected: listWsConnected } = useInboxRealtime(token, silentRefresh, Boolean(token));
  useVisibilityInterval(silentRefresh, token && !listWsConnected ? 20000 : 0);

  if (!token) {
    return (
      <div className="py-10 text-center text-fluid-sm text-gray-600">
        로그인이 필요합니다.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="py-12 text-center text-gray-500 text-fluid-sm">불러오는 중…</div>
    );
  }

  return (
    <div className="flex min-w-0 w-full max-w-full flex-col gap-4 pb-4">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold text-gray-800">전자 계약</h1>
        <p className="mt-1 text-fluid-sm text-gray-600">
          관리자가 발급한 계약서를 확인하고 같은 화면 흐름으로 서명할 수 있습니다. 체결은 보안 확인을 위해
          안내 페이지로 이동합니다.
        </p>
      </div>

      {error ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-fluid-sm text-amber-950">
          {error}
        </div>
      ) : null}

      {items.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white px-4 py-10 text-center text-fluid-sm text-gray-600">
          발급된 계약 초대가 없습니다. 관리자가 링크를 발급하면 여기에서 나타납니다.
        </div>
      ) : null}

      {items.length > 0 ? (
        <>
          <div className="lg:hidden space-y-3">
            {items.map((row) => {
              const signOk = canProceedToSign(row);
              const expired = issuanceExpired(row);
              return (
                <div key={row.id} className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm min-w-0">
                  <div className="font-semibold text-gray-900 text-fluid-sm truncate" title={row.definitionTitle}>
                    {row.definitionTitle || '계약서'}
                  </div>
                  <dl className="mt-2 space-y-1 text-fluid-xs text-gray-700">
                    <div className="flex justify-between gap-2">
                      <dt className="text-gray-500 shrink-0">버전</dt>
                      <dd className="min-w-0 text-right truncate">
                        {typeof row.versionOrdinal === 'number' ? `v${row.versionOrdinal}` : '—'} ·{' '}
                        {(row.versionTitle ?? '').trim() || '—'}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-gray-500 shrink-0">상태</dt>
                      <dd className="text-right">{issuanceStatusKo(row)}</dd>
                    </div>
                    {row.definitionArchived ? (
                      <div className="text-amber-800">보관된 계약서입니다. 관리자에게 문의해 주세요.</div>
                    ) : null}
                    {expired && !row.hasSigned ? (
                      <div className="text-gray-600">유효 기간이 지났습니다.</div>
                    ) : null}
                    <div className="flex justify-between gap-2">
                      <dt className="text-gray-500 shrink-0">발급</dt>
                      <dd className="text-right">{formatDt(row.createdAt)}</dd>
                    </div>
                    {row.expiresAt ? (
                      <div className="flex justify-between gap-2">
                        <dt className="text-gray-500 shrink-0">만료</dt>
                        <dd className="text-right">{formatDt(row.expiresAt)}</dd>
                      </div>
                    ) : (
                      <div className="flex justify-between gap-2">
                        <dt className="text-gray-500 shrink-0">만료</dt>
                        <dd className="text-right">제한 없음</dd>
                      </div>
                    )}
                  </dl>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {signOk ? (
                      <Link
                        to={`/e-contract/sign/${encodeURIComponent(row.token)}`}
                        className="rounded-md bg-blue-600 px-3 py-2 text-fluid-sm font-medium text-white hover:bg-blue-700 touch-manipulation"
                      >
                        계약하기 (서명)
                      </Link>
                    ) : null}
                    {row.hasSigned || row.status === 'SIGNED' ? (
                      <Link
                        to={`/e-contract/sign/${encodeURIComponent(row.token)}`}
                        className="rounded-md border border-gray-300 bg-white px-3 py-2 text-fluid-sm text-gray-800 hover:bg-gray-50 touch-manipulation"
                      >
                        체결 내용 보기
                      </Link>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>

          <SyncHorizontalScroll>
            <div className="-mx-4 px-4 sm:mx-0 sm:px-0 hidden lg:block w-full min-w-0 max-w-full overflow-x-auto overscroll-x-contain">
              <div className="bg-white border border-gray-200 rounded-lg">
                <table className="w-full border-collapse table-fixed border-separate border-spacing-0 text-fluid-xs min-w-[760px]">
                  <colgroup>
                    <col className="w-[22%]" />
                    <col className="w-[18%]" />
                    <col className="w-[12%]" />
                    <col className="w-[16%]" />
                    <col className="w-[15%]" />
                    <col className="w-[17%]" />
                  </colgroup>
                  <thead>
                    <tr className="bg-gray-100 text-gray-800">
                      <th className="border-b border-gray-200 px-2 py-2 text-center font-semibold sticky left-0 z-10 bg-gray-100 border-r border-gray-200">
                        계약서
                      </th>
                      <th className="border-b border-gray-200 px-2 py-2 text-center font-semibold">
                        버전
                      </th>
                      <th className="border-b border-gray-200 px-2 py-2 text-center font-semibold">
                        상태
                      </th>
                      <th className="border-b border-gray-200 px-2 py-2 text-center font-semibold">
                        발급
                      </th>
                      <th className="border-b border-gray-200 px-2 py-2 text-center font-semibold">
                        만료
                      </th>
                      <th className="border-b border-gray-200 px-2 py-2 text-center font-semibold">
                        진행
                      </th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-800">
                    {items.map((row) => {
                      const signOk = canProceedToSign(row);
                      const signed = row.hasSigned || row.status === 'SIGNED';
                      return (
                        <tr key={row.id} className="group hover:bg-gray-50">
                          <td className="border-b border-gray-100 px-2 py-2 text-center truncate sticky left-0 z-[1] bg-white group-hover:bg-gray-50 border-r border-gray-100">
                            <span title={row.definitionTitle}>{row.definitionTitle || '계약서'}</span>
                            {row.definitionArchived ? (
                              <span className="ml-1 text-fluid-2xs text-amber-700">보관됨</span>
                            ) : null}
                          </td>
                          <td className="border-b border-gray-100 px-2 py-2 text-center truncate" title={`${typeof row.versionOrdinal === 'number' ? `v${row.versionOrdinal} ` : ''}${row.versionTitle}`}>
                            {typeof row.versionOrdinal === 'number' ? `v${row.versionOrdinal}` : '—'}
                            <span className="block truncate text-fluid-2xs text-gray-600">
                              {(row.versionTitle ?? '').trim() || ''}
                            </span>
                          </td>
                          <td className="border-b border-gray-100 px-2 py-2 text-center text-fluid-xs">
                            {issuanceStatusKo(row)}
                          </td>
                          <td className="border-b border-gray-100 px-2 py-2 text-center text-fluid-xs">
                            {formatDt(row.createdAt)}
                          </td>
                          <td className="border-b border-gray-100 px-2 py-2 text-center text-fluid-xs">
                            {row.expiresAt ? formatDt(row.expiresAt) : '—'}
                          </td>
                          <td className="border-b border-gray-100 px-2 py-2 text-center">
                            <div className="flex flex-col items-center gap-1 min-w-0">
                              {signOk ? (
                                <Link
                                  to={`/e-contract/sign/${encodeURIComponent(row.token)}`}
                                  className="inline-flex rounded-md bg-blue-600 px-2 py-1 text-fluid-2xs font-medium text-white hover:bg-blue-700 touch-manipulation"
                                >
                                  계약하기
                                </Link>
                              ) : null}
                              {signed ? (
                                <Link
                                  to={`/e-contract/sign/${encodeURIComponent(row.token)}`}
                                  className="inline-flex rounded-md border border-gray-300 bg-white px-2 py-1 text-fluid-2xs text-gray-800 hover:bg-gray-50 touch-manipulation"
                                >
                                  체결 확인
                                </Link>
                              ) : null}
                              {!signOk && !signed ? (
                                <span className="text-fluid-2xs text-gray-500">—</span>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </SyncHorizontalScroll>

          <p className="text-fluid-2xs text-gray-500 lg:block hidden px-2 sm:px-0">
            표가 넓을 때는 좌우로 스크롤하여 볼 수 있습니다.
          </p>
        </>
      ) : null}
    </div>
  );
}
