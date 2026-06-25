import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { InspectionAreaPhoto, InspectionChecklistDto } from '../../api/inquiryInspection';
import {
  deleteTeamInspectionPhoto,
  patchTeamInspectionPhotoFlag,
  uploadTeamInspectionPhotos,
} from '../../api/inquiryInspection';
import { shareImageFiles, shareImagesResultHint } from '../../utils/shareFiles';
import {
  collectContaminationDirectPhotos,
  collectContaminationGalleryEntries,
  collectFlaggedBeforePhotos,
  contaminationEntriesToShareItems,
  findContaminationUploadTarget,
  removeChecklistPhoto,
  updateChecklistPhotoFlag,
  type ContaminationPhotoEntry,
} from '../../utils/inspectionFlaggedPhotos';
import { InspectionPhotoFlagButton } from './InspectionPhotoFlagButton';
import { ImageThumbLightbox, type ImageGallerySlide } from '../ui/ImageThumbLightbox';
import { useInlineCamera } from '../../hooks/useInlineCamera';
import { prepareImageFileForUpload } from '../../utils/imageResizeForUpload';
import { mergeItemPhotos, removeItemPhoto, replaceItemPhoto } from '../../utils/inspectionChecklistPhotoMerge';

function sanitizeFilename(label: string, index: number): string {
  const part = label.trim().replace(/[^\w\uAC00-\uD7A3.-]+/g, '_').slice(0, 16);
  return `${part || 'photo'}_${index}`;
}

function entryCaption(entry: ContaminationPhotoEntry): string {
  if (entry.kind === 'flagged') return `${entry.areaLabel} · ${entry.itemLabel}`;
  return '추가 오염 촬영';
}

function ShareOutlineIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" y1="2" x2="12" y2="15" />
    </svg>
  );
}

export function ContaminationPhotosSection({
  checklist,
  inquiryId,
  token,
  readOnly,
  disabled,
  onChecklistUpdate,
  onMsg,
}: {
  checklist: InspectionChecklistDto;
  inquiryId: string;
  token: string;
  readOnly: boolean;
  disabled?: boolean;
  onChecklistUpdate: (next: InspectionChecklistDto) => void;
  onMsg?: (msg: string | null) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const captureInFlightRef = useRef(false);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareProgress, setShareProgress] = useState<{ done: number; total: number } | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [pendingUploadCount, setPendingUploadCount] = useState(0);
  const [capturing, setCapturing] = useState(false);

  const { videoRef, status: cameraStatus, error: cameraError, captureFrame, refreshPreview } =
    useInlineCamera(captureOpen && !readOnly);

  useEffect(() => {
    if (!captureOpen || readOnly) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [captureOpen, readOnly]);

  useEffect(() => {
    if (!captureOpen) return;
    refreshPreview();
    requestAnimationFrame(() => refreshPreview());
  }, [captureOpen, refreshPreview]);

  const flaggedEntries = useMemo(() => collectFlaggedBeforePhotos(checklist), [checklist]);
  const directEntries = useMemo(() => collectContaminationDirectPhotos(checklist), [checklist]);
  const entries = useMemo(() => collectContaminationGalleryEntries(checklist), [checklist]);
  const count = entries.length;
  const uploadTarget = useMemo(() => findContaminationUploadTarget(checklist), [checklist]);

  const gallerySlides: ImageGallerySlide[] = useMemo(
    () =>
      entries.map((e, idx) => ({
        src: e.photo.secureUrl,
        alt: entryCaption(e),
        title: e.kind === 'flagged' ? `[오염] ${entryCaption(e)}` : '[오염] 추가 촬영',
        downloadFilename: `contamination_${sanitizeFilename(entryCaption(e), idx + 1)}.jpg`,
      })),
    [entries],
  );

  const toggleFlag = async (itemId: string, photoId: string, next: boolean) => {
    if (readOnly || disabled || togglingId) return;
    const prev = checklist;
    onChecklistUpdate(updateChecklistPhotoFlag(checklist, itemId, photoId, next));
    setTogglingId(photoId);
    onMsg?.(null);
    try {
      await patchTeamInspectionPhotoFlag(token, inquiryId, itemId, photoId, next);
    } catch (e) {
      onChecklistUpdate(prev);
      onMsg?.(e instanceof Error ? e.message : '표시 저장 실패');
    } finally {
      setTogglingId(null);
    }
  };

  const handleDeleteDirect = async (itemId: string, photoId: string) => {
    if (readOnly || disabled || !window.confirm('이 오염 사진을 삭제할까요?')) return;
    const prev = checklist;
    onChecklistUpdate(removeChecklistPhoto(checklist, itemId, photoId));
    onMsg?.(null);
    try {
      await deleteTeamInspectionPhoto(token, inquiryId, itemId, photoId);
    } catch (e) {
      onChecklistUpdate(prev);
      onMsg?.(e instanceof Error ? e.message : '삭제 실패');
    }
  };

  const checklistRef = useRef(checklist);
  checklistRef.current = checklist;

  const applyChecklist = useCallback(
    (updater: (prev: InspectionChecklistDto) => InspectionChecklistDto) => {
      const next = updater(checklistRef.current);
      checklistRef.current = next;
      onChecklistUpdate(next);
    },
    [onChecklistUpdate],
  );

  const uploadFiles = useCallback(
    async (files: File[]) => {
      if (!files.length || !uploadTarget || readOnly || disabled) return;
      for (const file of files) {
        const optimisticId = `pending-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const blobUrl = URL.createObjectURL(file);
        const optimisticPhoto: InspectionAreaPhoto = {
          id: optimisticId,
          phase: 'BEFORE',
          secureUrl: blobUrl,
          width: null,
          height: null,
          flagged: false,
          uploadedBy: { id: '', name: '' },
          createdAt: new Date().toISOString(),
        };
        const itemId = uploadTarget.itemId;

        applyChecklist((prev) => mergeItemPhotos(prev, itemId, [optimisticPhoto]));
        onMsg?.(null);

        setPendingUploadCount((n) => n + 1);
        void (async () => {
          try {
            const prepared = await prepareImageFileForUpload(file);
            const created = await uploadTeamInspectionPhotos(token, inquiryId, itemId, 'BEFORE', [prepared]);
            applyChecklist((prev) => replaceItemPhoto(prev, itemId, optimisticId, created));
            onMsg?.(`오염 사진 ${created.length}장을 추가했습니다.`);
            refreshPreview();
          } catch (e) {
            applyChecklist((prev) => removeItemPhoto(prev, itemId, optimisticId));
            onMsg?.(e instanceof Error ? e.message : '업로드 실패');
          } finally {
            URL.revokeObjectURL(blobUrl);
            setPendingUploadCount((n) => Math.max(0, n - 1));
          }
        })();
      }
    },
    [applyChecklist, disabled, inquiryId, onMsg, readOnly, refreshPreview, token, uploadTarget],
  );

  const handleUpload = async (files: FileList | null) => {
    if (!files?.length) return;
    await uploadFiles(Array.from(files));
  };

  const handleShutter = useCallback(async () => {
    if (disabled || captureInFlightRef.current || !uploadTarget) return;
    if (cameraStatus === 'live') {
      captureInFlightRef.current = true;
      setCapturing(true);
      try {
        const file = await captureFrame();
        await uploadFiles([file]);
      } catch (e) {
        onMsg?.(e instanceof Error ? e.message : '촬영 실패');
      } finally {
        captureInFlightRef.current = false;
        setCapturing(false);
      }
      return;
    }
    onMsg?.(null);
    fileInputRef.current?.click();
  }, [cameraStatus, captureFrame, disabled, onMsg, uploadFiles, uploadTarget]);

  const closeCapture = useCallback(() => {
    if (capturing) return;
    setCaptureOpen(false);
  }, [capturing]);

  const handleShare = async () => {
    if (!count || sharing || disabled) return;
    setSharing(true);
    setShareProgress({ done: 0, total: count });
    try {
      const customerName = checklist.inquiryHeader?.customerName;
      const preferredDate = checklist.inquiryHeader?.preferredDate;
      const dateLabel = preferredDate
        ? new Date(preferredDate).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })
        : '';
      const title = `[청소 전·오염] ${customerName ?? '현장'}`;
      const text = [
        title,
        dateLabel ? `서비스일 ${dateLabel}` : '',
        `오염·손상 사진 ${count}장입니다. 확인 후 말씀해 주시면 현장에서 바로 조치·협의하겠습니다.`,
      ]
        .filter(Boolean)
        .join('\n');

      const result = await shareImageFiles({
        images: contaminationEntriesToShareItems(entries),
        title,
        text,
        onProgress: (done, total) => setShareProgress({ done, total }),
      });
      const hint = shareImagesResultHint(result, count);
      if (hint) alert(hint);
    } catch (e) {
      alert(e instanceof Error ? e.message : '전달 준비에 실패했습니다.');
    } finally {
      setSharing(false);
      setShareProgress(null);
    }
  };

  const shareAriaLabel =
    sharing && shareProgress
      ? `사진 준비 중 ${shareProgress.done}/${shareProgress.total}`
      : sharing
        ? '사진 준비 중'
        : `오염 사진 ${count}장 전달`;

  let captureOverlay: ReactNode = null;
  if (captureOpen && !readOnly && uploadTarget) {
    captureOverlay = (
      <div className="fixed inset-0 z-[200] flex flex-col bg-black text-white pt-[env(safe-area-inset-top)]">
        <div className="relative min-h-0 flex-1">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`absolute inset-0 h-full w-full object-cover ${
              cameraStatus === 'live' ? 'opacity-100' : 'opacity-0'
            }`}
          />
          {cameraStatus !== 'live' && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-950 px-6 text-center">
              <p className="text-sm text-gray-300">
                {cameraStatus === 'starting'
                  ? '카메라를 여는 중…'
                  : cameraError ?? '카메라를 사용할 수 없습니다. 아래 촬영 버튼으로 갤러리·카메라 앱을 이용해 주세요.'}
              </p>
            </div>
          )}

          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/75 via-transparent to-black/80" />

          <div className="absolute inset-x-0 top-0 z-10 border-b border-white/10 bg-black/40 px-3 py-2.5 backdrop-blur-sm">
            <div className="mx-auto flex max-w-lg items-center gap-2">
              <button
                type="button"
                onClick={closeCapture}
                disabled={capturing}
                className="pointer-events-auto flex h-11 min-w-[44px] shrink-0 items-center justify-center rounded-full bg-white/15 text-sm font-medium touch-manipulation disabled:opacity-50"
                aria-label="닫기"
              >
                ←
              </button>
              <div className="min-w-0 flex-1 text-center">
                <p className="text-xs text-amber-200/90">오염사진</p>
                <p className="truncate text-base font-bold">추가 오염 촬영</p>
              </div>
              <button
                type="button"
                onClick={closeCapture}
                disabled={capturing}
                className="pointer-events-auto flex h-11 shrink-0 items-center justify-center rounded-full border border-white/25 bg-white/10 px-3 text-sm font-semibold touch-manipulation disabled:opacity-50"
              >
                닫기
              </button>
            </div>
            {pendingUploadCount > 0 ? (
              <p className="pointer-events-none mx-auto mt-1 max-w-lg text-center text-[10px] text-sky-200/90">
                백그라운드 저장 {pendingUploadCount}건
              </p>
            ) : null}
          </div>

          <div className="absolute inset-x-0 top-[4.25rem] z-10 px-4">
            <div className="pointer-events-none mx-auto max-w-lg rounded-xl border border-amber-400/40 bg-black/55 px-4 py-3 backdrop-blur-md">
              <p className="text-[11px] font-bold tracking-wide text-amber-300">촬영 가이드</p>
              <p className="mt-1.5 text-sm font-medium leading-snug text-white">
                오염·손상이 심한 부분을 가까이에서 선명하게 촬영해 주세요. 여러 장 연속 촬영할 수 있습니다.
              </p>
            </div>
          </div>
        </div>

        <div className="shrink-0 border-t border-white/10 bg-black/90 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
          <div className="mx-auto flex max-w-lg items-center justify-center">
            <button
              type="button"
              disabled={capturing || disabled || cameraStatus === 'starting'}
              onClick={() => void handleShutter()}
              className="flex h-[4.5rem] w-[4.5rem] shrink-0 items-center justify-center rounded-full border-4 border-white bg-white/95 shadow-lg touch-manipulation active:scale-95 disabled:opacity-50"
              aria-label="촬영"
            >
              <span className="block h-[3.25rem] w-[3.25rem] rounded-full bg-amber-500" />
            </button>
          </div>
          <p className="mt-2 text-center text-[11px] text-gray-400">
            셔터를 누르면 바로 저장됩니다 · 추가 {directEntries.length}장
            {pendingUploadCount > 0 ? ` · 업로드 ${pendingUploadCount}건` : ''}
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            disabled={capturing}
            onChange={(e) => {
              void handleUpload(e.target.files);
              e.target.value = '';
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <>
      {captureOverlay ? createPortal(captureOverlay, document.body) : null}
    <section
      className={`rounded-xl border px-3 py-3 ${
        count > 0 ? 'border-amber-300 bg-amber-50/80' : 'border-gray-200 bg-gray-50/80'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-fluid-sm font-semibold text-gray-900">오염사진</h3>
            <span
              className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-fluid-2xs font-semibold tabular-nums ${
                count > 0
                  ? 'bg-amber-200 text-amber-950 ring-1 ring-amber-300/80'
                  : 'bg-gray-200 text-gray-600 ring-1 ring-gray-300/80'
              }`}
            >
              {count > 0 ? `${count}장` : '없음'}
            </span>
          </div>
          <p className="mt-1 text-fluid-2xs leading-snug text-gray-600">
            {readOnly
              ? '청소 전 촬영에서 ★ 표시한 사진과, 팀장이 추가로 올린 오염 사진입니다.'
              : '일반 촬영 중 ☆→★ 표시하면 여기에도 모입니다. 아래 「오염 추가 촬영」으로만 올린 사진은 이 카테고리에만 저장됩니다.'}
          </p>
          {!readOnly && (
            <p className="mt-1 text-fluid-2xs text-amber-900/80">
              ★ {flaggedEntries.length}장 · 추가 {directEntries.length}장
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {count > 0 ? (
            <ImageThumbLightbox
              src={entries[0]!.photo.secureUrl}
              alt="오염 사진 모아보기"
              buttonLabel="모아보기"
              gallerySlides={gallerySlides}
              galleryIndex={0}
              showDownload
              buttonClassName="inline-flex min-h-8 items-center rounded-lg border border-amber-400 bg-white px-2.5 text-fluid-2xs font-semibold text-amber-950 touch-manipulation hover:bg-amber-50"
            />
          ) : null}
          {count > 0 && !readOnly ? (
            <button
              type="button"
              disabled={disabled || sharing}
              onClick={() => void handleShare()}
              title={shareAriaLabel}
              aria-label={shareAriaLabel}
              className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-sky-400 bg-sky-100 text-sky-900 touch-manipulation disabled:opacity-45 active:scale-95"
            >
              {sharing ? (
                <span className="text-[10px] font-semibold leading-none">…</span>
              ) : (
                <ShareOutlineIcon className="h-4 w-4 shrink-0" />
              )}
              {!sharing ? (
                <span className="pointer-events-none absolute right-0 top-0 flex h-[13px] min-w-[13px] translate-x-[35%] -translate-y-[35%] items-center justify-center rounded-full bg-sky-600 px-0.5 text-[8px] font-bold leading-none text-white ring-1 ring-amber-50">
                  {count}
                </span>
              ) : null}
            </button>
          ) : null}
        </div>
      </div>

      {!readOnly && uploadTarget ? (
        <div className="mt-3">
          <button
            type="button"
            disabled={disabled || capturing || pendingUploadCount > 0}
            onClick={() => setCaptureOpen(true)}
            className="flex min-h-[44px] w-full items-center justify-center rounded-lg border border-dashed border-amber-400 bg-white px-3 py-2 text-fluid-xs font-semibold text-amber-950 touch-manipulation disabled:opacity-50"
          >
            {capturing ? '촬영 중…' : pendingUploadCount > 0 ? `저장 중 ${pendingUploadCount}건…` : '+ 오염 추가 촬영'}
          </button>
        </div>
      ) : null}

      {count > 0 ? (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch]">
          {entries.map((entry, idx) => (
            <div key={entry.photo.id} className="relative w-[4.5rem] shrink-0">
              <div className="relative">
                <ImageThumbLightbox
                  src={entry.photo.secureUrl}
                  alt={entryCaption(entry)}
                  gallerySlides={gallerySlides}
                  galleryIndex={idx}
                  showDownload
                  thumbClassName="h-16 w-full object-cover"
                  buttonClassName="block w-full overflow-hidden rounded-lg border-2 border-amber-400 bg-white touch-manipulation"
                />
                {!readOnly && entry.kind === 'flagged' && (
                  <div className="absolute -right-1 -top-1 z-10">
                    <InspectionPhotoFlagButton
                      flagged
                      disabled={disabled || togglingId === entry.photo.id}
                      onToggle={() => void toggleFlag(entry.itemId, entry.photo.id, false)}
                      className="!h-8 !w-8 !text-sm"
                    />
                  </div>
                )}
                {!readOnly && entry.kind === 'direct' && (
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => void handleDeleteDirect(entry.itemId, entry.photo.id)}
                    className="absolute -right-1 -top-1 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-rose-300 bg-white text-[10px] font-bold text-rose-700 shadow-sm touch-manipulation"
                    aria-label="삭제"
                  >
                    ×
                  </button>
                )}
              </div>
              <p
                className="mt-1 truncate text-center text-[9px] leading-tight text-amber-950"
                title={entryCaption(entry)}
              >
                {entry.kind === 'flagged' ? `★ ${entryCaption(entry)}` : '추가'}
              </p>
            </div>
          ))}
        </div>
      ) : null}
    </section>
    </>
  );
}

/** @deprecated ContaminationPhotosSection */
export const FlaggedBeforePhotosSection = ContaminationPhotosSection;
