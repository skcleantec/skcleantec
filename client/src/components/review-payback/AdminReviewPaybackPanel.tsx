import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useStaffAppScrollPreserve } from '../../hooks/useStaffAppScrollPreserve';
import { beginListRefresh } from '../../utils/listRefreshDisplay';
import { Link } from 'react-router-dom';
import {
  deleteReviewPayback,
  getReviewPayback,
  listReviewPaybacks,
  markReviewPaybacksSeen,
  patchReviewPayback,
  type ReviewPaybackImageItem,
  type ReviewPaybackListItem,
  type ReviewPaybackStatus,
} from '../../api/reviewPayback';
import { ConfirmPasswordModal } from '../admin/ConfirmPasswordModal';
import { ListPaginationBar } from '../ui/ListPaginationBar';

import { ImageThumbLightbox, type ImageGallerySlide } from '../ui/ImageThumbLightbox';
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

function buildReviewGallerySlides(images: ReviewPaybackImageItem[]): ImageGallerySlide[] {
  return images.map((img, idx) => ({
    src: img.url,
    alt: `리뷰 캡처 ${idx + 1}`,
    title: `리뷰 캡처 ${idx + 1}`,
  }));
}

/** 목록 — 대표 1장 + 추가 장수 표시 */
function ReviewCaptureListPreview({ images }: { images: ReviewPaybackImageItem[] }) {
  if (images.length === 0) return <span className="text-gray-400">—</span>;
  const slides = buildReviewGallerySlides(images);
  const extra = images.length - 1;
  return (
    <div className="relative mx-auto inline-flex h-12 w-12 shrink-0">
      <ImageThumbLightbox
        src={images[0].url}
        alt="리뷰 캡처"
        thumbClassName="h-12 w-12 object-cover"
        buttonClassName="block h-12 w-12 overflow-hidden rounded-lg border border-slate-100 bg-gray-50 p-0 shadow-sm ring-inset focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 touch-manipulation"
        gallerySlides={slides}
        galleryIndex={0}
      />
      {extra > 0 ? (
        <span
          className="pointer-events-none absolute -bottom-0.5 -right-0.5 flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full bg-slate-900/90 px-1 text-[10px] font-bold leading-none text-white tabular-nums ring-2 ring-white"
          title={`총 ${images.length}장`}
          aria-label={`외 ${extra}장`}
        >
          +{extra}
        </span>
      ) : null}
    </div>
  );
}

/** 상세 — 썸네일 그리드 + 라이트박스 갤러리 */
function ReviewCaptureDetailGallery({ images }: { images: ReviewPaybackImageItem[] }) {
  if (images.length === 0) {
    return <p className="text-fluid-xs text-gray-400">캡처 없음</p>;
  }
  const slides = buildReviewGallerySlides(images);
  return (
    <div>
      <p className="mb-2 text-fluid-xs font-medium text-gray-600 tabular-nums">리뷰 캡처 {images.length}장</p>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {images.map((img, idx) => (
          <ImageThumbLightbox
            key={`${img.url}-${idx}`}
            src={img.url}
            alt={`리뷰 캡처 ${idx + 1}`}
            thumbClassName="aspect-square h-full w-full object-cover"
            buttonClassName="block aspect-square w-full overflow-hidden rounded-lg border border-gray-200 bg-gray-50 p-0 ring-inset focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 touch-manipulation"
            gallerySlides={slides}
            galleryIndex={idx}
            showDownload
          />
        ))}
      </div>
    </div>
  );
}

type Props = {
  token: string;
};

export function AdminReviewPaybackPanel({ token }: Props) {
  const [items, setItems] = useState<ReviewPaybackListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { preserveScroll, scrollToTop } = useStaffAppScrollPreserve();
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
  const [deleteTarget, setDeleteTarget] = useState<ReviewPaybackListItem | null>(null);

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
    async (silent = false, opts?: { scrollToTop?: boolean }) => {
      if (!token) return;
      if (opts?.scrollToTop) scrollToTop();
      beginListRefresh({
        showLoading: !silent,
        itemCount: items.length,
        setLoading,
        preserveScroll,
      });
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
    [token, listPage, listPageSize, filterStatus, unseenOnly, search, dateQuery, setTotal, items.length, preserveScroll, scrollToTop],
  );

  const prevFilterKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const prev = prevFilterKeyRef.current;
    prevFilterKeyRef.current = filterKey;
    void load(false, { scrollToTop: prev !== null && prev !== filterKey });
  }, [filterKey, listPage, listPageSize, load]);

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

  const handleDeleted = (deletedId: string) => {
    setItems((prev) => prev.filter((r) => r.id !== deletedId));
    setTotal((t) => Math.max(0, t - 1));
    setDetail((d) => (d?.id === deletedId ? null : d));
    setDeleteTarget(null);
  };

  return (
    <div className="min-w-0 space-y-4">
      <div>
        <h1 className="text-fluid-lg font-semibold text-slate-900">페이백/리뷰</h1>
        <p className="mt-1 text-fluid-xs text-slate-500">
          고객이 페이백 링크로 제출한 리뷰 캡처·계좌 신청 목록입니다. 입금 금액은 시스템에서 관리하지 않습니다.
        </p>
      </div>

      <div className="space-y-3 rounded-2xl border border-slate-200/60 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap gap-1.5">
          {STATUS_CHIPS.map((c) => (
            <button
              key={c.value || 'all'}
              type="button"
              disabled={unseenOnly}
              onClick={() => setFilterStatus(c.value)}
              className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold touch-manipulation transition-all duration-150 hover:scale-[1.03] active:scale-[0.97] disabled:opacity-45 ${
                filterStatus === c.value && !unseenOnly
                  ? 'border-slate-800 bg-slate-900 text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:border-slate-300'
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
            className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold touch-manipulation transition-all duration-150 hover:scale-[1.03] active:scale-[0.97] ${
              unseenOnly
                ? 'border-amber-500 bg-amber-50 text-amber-800 ring-1 ring-amber-200/50'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:border-slate-300'
            }`}
          >
            미확인만
          </button>
        </div>

        <div className="flex flex-wrap items-end gap-2.5">
          <label className="text-fluid-xs font-semibold text-slate-500">
            기간
            <select
              value={datePreset}
              onChange={(e) => setDatePreset(e.target.value as DateRangePresetId)}
              className="mt-1 block rounded-xl border border-slate-200 px-3 py-2 text-fluid-xs text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 shadow-sm"
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
            <label className="text-fluid-xs font-semibold text-slate-500">
              월
              <input
                type="month"
                value={monthKey}
                onChange={(e) => setMonthKey(e.target.value)}
                className="mt-1 block rounded-xl border border-slate-200 px-3 py-2 text-fluid-xs text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 shadow-sm"
              />
            </label>
          ) : null}
          <label className="min-w-[10rem] flex-1 text-fluid-xs font-semibold text-slate-500">
            검색
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="고객명·연락처·은행"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-fluid-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 shadow-sm"
            />
          </label>
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-xl bg-slate-800 px-4 py-2 text-fluid-xs font-semibold text-white shadow-sm hover:bg-slate-900 hover:scale-[1.03] active:scale-[0.97] transition-all duration-150"
          >
            조회
          </button>
        </div>
      </div>

      {error ? <p className="text-fluid-sm text-red-700">{error}</p> : null}
      {loading ? <p className="text-fluid-sm text-slate-500">로딩 중…</p> : null}

      {!loading && items.length === 0 ? (
        <p className="rounded-2xl border border-slate-200/60 bg-white p-8 text-center text-fluid-sm text-slate-500 shadow-sm">
          {unseenOnly ? '미확인 신청이 없습니다.' : '신청 내역이 없습니다.'}
        </p>
      ) : null}
 
      {items.length > 0 ? (
        <>
          <div className="hidden lg:block">
            <SyncHorizontalScroll>
              <table className="w-full min-w-[860px] border-collapse text-fluid-2xs xl:text-fluid-xs">
                <thead>
                  <tr className="border-b border-slate-200/60 bg-slate-50/80 text-slate-500">
                    <th className="px-2 py-2.5 text-left font-semibold">신청일</th>
                    <th className="px-2 py-2.5 text-left font-semibold">고객</th>
                    <th className="px-2 py-2.5 text-left font-semibold">계좌</th>
                    <th className="px-2 py-2.5 text-center font-semibold">캡처</th>
                    <th className="px-2 py-2.5 text-center font-semibold">상태</th>
                    <th className="px-2 py-2.5 text-center font-semibold">연결</th>
                    <th className="px-2 py-2.5 text-center font-semibold">처리</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row) => (
                    <tr
                      key={row.id}
                      className={`border-b border-slate-100/80 transition-colors hover:bg-slate-50/80 ${
                        isUnseenRow(row) ? 'bg-amber-50/50' : ''
                      }`}
                    >
                      <td className="px-2 py-2.5 tabular-nums text-slate-500 font-medium whitespace-nowrap">
                        {formatDateCompactWithWeekday(row.submittedAt)}
                      </td>
                      <td className="px-2 py-2.5">
                        <div className="font-semibold text-slate-900">{row.customerName}</div>
                        <div className="text-slate-500 font-medium tabular-nums">{displayPhone(row.customerPhone)}</div>
                        {row.inquiry?.inquiryNumber ? (
                          <div className="text-slate-500 font-mono text-[11px] tabular-nums mt-0.5">{row.inquiry.inquiryNumber}</div>
                        ) : null}
                      </td>
                      <td className="px-2 py-2.5 text-slate-700 font-medium">
                        {row.bankName}
                        <br />
                        <span className="tabular-nums text-slate-500 font-normal">{row.accountNumberMasked}</span>
                      </td>
                      <td className="px-2 py-2.5 text-center">
                        <ReviewCaptureListPreview images={reviewImagesForRow(row)} />
                      </td>
                      <td className="px-2 py-2.5 text-center">
                        <span
                          className={`inline-block rounded-md px-2 py-0.5 text-[10px] font-semibold ${statusTone(row.status)}`}
                        >
                          {STATUS_LABEL[row.status]}
                        </span>
                        {row.handledBy?.name ? (
                          <div className="mt-0.5 text-[10px] text-slate-500 font-medium">{row.handledBy.name}</div>
                        ) : null}
                      </td>
                      <td className="px-2 py-2.5 text-center">
                        <div className="flex flex-wrap justify-center gap-1.5 [&>a]:inline-flex [&>a]:items-center [&>a]:rounded-lg [&>a]:border [&>a]:px-2.5 [&>a]:py-1 [&>a]:text-[10px] [&>a]:font-semibold [&>a]:shadow-sm [&>a]:transition-all [&>a]:duration-150 hover:[&>a]:scale-[1.03] active:[&>a]:scale-[0.97]">
                          {row.inquiry?.id ? (
                            <Link
                              to={`/admin/inquiries?openInquiry=${encodeURIComponent(row.inquiry.id)}`}
                              className="border-indigo-100 bg-indigo-50/40 text-indigo-700 hover:bg-indigo-100/60"
                            >
                              접수
                            </Link>
                          ) : null}
                          {row.inquiry?.id ? (
                            <Link
                              to={`/admin/inquiries/order-issue?pendingInquiryId=${encodeURIComponent(row.inquiry.id)}`}
                              className="border-emerald-100 bg-emerald-50/40 text-emerald-700 hover:bg-emerald-100/60"
                            >
                              발주서
                            </Link>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-2 py-2.5 text-center">
                        <div className="flex flex-wrap items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => void openDetail(row)}
                            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-fluid-xs font-semibold text-slate-700 shadow-sm transition-all duration-150 hover:scale-[1.03] active:scale-[0.97] hover:bg-slate-50 hover:border-slate-300"
                          >
                            상세
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(row)}
                            className="rounded-lg border border-red-200 bg-white px-2.5 py-1 text-fluid-xs font-semibold text-red-700 shadow-sm transition-all duration-150 hover:scale-[1.03] active:scale-[0.97] hover:bg-red-50"
                          >
                            삭제
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </SyncHorizontalScroll>
          </div>
 
          <div className="flex flex-col gap-3 p-1 lg:hidden">
            {items.map((row) => (
              <div
                key={row.id}
                className={`rounded-2xl border p-4 shadow-md shadow-slate-100/40 hover:shadow-lg transition-all duration-200 overflow-hidden ${
                  isUnseenRow(row)
                    ? 'border-amber-400 bg-amber-50/30'
                    : 'border-slate-200/60 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-900">{row.customerName}</p>
                    <p className="text-fluid-xs text-slate-500 font-medium tabular-nums">{displayPhone(row.customerPhone)}</p>
                    <p className="text-fluid-xs text-slate-500 font-medium tabular-nums">
                      {formatDateCompactWithWeekday(row.submittedAt)}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-semibold ${statusTone(row.status)}`}>
                    {STATUS_LABEL[row.status]}
                  </span>
                </div>
                <p className="mt-2 text-fluid-xs text-slate-750 font-medium">
                  {row.bankName} · <span className="tabular-nums font-normal text-slate-500">{row.accountNumberMasked}</span>
                </p>
                <div className="mt-3.5 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                  <ReviewCaptureListPreview images={reviewImagesForRow(row)} />
                  {row.inquiry?.id ? (
                    <Link
                      to={`/admin/inquiries?openInquiry=${encodeURIComponent(row.inquiry.id)}`}
                      className="rounded-lg border border-indigo-100 bg-indigo-50/30 px-3 py-1.5 text-fluid-xs font-semibold text-indigo-700 transition-all duration-150 hover:scale-[1.03] active:scale-[0.97] shadow-sm hover:bg-indigo-100/60"
                    >
                      접수 보기
                    </Link>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void openDetail(row)}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-fluid-xs font-semibold text-slate-700 shadow-sm transition-all duration-150 hover:scale-[1.03] active:scale-[0.97] hover:bg-slate-50 hover:border-slate-300"
                  >
                    상세·처리
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(row)}
                    className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-fluid-xs font-semibold text-red-700 shadow-sm transition-all duration-150 hover:scale-[1.03] active:scale-[0.97] hover:bg-red-50"
                  >
                    삭제
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
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-4 shadow-xl">
            <h2 className="text-fluid-base font-semibold text-gray-900">{detail.customerName} — 페이백 상세</h2>
            <p className="mt-1 text-fluid-xs text-gray-500 tabular-nums">{displayPhone(detail.customerPhone)}</p>
            {detail.inquiry?.inquiryNumber ? (
              <p className="mt-1 text-fluid-xs text-gray-500">접수 {detail.inquiry.inquiryNumber}</p>
            ) : null}
            <div className="mt-3">
              <ReviewCaptureDetailGallery images={reviewImagesForRow(detail)} />
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
              <button
                type="button"
                disabled={saving || detailLoading}
                onClick={() => setDeleteTarget(detail)}
                className="rounded border border-red-200 px-3 py-1.5 text-fluid-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmPasswordModal
        open={!!deleteTarget}
        title={
          deleteTarget
            ? `「${deleteTarget.customerName}」 페이백/리뷰 신청을 영구 삭제합니다. 복구할 수 없습니다.`
            : ''
        }
        confirmLabel="삭제"
        onClose={() => setDeleteTarget(null)}
        onConfirm={async (password) => {
          if (!token || !deleteTarget) return;
          await deleteReviewPayback(token, deleteTarget.id, password);
          handleDeleted(deleteTarget.id);
        }}
      />
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
