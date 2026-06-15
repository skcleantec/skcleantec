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
      entries.map((e) => ({
        src: e.photo.secureUrl,
        alt: `${e.areaLabel} · ${e.itemLabel}`,
        title: `${e.areaLabel} · ${e.itemLabel}`,
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

  const shareLabel =
    sharing && shareProgress
      ? `준비 중 (${shareProgress.done}/${shareProgress.total})`
      : sharing
        ? '준비 중…'
        : `선택 사진 전달${count ? ` (${count})` : ''}`;

  return (
    <section
      className={`rounded-xl border px-3 py-3 ${
        count > 0 ? 'border-amber-300 bg-amber-50/80' : 'border-gray-200 bg-gray-50/80'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-fluid-sm font-semibold text-gray-900">
            오염 심함 {count > 0 ? `(${count})` : ''}
          </h3>
          <p className="mt-0.5 text-fluid-2xs text-gray-600">
            {readOnly
              ? '표시된 청소 전 사진입니다.'
              : '촬영한 사진에서 ☆를 눌러 표시하면 여기에 모입니다.'}
          </p>
        </div>
        {count > 0 && (
          <button
            type="button"
            disabled={disabled || sharing}
            onClick={() => void handleShare()}
            className="min-h-[40px] shrink-0 rounded-lg border border-sky-400 bg-sky-100 px-3 py-2 text-fluid-2xs font-semibold text-sky-950 touch-manipulation disabled:opacity-45"
          >
            {shareLabel}
          </button>
        )}
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
