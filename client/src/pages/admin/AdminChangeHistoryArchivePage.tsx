import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import {
  deleteChangeHistoryEntry,
  getAdminChangeHistoryArchive,
  type ChangeHistoryItem,
  type ChangeLogCategory,
} from '../../api/inquiryChangeLogs';
import { ConfirmPasswordModal } from '../../components/admin/ConfirmPasswordModal';
import { PageTitleWithFavorite } from '../../components/layout/NavFavoritePageTitle';
import { ListPaginationBar } from '../../components/ui/ListPaginationBar';
import { YearMonthSelect, YmdSelect } from '../../components/ui/DateQuerySelects';
import { useAdminStaffSession } from '../../hooks/useAdminStaffSession';
import { getToken } from '../../stores/auth';
import { formatDateTimeCompactWithWeekday } from '../../utils/dateFormat';
import {
  clampListPage,
  parseInquiryListPageSize,
  parseListPage,
} from '../../utils/listPagination';

type DatePreset = 'all' | 'today' | 'month' | 'day';

function kstTodayYmd(): string {
  return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10);
}

function kstMonthYm(): string {
  return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 7);
}

function parseDatePreset(raw: string | null): DatePreset {
  if (raw === 'today' || raw === 'month' || raw === 'day' || raw === 'all') return raw;
  return 'all';
}

function formatWhen(iso: string): string {
  try {
    return formatDateTimeCompactWithWeekday(iso);
  } catch {
    return iso;
  }
}

const CATEGORY_LABEL: Record<ChangeLogCategory, string> = {
  date: '날짜',
  cost: '비용',
  extra: '추가청소',
  team: '팀장',
  status: '상태',
  etc: '기타',
};

function CategoryChips({ categories }: { categories: ChangeLogCategory[] }) {
  if (!categories.length) return null;
  return (
    <span className="inline-flex flex-wrap gap-1">
      {categories.map((c) => (
        <span
          key={c}
          className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-fluid-2xs text-slate-600"
        >
          {CATEGORY_LABEL[c] ?? c}
        </span>
      ))}
    </span>
  );
}

export function AdminChangeHistoryArchivePage() {
  const token = getToken();
  const navigate = useNavigate();
  const { role, isTenantOwner, isSuperAdmin } = useAdminStaffSession();
  const canDelete = isTenantOwner || isSuperAdmin;
  const [searchParams, setSearchParams] = useSearchParams();

  const page = parseListPage(searchParams.get('page'));
  const pageSize = parseInquiryListPageSize(searchParams.get('pageSize'));
  const datePreset = parseDatePreset(searchParams.get('datePreset'));
  const monthKey = searchParams.get('month') ?? kstMonthYm();
  const dayKey = searchParams.get('day') ?? kstTodayYmd();
  const searchQuery = searchParams.get('search') ?? '';
  const [searchInput, setSearchInput] = useState(searchQuery);

  const [items, setItems] = useState<ChangeHistoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ChangeHistoryItem | null>(null);
  const [pwdOpen, setPwdOpen] = useState(false);

  const offset = (page - 1) * pageSize;

  const apiParams = useMemo(
    () => ({
      search: searchQuery || undefined,
      limit: pageSize,
      offset,
      datePreset: datePreset === 'all' ? undefined : datePreset,
      month: datePreset === 'month' ? monthKey : undefined,
      day: datePreset === 'day' ? dayKey : undefined,
    }),
    [searchQuery, pageSize, offset, datePreset, monthKey, dayKey],
  );

  const syncUrl = useCallback(
    (patch: {
      page?: number;
      pageSize?: number;
      datePreset?: DatePreset;
      month?: string;
      day?: string;
      search?: string;
    }) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        const p = patch.page ?? page;
        const ps = patch.pageSize ?? pageSize;
        const dp = patch.datePreset ?? datePreset;
        next.set('page', String(p));
        next.set('pageSize', String(ps));
        if (dp === 'all') next.delete('datePreset');
        else next.set('datePreset', dp);
        if (dp === 'month') next.set('month', patch.month ?? monthKey);
        else next.delete('month');
        if (dp === 'day') next.set('day', patch.day ?? dayKey);
        else next.delete('day');
        const s = patch.search ?? searchQuery;
        if (s.trim()) next.set('search', s.trim());
        else next.delete('search');
        return next;
      });
    },
    [page, pageSize, datePreset, monthKey, dayKey, searchQuery, setSearchParams],
  );

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getAdminChangeHistoryArchive(token, apiParams);
      setItems(data.items);
      setTotal(data.total);
      const maxPage = Math.max(1, Math.ceil(data.total / pageSize));
      if (page > maxPage) {
        syncUrl({ page: clampListPage(page, data.total, pageSize) });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '불러오기에 실패했습니다.');
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [token, apiParams, page, pageSize, syncUrl]);

  useEffect(() => {
    setSearchInput(searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    if (!token) return;
    void load();
  }, [token, load]);

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (role && role !== 'ADMIN') {
    return <Navigate to="/admin/dashboard" replace />;
  }

  function applySearch() {
    syncUrl({ page: 1, search: searchInput });
  }

  function applyDatePreset(preset: DatePreset) {
    syncUrl({ page: 1, datePreset: preset });
  }

  async function handleDeleteConfirm(password: string) {
    if (!deleteTarget || !token) return;
    await deleteChangeHistoryEntry(token, deleteTarget.id, password);
    setDeleteTarget(null);
    setPwdOpen(false);
    await load();
  }

  function openInquiry(row: ChangeHistoryItem) {
    if (!row.inquiryId) return;
    navigate(`/admin/inquiries?openInquiry=${encodeURIComponent(row.inquiryId)}`);
  }

  return (
    <div className="min-w-0 w-full max-w-full space-y-3 sm:space-y-4">
      <PageTitleWithFavorite label="접수 변경 이력" path="/admin/team-leaders/change-history">
        <h1 className="text-xl font-semibold text-gray-800">접수 변경 이력</h1>
      </PageTitleWithFavorite>

      <p className="text-fluid-xs text-slate-600 leading-snug">
        업체 전체 접수 변경 기록을 조회합니다. 기록 시각·작업자·변경 내용을 확인할 수 있으며, 접수가
        연결된 항목은 클릭해 해당 접수로 이동할 수 있습니다.
      </p>

      <div
        className="rounded-xl border border-slate-200 bg-white px-3 py-3 sm:px-4 shadow-sm"
        data-staff-list-filter
      >
        <div className="flex flex-col gap-3 min-w-0">
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <span className="text-fluid-2xs font-semibold text-slate-600 shrink-0">기록일</span>
            <div className="inline-flex rounded-xl border border-slate-200 overflow-hidden text-fluid-sm shrink-0 shadow-sm">
              {(
                [
                  ['all', '전체'],
                  ['today', '당일'],
                  ['month', '월별'],
                  ['day', '날짜'],
                ] as const
              ).map(([key, label], idx) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => applyDatePreset(key)}
                  className={`px-3 py-1.5 font-medium transition-colors ${
                    idx > 0 ? 'border-l border-slate-200' : ''
                  } ${
                    datePreset === key
                      ? 'bg-slate-900 text-white'
                      : 'bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {datePreset === 'month' ? (
              <YearMonthSelect
                value={monthKey}
                onChange={(v) => syncUrl({ page: 1, month: v })}
                idPrefix="change-history"
                minYear={2020}
                maxYear={2040}
              />
            ) : null}
            {datePreset === 'day' ? (
              <YmdSelect
                value={dayKey}
                onChange={(v) => syncUrl({ page: 1, day: v })}
                idPrefix="change-history"
              />
            ) : null}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:flex-wrap">
            <div className="min-w-0 flex-1 sm:max-w-md">
              <label className="block text-fluid-2xs font-semibold text-slate-600 mb-1">검색</label>
              <input
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    applySearch();
                  }
                }}
                placeholder="고객명 또는 연락처"
                className="w-full min-h-9 rounded-lg border border-slate-200 px-3 py-2 text-fluid-xs focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400/30"
              />
            </div>
            <button
              type="button"
              onClick={applySearch}
              disabled={loading}
              className="min-h-9 rounded-lg bg-slate-900 px-4 py-2 text-fluid-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              검색
            </button>
            {searchQuery ? (
              <button
                type="button"
                onClick={() => {
                  setSearchInput('');
                  syncUrl({ page: 1, search: '' });
                }}
                className="min-h-9 rounded-lg border border-slate-200 bg-white px-3 py-2 text-fluid-xs text-slate-600 hover:bg-slate-50"
              >
                검색 지우기
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-fluid-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="bg-white border border-gray-200 rounded-lg min-w-0">
        <ListPaginationBar
          mode="summary"
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={(p) => syncUrl({ page: p })}
          onPageSizeChange={(ps) => syncUrl({ page: 1, pageSize: ps })}
        />

        {loading && items.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-fluid-sm">불러오는 중…</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-fluid-sm">표시할 변경 이력이 없습니다.</div>
        ) : (
          <>
            <div className="lg:hidden divide-y divide-slate-100">
              {items.map((row) => (
                <div key={row.id} className="p-3 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <button
                      type="button"
                      disabled={!row.inquiryId}
                      onClick={() => openInquiry(row)}
                      className={`text-left min-w-0 flex-1 ${
                        row.inquiryId ? 'hover:text-blue-700' : 'cursor-default'
                      }`}
                    >
                      <div className="font-semibold text-slate-900 truncate">{row.customerName}</div>
                      <div className="text-fluid-2xs text-slate-500 mt-0.5">
                        {formatWhen(row.createdAt)} · {row.actorName ?? '시스템'}
                      </div>
                    </button>
                    {canDelete ? (
                      <button
                        type="button"
                        className="shrink-0 text-fluid-2xs text-red-600 font-semibold"
                        onClick={() => {
                          setDeleteTarget(row);
                          setPwdOpen(true);
                        }}
                      >
                        삭제
                      </button>
                    ) : null}
                  </div>
                  <CategoryChips categories={row.categories} />
                  <p className="text-fluid-xs text-slate-700 line-clamp-2">{row.summaryLine}</p>
                  {row.inquiryId ? (
                    <button
                      type="button"
                      onClick={() => openInquiry(row)}
                      className="text-fluid-2xs text-blue-600 font-medium"
                    >
                      접수 보기 →
                    </button>
                  ) : null}
                </div>
              ))}
            </div>

            <div className="hidden lg:block w-full min-w-0 max-w-full overflow-x-auto overscroll-x-contain -mx-4 px-4 sm:mx-0 sm:px-0">
              <table className="w-full table-fixed border-collapse text-fluid-xs">
                <colgroup>
                  <col className="w-[14%]" />
                  <col className="w-[12%]" />
                  <col className="w-[10%]" />
                  <col className="w-[44%]" />
                  <col className="w-[12%]" />
                  <col className="w-[8%]" />
                </colgroup>
                <thead>
                  <tr className="bg-gray-100 border-b border-gray-200">
                    <th className="px-2 py-2 text-center font-medium text-gray-700">기록 시각</th>
                    <th className="px-2 py-2 text-center font-medium text-gray-700">고객</th>
                    <th className="px-2 py-2 text-center font-medium text-gray-700">작업자</th>
                    <th className="px-2 py-2 text-center font-medium text-gray-700">변경 내용</th>
                    <th className="px-2 py-2 text-center font-medium text-gray-700">유형</th>
                    <th className="px-2 py-2 text-center font-medium text-gray-700">접수</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row) => (
                    <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50 align-top">
                      <td className="px-2 py-2 text-center text-slate-600 whitespace-nowrap tabular-nums">
                        {formatWhen(row.createdAt)}
                      </td>
                      <td className="px-2 py-2 text-center truncate" title={row.customerName}>
                        {row.customerName}
                      </td>
                      <td className="px-2 py-2 text-center truncate" title={row.actorName ?? ''}>
                        {row.actorName ?? '시스템'}
                      </td>
                      <td className="px-2 py-2 text-center">
                        <ul className="text-left list-disc list-inside space-y-0.5">
                          {row.lines.slice(0, 3).map((line, i) => (
                            <li key={i} className="truncate" title={line}>
                              {line}
                            </li>
                          ))}
                          {row.lines.length > 3 ? (
                            <li className="text-slate-400">외 {row.lines.length - 3}건</li>
                          ) : null}
                        </ul>
                      </td>
                      <td className="px-2 py-2 text-center">
                        <CategoryChips categories={row.categories} />
                      </td>
                      <td className="px-2 py-2 text-center">
                        {row.inquiryId ? (
                          <button
                            type="button"
                            onClick={() => openInquiry(row)}
                            className="text-blue-600 hover:underline font-medium"
                          >
                            보기
                          </button>
                        ) : (
                          '—'
                        )}
                        {canDelete ? (
                          <>
                            <br />
                            <button
                              type="button"
                              className="text-red-600 hover:underline text-fluid-2xs mt-1"
                              onClick={() => {
                                setDeleteTarget(row);
                                setPwdOpen(true);
                              }}
                            >
                              삭제
                            </button>
                          </>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {!loading ? (
          <ListPaginationBar
            mode="nav"
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={(p) => syncUrl({ page: p })}
            onPageSizeChange={(ps) => syncUrl({ page: 1, pageSize: ps })}
          />
        ) : null}
      </div>

      <p className="text-fluid-2xs text-slate-500">
        FAB·대시보드 위젯은 최근 변경만 표시합니다. 전체 기록은 이 화면에서 조회하세요.{' '}
        <Link to="/admin/dashboard" className="text-blue-600 hover:underline">
          대시보드로
        </Link>
      </p>

      <ConfirmPasswordModal
        open={pwdOpen}
        title="히스토리 삭제"
        confirmLabel="삭제"
        onClose={() => {
          setPwdOpen(false);
          setDeleteTarget(null);
        }}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
