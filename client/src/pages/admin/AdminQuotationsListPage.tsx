import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getToken } from '../../stores/auth';
import {
  deleteQuotation,
  listQuotations,
  type QuotationDatePreset,
  type QuotationDto,
  type QuotationStatus,
} from '../../api/quotations';
import { ModalCloseButton } from '../../components/admin/ModalCloseButton';
import { YearMonthSelect, YmdSelect } from '../../components/ui/DateQuerySelects';
import { ListPaginationBar } from '../../components/ui/ListPaginationBar';
import {
  clampListPage,
  parseInquiryListPageSize,
  parseListPage,
} from '../../utils/listPagination';

const STATUS_LABEL: Record<QuotationStatus, string> = {
  DRAFT: '작성 중',
  FINALIZED: '확정',
  SENT: '발송됨',
};

const STATUS_OPTIONS: { value: '' | QuotationStatus; label: string }[] = [
  { value: '', label: '전체 상태' },
  { value: 'DRAFT', label: '작성 중' },
  { value: 'FINALIZED', label: '확정' },
  { value: 'SENT', label: '발송됨' },
];

function kstMonthKeyNow(): string {
  return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 7);
}

function kstYmdNow(): string {
  return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10);
}

export function AdminQuotationsListPage() {
  const token = getToken();
  const [searchParams, setSearchParams] = useSearchParams();

  const datePreset = (searchParams.get('datePreset') as QuotationDatePreset | null) ?? 'all';
  const monthKey = searchParams.get('month') ?? kstMonthKeyNow();
  const dayKey = searchParams.get('day') ?? kstYmdNow();
  const customerName = searchParams.get('customerName') ?? '';
  const statusFilter = (searchParams.get('status') as QuotationStatus | '') ?? '';
  const pageSize = parseInquiryListPageSize(searchParams.get('pageSize'));
  const page = parseListPage(searchParams.get('page'));

  const [items, setItems] = useState<QuotationDto[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<QuotationDto | null>(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleting, setDeleting] = useState(false);

  const safePage = useMemo(
    () => clampListPage(page, total, pageSize),
    [page, total, pageSize],
  );

  const patchParams = useCallback(
    (patch: Record<string, string | null>) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        for (const [k, v] of Object.entries(patch)) {
          if (v == null || v === '') next.delete(k);
          else next.set(k, v);
        }
        return next;
      });
    },
    [setSearchParams],
  );

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    const offset = (safePage - 1) * pageSize;
    try {
      const data = await listQuotations(token, {
        limit: pageSize,
        offset,
        customerName: customerName.trim() || undefined,
        status: statusFilter || undefined,
        datePreset,
        month: datePreset === 'month' ? monthKey : undefined,
        day: datePreset === 'day' ? dayKey : undefined,
      });
      setItems(data.items);
      setTotal(data.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : '목록을 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  }, [token, safePage, pageSize, customerName, statusFilter, datePreset, monthKey, dayKey]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleDelete() {
    if (!token || !deleteTarget) return;
    if (!deletePassword.trim()) {
      alert('비밀번호를 입력해 주세요.');
      return;
    }
    setDeleting(true);
    try {
      await deleteQuotation(token, deleteTarget.id, deletePassword);
      setDeleteTarget(null);
      setDeletePassword('');
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : '삭제에 실패했습니다.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-3 py-4 sm:px-4">
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <h1 className="text-lg font-semibold text-gray-900">견적서</h1>
        <Link
          to="/admin/inquiries/quotations/new"
          className="ml-auto px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          + 새 견적서
        </Link>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white mb-4">
        <div className="flex flex-col gap-3 border-b border-gray-100 bg-gray-50/90 px-3 py-3 sm:px-4">
          <div className="flex flex-col gap-2 min-w-0 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <div className="flex flex-col gap-2 min-w-0 sm:flex-row sm:flex-wrap sm:items-center">
              <span className="text-fluid-2xs font-semibold text-gray-700 shrink-0">작성일</span>
              <div className="inline-flex flex-wrap items-center gap-2">
                <div className="inline-flex rounded border border-gray-300 overflow-hidden text-fluid-sm shrink-0">
                  {(
                    [
                      ['today', '오늘'],
                      ['all', '전체'],
                      ['month', '월별'],
                      ['day', '일별'],
                    ] as const
                  ).map(([key, label], i) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => patchParams({ datePreset: key, page: '1' })}
                      className={`px-3 py-1.5 font-medium ${i > 0 ? 'border-l border-gray-300' : ''} ${
                        datePreset === key ? 'bg-gray-800 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {datePreset === 'month' && (
                  <YearMonthSelect
                    value={monthKey}
                    onChange={(v) => patchParams({ month: v, page: '1' })}
                    idPrefix="quotation-list-month"
                    className="items-center"
                  />
                )}
                {datePreset === 'day' && (
                  <YmdSelect
                    value={dayKey}
                    onChange={(v) => patchParams({ day: v, page: '1' })}
                    idPrefix="quotation-list-day"
                    className="items-center"
                  />
                )}
              </div>
            </div>
            <ListPaginationBar
              mode="summary"
              page={safePage}
              pageSize={pageSize}
              total={total}
              onPageChange={(p) => patchParams({ page: String(p) })}
              onPageSizeChange={(s) => patchParams({ pageSize: String(s), page: '1' })}
              className="shrink-0"
            />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <label className="block text-sm min-w-0 flex-1 sm:max-w-xs">
              <span className="text-gray-600 text-xs">상대 이름</span>
              <input
                className="mt-1 w-full border rounded px-2 py-1.5 text-sm"
                value={customerName}
                onChange={(e) => patchParams({ customerName: e.target.value, page: '1' })}
                placeholder="검색"
              />
            </label>
            <label className="block text-sm sm:w-36">
              <span className="text-gray-600 text-xs">상태</span>
              <select
                className="mt-1 w-full border rounded px-2 py-1.5 text-sm"
                value={statusFilter}
                onChange={(e) =>
                  patchParams({ status: e.target.value || null, page: '1' })
                }
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value || 'all'} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {error && <p className="px-4 py-3 text-sm text-red-600">{error}</p>}
        {loading ? (
          <p className="px-4 py-8 text-sm text-gray-500">불러오는 중…</p>
        ) : items.length === 0 ? (
          <p className="px-4 py-8 text-sm text-gray-500">견적서가 없습니다.</p>
        ) : (
          <>
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left">
                  <tr>
                    <th className="px-3 py-2">견적번호</th>
                    <th className="px-3 py-2">상대</th>
                    <th className="px-3 py-2 text-right">합계</th>
                    <th className="px-3 py-2">상태</th>
                    <th className="px-3 py-2">작성일</th>
                    <th className="px-3 py-2">발송일</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((row) => (
                    <tr key={row.id} className="border-t hover:bg-gray-50">
                      <td className="px-3 py-2 font-mono text-xs">{row.quoteNumber}</td>
                      <td className="px-3 py-2">{row.customerName}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {row.total.toLocaleString('ko-KR')}원
                      </td>
                      <td className="px-3 py-2">{STATUS_LABEL[row.status]}</td>
                      <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
                        {new Date(row.createdAt).toLocaleDateString('ko-KR')}
                      </td>
                      <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
                        {row.sentAt
                          ? new Date(row.sentAt).toLocaleDateString('ko-KR')
                          : '—'}
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        <Link
                          to={`/admin/inquiries/quotations/${row.id}`}
                          className="text-blue-600 hover:underline mr-2"
                        >
                          열기
                        </Link>
                        <button
                          type="button"
                          onClick={() => {
                            setDeleteTarget(row);
                            setDeletePassword('');
                          }}
                          className="text-red-600 hover:underline text-xs"
                        >
                          삭제
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="sm:hidden divide-y">
              {items.map((row) => (
                <li key={row.id} className="p-3">
                  <div className="flex justify-between gap-2">
                    <span className="font-medium">{row.customerName}</span>
                    <span className="text-xs text-gray-500">{STATUS_LABEL[row.status]}</span>
                  </div>
                  <div className="text-xs font-mono text-gray-500 mt-0.5">{row.quoteNumber}</div>
                  <div className="text-sm mt-1 tabular-nums">{row.total.toLocaleString('ko-KR')}원</div>
                  <div className="flex gap-2 mt-2">
                    <Link
                      to={`/admin/inquiries/quotations/${row.id}`}
                      className="text-sm text-blue-600"
                    >
                      열기
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        setDeleteTarget(row);
                        setDeletePassword('');
                      }}
                      className="text-sm text-red-600"
                    >
                      삭제
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <ListPaginationBar
        page={safePage}
        pageSize={pageSize}
        total={total}
        onPageChange={(p) => patchParams({ page: String(p) })}
        onPageSizeChange={(s) => patchParams({ pageSize: String(s), page: '1' })}
      />

      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !deleting) setDeleteTarget(null);
          }}
        >
          <div
            className="relative w-full sm:max-w-sm rounded-t-xl sm:rounded-xl bg-white shadow-lg border border-gray-200"
            onClick={(e) => e.stopPropagation()}
          >
            <ModalCloseButton onClick={() => setDeleteTarget(null)} disabled={deleting} />
            <div className="border-b border-gray-100 px-4 pb-3 pt-4 pr-12">
              <h2 className="font-semibold text-red-700">견적서 삭제</h2>
            </div>
            <div className="p-4">
              <p className="text-sm text-gray-600 mb-3">
                {deleteTarget.quoteNumber} — {deleteTarget.customerName}
              </p>
              <input
                type="password"
                className="w-full border rounded px-2 py-1.5 text-sm"
                placeholder="로그인 비밀번호"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2 border-t border-gray-100 px-4 py-3">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-sm border border-gray-300 rounded text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                취소
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={() => void handleDelete()}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded disabled:opacity-50"
              >
                {deleting ? '삭제 중…' : '삭제'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
