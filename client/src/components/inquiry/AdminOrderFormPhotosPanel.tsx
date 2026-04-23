import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  getAdminOrderFormPhotos,
  type OrderFormPhotoItem,
} from '../../api/orderform';

interface Props {
  /** 발주서 id — 있을 때만 렌더를 시도한다 */
  orderFormId: string | null | undefined;
  /** 관리자·마케터 JWT */
  token: string | null;
}

/** 접수 상세에서 발주서에 첨부된 고객 현장 사진을 썸네일 그리드로 보여준다 (읽기 전용) */
export function AdminOrderFormPhotosPanel({ orderFormId, token }: Props) {
  const [items, setItems] = useState<OrderFormPhotoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<OrderFormPhotoItem | null>(null);

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
      ) : items.length === 0 ? (
        <p className="rounded-md border border-dashed border-gray-200 bg-gray-50 px-3 py-4 text-center text-xs text-gray-500">
          고객이 발주서에 첨부한 현장 사진이 없습니다.
        </p>
      ) : (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
          {items.map((p) => (
            <li
              key={p.id}
              className="aspect-square overflow-hidden rounded-md border border-gray-200 bg-gray-100"
            >
              <button
                type="button"
                onClick={() => setLightbox(p)}
                className="block h-full w-full"
                aria-label="사진 크게 보기"
              >
                <img
                  src={p.secureUrl}
                  alt="발주서 현장 사진"
                  loading="lazy"
                  className="h-full w-full object-cover transition hover:scale-105"
                />
              </button>
            </li>
          ))}
        </ul>
      )}

      {lightbox
        ? createPortal(
            <div
              className="fixed inset-0 z-[800] flex items-center justify-center bg-black/80 p-4"
              role="presentation"
              onClick={() => setLightbox(null)}
            >
              <div
                className="relative max-h-full max-w-full"
                onClick={(e) => e.stopPropagation()}
                role="presentation"
              >
                <img
                  src={lightbox.secureUrl}
                  alt="발주서 현장 사진 확대"
                  className="max-h-[92vh] max-w-[92vw] rounded-md object-contain"
                />
                <button
                  type="button"
                  onClick={() => setLightbox(null)}
                  className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/70 text-white"
                  aria-label="닫기"
                >
                  ×
                </button>
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
