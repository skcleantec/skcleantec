import { useCallback, useEffect, useRef, useState } from 'react';
import {
  deleteOrderFormPhotoByToken,
  listOrderFormPhotosByToken,
  uploadOrderFormPhotosByToken,
  type OrderFormPhotoItem,
} from '../../api/orderform';

interface Props {
  /** 발주서 공개 토큰 — 이 토큰 하나로 목록·업로드·삭제가 모두 이뤄진다. */
  token: string;
  /** 제출 중에는 버튼들을 잠가둔다. */
  disabled?: boolean;
  /** 업로드 최대 장수. 서버와 동일하게 기본 20. */
  maxPhotos?: number;
}

const IMAGE_ACCEPT =
  'image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,.heic,.heif';

function isImageFile(file: File): boolean {
  if (file.type.startsWith('image/')) return true;
  return /\.(jpe?g|png|gif|webp|heic|heif)$/i.test(file.name);
}

export function OrderFormPhotoSection({ token, disabled, maxPhotos = 20 }: Props) {
  const [items, setItems] = useState<OrderFormPhotoItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<OrderFormPhotoItem | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  const refresh = useCallback(async () => {
    try {
      const r = await listOrderFormPhotosByToken(token);
      setItems(r.items);
    } catch {
      /* 조용히 무시 — 네트워크 일시 장애 */
    }
  }, [token]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onPickGallery = () => {
    if (disabled || uploading) return;
    galleryInputRef.current?.click();
  };

  const onPickCamera = () => {
    if (disabled || uploading) return;
    cameraInputRef.current?.click();
  };

  const onFiles = async (fileList: FileList | null, inputEl: HTMLInputElement | null) => {
    if (!fileList || fileList.length === 0) return;
    const selected = Array.from(fileList).filter(isImageFile);
    if (selected.length === 0) {
      setError('이미지 파일만 선택해주세요.');
      if (inputEl) inputEl.value = '';
      return;
    }
    const remaining = Math.max(0, maxPhotos - items.length);
    if (remaining <= 0) {
      setError(`사진은 최대 ${maxPhotos}장까지 첨부할 수 있습니다.`);
      if (inputEl) inputEl.value = '';
      return;
    }
    const toUpload = selected.slice(0, remaining);
    if (toUpload.length < selected.length) {
      setError(
        `최대 ${maxPhotos}장까지 첨부할 수 있어 일부만 업로드됩니다. (${toUpload.length}장 진행)`
      );
    } else {
      setError(null);
    }

    setUploading(true);
    try {
      const r = await uploadOrderFormPhotosByToken(token, toUpload);
      setItems((prev) => [...prev, ...r.items]);
    } catch (e) {
      setError(e instanceof Error ? e.message : '사진 업로드에 실패했습니다.');
      void refresh();
    } finally {
      setUploading(false);
      if (inputEl) inputEl.value = '';
    }
  };

  const onRemove = async (photoId: string) => {
    if (disabled || uploading) return;
    if (!window.confirm('이 사진을 삭제할까요?')) return;
    try {
      await deleteOrderFormPhotoByToken(token, photoId);
      setItems((prev) => prev.filter((p) => p.id !== photoId));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : '사진 삭제에 실패했습니다.');
    }
  };

  const remaining = Math.max(0, maxPhotos - items.length);
  const atLimit = remaining === 0;

  return (
    <div>
      <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">
        <p className="font-semibold">현장 사진을 미리 보내주세요 (선택)</p>
        <p className="mt-1">
          집안 전체 컨디션, 특별히 청소가 필요한 곳, 오염이 심해 보이는 부분을 사진으로 남겨주시면
          더 정확하게 준비해 찾아갈 수 있습니다.
        </p>
        <p className="mt-1">
          <b>오염이 심하거나 특이 사항이 있는 현장은 당일 추가 요금이 발생할 수 있어</b>,
          미리 사진을 받아 견적을 함께 안내해 드릴 수 있도록 하는 과정입니다.
        </p>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onPickGallery}
          disabled={disabled || uploading || atLimit}
          className="inline-flex min-h-[44px] touch-manipulation items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {uploading ? '업로드 중…' : '앨범에서 선택 (여러 장)'}
        </button>
        <button
          type="button"
          onClick={onPickCamera}
          disabled={disabled || uploading || atLimit}
          className="inline-flex min-h-[44px] touch-manipulation items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          카메라로 촬영
        </button>
        <span className="text-xs text-gray-500">
          {items.length} / {maxPhotos}장 · 한 장당 최대 12MB
        </span>
        {/* 앨범·갤러리: capture 없음 — iOS/Android에서 사진 보관함·다중 선택 */}
        <input
          ref={galleryInputRef}
          type="file"
          accept={IMAGE_ACCEPT}
          multiple
          className="hidden"
          onChange={(e) => {
            void onFiles(e.target.files, e.target);
          }}
        />
        {/* 카메라 전용: capture 있으면 앨범이 막히므로 입력 분리 */}
        <input
          ref={cameraInputRef}
          type="file"
          accept={IMAGE_ACCEPT}
          capture="environment"
          className="hidden"
          onChange={(e) => {
            void onFiles(e.target.files, e.target);
          }}
        />
      </div>

      {error ? (
        <p className="mt-2 text-xs text-red-600">{error}</p>
      ) : null}

      {items.length > 0 ? (
        <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {items.map((p) => (
            <li
              key={p.id}
              className="group relative aspect-square overflow-hidden rounded-md border border-gray-200 bg-gray-100"
            >
              <button
                type="button"
                onClick={() => setPreview(p)}
                className="block h-full w-full"
                aria-label="사진 크게 보기"
              >
                <img
                  src={p.secureUrl}
                  alt="현장 사진"
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              </button>
              <button
                type="button"
                onClick={() => void onRemove(p.id)}
                disabled={disabled || uploading}
                className="absolute right-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-xs font-bold text-white hover:bg-black/80 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="사진 삭제"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-xs text-gray-500">
          * 아직 첨부된 사진이 없습니다. 앨범에서 여러 장을 한 번에 선택하거나, 카메라로 촬영해
          올려주세요.
        </p>
      )}

      {preview ? (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 p-4"
          onClick={() => setPreview(null)}
          role="presentation"
        >
          <div
            className="relative max-h-full max-w-full"
            onClick={(e) => e.stopPropagation()}
            role="presentation"
          >
            <img
              src={preview.secureUrl}
              alt="현장 사진 확대"
              className="max-h-[92vh] max-w-[92vw] rounded-md object-contain"
            />
            <button
              type="button"
              onClick={() => setPreview(null)}
              className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/70 text-white"
              aria-label="닫기"
            >
              ×
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
