import { useCallback, useEffect, useMemo, useState } from 'react';
import { getToken } from '../../stores/auth';
import {
  listReviewPaybacks,
  markReviewPaybacksSeen,
  patchReviewPayback,
  type ReviewPaybackListItem,
  type ReviewPaybackStatus,
} from '../../api/reviewPayback';
import { ListPaginationBar } from '../../components/ui/ListPaginationBar';
import { ImageThumbLightbox } from '../../components/ui/ImageThumbLightbox';
import { usePaginatedListQuery } from '../../hooks/usePaginatedListQuery';
import { useInboxRealtime } from '../../hooks/useInboxRealtime';
import { kstTodayYmd } from '../../utils/userEmployment';
import { formatDateCompactWithWeekday } from '../../utils/dateFormat';

const STATUS_OPTIONS: { value: ReviewPaybackStatus | ''; label: string }[] = [
  { value: '', label: '전체 상태' },
  { value: 'PENDING', label: '신청 접수' },
  { value: 'VERIFIED', label: '리뷰 확인' },
  { value: 'PAID', label: '입금 완료' },
  { value: 'REJECTED', label: '반려' },
];

const STATUS_LABEL: Record<ReviewPaybackStatus, string> = {
  PENDING: '신청 접수',
  VERIFIED: '리뷰 확인',
  PAID: '입금 완료',
  REJECTED: '반려',
};

function statusTone(status: ReviewPaybackStatus): string {
  if (status === 'PAID') return 'bg-green-100 text-green-800';
  if (status === 'VERIFIED') return 'bg-blue-100 text-blue-800';
  if (status === 'REJECTED') return 'bg-gray-200 text-gray-700';
  return 'bg-amber-100 text-amber-900';
}

export function AdminReviewPaybackPage() {
  const token = getToken();
  const [items, setItems] = useState<ReviewPaybackListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<ReviewPaybackStatus | ''>('');
  const [search, setSearch] = useState('');
  const [datePreset, setDatePreset] = useState<'month' | 'all'>('month');
  const [monthKey, setMonthKey] = useState(() => kstTodayYmd().slice(0, 7));
  const [detail, setDetail] = useState<ReviewPaybackListItem | null>(null);
  const [memoDraft, setMemoDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const filterKey = useMemo(
    () => JSON.stringify({ filterStatus, search: search.trim(), datePreset, monthKey }),
    [filterStatus, search, datePreset, monthKey],
  );

  const { listPage, listPageSize, total, setTotal, handleListPageChange, handleListPageSizeChange } =
    usePaginatedListQuery(filterKey);

  const load = useCallback(
    async (silent = false) => {
      if (!token) return;
      if (!silent) setLoading(true);
      setError(null);
      try {
        const res = await listReviewPaybacks(token, {
          page: listPage,
          pageSize: listPageSize,
          status: filterStatus || undefined,
          search: search.trim() || undefined,
          datePreset: datePreset === 'month' ? 'month' : 'all',
          month: datePreset === 'month' ? monthKey : undefined,
        });
        setItems(res.items);
        setTotal(res.total);
        const unseenIds = res.items.filter((r) => r.status === 'PENDING' && !r.seenAt).map((r) => r.id);
        if (unseenIds.length > 0) void markReviewPaybacksSeen(token, unseenIds);
      } catch (e) {
        setError(e instanceof Error ? e.message : '목록을 불러올 수 없습니다.');
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [token, listPage, listPageSize, filterStatus, search, datePreset, monthKey, setTotal],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useInboxRealtime(token, () => void load(true), Boolean(token));

  const openDetail = (row: ReviewPaybackListItem) => {
    setDetail(row);
    setMemoDraft(row.adminMemo ?? '');
  };

  const handleStatus = async (row: ReviewPaybackListItem, status: ReviewPaybackStatus) => {
    if (!token) return;
    setSaving(true);
    try {
      const updated = await patchReviewPayback(token, row.id, { status, adminMemo: memoDraft.trim() || null });
      setItems((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      if (detail?.id === updated.id) setDetail(updated);
    } catch (e) {
      alert(e instanceof Error ? e.message : '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-w-0 space-y-4">
      <div>
        <h1 className="text-fluid-lg font-semibold text-gray-900">페이백/리뷰</h1>
        <p className="mt-1 text-fluid-xs text-gray-600">
          고객이 페이백 링크로 제출한 리뷰 캡처·계좌 신청 목록입니다.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-2 rounded-lg border border-gray-200 bg-white p-3">
        <label className="text-fluid-xs text-gray-600">
          기간
          <select
            value={datePreset}
            onChange={(e) => setDatePreset(e.target.value as 'month' | 'all')}
            className="mt-1 block rounded border border-gray-300 px-2 py-1.5 text-fluid-xs"
          >
            <option value="month">이번 달</option>
            <option value="all">전체</option>
          </select>
        </label>
        {datePreset === 'month' ? (
          <label className="text-fluid-xs text-gray-600">
            월
            <input
              type="month"
              value={monthKey}
              onChange={(e) => setMonthKey(e.target.value)}
              className="mt-1 block rounded border border-gray-300 px-2 py-1.5 text-fluid-xs"
            />
          </label>
        ) : null}
        <label className="text-fluid-xs text-gray-600">
          상태
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as ReviewPaybackStatus | '')}
            className="mt-1 block rounded border border-gray-300 px-2 py-1.5 text-fluid-xs"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value || 'all'} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-[10rem] flex-1 text-fluid-xs text-gray-600">
          검색
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="고객명·연락처·은행"
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-fluid-xs"
          />
        </label>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded bg-gray-800 px-3 py-2 text-fluid-xs font-medium text-white hover:bg-gray-900"
        >
          조회
        </button>
      </div>

      {error ? <p className="text-fluid-sm text-red-700">{error}</p> : null}
      {loading ? <p className="text-fluid-sm text-gray-500">로딩 중…</p> : null}

      {!loading && items.length === 0 ? (
        <p className="rounded-lg border border-gray-200 bg-white p-8 text-center text-fluid-sm text-gray-500">
          신청 내역이 없습니다.
        </p>
      ) : null}

      {items.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="w-full min-w-[720px] border-collapse text-fluid-2xs xl:text-fluid-xs">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-gray-700">
                <th className="px-2 py-2 text-left font-medium">신청일</th>
                <th className="px-2 py-2 text-left font-medium">고객</th>
                <th className="px-2 py-2 text-left font-medium">계좌</th>
                <th className="px-2 py-2 text-center font-medium">캡처</th>
                <th className="px-2 py-2 text-center font-medium">상태</th>
                <th className="px-2 py-2 text-center font-medium">처리</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50/80">
                  <td className="px-2 py-2 tabular-nums text-gray-700 whitespace-nowrap">
                    {formatDateCompactWithWeekday(row.submittedAt)}
                  </td>
                  <td className="px-2 py-2">
                    <div className="font-medium text-gray-900">{row.customerName}</div>
                    <div className="text-gray-500 tabular-nums">{row.customerPhone ?? '—'}</div>
                    {row.inquiry?.inquiryNumber ? (
                      <div className="text-gray-500">{row.inquiry.inquiryNumber}</div>
                    ) : null}
                  </td>
                  <td className="px-2 py-2 text-gray-700">
                    {row.bankName}
                    <br />
                    <span className="tabular-nums">{row.accountNumberMasked}</span>
                  </td>
                  <td className="px-2 py-2 text-center">
                    <ImageThumbLightbox
                      src={row.reviewImageUrl}
                      alt="리뷰 캡처"
                      thumbClassName="mx-auto h-12 w-12 object-cover"
                    />
                  </td>
                  <td className="px-2 py-2 text-center">
                    <span className={`inline-block rounded px-2 py-0.5 text-[10px] font-medium ${statusTone(row.status)}`}>
                      {STATUS_LABEL[row.status]}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-center">
                    <button
                      type="button"
                      onClick={() => openDetail(row)}
                      className="text-fluid-xs text-blue-700 hover:underline"
                    >
                      상세
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <ListPaginationBar
        page={listPage}
        pageSize={listPageSize}
        total={total}
        onPageChange={handleListPageChange}
        onPageSizeChange={handleListPageSizeChange}
      />

      {detail ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg bg-white p-4 shadow-xl">
            <h2 className="text-fluid-base font-semibold text-gray-900">{detail.customerName} — 페이백 상세</h2>
            <p className="mt-1 text-fluid-xs text-gray-500 tabular-nums">{detail.customerPhone ?? '—'}</p>
            <div className="mt-3">
              <ImageThumbLightbox
                src={detail.reviewImageUrl}
                alt="리뷰 캡처"
                thumbClassName="max-h-48 w-auto object-contain"
              />
            </div>
            <p className="mt-3 text-fluid-sm text-gray-800">
              {detail.bankName} · <span className="tabular-nums">{detail.accountNumber}</span>
            </p>
            <label className="mt-3 block text-fluid-xs text-gray-600">
              메모
              <textarea
                value={memoDraft}
                onChange={(e) => setMemoDraft(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-fluid-xs"
              />
            </label>
            <div className="mt-4 flex flex-wrap gap-2">
              {(['VERIFIED', 'PAID', 'REJECTED'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  disabled={saving}
                  onClick={() => void handleStatus(detail, st)}
                  className="rounded border border-gray-300 px-3 py-1.5 text-fluid-xs hover:bg-gray-50 disabled:opacity-50"
                >
                  {STATUS_LABEL[st]}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setDetail(null)}
                className="ml-auto rounded px-3 py-1.5 text-fluid-xs text-gray-600 hover:bg-gray-100"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
