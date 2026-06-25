import { useMemo, useRef, useState } from 'react';
import type { InspectionChecklistDto } from '../../api/inquiryInspection';
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
import { prepareImageFilesForUpload } from '../../utils/imageResizeForUpload';
import { mergeItemPhotos } from '../../utils/inspectionChecklistPhotoMerge';

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
  const [sharing, setSharing] = useState(false);
  const [shareProgress, setShareProgress] = useState<{ done: number; total: number } | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

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

  const handleUpload = async (files: FileList | null) => {
    if (!files?.length || !uploadTarget || readOnly || disabled || uploading) return;
    setUploading(true);
    onMsg?.(null);
    try {
      const prepared = await prepareImageFilesForUpload(Array.from(files));
      const created = await uploadTeamInspectionPhotos(
        token,
        inquiryId,
        uploadTarget.itemId,
        'BEFORE',
        prepared,
      );
      onChecklistUpdate(mergeItemPhotos(checklist, uploadTarget.itemId, created));
      onMsg?.(`오염 사진 ${created.length}장을 추가했습니다.`);
    } catch (e) {
      onMsg?.(e instanceof Error ? e.message : '업로드 실패');
    } finally {
      setUploading(false);
    }
  };

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

  return (
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
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              void handleUpload(e.target.files);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            disabled={disabled || uploading}
            onClick={() => fileInputRef.current?.click()}
            className="flex min-h-[44px] w-full items-center justify-center rounded-lg border border-dashed border-amber-400 bg-white px-3 py-2 text-fluid-xs font-semibold text-amber-950 touch-manipulation disabled:opacity-50"
          >
            {uploading ? '업로드 중…' : '+ 오염 추가 촬영'}
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
  );
}

/** @deprecated ContaminationPhotosSection */
export const FlaggedBeforePhotosSection = ContaminationPhotosSection;
