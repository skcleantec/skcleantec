import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  type CleaningPhotoItem,
  type CleaningPhotoPhase,
  deleteAdminCleaningPhoto,
  deleteTeamCleaningPhoto,
  listAdminCleaningPhotos,
  listTeamCleaningPhotos,
  uploadAdminCleaningPhotos,
  uploadTeamCleaningPhotos,
} from '../../api/inquiryCleaningPhotos';
import { ConfirmPasswordModal } from '../admin/ConfirmPasswordModal';
import { ImageThumbLightbox, type ImageGallerySlide } from '../ui/ImageThumbLightbox';
import { parseJwtPayload } from '../../utils/jwtPayload';

const PHASE_LABEL: Record<CleaningPhotoPhase, string> = {
  BEFORE: '청소 전',
  AFTER: '청소 후',
};

function CameraUploadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function SparklesUploadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
      />
    </svg>
  );
}

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
  /** 팀장 상세 상단 카드 안에 넣을 때: 바깥 제목과 겹치지 않게 구분선·소제목 정리 */
  embedded?: boolean;
};

export function InquiryCleaningPhotosPanel({ inquiryId, variant, token, embedded = false }: Props) {
  const teamUserId =
    variant === 'team' ? parseJwtPayload<{ userId?: string }>(token)?.userId ?? null : null;

  const [items, setItems] = useState<CleaningPhotoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadPhase, setUploadPhase] = useState<CleaningPhotoPhase>('BEFORE');
  const [uploading, setUploading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CleaningPhotoItem | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileInputBeforeRef = useRef<HTMLInputElement>(null);
  const fileInputAfterRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res =
        variant === 'team'
          ? await listTeamCleaningPhotos(token, inquiryId)
          : await listAdminCleaningPhotos(token, inquiryId);
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
        alt: `${PHASE_LABEL[p.phase]} · ${p.uploadedBy.name}`,
      })),
    [items]
  );

  const handleFiles = async (files: FileList | null, phase: CleaningPhotoPhase) => {
    const raw = Array.from(files ?? []).filter((f) => f.type.startsWith('image/'));
    if (raw.length === 0) return;
    const batch = raw.slice(0, 20);
    setUploading(true);
    if (raw.length > 20) {
      setError('한 번에 최대 20장까지 올릴 수 있습니다. 처음 20장만 전송합니다.');
    } else {
      setError(null);
    }
    try {
      const res =
        variant === 'team'
          ? await uploadTeamCleaningPhotos(token, inquiryId, batch, phase)
          : await uploadAdminCleaningPhotos(token, inquiryId, batch, phase);
      setItems((prev) => [...res.items, ...prev]);
    } catch (e) {
      setError(e instanceof Error ? e.message : '업로드에 실패했습니다.');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteTeam = async (photo: CleaningPhotoItem) => {
    if (!window.confirm('이 사진을 삭제할까요?')) return;
    setError(null);
    try {
      await deleteTeamCleaningPhoto(token, inquiryId, photo.id);
      setItems((prev) => prev.filter((p) => p.id !== photo.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : '삭제에 실패했습니다.');
    }
  };

  const handleDeleteAdmin = async (password: string) => {
    if (!deleteTarget) return;
    await deleteAdminCleaningPhoto(token, inquiryId, deleteTarget.id, password);
    setItems((prev) => prev.filter((p) => p.id !== deleteTarget.id));
    setDeleteTarget(null);
  };

  const byPhase = (phase: CleaningPhotoPhase) => items.filter((p) => p.phase === phase);

  const wrapClass = embedded
    ? 'min-w-0'
    : 'border-t border-gray-100 pt-3 mt-1 min-w-0';

  return (
    <div className={wrapClass}>
      {!embedded && (
        <span className="text-gray-500 block text-fluid-xs mb-2">청소 전·후 사진</span>
      )}

      <details className="group mb-3 min-w-0 rounded-lg border border-gray-200 bg-white overflow-hidden [&_summary::-webkit-details-marker]:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 text-fluid-sm font-medium text-gray-800 hover:bg-gray-50 min-h-[44px] touch-manipulation select-none">
          <span>사진 올리기</span>
          <ChevronDownMini className="h-5 w-5 shrink-0 text-gray-500 transition-transform group-open:rotate-180" />
        </summary>
        <div className="border-t border-gray-100 bg-gray-50/80 px-3 pb-3 pt-2">
          {variant === 'team' ? (
            <div className="min-w-0 space-y-3">
              <p className="text-fluid-xs text-gray-600">구분별 아이콘을 누르면 해당 청소 전·후로 올라갑니다.</p>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-fluid-sm font-medium text-gray-800 shrink-0">{PHASE_LABEL.BEFORE}</span>
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => fileInputBeforeRef.current?.click()}
                  className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-blue-200 bg-blue-50 text-blue-700 shadow-sm touch-manipulation hover:bg-blue-100 disabled:opacity-50 active:bg-blue-200"
                  aria-label={`${PHASE_LABEL.BEFORE} 사진 올리기`}
                >
                  <CameraUploadIcon className="h-6 w-6" />
                </button>
                <input
                  ref={fileInputBeforeRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  multiple
                  className="sr-only"
                  disabled={uploading}
                  onChange={(e) => {
                    const list = e.target.files;
                    e.target.value = '';
                    void handleFiles(list, 'BEFORE');
                  }}
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-fluid-sm font-medium text-gray-800 shrink-0">{PHASE_LABEL.AFTER}</span>
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => fileInputAfterRef.current?.click()}
                  className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-emerald-200 bg-emerald-50 text-emerald-700 shadow-sm touch-manipulation hover:bg-emerald-100 disabled:opacity-50 active:bg-emerald-200"
                  aria-label={`${PHASE_LABEL.AFTER} 사진 올리기`}
                >
                  <SparklesUploadIcon className="h-6 w-6" />
                </button>
                <input
                  ref={fileInputAfterRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  multiple
                  className="sr-only"
                  disabled={uploading}
                  onChange={(e) => {
                    const list = e.target.files;
                    e.target.value = '';
                    void handleFiles(list, 'AFTER');
                  }}
                />
              </div>
              {uploading && <p className="text-fluid-xs text-gray-500">업로드 중…</p>}
            </div>
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end min-w-0">
              <div className="flex flex-wrap items-center gap-2 min-w-0">
                <span className="text-fluid-xs text-gray-600 shrink-0">구분</span>
                <select
                  value={uploadPhase}
                  onChange={(e) => setUploadPhase(e.target.value as CleaningPhotoPhase)}
                  className="border border-gray-300 rounded px-2 py-2 text-fluid-sm min-w-0 flex-1 sm:flex-initial bg-white"
                  disabled={uploading}
                >
                  <option value="BEFORE">{PHASE_LABEL.BEFORE}</option>
                  <option value="AFTER">{PHASE_LABEL.AFTER}</option>
                </select>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                multiple
                className="sr-only"
                disabled={uploading}
                onChange={(e) => {
                  const list = e.target.files;
                  e.target.value = '';
                  void handleFiles(list, uploadPhase);
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
          )}
        </div>
      </details>

      {error && <p className="text-fluid-sm text-red-600 mb-2">{error}</p>}

      {loading ? (
        <p className="text-fluid-sm text-gray-500">불러오는 중…</p>
      ) : (
        <div className="space-y-4">
          {(['BEFORE', 'AFTER'] as const).map((phase) => {
            const list = byPhase(phase);
            return (
              <div key={phase} className="min-w-0">
                <p className="text-fluid-xs font-medium text-gray-700 mb-2">{PHASE_LABEL[phase]}</p>
                {list.length === 0 ? (
                  <p className="text-fluid-sm text-gray-400">등록된 사진이 없습니다.</p>
                ) : (
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
                    {list.map((photo) => (
                      <div
                        key={photo.id}
                        className="relative min-w-0 rounded-lg border border-gray-200 overflow-hidden bg-gray-50"
                      >
                        <ImageThumbLightbox
                          src={photo.secureUrl}
                          alt={`${PHASE_LABEL[phase]} 사진`}
                          thumbClassName="h-8 w-full max-h-8 object-cover"
                          buttonClassName="flex min-h-[44px] w-full items-center justify-center overflow-hidden rounded border border-gray-200 bg-gray-50 p-0 ring-inset focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 touch-manipulation"
                          gallerySlides={gallerySlides.length > 1 ? gallerySlides : undefined}
                          galleryIndex={items.findIndex((p) => p.id === photo.id)}
                        />
                        <div
                          className="px-1 py-0.5 text-[10px] leading-tight text-gray-600 truncate"
                          title={photo.uploadedBy.name}
                        >
                          {photo.uploadedBy.name}
                        </div>
                        {variant === 'team' &&
                        (teamUserId == null || teamUserId === photo.uploadedBy.id) ? (
                          <button
                            type="button"
                            className="absolute top-0.5 right-0.5 z-10 px-1 py-0.5 rounded bg-black/55 text-white text-[10px] hover:bg-black/70 touch-manipulation"
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleDeleteTeam(photo);
                            }}
                          >
                            삭제
                          </button>
                        ) : variant === 'admin' ? (
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
              </div>
            );
          })}
        </div>
      )}

      {variant === 'admin' && (
        <ConfirmPasswordModal
          open={deleteTarget != null}
          title="청소 사진 삭제"
          confirmLabel="삭제"
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDeleteAdmin}
        />
      )}
    </div>
  );
}
