import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  type ConsultationPhotoItem,
  deleteAdminConsultationPhoto,
  listAdminConsultationPhotos,
  listTeamConsultationPhotos,
  uploadAdminConsultationPhotos,
} from '../../api/inquiryConsultationPhotos';
import { ConfirmPasswordModal } from '../admin/ConfirmPasswordModal';
import { ImageThumbLightbox, type ImageGallerySlide } from '../ui/ImageThumbLightbox';

function ChevronDownMini({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

type Props = {
  inquiryId: string;
  variant: 'team' | 'admin';
  token: string;
  embedded?: boolean;
};

export function InquiryConsultationPhotosPanel({
  inquiryId,
  variant,
  token,
  embedded = false,
}: Props) {
  const [items, setItems] = useState<ConsultationPhotoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ConsultationPhotoItem | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res =
        variant === 'team'
          ? await listTeamConsultationPhotos(token, inquiryId)
          : await listAdminConsultationPhotos(token, inquiryId);
      setItems(res.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : '사진 목록을 불러올 수 없습니다.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [token, inquiryId, variant]);

  useEffect(() => {
    void load();
  }, [load]);

  const gallerySlides: ImageGallerySlide[] = useMemo(
    () =>
      items.map((p) => ({
        src: p.secureUrl,
        alt: `${p.uploadedBy.name} · 상담 참고`,
      })),
    [items]
  );

  const isLikelyUploadableImage = (f: File) => {
    if (f.type.startsWith('image/')) return true;
    return /\.(jpe?g|png|gif|webp)$/i.test(f.name);
  };

  const handleFiles = async (files: File[]) => {
    const raw = files.filter(isLikelyUploadableImage);
    if (files.length > 0 && raw.length === 0) {
      setError('지원 형식의 이미지만 올릴 수 있습니다. (JPEG, PNG, WebP, GIF)');
      return;
    }
    if (raw.length === 0) return;
    const batch = raw.slice(0, 20);
    setUploading(true);
    if (raw.length > 20) {
      setError('한 번에 최대 20장까지 올릴 수 있습니다. 처음 20장만 전송합니다.');
    } else {
      setError(null);
    }
    try {
      const res = await uploadAdminConsultationPhotos(token, inquiryId, batch);
      const uploaded = Array.isArray(res.items) ? res.items : [];
      if (uploaded.length > 0) {
        setItems((prev) => [...uploaded, ...prev]);
      } else {
        const again = await listAdminConsultationPhotos(token, inquiryId);
        setItems(again.items);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '업로드에 실패했습니다.');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteAdmin = async (password: string) => {
    if (!deleteTarget) return;
    await deleteAdminConsultationPhoto(token, inquiryId, deleteTarget.id, password);
    setItems((prev) => prev.filter((p) => p.id !== deleteTarget.id));
    setDeleteTarget(null);
  };

  const wrapClass = embedded ? 'min-w-0' : 'border-t border-gray-100 pt-3 mt-1 min-w-0';

  return (
    <div className={wrapClass}>
      {!embedded && variant === 'admin' && (
        <span className="text-gray-500 block text-fluid-xs mb-2">상담·참고 사진</span>
      )}

      {variant === 'admin' ? (
        <details className="group mb-3 min-w-0 rounded-lg border border-gray-200 bg-white overflow-hidden [&_summary::-webkit-details-marker]:hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 text-fluid-sm font-medium text-gray-800 hover:bg-gray-50 min-h-[44px] touch-manipulation select-none">
            <span>사진 올리기</span>
            <ChevronDownMini className="h-5 w-5 shrink-0 text-gray-500 transition-transform group-open:rotate-180" />
          </summary>
          <div className="border-t border-gray-100 bg-gray-50/80 px-3 pb-3 pt-2">
            <p className="text-fluid-xs text-gray-600 mb-2">
              마케터·관리자만 업로드할 수 있습니다. 담당 팀장·타업체는 팀 화면에서 같은 사진을 볼 수 있습니다.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.gif,.webp"
              multiple
              className="sr-only"
              disabled={uploading}
              onChange={(e) => {
                const input = e.target;
                const picked = input.files ? Array.from(input.files) : [];
                input.value = '';
                void handleFiles(picked);
              }}
            />
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="w-full sm:w-auto min-h-[44px] touch-manipulation rounded-lg border border-gray-300 bg-white px-4 text-fluid-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
            >
              {uploading ? '업로드 중…' : '사진 올리기 (여러 장·카메라·갤러리)'}
            </button>
          </div>
        </details>
      ) : null}

      {error && <p className="text-fluid-sm text-red-600 mb-2">{error}</p>}

      {loading ? (
        <p className="text-fluid-sm text-gray-500">불러오는 중…</p>
      ) : items.length === 0 ? (
        <p className="text-fluid-sm text-gray-400">등록된 사진이 없습니다.</p>
      ) : (
        <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
          {items.map((photo) => (
            <div
              key={photo.id}
              className="relative min-w-0 rounded-lg border border-gray-200 overflow-hidden bg-gray-50"
            >
              <ImageThumbLightbox
                src={photo.secureUrl}
                alt="상담 참고 사진"
                thumbClassName="h-20 w-full max-h-20 object-cover"
                buttonClassName="flex min-h-[80px] w-full items-center justify-center overflow-hidden rounded border border-gray-200 bg-gray-50 p-0 ring-inset focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 touch-manipulation"
                gallerySlides={gallerySlides.length > 1 ? gallerySlides : undefined}
                galleryIndex={items.findIndex((p) => p.id === photo.id)}
              />
              <div
                className="px-1 py-0.5 text-[10px] leading-tight text-gray-600 truncate"
                title={photo.uploadedBy.name}
              >
                {photo.uploadedBy.name}
              </div>
              {variant === 'admin' ? (
                <button
                  type="button"
                  className="absolute top-0.5 right-0.5 z-10 px-1 py-0.5 rounded bg-black/55 text-white text-[10px] hover:bg-black/70 touch-manipulation"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteTarget(photo);
                  }}
                >
                  삭제
                </button>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {variant === 'admin' && (
        <ConfirmPasswordModal
          open={deleteTarget != null}
          title="상담·참고 사진 삭제"
          confirmLabel="삭제"
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDeleteAdmin}
        />
      )}
    </div>
  );
}
