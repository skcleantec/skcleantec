import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { EContractPagedPreviewModal } from '../../components/e-contract/EContractPagedPreviewModal';
import { ListPaginationBar } from '../../components/ui/ListPaginationBar';
import { YearMonthSelect, YmdSelect } from '../../components/ui/DateQuerySelects';
import { fetchEContractPublicSession, type PublicSignSessionDto } from '../../api/eContractPublic';
import { listTeamEContractIssuances, type TeamLeaderEContractIssuanceItem } from '../../api/team';
import { clearTeamToken, getTeamToken } from '../../stores/teamAuth';
import { teamPreviewDepsKey, useTeamPreviewStaleGuard } from '../../utils/teamPreviewQuery';
import { useInboxRealtime } from '../../hooks/useInboxRealtime';
import { useVisibilityInterval } from '../../hooks/useVisibilityInterval';
import { SyncHorizontalScroll } from '../../components/ui/SyncHorizontalScroll';
import { isAuthSessionExpiredError } from '../../api/auth';
import { eContractIssuanceStatusKo } from '../../utils/eContractDisplay';
import { kstTodayYmd } from '../../utils/dateFormat';
import {
  INQUIRY_LIST_DEFAULT_PAGE_SIZE,
  clampListPage,
  parseInquiryListPageSize,
  parseListPage,
  type InquiryListPageSize,
} from '../../utils/listPagination';

type DatePreset = 'today' | 'all' | 'month' | 'day';

function kstMonthKeyNow(): string {
  return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 7);
}

function parseDatePreset(raw: string | null): DatePreset {
  if (raw === 'today' || raw === 'all' || raw === 'month' || raw === 'day') return raw;
  return 'all';
}

function issuanceStatusKo(row: TeamLeaderEContractIssuanceItem): string {
  return eContractIssuanceStatusKo(row.status, row.hasSigned);
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

function TeamIssuanceDocActions({
  row,
  busy,
  compact,
  tableRow,
  onPreview,
  onPdfSave,
}: {
  row: TeamLeaderEContractIssuanceItem;
  busy: boolean;
  compact?: boolean;
  /** PC 표 진행 열: 버튼을 한 줄로 유지하고 넘치면 가로 스크롤 */
  tableRow?: boolean;
  onPreview: () => void;
  onPdfSave: () => void;
}) {
  if (row.definitionArchived) return null;
  const btn =
    compact === true
      ? 'shrink-0 inline-flex rounded-md border px-2 py-1 text-fluid-2xs font-medium disabled:opacity-50 touch-manipulation whitespace-nowrap'
      : 'inline-flex rounded-md border px-3 py-2 text-fluid-xs font-medium disabled:opacity-50 touch-manipulation';
  const rowClass =
    tableRow === true
      ? 'inline-flex shrink-0 flex-nowrap items-center gap-1'
      : `flex flex-wrap gap-1 ${compact ? 'justify-center' : ''}`;
  return (
    <div className={rowClass}>
      <button type="button" disabled={busy} className={`${btn} border-blue-600 bg-white text-blue-900 hover:bg-blue-50`} onClick={onPreview}>
        미리보기
      </button>
      <button type="button" disabled={busy} className={`${btn} border-gray-900 bg-gray-900 text-white hover:bg-gray-800`} onClick={onPdfSave}>
        PDF로 저장
      </button>
    </div>
  );
}

export function TeamEContractListPage() {
  const token = getTeamToken();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const previewKey = teamPreviewDepsKey(location.search);
  const { capturePreviewKey, isPreviewFetchStale } = useTeamPreviewStaleGuard(previewKey);

  const datePreset = parseDatePreset(searchParams.get('datePreset'));
  const monthKey = useMemo(() => {
    const m = searchParams.get('month');
    if (m && /^\d{4}-\d{2}$/.test(m)) return m;
    return kstMonthKeyNow();
  }, [searchParams]);
  const dayKey = useMemo(() => {
    const d = searchParams.get('day');
    if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
    return kstTodayYmd();
  }, [searchParams]);
  const listPage = parseListPage(searchParams.get('page'));
  const listPageSize = parseInquiryListPageSize(searchParams.get('pageSize'));

  const [items, setItems] = useState<TeamLeaderEContractIssuanceItem[]>([]);
  const [listTotal, setListTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [previewSession, setPreviewSession] = useState<PublicSignSessionDto | null>(null);
  const [pagedPreviewOpen, setPagedPreviewOpen] = useState(false);
  const [pagedAutoPdfDownload, setPagedAutoPdfDownload] = useState(false);
  const [docFetchRowId, setDocFetchRowId] = useState<string | null>(null);

  const effectivePage = clampListPage(listPage, listTotal, listPageSize);

  const patchParams = useCallback(
    (patch: (next: URLSearchParams) => void) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          patch(next);
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  const closeDocPreview = useCallback(() => {
    setPagedPreviewOpen(false);
    setPagedAutoPdfDownload(false);
    setPreviewSession(null);
  }, []);

  const runWithPublicSession = useCallback(
    async (row: TeamLeaderEContractIssuanceItem, fn: (session: PublicSignSessionDto) => void) => {
      setDocFetchRowId(row.id);
      try {
        const session = await fetchEContractPublicSession(row.token);
        fn(session);
      } catch (e) {
        window.alert(e instanceof Error ? e.message : '계약 본문을 불러오지 못했습니다.');
      } finally {
        setDocFetchRowId(null);
      }
    },
    [],
  );

  const onDocPreview = useCallback(
    (row: TeamLeaderEContractIssuanceItem) =>
      void runWithPublicSession(row, (session) => {
        setPreviewSession(session);
        setPagedAutoPdfDownload(false);
        setPagedPreviewOpen(true);
      }),
    [runWithPublicSession],
  );

  const onDocPrint = useCallback(
    (row: TeamLeaderEContractIssuanceItem) =>
      void runWithPublicSession(row, (session) => {
        setPreviewSession(session);
        setPagedAutoPdfDownload(true);
        setPagedPreviewOpen(true);
      }),
    [runWithPublicSession],
  );

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!token) return;
      if (!opts?.silent) setLoading(true);
      setError(null);
      const startedKey = capturePreviewKey();
      try {
        const offset = (effectivePage - 1) * listPageSize;
        const data = await listTeamEContractIssuances(token, {
          datePreset: datePreset === 'all' ? undefined : datePreset,
          month: datePreset === 'month' ? monthKey : undefined,
          day: datePreset === 'day' ? dayKey : undefined,
          limit: listPageSize,
          offset,
        });
        if (isPreviewFetchStale(startedKey)) return;
        setItems(data.items);
        setListTotal(data.total);
      } catch (e) {
        if (isPreviewFetchStale(startedKey)) return;
        if (isAuthSessionExpiredError(e)) {
          clearTeamToken();
          navigate('/login', { replace: true, state: { sessionExpired: true } });
          return;
        }
        setItems([]);
        setListTotal(0);
        const msg =
          e instanceof Error
            ? e.message
            : typeof e === 'string'
              ? e
              : '목록을 불러오지 못했습니다.';
        setError(msg);
      } finally {
        if (!opts?.silent && !isPreviewFetchStale(startedKey)) setLoading(false);
      }
    },
    [token, navigate, previewKey, effectivePage, listPageSize, datePreset, monthKey, dayKey, capturePreviewKey, isPreviewFetchStale],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const silentRefresh = useCallback(() => void load({ silent: true }), [load]);

  const { connected: listWsConnected } = useInboxRealtime(token, silentRefresh, Boolean(token));
  useVisibilityInterval(silentRefresh, token && !listWsConnected ? 20000 : 0);

  const applyDatePreset = (preset: DatePreset) => {
    patchParams((next) => {
      if (preset === 'all') next.delete('datePreset');
      else next.set('datePreset', preset);
      if (preset === 'month') {
        next.set('month', monthKey);
        next.delete('day');
      } else if (preset === 'day') {
        next.set('day', dayKey);
        next.delete('month');
      } else {
        next.delete('month');
        next.delete('day');
      }
      next.delete('page');
    });
  };

  const handlePageChange = (page: number) => {
    patchParams((next) => {
      if (page <= 1) next.delete('page');
      else next.set('page', String(page));
    });
  };

  const handlePageSizeChange = (size: InquiryListPageSize) => {
    patchParams((next) => {
      if (size === INQUIRY_LIST_DEFAULT_PAGE_SIZE) next.delete('pageSize');
      else next.set('pageSize', String(size));
      next.delete('page');
    });
  };

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
        <p className="mt-2 text-fluid-2xs text-gray-500">
          목록에서 「미리보기」「PDF로 저장」으로 A4 분할 문서를 확인·파일로 받을 수 있습니다. 서명 화면에서도 동일합니다.
        </p>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <span className="text-fluid-xs font-medium text-gray-700">발급일</span>
        <div className="mt-2 inline-flex flex-wrap gap-1 rounded-lg border border-gray-200 p-1">
          {(
            [
              ['today', '당일'],
              ['all', '전체'],
              ['month', '월별'],
              ['day', '날짜'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => applyDatePreset(key)}
              className={`rounded-md px-3 py-1.5 text-fluid-xs font-medium ${
                datePreset === key ? 'bg-gray-800 text-white' : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {datePreset === 'month' ? (
          <div className="mt-3">
            <YearMonthSelect
              value={monthKey}
              onChange={(ym) =>
                patchParams((next) => {
                  next.set('month', ym);
                  next.delete('page');
                })
              }
            />
          </div>
        ) : null}
        {datePreset === 'day' ? (
          <div className="mt-3">
            <YmdSelect
              value={dayKey}
              onChange={(ymd) =>
                patchParams((next) => {
                  next.set('day', ymd);
                  next.delete('page');
                })
              }
            />
          </div>
        ) : null}
      </div>

      <ListPaginationBar
        mode="summary"
        page={effectivePage}
        pageSize={listPageSize}
        total={listTotal}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
      />

      {error ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-fluid-sm text-amber-950">
          {error}
        </div>
      ) : null}

      {items.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white px-4 py-10 text-center text-fluid-sm text-gray-600">
          {listTotal === 0 ? '발급된 계약 초대가 없습니다. 관리자가 링크를 발급하면 여기에서 나타납니다.' : '이 페이지에 표시할 항목이 없습니다.'}
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
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-md bg-blue-600 px-3 py-2 text-fluid-sm font-medium text-white hover:bg-blue-700 touch-manipulation"
                      >
                        계약하기 (서명)
                      </Link>
                    ) : null}
                    {row.hasSigned || row.status === 'SIGNED' ? (
                      <Link
                        to={`/e-contract/sign/${encodeURIComponent(row.token)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-md border border-gray-300 bg-white px-3 py-2 text-fluid-sm text-gray-800 hover:bg-gray-50 touch-manipulation"
                      >
                        체결 내용 보기
                      </Link>
                    ) : null}
                  </div>
                  <div className="mt-2">
                    <TeamIssuanceDocActions
                      row={row}
                      busy={docFetchRowId === row.id}
                      onPreview={() => onDocPreview(row)}
                      onPdfSave={() => onDocPrint(row)}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <SyncHorizontalScroll>
            <div className="-mx-4 px-4 sm:mx-0 sm:px-0 hidden lg:block w-full min-w-0 max-w-full overflow-x-auto overscroll-x-contain">
              <div className="bg-white border border-gray-200 rounded-lg">
                <table className="w-full border-collapse table-fixed border-separate border-spacing-0 text-fluid-xs min-w-[820px]">
                  <colgroup>
                    <col className="w-[22%]" />
                    <col className="w-[18%]" />
                    <col className="w-[12%]" />
                    <col className="w-[16%]" />
                    <col className="w-[13%]" />
                    <col className="w-[19%]" />
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
                          <td className="border-b border-gray-100 px-1 py-2 text-center">
                            <div className="mx-auto flex min-w-0 max-w-full flex-nowrap items-center justify-center gap-1 overflow-x-auto overscroll-x-contain py-0.5 [scrollbar-width:thin]" style={{ WebkitOverflowScrolling: 'touch' }}>
                              {signOk ? (
                                <Link
                                  to={`/e-contract/sign/${encodeURIComponent(row.token)}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="shrink-0 inline-flex whitespace-nowrap rounded-md bg-blue-600 px-2 py-1 text-fluid-2xs font-medium text-white hover:bg-blue-700 touch-manipulation"
                                >
                                  계약하기
                                </Link>
                              ) : null}
                              {signed ? (
                                <Link
                                  to={`/e-contract/sign/${encodeURIComponent(row.token)}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="shrink-0 inline-flex whitespace-nowrap rounded-md border border-gray-300 bg-white px-2 py-1 text-fluid-2xs text-gray-800 hover:bg-gray-50 touch-manipulation"
                                >
                                  체결 확인
                                </Link>
                              ) : null}
                              {!signOk && !signed ? (
                                <span className="shrink-0 text-fluid-2xs text-gray-500">—</span>
                              ) : null}
                              <TeamIssuanceDocActions
                                row={row}
                                busy={docFetchRowId === row.id}
                                compact
                                tableRow
                                onPreview={() => onDocPreview(row)}
                                onPdfSave={() => onDocPrint(row)}
                              />
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

          {!loading ? (
            <ListPaginationBar
              mode="nav"
              page={effectivePage}
              pageSize={listPageSize}
              total={listTotal}
              onPageChange={handlePageChange}
              onPageSizeChange={handlePageSizeChange}
            />
          ) : null}
        </>
      ) : null}

      {previewSession ? (
        <EContractPagedPreviewModal
          open={pagedPreviewOpen}
          onClose={closeDocPreview}
          bodyRaw={previewSession.bodyMarkdown}
          docId={previewSession.issuanceId}
          definitionTitle={previewSession.definitionTitle}
          versionOrdinal={previewSession.versionOrdinal}
          autoDownloadPdfOnReady={pagedAutoPdfDownload}
          onAutoDownloadPdfConsumed={() => setPagedAutoPdfDownload(false)}
        />
      ) : null}
    </div>
  );
}
