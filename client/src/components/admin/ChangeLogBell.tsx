import { useCallback, useEffect, useRef, useState } from 'react';
import {
  type ChangeHistoryItem,
  type ChangeLogCategory,
  type UnseenChangeCount,
} from '../../api/inquiryChangeLogs';
import { useChangeLogRealtime, type ChangeLogRtPayload } from '../../hooks/useInboxRealtime';
import { ModalCloseButton } from './ModalCloseButton';
import { formatDateTimeCompactWithWeekday } from '../../utils/dateFormat';

const PAGE_SIZE = 50;

type CategoryMeta = { label: string; chip: string; dot: string };

const CATEGORY_META: Record<ChangeLogCategory, CategoryMeta> = {
  date: { label: '날짜', chip: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-500' },
  cost: { label: '비용', chip: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  extra: { label: '추가청소', chip: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
  team: { label: '팀장', chip: 'bg-violet-50 text-violet-700 border-violet-200', dot: 'bg-violet-500' },
  status: { label: '상태', chip: 'bg-rose-50 text-rose-700 border-rose-200', dot: 'bg-rose-500' },
  etc: { label: '기타', chip: 'bg-gray-100 text-gray-600 border-gray-200', dot: 'bg-gray-400' },
};

const FILTERS: ChangeLogCategory[] = ['date', 'cost', 'extra', 'team', 'status'];

function formatWhen(iso: string): string {
  try {
    return formatDateTimeCompactWithWeekday(iso);
  } catch {
    return iso;
  }
}

function CategoryChips({ categories }: { categories: ChangeLogCategory[] }) {
  if (!categories?.length) return null;
  return (
    <span className="inline-flex flex-wrap gap-1 align-middle">
      {categories.map((c) => {
        const m = CATEGORY_META[c] ?? CATEGORY_META.etc;
        return (
          <span
            key={c}
            className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium leading-none ${m.chip}`}
          >
            {m.label}
          </span>
        );
      })}
    </span>
  );
}

type Props = {
  token: string;
  /** 미확인 변경 수 조회 (관리자/팀장 엔드포인트 분기) */
  fetchUnseen: (token: string) => Promise<UnseenChangeCount>;
  /** 변경 이력 목록 (페이지) */
  fetchList: (
    token: string,
    opts: { limit: number; offset: number }
  ) => Promise<{ items: ChangeHistoryItem[]; total: number }>;
  /** 확인(읽음) 처리 */
  markSeen: (token: string) => Promise<unknown>;
  /** 항목 클릭 시 해당 접수로 이동 */
  onOpenInquiry: (inquiryId: string) => void;
};

/**
 * 우측 고정 종 아이콘 — 미확인 접수 변경 이력이 있으면 깜빡이고 배지 숫자 표시.
 * 클릭 시 모달로 변경 내역(유형 칩·필터·과거 이력 스크롤)을 보여주고,
 * 항목을 누르면 해당 접수 상세로 이동한다.
 */
export function ChangeLogBell({ token, fetchUnseen, fetchList, markSeen, onOpenInquiry }: Props) {
  const [unseen, setUnseen] = useState(0);
  const [blink, setBlink] = useState(false);
  const [toast, setToast] = useState<ChangeLogRtPayload | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ChangeHistoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [activeFilters, setActiveFilters] = useState<Set<ChangeLogCategory>>(new Set());

  const refreshUnseen = useCallback(() => {
    fetchUnseen(token)
      .then((r) => {
        setUnseen(r.count);
        if (r.count > 0) setBlink(true);
      })
      .catch(() => {});
  }, [token, fetchUnseen]);

  useEffect(() => {
    refreshUnseen();
  }, [refreshUnseen]);

  useChangeLogRealtime(
    token,
    useCallback((p: ChangeLogRtPayload) => {
      setUnseen((c) => c + 1);
      setBlink(true);
      setToast(p);
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToast(null), 6000);
    }, []),
    Boolean(token),
  );

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  const loadPage = useCallback(
    async (nextOffset: number, append: boolean) => {
      setLoading(true);
      try {
        const r = await fetchList(token, { limit: PAGE_SIZE, offset: nextOffset });
        setTotal(r.total);
        setOffset(nextOffset);
        setItems((prev) => (append ? [...prev, ...r.items] : r.items));
      } catch {
        if (!append) setItems([]);
      } finally {
        setLoading(false);
      }
    },
    [token, fetchList],
  );

  const openModal = useCallback(async () => {
    setOpen(true);
    setBlink(false);
    setToast(null);
    setActiveFilters(new Set());
    await loadPage(0, false);
    try {
      await markSeen(token);
      setUnseen(0);
    } catch {
      /* ignore */
    }
  }, [loadPage, markSeen, token]);

  const toggleFilter = (c: ChangeLogCategory) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });
  };

  const goToInquiry = (item: ChangeHistoryItem) => {
    if (!item.inquiryId) return;
    setOpen(false);
    onOpenInquiry(item.inquiryId);
  };

  const visibleItems =
    activeFilters.size === 0
      ? items
      : items.filter((it) => it.categories.some((c) => activeFilters.has(c)));

  const hasMore = items.length < total;

  return (
    <>
      {/* 우측 고정 종 아이콘 */}
      <div className="fixed right-2 top-1/2 z-[100] -translate-y-1/2">
        {toast && (
          <button
            type="button"
            onClick={() => void openModal()}
            className="absolute right-12 top-1/2 w-60 -translate-y-1/2 rounded-lg border border-gray-200 bg-white p-3 text-left shadow-lg"
          >
            <p className="text-fluid-xs font-semibold text-gray-900 truncate">
              {toast.customerName || '접수'} 변경
            </p>
            <p className="mt-0.5 text-fluid-xs text-gray-600 line-clamp-2">{toast.summary}</p>
            <span className="mt-1 inline-block">
              <CategoryChips categories={toast.categories} />
            </span>
          </button>
        )}
        <button
          type="button"
          onClick={() => void openModal()}
          aria-label={`접수 변경 이력${unseen > 0 ? ` (미확인 ${unseen}건)` : ''}`}
          className={`relative flex h-11 w-11 items-center justify-center rounded-full border shadow-md transition-colors ${
            unseen > 0
              ? 'border-amber-500 bg-amber-400 text-amber-950 hover:bg-amber-300'
              : 'border-gray-300 bg-white text-gray-500 hover:bg-gray-50'
          } ${blink && unseen > 0 ? 'animate-pulse' : ''}`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5"
          >
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          {unseen > 0 && (
            <span className="absolute -right-1 -top-1 flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
              {unseen > 99 ? '99+' : unseen}
            </span>
          )}
        </button>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-[130] flex items-center justify-center bg-black/40 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            className="relative flex max-h-[85vh] w-full max-w-2xl flex-col rounded-lg border border-gray-200 bg-white shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <ModalCloseButton onClick={() => setOpen(false)} />
            <div className="shrink-0 border-b border-gray-200 p-4 pr-12">
              <h2 className="text-base font-semibold text-gray-900">접수 변경 이력</h2>
              <p className="mt-0.5 text-fluid-xs text-gray-500">
                항목을 누르면 해당 접수로 이동합니다 · 총 {total}건
              </p>
            </div>

            <div className="flex shrink-0 flex-wrap gap-1.5 border-b border-gray-100 p-3">
              {FILTERS.map((c) => {
                const m = CATEGORY_META[c];
                const on = activeFilters.has(c);
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => toggleFilter(c)}
                    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-fluid-xs transition-colors ${
                      on ? `${m.chip} ring-1 ring-inset ring-current` : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />
                    {m.label}
                  </button>
                );
              })}
              {activeFilters.size > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveFilters(new Set())}
                  className="ml-1 text-fluid-xs text-gray-500 underline hover:text-gray-700"
                >
                  필터 해제
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {loading && items.length === 0 && (
                <p className="text-fluid-sm text-gray-500">불러오는 중…</p>
              )}
              {!loading && visibleItems.length === 0 && (
                <p className="text-fluid-sm text-gray-500">표시할 변경 이력이 없습니다.</p>
              )}
              <ul className="space-y-2.5">
                {visibleItems.map((row) => {
                  const clickable = Boolean(row.inquiryId);
                  return (
                    <li key={row.id}>
                      <button
                        type="button"
                        disabled={!clickable}
                        onClick={() => goToInquiry(row)}
                        className={`w-full rounded-lg border border-gray-100 p-3 text-left transition-colors ${
                          clickable ? 'hover:border-gray-300 hover:bg-gray-50' : 'cursor-default opacity-80'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-gray-900">{row.customerName}</span>
                          <CategoryChips categories={row.categories} />
                        </div>
                        <ul className="mt-1.5 list-inside list-disc text-fluid-sm text-gray-700">
                          {row.lines.map((line, i) => (
                            <li key={i}>{line}</li>
                          ))}
                        </ul>
                        <p className="mt-1.5 text-fluid-xs text-gray-500">
                          {formatWhen(row.createdAt)} · {row.actorName ?? '시스템'}
                          {clickable && <span className="ml-1 text-blue-600">접수 보기 →</span>}
                        </p>
                      </button>
                    </li>
                  );
                })}
              </ul>
              {hasMore && (
                <div className="mt-3 text-center">
                  <button
                    type="button"
                    onClick={() => void loadPage(offset + PAGE_SIZE, true)}
                    disabled={loading}
                    className="rounded-md border border-gray-300 bg-white px-4 py-1.5 text-fluid-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                  >
                    {loading ? '불러오는 중…' : '과거 이력 더 보기'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
