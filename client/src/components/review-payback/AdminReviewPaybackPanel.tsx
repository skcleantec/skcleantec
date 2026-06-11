import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getReviewPayback,
  listReviewPaybacks,
  markReviewPaybacksSeen,
  patchReviewPayback,
  type ReviewPaybackImageItem,
  type ReviewPaybackListItem,
  type ReviewPaybackStatus,
} from '../../api/reviewPayback';
import { ListPaginationBar } from '../ui/ListPaginationBar';
import { ImageThumbLightbox } from '../ui/ImageThumbLightbox';
import { SyncHorizontalScroll } from '../ui/SyncHorizontalScroll';
import { usePaginatedListQuery } from '../../hooks/usePaginatedListQuery';
import { useInboxRealtime, useReviewPaybackRealtime } from '../../hooks/useInboxRealtime';
import { kstTodayYmd } from '../../utils/userEmployment';
import { formatDateCompactWithWeekday } from '../../utils/dateFormat';
import { computeDateRangeFromPreset, type DateRangePresetId } from '../../utils/dateRangePresets';

const STATUS_CHIPS: { value: ReviewPaybackStatus | ''; label: string }[] = [
  { value: '', label: '전체' },
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

function displayPhone(phone: string | null | undefined): string {
  const p = phone?.trim();
  return p || '—';
}

function isUnseenRow(row: ReviewPaybackListItem): boolean {
  return row.status === 'PENDING' && !row.seenAt;
}

const STATUS_DONE_MESSAGE: Partial<Record<ReviewPaybackStatus, string>> = {
  PAID: '입금 완료되었습니다.',
  REJECTED: '반려되었습니다.',
};

function reviewImagesForRow(row: ReviewPaybackListItem): ReviewPaybackImageItem[] {
  if (row.reviewImages?.length) return row.reviewImages;
  if (row.reviewImageUrl?.trim()) return [{ url: row.reviewImageUrl }];
  return [];
}

function ReviewCaptureThumbs({
  images,
  thumbClassName,
}: {
  images: ReviewPaybackImageItem[];
  thumbClassName: string;
}) {
  if (images.length === 0) return <span className="text-gray-400">—</span>;
  return (
    <div className="flex flex-wrap items-center justify-center gap-1">
      {images.map((img, idx) => (
        <ImageThumbLightbox
          key={`${img.url}-${idx}`}
          src={img.url}
          alt={`리뷰 캡처 ${idx + 1}`}
          thumbClassName={thumbClassName}
        />
      ))}
      {images.length > 1 ? (
        <span className="text-[10px] text-gray-500 tabular-nums">{images.length}장</span>
      ) : null}
    </div>
  );
}

type Props = {
  token: string;
};

export function AdminReviewPaybackPanel({ token }: Props) {
  const [items, setItems] = useState<ReviewPaybackListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<ReviewPaybackStatus | ''>('');
  const [unseenOnly, setUnseenOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [datePreset, setDatePreset] = useState<DateRangePresetId>('thisMonth');
  const [monthKey, setMonthKey] = useState(() => kstTodayYmd().slice(0, 7));
  const [detail, setDetail] = useState<ReviewPaybackListItem | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [memoDraft, setMemoDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const dateQuery = useMemo(() => {
    if (datePreset === 'custom') {
      const range = kstMonthRangeFromYm(monthKey);
      return range ? { from: range.from, to: range.to } : {};
    }
    const range = computeDateRangeFromPreset(datePreset);
    return range ? { from: range.from, to: range.to } : {};
  }, [datePreset, monthKey]);

  const filterKey = useMemo(
    () => JSON.stringify({ filterStatus, unseenOnly, search: search.trim(), datePreset, monthKey }),
    [filterStatus, unseenOnly, search, datePreset, monthKey],
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
          status: unseenOnly ? undefined : filterStatus || undefined,
          unseenOnly: unseenOnly ? '1' : undefined,
          search: search.trim() || undefined,
          ...dateQuery,
        });
        setItems(res.items);
        setTotal(res.total);
        const unseenIds = res.items.filter((r) => isUnseenRow(r)).map((r) => r.id);
        if (unseenIds.length > 0) void markReviewPaybacksSeen(token, unseenIds);
      } catch (e) {
        setError(e instanceof Error ? e.message : '목록을 불러올 수 없습니다.');
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [token, listPage, listPageSize, filterStatus, unseenOnly, search, dateQuery, setTotal],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useInboxRealtime(token, () => void load(true), Boolean(token));
  useReviewPaybackRealtime(token, () => void load(true), Boolean(token));

  const openDetail = async (row: ReviewPaybackListItem) => {
    setDetail(row);
    setMemoDraft(row.adminMemo ?? '');
    setDetailLoading(true);
    try {
      const full = await getReviewPayback(token, row.id);
      setDetail(full);
      setMemoDraft(full.adminMemo ?? '');
    } catch {
      /* 목록 행으로 상세 표시 유지 */
    } finally {
      setDetailLoading(false);
    }
  };

  const handleStatus = async (row: ReviewPaybackListItem, status: ReviewPaybackStatus) => {
    setSaving(true);
    try {
      const updated = await patchReviewPayback(token, row.id, { status, adminMemo: memoDraft.trim() || null });
      setItems((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      const doneMsg = STATUS_DONE_MESSAGE[status];
      if (doneMsg) {
        setDetail(null);
        alert(doneMsg);
      } else if (detail?.id === updated.id) {
        setDetail(updated);
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const copyAccount = async (row: ReviewPaybackListItem) => {
    const text = `${row.bankName} ${row.accountNumber}`;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      alert(text);
    }
  };

  return (
    <div className="min-w-0 space-y-4">
      <div>
        <h1 className="text-fluid-lg font-semibold text-gray-900">페이백/리뷰</h1>
        <p className="mt-1 text-fluid-xs text-gray-600">
          고객이 페이백 링크로 제출한 리뷰 캡처·계좌 신청 목록입니다. 입금 금액은 시스템에서 관리하지 않습니다.
        </p>
      </div>

      <div className="space-y-2 rounded-lg border border-gray-200 bg-white p-3">
        <div className="flex flex-wrap gap-1.5">
          {STATUS_CHIPS.map((c) => (
            <button
              key={c.value || 'all'}
              type="button"
              disabled={unseenOnly}
              onClick={() => setFilterStatus(c.value)}
              className={`rounded-full border px-2.5 py-1 text-[11px] font-medium touch-manipulation disabled:opacity-40 ${
                filterStatus === c.value && !unseenOnly
                  ? 'border-gray-800 bg-gray-900 text-white'
                  : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              {c.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setUnseenOnly((v) => !v);
              if (!unseenOnly) setFilterStatus('');
            }}
            className={`rounded-full border px-2.5 py-1 text-[11px] font-medium touch-manipulation ${
              unseenOnly
                ? 'border-amber-600 bg-amber-100 text-amber-950'
                : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            미확인만
          </button>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <label className="text-fluid-xs text-gray-600">
            기간
            <select
              value={datePreset}
              onChange={(e) => setDatePreset(e.target.value as DateRangePresetId)}
              className="mt-1 block rounded border border-gray-300 px-2 py-1.5 text-fluid-xs"
            >
              <option value="today">오늘</option>
              <option value="thisMonth">이번 달</option>
              <option value="lastMonth">지난 달</option>
              <option value="custom">월 선택</option>
              <option value="thisYear">올해</option>
              <option value="lastYear">지난해</option>
            </select>
          </label>
          {datePreset === 'custom' ? (
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
      </div>

      {error ? <p className="text-fluid-sm text-red-700">{error}</p> : null}
      {loading ? <p className="text-fluid-sm text-gray-500">로딩 중…</p> : null}

      {!loading && items.length === 0 ? (
        <p className="rounded-lg border border-gray-200 bg-white p-8 text-center text-fluid-sm text-gray-500">
          {unseenOnly ? '미확인 신청이 없습니다.' : '신청 내역이 없습니다.'}
        </p>
      ) : null}

      {items.length > 0 ? (
        <>
          <div className="hidden lg:block">
            <SyncHorizontalScroll>
              <table className="w-full min-w-[860px] border-collapse text-fluid-2xs xl:text-fluid-xs">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-gray-700">
                    <th className="px-2 py-2 text-left font-medium">신청일</th>
                    <th className="px-2 py-2 text-left font-medium">고객</th>
                    <th className="px-2 py-2 text-left font-medium">계좌</th>
                    <th className="px-2 py-2 text-center font-medium">캡처</th>
                    <th className="px-2 py-2 text-center font-medium">상태</th>
                    <th className="px-2 py-2 text-center font-medium">연결</th>
                    <th className="px-2 py-2 text-center font-medium">처리</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row) => (
                    <tr
                      key={row.id}
                      className={`border-b border-gray-100 hover:bg-gray-50/80 ${
                        isUnseenRow(row) ? 'bg-amber-50/80' : ''
                      }`}
                    >
                      <td className="px-2 py-2 tabular-nums text-gray-700 whitespace-nowrap">
                        {formatDateCompactWithWeekday(row.submittedAt)}
                      </td>
                      <td className="px-2 py-2">
                        <div className="font-medium text-gray-900">{row.customerName}</div>
                        <div className="text-gray-500 tabular-nums">{displayPhone(row.customerPhone)}</div>
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
                    <ReviewCaptureThumbs
                      images={reviewImagesForRow(row)}
                      thumbClassName="mx-auto h-12 w-12 object-cover"
                    />
                  </td>
                      <td className="px-2 py-2 text-center">
                        <span
                          className={`inline-block rounded px-2 py-0.5 text-[10px] font-medium ${statusTone(row.status)}`}
                        >
                          {STATUS_LABEL[row.status]}
                        </span>
                        {row.handledBy?.name ? (
                          <div className="mt-0.5 text-[10px] text-gray-500">{row.handledBy.name}</div>
                        ) : null}
                      </td>
                      <td className="px-2 py-2 text-center">
                        <div className="flex flex-wrap justify-center gap-1">
                          {row.inquiry?.id ? (
                            <Link
                              to={`/admin/inquiries?openInquiry=${encodeURIComponent(row.inquiry.id)}`}
                              className="rounded border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-900 hover:bg-blue-100"
                            >
                              접수
                            </Link>
                          ) : null}
                          {row.inquiry?.id ? (
                            <Link
                              to={`/admin/inquiries/order-issue?pendingInquiryId=${encodeURIComponent(row.inquiry.id)}`}
                              className="rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-900 hover:bg-emerald-100"
                            >
                              발주서
                            </Link>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-2 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => void openDetail(row)}
                          className="text-fluid-xs text-blue-700 hover:underline"
                        >
                          상세
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </SyncHorizontalScroll>
          </div>

          <div className="space-y-2 lg:hidden">
            {items.map((row) => (
              <div
                key={row.id}
                className={`rounded-lg border border-gray-200 bg-white p-3 ${
                  isUnseenRow(row) ? 'border-amber-300 bg-amber-50/50' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-gray-900">{row.customerName}</p>
                    <p className="text-fluid-xs text-gray-500 tabular-nums">{displayPhone(row.customerPhone)}</p>
                    <p className="text-fluid-xs text-gray-500 tabular-nums">
                      {formatDateCompactWithWeekday(row.submittedAt)}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded px-2 py-0.5 text-[10px] font-medium ${statusTone(row.status)}`}>
                    {STATUS_LABEL[row.status]}
                  </span>
                </div>
                <p className="mt-2 text-fluid-xs text-gray-700">
                  {row.bankName} · <span className="tabular-nums">{row.accountNumberMasked}</span>
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <ReviewCaptureThumbs
                    images={reviewImagesForRow(row)}
                    thumbClassName="h-14 w-14 object-cover rounded"
                  />
                  {row.inquiry?.id ? (
                    <Link
                      to={`/admin/inquiries?openInquiry=${encodeURIComponent(row.inquiry.id)}`}
                      className="text-fluid-xs text-blue-700 hover:underline"
                    >
                      접수 보기
                    </Link>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void openDetail(row)}
                    className="ml-auto text-fluid-xs font-medium text-blue-700 hover:underline"
                  >
                    상세·처리
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
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
            <p className="mt-1 text-fluid-xs text-gray-500 tabular-nums">{displayPhone(detail.customerPhone)}</p>
            {detail.inquiry?.inquiryNumber ? (
              <p className="mt-1 text-fluid-xs text-gray-500">접수 {detail.inquiry.inquiryNumber}</p>
            ) : null}
            <div className="mt-3 space-y-2">
              <ReviewCaptureThumbs
                images={reviewImagesForRow(detail)}
                thumbClassName="max-h-40 w-auto max-w-full object-contain"
              />
              <div className="flex flex-wrap gap-2">
                {reviewImagesForRow(detail).map((img, idx) => (
                  <a
                    key={`${img.url}-${idx}`}
                    href={img.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-fluid-xs text-blue-700 hover:underline"
                  >
                    원본 {idx + 1}
                  </a>
                ))}
              </div>
            </div>
            <p className="mt-3 text-fluid-sm text-gray-800">
              {detail.bankName} ·{' '}
              <span className="tabular-nums">{detailLoading ? detail.accountNumberMasked : detail.accountNumber}</span>
            </p>
            <button
              type="button"
              disabled={detailLoading}
              onClick={() => void copyAccount(detail)}
              className="mt-1 text-fluid-xs text-blue-700 hover:underline disabled:opacity-50"
            >
              계좌 복사
            </button>
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
                  disabled={saving || detailLoading}
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

function kstMonthRangeFromYm(monthKey: string): { from: string; to: string } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(monthKey);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  if (mo < 1 || mo > 12) return null;
  const lastDay = new Date(y, mo, 0).getDate();
  const mm = String(mo).padStart(2, '0');
  const dd = String(lastDay).padStart(2, '0');
  return { from: `${y}-${mm}-01`, to: `${y}-${mm}-${dd}` };
}
