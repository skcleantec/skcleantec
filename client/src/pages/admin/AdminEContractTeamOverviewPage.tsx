import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AdminEContractSubmissionDetailModal } from '../../components/e-contract/AdminEContractSubmissionDetailModal';
import { ListPaginationBar } from '../../components/ui/ListPaginationBar';
import { SyncHorizontalScroll } from '../../components/ui/SyncHorizontalScroll';
import { YearMonthSelect, YmdSelect } from '../../components/ui/DateQuerySelects';
import { getToken } from '../../stores/auth';
import {
  listAllEContractSubmissions,
  pickerAllContractRecipients,
  type EContractSubmissionRow,
  type EContractRecipientPicker,
} from '../../api/adminEContract';
import { eContractRecipientRoleLabel } from '../../utils/eContractDisplay';
import { kstTodayYmd } from '../../utils/dateFormat';
import {
  clampListPage,
  INQUIRY_LIST_DEFAULT_PAGE_SIZE,
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
  return 'month';
}

function signedDaysAgo(signedIso: string): string {
  const ms = Date.now() - new Date(signedIso).getTime();
  if (Number.isNaN(ms) || ms < 0) return '—';
  const d = Math.floor(ms / 86400000);
  const h = Math.floor(ms / 3600000);
  if (d >= 1) return `${d}일 전`;
  if (h >= 1) return `${h}시간 전`;
  return '방금';
}

function SubmissionRowActions({
  submissionId,
  onOpen,
}: {
  submissionId: string;
  onOpen: (id: string) => void;
}) {
  return (
    <button
      type="button"
      className="rounded-md border border-blue-200 bg-blue-50 px-3 py-1.5 text-fluid-xs font-medium text-blue-900 hover:bg-blue-100"
      onClick={() => onOpen(submissionId)}
    >
      상세보기
    </button>
  );
}

export function AdminEContractTeamOverviewPage() {
  const token = getToken();
  const [searchParams, setSearchParams] = useSearchParams();

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
  const filterLeaderId = searchParams.get('teamLeaderId') ?? '';
  const listPage = parseListPage(searchParams.get('page'));
  const listPageSize = parseInquiryListPageSize(searchParams.get('pageSize'));

  const [pickers, setPickers] = useState<EContractRecipientPicker[]>([]);
  const [rows, setRows] = useState<EContractSubmissionRow[]>([]);
  const [listTotal, setListTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [submissionModalId, setSubmissionModalId] = useState<string | null>(null);

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

  const loadPickers = useCallback(async () => {
    if (!token) return;
    try {
      const data = await pickerAllContractRecipients(token);
      setPickers(data.recipients);
    } catch (e) {
      setErr(e instanceof Error ? e.message : '팀장 목록을 불러오지 못했습니다.');
    }
  }, [token]);

  const loadList = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setErr(null);
    try {
      const offset = (effectivePage - 1) * listPageSize;
      const data = await listAllEContractSubmissions(token, {
        teamLeaderId: filterLeaderId || undefined,
        datePreset: datePreset === 'all' ? undefined : datePreset,
        month: datePreset === 'month' ? monthKey : undefined,
        day: datePreset === 'day' ? dayKey : undefined,
        limit: listPageSize,
        offset,
      });
      setRows(data.submissions);
      setListTotal(data.total);
    } catch (e) {
      setErr(e instanceof Error ? e.message : '체결 목록을 불러오지 못했습니다.');
      setRows([]);
      setListTotal(0);
    } finally {
      setLoading(false);
    }
  }, [token, effectivePage, listPageSize, filterLeaderId, datePreset, monthKey, dayKey]);

  useEffect(() => {
    void loadPickers();
  }, [loadPickers]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

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

  const dateFilterLabel =
    datePreset === 'today'
      ? '당일'
      : datePreset === 'month'
        ? `월별 · ${monthKey}`
        : datePreset === 'day'
          ? `날짜 · ${dayKey}`
          : '전체';

  return (
    <div className="min-w-0 w-full max-w-full px-4 sm:px-0">
      <h1 className="text-fluid-xl font-semibold text-gray-900">체결 기록</h1>
      <p className="mt-1 text-fluid-sm text-gray-600">체결일 기준으로 조회합니다.</p>

      <div className="mt-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4">
          <div>
            <span className="text-fluid-xs font-medium text-gray-700">체결일</span>
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

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <div className="min-w-[200px] max-w-md flex-1">
              <label className="block text-fluid-xs font-medium text-gray-700">수신자 필터(선택)</label>
              <select
                value={filterLeaderId}
                onChange={(e) =>
                  patchParams((next) => {
                    const v = e.target.value;
                    if (v) next.set('teamLeaderId', v);
                    else next.delete('teamLeaderId');
                    next.delete('page');
                  })
                }
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-fluid-sm"
              >
                <option value="">전체</option>
                {pickers.map((u) => (
                  <option key={u.id} value={u.id}>
                    [{eContractRecipientRoleLabel(u.role)}] {u.name} ({u.email})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <ListPaginationBar
          mode="summary"
          page={effectivePage}
          pageSize={listPageSize}
          total={listTotal}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
        />
      </div>

      {err ? (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-fluid-sm text-red-800">{err}</div>
      ) : null}

      {loading ? (
        <div className="mt-10 text-center text-fluid-sm text-gray-500">불러오는 중…</div>
      ) : rows.length === 0 ? (
        <div className="mt-10 text-center text-fluid-sm text-gray-500">표시할 체결 기록이 없습니다.</div>
      ) : (
        <>
          <div className="mt-4 space-y-3 lg:hidden">
            {rows.map((s) => (
              <div key={s.id} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                <div className="font-semibold text-gray-900 truncate" title={s.definitionTitle}>
                  {s.definitionTitle}
                </div>
                <dl className="mt-2 space-y-1 text-fluid-xs text-gray-700">
                  <div className="flex justify-between gap-2">
                    <dt className="text-gray-500 shrink-0">수신자</dt>
                    <dd className="min-w-0 truncate text-right" title={s.teamLeaderName}>
                      {s.teamLeaderName}
                      {s.recipientRole ? (
                        <span className="text-gray-500"> · {eContractRecipientRoleLabel(s.recipientRole)}</span>
                      ) : null}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-gray-500 shrink-0">버전</dt>
                    <dd>{s.versionOrdinal != null ? `v${s.versionOrdinal}` : '—'}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-gray-500 shrink-0">체결</dt>
                    <dd className="text-right tabular-nums">{new Date(s.signedAt).toLocaleString('ko-KR')}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-gray-500 shrink-0">경과</dt>
                    <dd>{signedDaysAgo(String(s.signedAt))}</dd>
                  </div>
                </dl>
                <div className="mt-3">
                  <SubmissionRowActions submissionId={s.id} onOpen={setSubmissionModalId} />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 hidden lg:block">
            <p className="mb-2 text-fluid-2xs text-gray-500 lg:hidden">표는 좌우로 스크롤하여 전체 열을 볼 수 있습니다.</p>
            <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
              <SyncHorizontalScroll className="min-w-0" contentClassName="-mx-4 px-4 sm:mx-0 sm:px-0">
                <table className="w-full min-w-[920px] table-fixed border-collapse border-0 text-fluid-sm">
                  <colgroup>
                    <col style={{ width: '12%' }} />
                    <col style={{ width: '18%' }} />
                    <col style={{ width: '20%' }} />
                    <col style={{ width: '7%' }} />
                    <col style={{ width: '16%' }} />
                    <col style={{ width: '9%' }} />
                    <col style={{ width: '18%' }} />
                  </colgroup>
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-100">
                      <th className="px-2 py-2 text-center text-fluid-xs font-medium text-gray-800">수신자</th>
                      <th className="px-2 py-2 text-center text-fluid-xs font-medium text-gray-800">이메일</th>
                      <th className="px-2 py-2 text-center text-fluid-xs font-medium text-gray-800">계약 종류</th>
                      <th className="px-2 py-2 text-center text-fluid-xs font-medium text-gray-800">버전</th>
                      <th className="px-2 py-2 text-center text-fluid-xs font-medium text-gray-800">체결 시각</th>
                      <th className="px-2 py-2 text-center text-fluid-xs font-medium text-gray-800">경과</th>
                      <th className="px-2 py-2 text-center text-fluid-xs font-medium text-gray-800">상세</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((s) => (
                      <tr key={s.id} className="group border-b border-gray-100 hover:bg-gray-50">
                        <td className="truncate px-2 py-2 text-center text-fluid-xs" title={s.teamLeaderName}>
                          {s.teamLeaderName}
                          {s.recipientRole ? (
                            <div className="text-fluid-2xs text-gray-500">
                              {eContractRecipientRoleLabel(s.recipientRole)}
                            </div>
                          ) : null}
                        </td>
                        <td className="truncate px-2 py-2 text-center text-fluid-2xs" title={s.teamLeaderEmail}>
                          {s.teamLeaderEmail}
                        </td>
                        <td className="truncate px-2 py-2 text-center text-fluid-xs" title={s.definitionTitle}>
                          {s.definitionTitle}
                        </td>
                        <td className="px-2 py-2 text-center tabular-nums text-fluid-xs">
                          {s.versionOrdinal != null ? `v${s.versionOrdinal}` : '—'}
                        </td>
                        <td className="truncate px-2 py-2 text-center text-fluid-2xs tabular-nums">
                          {new Date(s.signedAt).toLocaleString('ko-KR')}
                        </td>
                        <td className="px-2 py-2 text-center text-fluid-xs">{signedDaysAgo(String(s.signedAt))}</td>
                        <td className="px-2 py-2 text-center">
                          <SubmissionRowActions submissionId={s.id} onOpen={setSubmissionModalId} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </SyncHorizontalScroll>
            </div>
          </div>

          {!loading ? (
            <div className="mt-4">
              <ListPaginationBar
                mode="nav"
                page={effectivePage}
                pageSize={listPageSize}
                total={listTotal}
                onPageChange={handlePageChange}
                onPageSizeChange={handlePageSizeChange}
              />
            </div>
          ) : null}

          <p className="mt-3 text-center text-fluid-2xs text-gray-500">
            {dateFilterLabel}
            {filterLeaderId ? ' · 수신자 필터 적용' : ''} · 최신순
          </p>
        </>
      )}

      <AdminEContractSubmissionDetailModal
        token={token}
        submissionId={submissionModalId}
        open={Boolean(submissionModalId)}
        onClose={() => setSubmissionModalId(null)}
      />
    </div>
  );
}
