import { useMemo, useState } from 'react';
import type { InspectionChecklistDto } from '../../api/inquiryInspection';
import { patchTeamInspectionPhotoFlag } from '../../api/inquiryInspection';
import { shareImageFiles, shareImagesResultHint } from '../../utils/shareFiles';
import {
  collectFlaggedBeforePhotos,
  flaggedBeforePhotosToShareItems,
  updateChecklistPhotoFlag,
} from '../../utils/inspectionFlaggedPhotos';
import { InspectionPhotoFlagButton } from './InspectionPhotoFlagButton';
import { ImageThumbLightbox, type ImageGallerySlide } from '../ui/ImageThumbLightbox';

function sanitizeFlaggedFilename(areaLabel: string, itemLabel: string, index: number): string {
  const part = (s: string) => s.trim().replace(/[^\w\uAC00-\uD7A3.-]+/g, '_').slice(0, 16);
  return `${part(areaLabel)}_${part(itemLabel)}_${index}`;
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

export function FlaggedBeforePhotosSection({
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
  const [sharing, setSharing] = useState(false);
  const [shareProgress, setShareProgress] = useState<{ done: number; total: number } | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const entries = useMemo(() => collectFlaggedBeforePhotos(checklist), [checklist]);
  const count = entries.length;

  const gallerySlides: ImageGallerySlide[] = useMemo(
    () =>
      entries.map((e, idx) => ({
        src: e.photo.secureUrl,
        alt: `${e.areaLabel} · ${e.itemLabel}`,
        title: `[오염 심함] ${e.areaLabel} · ${e.itemLabel}`,
        downloadFilename: `flagged_${sanitizeFlaggedFilename(e.areaLabel, e.itemLabel, idx + 1)}.jpg`,
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
      const title = `[청소 전·오염 심함] ${customerName ?? '현장'}`;
      const text = [
        title,
        dateLabel ? `서비스일 ${dateLabel}` : '',
        `오염·손상이 심한 부분 사진 ${count}장입니다. 확인 후 말씀해 주시면 현장에서 바로 조치·협의하겠습니다.`,
      ]
        .filter(Boolean)
        .join('\n');

      const result = await shareImageFiles({
        images: flaggedBeforePhotosToShareItems(entries),
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
        : `선택 사진 ${count}장 전달`;

  return (
    <section
      className={`rounded-xl border px-3 py-3 ${
        count > 0 ? 'border-amber-300 bg-amber-50/80' : 'border-gray-200 bg-gray-50/80'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="min-w-0 text-fluid-sm font-semibold text-gray-900">오염 심함</h3>
        <div className="flex shrink-0 items-center gap-1.5">
          {count > 0 ? (
            <ImageThumbLightbox
              src={entries[0]!.photo.secureUrl}
              alt="오염 심함 사진 모아보기"
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

      {count > 0 ? (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch]">
          {entries.map((entry, idx) => (
            <div key={entry.photo.id} className="relative w-[4.5rem] shrink-0">
              <div className="relative">
                <ImageThumbLightbox
                  src={entry.photo.secureUrl}
                  alt={`${entry.areaLabel} ${entry.itemLabel}`}
                  gallerySlides={gallerySlides}
                  galleryIndex={idx}
                  showDownload
                  thumbClassName="h-16 w-full object-cover"
                  buttonClassName="block w-full overflow-hidden rounded-lg border-2 border-amber-400 bg-white touch-manipulation"
                />
                {!readOnly && (
                  <div className="absolute -right-1 -top-1 z-10">
                    <InspectionPhotoFlagButton
                      flagged
                      disabled={disabled || togglingId === entry.photo.id}
                      onToggle={() => void toggleFlag(entry.itemId, entry.photo.id, false)}
                      className="!h-8 !w-8 !text-sm"
                    />
                  </div>
                )}
              </div>
              <p
                className="mt-1 truncate text-center text-[9px] leading-tight text-amber-950"
                title={`${entry.areaLabel} · ${entry.itemLabel}`}
              >
                {entry.areaLabel}·{entry.itemLabel}
              </p>
            </div>
          ))}
        </div>
      ) : !readOnly ? (
        <p className="mt-2 text-fluid-2xs text-gray-500">아직 표시한 사진이 없습니다.</p>
      ) : null}
    </section>
  );
}
