import { useCallback, useEffect, useMemo, useState } from 'react';
import { PageTitleWithFavorite } from '../../components/layout/NavFavoritePageTitle';
import { Navigate } from 'react-router-dom';
import { ConfirmPasswordModal } from '../../components/admin/ConfirmPasswordModal';
import { ListPaginationBar } from '../../components/ui/ListPaginationBar';
import { YearMonthSelect, YmdSelect } from '../../components/ui/DateQuerySelects';
import { getToken } from '../../stores/auth';
import { useAdminStaffSession } from '../../hooks/useAdminStaffSession';
import { resolveEffectiveStaffAdminFromMe } from '../../utils/staffAdminAccess';
import {
  getInquiryTrashList,
  purgeInquiryFromTrash,
  restoreInquiryFromTrash,
  type InquiryTrashItem,
} from '../../api/inquiryTrash';
import {
  INQUIRY_LIST_DEFAULT_PAGE_SIZE,
  INQUIRY_LIST_PAGE_SIZE_OPTIONS,
} from '../../utils/listPagination';

function kstTodayYmd(): string {
  return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10);
}

type DatePreset = 'today' | 'all' | 'month' | 'day';

type PendingAction =
  | { kind: 'restore'; row: InquiryTrashItem }
  | { kind: 'purge'; row: InquiryTrashItem };

function formatDeletedAt(iso: string): string {
  try {
    return new Date(iso).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
  } catch {
    return iso;
  }
}

export function AdminInquiryTrashPage() {
  const token = getToken();
  const { ready, staffMe } = useAdminStaffSession();
  const isStaffAdmin = useMemo(() => resolveEffectiveStaffAdminFromMe(staffMe), [staffMe]);

  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const [monthKey, setMonthKey] = useState(() => kstTodayYmd().slice(0, 7));
  const [dayKey, setDayKey] = useState(() => kstTodayYmd());
  const [search, setSearch] = useState('');
  const [searchDraft, setSearchDraft] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(INQUIRY_LIST_DEFAULT_PAGE_SIZE);
  const [items, setItems] = useState<InquiryTrashItem[]>([]);
  const [total, setTotal] = useState(0);
  const [retentionDays, setRetentionDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchList = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const offset = (page - 1) * pageSize;
      const r = await getInquiryTrashList(token, {
        limit: pageSize,
        offset,
        search: search || undefined,
        datePreset,
        month: datePreset === 'month' ? monthKey : undefined,
        day: datePreset === 'day' ? dayKey : undefined,
      });
      setItems(r.items);
      setTotal(r.total);
      setRetentionDays(r.retentionDays);
    } catch (e) {
      setError(e instanceof Error ? e.message : '목록을 불러올 수 없습니다.');
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [token, page, pageSize, search, datePreset, monthKey, dayKey]);

  useEffect(() => {
    void fetchList();
  }, [fetchList]);

  const onPresetChange = (preset: DatePreset) => {
    setDatePreset(preset);
    setPage(1);
  };

  const onSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchDraft.trim());
    setPage(1);
  };

  const handlePasswordConfirm = async (password: string) => {
    if (!token || !pending) return;
    setActionError(null);
    try {
      if (pending.kind === 'restore') {
        await restoreInquiryFromTrash(token, pending.row.id, password);
      } else {
        await purgeInquiryFromTrash(token, pending.row.id, password);
      }
      setPending(null);
      await fetchList();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : '처리에 실패했습니다.');
    }
  };

  if (!token) {
    return <Navigate to="/login" replace />;
  }
  if (ready && !isStaffAdmin) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  const presetBtn = (preset: DatePreset, label: string) => (
    <button
      type="button"
      onClick={() => onPresetChange(preset)}
      className={`rounded-lg px-3 py-1.5 text-fluid-xs font-medium ${
        datePreset === preset ? 'bg-slate-900 text-white' : 'bg-white text-gray-700 border border-gray-300'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="min-w-0 w-full max-w-full space-y-4">
      <div>
        <PageTitleWithFavorite label="접수 휴지통">
          <h1 className="text-xl font-semibold text-gray-900">접수 휴지통</h1>
        </PageTitleWithFavorite>
        <p className="mt-1 text-fluid-sm text-gray-600 leading-relaxed">
          삭제된 접수는 <strong className="font-medium">{retentionDays}일</strong> 동안 보관됩니다. 기간이 지나면
          배정·사진·변경 이력과 함께 <strong className="font-medium">자동으로 영구 삭제</strong>됩니다. 복구하면
          일반 접수 목록·스케줄에 다시 나타납니다.
        </p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-fluid-xs font-medium text-gray-700">삭제일</span>
          {presetBtn('today', '당일')}
          {presetBtn('all', '전체')}
          {presetBtn('month', '월별')}
          {presetBtn('day', '날짜')}
        </div>
        {datePreset === 'month' ? (
          <YearMonthSelect value={monthKey} onChange={(v) => { setMonthKey(v); setPage(1); }} />
        ) : null}
        {datePreset === 'day' ? (
          <YmdSelect value={dayKey} onChange={(v) => { setDayKey(v); setPage(1); }} />
        ) : null}
        <form onSubmit={onSearchSubmit} className="flex flex-wrap gap-2">
          <input
            type="search"
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            placeholder="고객명·연락처·접수번호"
            className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-fluid-sm"
          />
          <button type="submit" className="rounded-lg bg-slate-800 px-4 py-2 text-fluid-xs text-white">
            검색
          </button>
        </form>
      </div>

      <ListPaginationBar
        mode="summary"
        page={page}
        pageSize={pageSize}
        total={total}
        pageSizeOptions={INQUIRY_LIST_PAGE_SIZE_OPTIONS}
        onPageChange={setPage}
        onPageSizeChange={(n) => {
          setPageSize(n);
          setPage(1);
        }}
      />

      {error ? <p className="text-fluid-sm text-red-600">{error}</p> : null}

      <div className="bg-white border border-gray-200 rounded-lg -mx-4 px-4 sm:mx-0 sm:px-0">
        <div
          className="w-full min-w-0 max-w-full overflow-x-auto overscroll-x-contain"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          <table className="w-full min-w-[720px] table-fixed border-collapse text-fluid-xs">
            <colgroup>
              <col className="w-[12%]" />
              <col className="w-[10%]" />
              <col className="w-[14%]" />
              <col className="w-[18%]" />
              <col className="w-[14%]" />
              <col className="w-[10%]" />
              <col className="w-[12%]" />
              <col className="w-[10%]" />
            </colgroup>
            <thead>
              <tr className="bg-gray-100 text-gray-700">
                <th className="px-2 py-2 text-center font-medium">고객명</th>
                <th className="px-2 py-2 text-center font-medium">접수번호</th>
                <th className="px-2 py-2 text-center font-medium">연락처</th>
                <th className="px-2 py-2 text-center font-medium">주소</th>
                <th className="px-2 py-2 text-center font-medium">삭제일시</th>
                <th className="px-2 py-2 text-center font-medium">삭제자</th>
                <th className="px-2 py-2 text-center font-medium">영구삭제 예정</th>
                <th className="px-2 py-2 text-center font-medium">작업</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-fluid-sm text-gray-500">
                    불러오는 중…
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-fluid-sm text-gray-500">
                    휴지통에 접수가 없습니다.
                  </td>
                </tr>
              ) : (
                items.map((row) => (
                  <tr key={row.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-2 py-2 text-center truncate" title={row.customerName}>
                      {row.customerName}
                    </td>
                    <td className="px-2 py-2 text-center truncate tabular-nums" title={row.inquiryNumber ?? ''}>
                      {row.inquiryNumber ?? '—'}
                    </td>
                    <td className="px-2 py-2 text-center truncate tabular-nums" title={row.customerPhone}>
                      {row.customerPhone}
                    </td>
                    <td className="px-2 py-2 text-center truncate" title={row.address}>
                      {row.address}
                    </td>
                    <td className="px-2 py-2 text-center text-fluid-2xs whitespace-nowrap">
                      {formatDeletedAt(row.deletedAt)}
                    </td>
                    <td className="px-2 py-2 text-center truncate" title={row.deletedBy?.name ?? ''}>
                      {row.deletedBy?.name ?? '—'}
                    </td>
                    <td className="px-2 py-2 text-center tabular-nums">
                      {row.purgeAt}
                      <span className="block text-fluid-2xs text-gray-500">D-{row.daysRemaining}</span>
                    </td>
                    <td className="px-2 py-2 text-center">
                      <div className="flex flex-wrap justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => setPending({ kind: 'restore', row })}
                          className="rounded border border-sky-300 bg-sky-50 px-2 py-1 text-fluid-2xs text-sky-900"
                        >
                          복구
                        </button>
                        <button
                          type="button"
                          onClick={() => setPending({ kind: 'purge', row })}
                          className="rounded border border-red-200 bg-red-50 px-2 py-1 text-fluid-2xs text-red-800"
                        >
                          영구삭제
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {!loading ? (
        <ListPaginationBar
          mode="nav"
          page={page}
          pageSize={pageSize}
          total={total}
          pageSizeOptions={INQUIRY_LIST_PAGE_SIZE_OPTIONS}
          onPageChange={setPage}
          onPageSizeChange={(n) => {
            setPageSize(n);
            setPage(1);
          }}
        />
      ) : null}

      {pending ? (
        <ConfirmPasswordModal
          open
          title={pending.kind === 'restore' ? '접수 복구' : '접수 영구 삭제'}
          description={
            <>
              {actionError ? (
                <p className="mb-2 text-sm text-red-600">{actionError}</p>
              ) : null}
              {pending.kind === 'restore'
                ? `「${pending.row.customerName}」 접수를 복구합니다.`
                : `「${pending.row.customerName}」 접수를 지금 영구 삭제합니다. 복구할 수 없습니다.`}
            </>
          }
          confirmLabel={pending.kind === 'restore' ? '복구' : '영구 삭제'}
          onClose={() => {
            setPending(null);
            setActionError(null);
          }}
          onConfirm={handlePasswordConfirm}
        />
      ) : null}
    </div>
  );
}
