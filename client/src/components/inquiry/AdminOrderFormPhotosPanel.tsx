import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  getAdminOrderFormPhotos,
  type OrderFormPhotoItem,
} from '../../api/orderform';

interface Props {
  /** 발주서 id — 있을 때만 렌더를 시도한다 */
  orderFormId: string | null | undefined;
  /** 관리자·마케터·팀장 JWT */
  token: string | null;
  /** 썸네일 그리드에서 한 번에 보여줄 최대 장수. 초과분은 마지막 타일에 "+N" 배지로 표시. 기본 10. */
  gridLimit?: number;
}

/**
 * 접수 상세 / 스케줄 상세 / 팀장 상세에서 공통 사용.
 * - 카운트 뱃지, +N 오버레이, 좌우 내비게이션, 바닥 썸네일 스트립을 갖춘 라이트박스를 포함.
 */
export function AdminOrderFormPhotosPanel({
  orderFormId,
  token,
  gridLimit = 10,
}: Props) {
  const [items, setItems] = useState<OrderFormPhotoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** 라이트박스에서 현재 보고 있는 사진 index. null이면 닫힘 */
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!orderFormId || !token) return;
    setLoading(true);
    setError(null);
    try {
      const r = await getAdminOrderFormPhotos(token, orderFormId);
      setItems(r.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : '사진을 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  }, [orderFormId, token]);

  useEffect(() => {
    void load();
  }, [load]);

  /** 썸네일 스트립에서 현재 항목이 보이도록 스크롤 */
  const stripRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (viewerIndex == null) return;
    const el = stripRef.current?.querySelector<HTMLElement>(
      `[data-strip-idx="${viewerIndex}"]`
    );
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [viewerIndex]);

  const total = items.length;
  const visibleCount = Math.min(total, Math.max(1, gridLimit));
  const hiddenCount = Math.max(0, total - visibleCount);

  const openViewerAt = useCallback((idx: number) => {
    setViewerIndex(idx);
  }, []);

  const closeViewer = useCallback(() => setViewerIndex(null), []);
  const gotoPrev = useCallback(() => {
    setViewerIndex((i) => {
      if (i == null || total === 0) return i;
      return (i - 1 + total) % total;
    });
  }, [total]);
  const gotoNext = useCallback(() => {
    setViewerIndex((i) => {
      if (i == null || total === 0) return i;
      return (i + 1) % total;
    });
  }, [total]);

  // 키보드 단축키 (열려 있을 때만 동작)
  useEffect(() => {
    if (viewerIndex == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeViewer();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        gotoPrev();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        gotoNext();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [viewerIndex, closeViewer, gotoPrev, gotoNext]);

  // 라이트박스가 열린 동안 배경 스크롤 잠금
  useEffect(() => {
    if (viewerIndex == null) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [viewerIndex]);

  const currentPhoto = useMemo(
    () => (viewerIndex != null ? items[viewerIndex] ?? null : null),
    [viewerIndex, items]
  );

  if (!orderFormId) return null;

  return (
    <div className="min-w-0">
      {loading ? (
        <p className="py-4 text-center text-xs text-gray-500">사진을 불러오는 중…</p>
      ) : error ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => void load()}
            className="rounded border border-red-300 bg-white px-2 py-1 text-red-700 hover:bg-red-100"
          >
            다시 시도
          </button>
        </div>
      ) : total === 0 ? (
        <p className="rounded-md border border-dashed border-gray-200 bg-gray-50 px-3 py-4 text-center text-xs text-gray-500">
          고객이 발주서에 첨부한 현장 사진이 없습니다.
        </p>
      ) : (
        <>
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
              총 {total}장
            </span>
            {hiddenCount > 0 ? (
              <button
                type="button"
                onClick={() => openViewerAt(0)}
                className="text-xs text-emerald-700 underline underline-offset-2 hover:text-emerald-900"
              >
                전체 보기 ({total}장)
              </button>
            ) : null}
          </div>
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
            {items.slice(0, visibleCount).map((p, idx) => {
              const isLastVisible = idx === visibleCount - 1;
              const showMoreOverlay = isLastVisible && hiddenCount > 0;
              return (
                <li
                  key={p.id}
                  className="relative aspect-square overflow-hidden rounded-md border border-gray-200 bg-gray-100"
                >
                  <button
                    type="button"
                    onClick={() => openViewerAt(idx)}
                    className="block h-full w-full"
                    aria-label={`${idx + 1}번째 사진 크게 보기`}
                  >
                    <img
                      src={p.secureUrl}
                      alt="발주서 현장 사진"
                      loading="lazy"
                      className="h-full w-full object-cover transition hover:scale-105"
                    />
                    {showMoreOverlay ? (
                      <span className="absolute inset-0 flex items-center justify-center bg-black/55 text-lg font-semibold text-white">
                        +{hiddenCount}
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {currentPhoto && viewerIndex != null
        ? createPortal(
            <div
              className="fixed inset-0 z-[800] flex flex-col bg-black/90"
              role="dialog"
              aria-modal="true"
              aria-label="발주서 첨부 사진 확대 보기"
            >
              <div className="relative flex shrink-0 items-center justify-between gap-2 px-4 py-3 text-white">
                <span className="text-sm">
                  {viewerIndex + 1} / {total}
                </span>
                <button
                  type="button"
                  onClick={closeViewer}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-xl font-semibold text-white hover:bg-white/20"
                  aria-label="닫기"
                >
                  ×
                </button>
              </div>

              <div
                className="relative flex min-h-0 flex-1 items-center justify-center px-2 sm:px-10"
                onClick={closeViewer}
                role="presentation"
              >
                {total > 1 ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      gotoPrev();
                    }}
                    aria-label="이전 사진"
                    className="absolute left-2 top-1/2 z-10 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-2xl text-white hover:bg-white/25 sm:left-4"
                  >
                    ‹
                  </button>
                ) : null}

                <img
                  src={currentPhoto.secureUrl}
                  alt={`발주서 현장 사진 ${viewerIndex + 1}`}
                  className="max-h-full max-w-full rounded-md object-contain"
                  onClick={(e) => e.stopPropagation()}
                />

                {total > 1 ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      gotoNext();
                    }}
                    aria-label="다음 사진"
                    className="absolute right-2 top-1/2 z-10 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-2xl text-white hover:bg-white/25 sm:right-4"
                  >
                    ›
                  </button>
                ) : null}
              </div>

              <div
                ref={stripRef}
                className="shrink-0 overflow-x-auto overscroll-x-contain bg-black/70 px-3 py-3"
                style={{ WebkitOverflowScrolling: 'touch' }}
              >
                <ul className="flex items-center gap-2">
                  {items.map((p, idx) => {
                    const active = idx === viewerIndex;
                    return (
                      <li key={p.id} data-strip-idx={idx} className="shrink-0">
                        <button
                          type="button"
                          onClick={() => openViewerAt(idx)}
                          className={`block h-16 w-16 overflow-hidden rounded-md border-2 transition ${
                            active
                              ? 'border-white opacity-100'
                              : 'border-transparent opacity-60 hover:opacity-100'
                          }`}
                          aria-label={`${idx + 1}번째 사진 보기`}
                          aria-current={active ? 'true' : undefined}
                        >
                          <img
                            src={p.secureUrl}
                            alt=""
                            loading="lazy"
                            className="h-full w-full object-cover"
                          />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
