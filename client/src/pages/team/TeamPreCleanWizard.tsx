import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  countBeforeItemProgress,
  isBeforeAreaItemsComplete,
  isBeforeItemComplete,
} from '@shared/inquiryInspectionTemplate';
import { getInspectionCaptureHint } from '@shared/inquiryInspectionCaptureGuides';
import {
  deleteTeamInspectionPhoto,
  addTeamInspectionAreaInstance,
  removeTeamInspectionAreaInstance,
  patchTeamInspectionArea,
  patchTeamInspectionItem,
  patchTeamInspectionPhotoFlag,
  uploadTeamInspectionPhotos,
  type InspectionArea,
  type InspectionAreaPhoto,
  type InspectionChecklistDto,
  type InspectionItem,
} from '../../api/inquiryInspection';
import { ImageThumbLightbox, type ImageGallerySlide } from '../../components/ui/ImageThumbLightbox';
import { prepareImageFileForUpload } from '../../utils/imageResizeForUpload';
import { useInlineCamera } from '../../hooks/useInlineCamera';
import { ShareAreaBeforePhotosButton } from '../../components/inquiry-inspection/ShareAreaBeforePhotosButton';
import { InspectionPhotoFlagButton } from '../../components/inquiry-inspection/InspectionPhotoFlagButton';
import {
  InspectionAreaCountButtons,
  areaHasBeforePhotos,
} from '../../components/inquiry-inspection/InspectionAreaCountButtons';
import { updateChecklistPhotoFlag } from '../../utils/inspectionFlaggedPhotos';
import { normalizeAreaKeyForTemplate } from '@shared/inquiryInspectionTenantTemplate';

const SESSION_PREFIX = 'preCleanWizard';

function visibleItems(area: InspectionArea): InspectionItem[] {
  return area.items.filter((it) => !it.itemKey.startsWith('_'));
}

function itemBeforeCount(item: InspectionItem): number {
  return item.photos.filter((p) => p.phase === 'BEFORE').length;
}

function findFirstIncompleteIndex(area: InspectionArea): number {
  const items = visibleItems(area);
  const idx = items.findIndex((it) =>
    !isBeforeItemComplete({ notApplicable: it.notApplicable, beforeCount: itemBeforeCount(it) }),
  );
  return idx >= 0 ? idx : 0;
}

function sessionKey(inquiryId: string) {
  return `${SESSION_PREFIX}:${inquiryId}`;
}

function readCaptureSession(inquiryId: string): { areaId?: string; idx?: number } | null {
  const raw = sessionStorage.getItem(sessionKey(inquiryId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as { areaId?: string; idx?: number };
  } catch {
    return null;
  }
}

function writeCaptureSession(inquiryId: string, areaId: string, idx: number) {
  sessionStorage.setItem(sessionKey(inquiryId), JSON.stringify({ areaId, idx }));
}

type AreaBeforePhotoEntry = {
  photo: InspectionAreaPhoto;
  itemId: string;
  itemLabel: string;
};

function collectAreaBeforePhotos(area: InspectionArea): AreaBeforePhotoEntry[] {
  const out: AreaBeforePhotoEntry[] = [];
  for (const item of visibleItems(area)) {
    for (const photo of item.photos.filter((p) => p.phase === 'BEFORE')) {
      out.push({ photo, itemId: item.id, itemLabel: item.label });
    }
  }
  return out;
}

function mergeItemPhotos(
  dto: InspectionChecklistDto,
  itemId: string,
  newPhotos: InspectionAreaPhoto[],
): InspectionChecklistDto {
  return {
    ...dto,
    areas: dto.areas.map((area) => ({
      ...area,
      items: area.items.map((it) =>
        it.id === itemId ? { ...it, photos: [...it.photos, ...newPhotos] } : it,
      ),
    })),
  };
}

function removeItemPhoto(
  dto: InspectionChecklistDto,
  itemId: string,
  photoId: string,
): InspectionChecklistDto {
  return {
    ...dto,
    areas: dto.areas.map((area) => ({
      ...area,
      items: area.items.map((it) =>
        it.id === itemId ? { ...it, photos: it.photos.filter((p) => p.id !== photoId) } : it,
      ),
    })),
  };
}

function CapturePhotoThumb({
  photo,
  idx,
  gallerySlides,
  disabled,
  onRetakeAtGalleryIndex,
  onLightboxClose,
  caption,
  onToggleFlag,
  flagDisabled,
}: {
  photo: InspectionAreaPhoto;
  idx: number;
  gallerySlides: ImageGallerySlide[];
  disabled: boolean;
  onRetakeAtGalleryIndex: (galleryIndex: number) => void;
  onLightboxClose?: () => void;
  caption?: string;
  onToggleFlag?: () => void;
  flagDisabled?: boolean;
}) {
  const flagged = !!photo.flagged;
  return (
    <div className="flex w-[4rem] shrink-0 flex-col gap-0.5">
      <div className="relative">
        <ImageThumbLightbox
          src={photo.secureUrl}
          alt={`청소 전 ${idx + 1}`}
          gallerySlides={gallerySlides}
          galleryIndex={idx}
          thumbClassName="h-14 w-full object-cover"
          buttonClassName={`relative block w-full overflow-hidden rounded-lg border-2 bg-black/40 touch-manipulation active:scale-[0.97] disabled:opacity-50 ${
            flagged ? 'border-amber-400' : 'border-white/25'
          }`}
          onRetake={disabled ? undefined : onRetakeAtGalleryIndex}
          onLightboxClose={onLightboxClose}
        />
        {onToggleFlag ? (
          <div className="absolute -left-1 -top-1 z-10">
            <InspectionPhotoFlagButton
              flagged={flagged}
              disabled={flagDisabled}
              variant="dark"
              onToggle={onToggleFlag}
              className="!h-8 !w-8 !text-sm"
            />
          </div>
        ) : null}
      </div>
      {caption ? (
        <p className="truncate text-center text-[9px] leading-tight text-gray-400" title={caption}>
          {caption}
        </p>
      ) : null}
    </div>
  );
}

export function TeamPreCleanWizard({
  checklist,
  inquiryId,
  token,
  readOnly,
  busy,
  setBusy,
  onReload,
  onMsg,
  onClose,
  onChecklistUpdate,
}: {
  checklist: InspectionChecklistDto;
  inquiryId: string;
  token: string;
  readOnly: boolean;
  busy: boolean;
  setBusy: (v: boolean) => void;
  onReload: () => Promise<InspectionChecklistDto | null>;
  onMsg: (msg: string | null) => void;
  onClose?: () => void;
  onChecklistUpdate?: (next: InspectionChecklistDto) => void;
}) {
  const [captureAreaId, setCaptureAreaId] = useState<string | null>(null);
  const [itemIndex, setItemIndex] = useState(0);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [localChecklist, setLocalChecklist] = useState(checklist);
  const [uploading, setUploading] = useState(false);
  const [flaggingPhotoId, setFlaggingPhotoId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const restoredRef = useRef(false);
  const reloadGenRef = useRef(0);

  const cameraActive = !readOnly && !!captureAreaId;
  const { videoRef, status: cameraStatus, error: cameraError, captureFrame, refreshPreview } =
    useInlineCamera(cameraActive);

  useEffect(() => {
    if (!captureAreaId) {
      setLocalChecklist(checklist);
    }
  }, [checklist, captureAreaId]);

  const scheduleBackgroundReload = useCallback(() => {
    const gen = ++reloadGenRef.current;
    void onReload().then((fresh) => {
      if (fresh && gen === reloadGenRef.current) {
        setLocalChecklist(fresh);
      }
    });
  }, [onReload]);

  const areas = localChecklist.areas;

  const captureArea = useMemo(
    () => (captureAreaId ? areas.find((a) => a.id === captureAreaId) ?? null : null),
    [areas, captureAreaId],
  );

  const captureItems = useMemo(
    () => (captureArea ? visibleItems(captureArea) : []),
    [captureArea],
  );

  const currentItem = useMemo(() => {
    if (!captureArea) return null;
    const items = visibleItems(captureArea);
    if (activeItemId) {
      return items.find((it) => it.id === activeItemId) ?? items[itemIndex] ?? null;
    }
    return items[itemIndex] ?? null;
  }, [captureArea, activeItemId, itemIndex]);

  useEffect(() => {
    if (restoredRef.current || readOnly) return;
    restoredRef.current = true;
    const saved = readCaptureSession(inquiryId);
    if (!saved?.areaId || !areas.some((a) => a.id === saved.areaId)) return;
    const area = areas.find((a) => a.id === saved.areaId);
    if (!area) return;
    const items = visibleItems(area);
    const idx =
      typeof saved.idx === 'number' ? Math.min(Math.max(0, saved.idx), Math.max(0, items.length - 1)) : 0;
    setCaptureAreaId(saved.areaId);
    setItemIndex(idx);
    setActiveItemId(items[idx]?.id ?? null);
  }, [inquiryId, areas, readOnly]);

  useEffect(() => {
    if (!captureAreaId || !captureItems[itemIndex]) return;
    setActiveItemId(captureItems[itemIndex].id);
  }, [captureAreaId, itemIndex, captureItems]);

  useEffect(() => {
    if (readOnly || !captureAreaId) return;
    writeCaptureSession(inquiryId, captureAreaId, itemIndex);
  }, [captureAreaId, itemIndex, inquiryId, readOnly]);

  useEffect(() => {
    if (readOnly || !captureAreaId) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [captureAreaId, readOnly]);

  const exitCapture = useCallback(async () => {
    if (captureAreaId) {
      writeCaptureSession(inquiryId, captureAreaId, itemIndex);
    }
    setCaptureAreaId(null);
    await onReload();
  }, [captureAreaId, itemIndex, inquiryId, onReload]);

  const beginCaptureForArea = (areaId: string, areasSource: InspectionArea[]) => {
    const area = areasSource.find((a) => a.id === areaId);
    if (!area || area.notApplicable) return;
    const items = visibleItems(area);
    const saved = readCaptureSession(inquiryId);
    let idx = findFirstIncompleteIndex(area);
    if (saved?.areaId === areaId && typeof saved.idx === 'number') {
      idx = Math.min(Math.max(0, saved.idx), Math.max(0, items.length - 1));
    }
    setCaptureAreaId(areaId);
    setItemIndex(idx);
    setActiveItemId(items[idx]?.id ?? null);
  };

  const startCapture = async (areaId: string) => {
    const area = areas.find((a) => a.id === areaId);
    if (!area || area.notApplicable) return;
    setBusy(true);
    try {
      const fresh = await onReload();
      if (fresh) setLocalChecklist(fresh);
      beginCaptureForArea(areaId, fresh?.areas ?? areas);
    } finally {
      setBusy(false);
    }
  };

  const advanceToNextItem = useCallback(
    (areaItemsLength: number) => {
      setItemIndex((i) => {
        if (i < areaItemsLength - 1) return i + 1;
        queueMicrotask(() => {
          onMsg('이 구역의 청소 전 촬영을 마쳤습니다.');
          setCaptureAreaId(null);
          sessionStorage.removeItem(sessionKey(inquiryId));
        });
        return i;
      });
    },
    [inquiryId, onMsg],
  );

  const uploadAndAdvance = useCallback(
    async (file: File) => {
      if (!currentItem || uploading) return;
      const itemId = currentItem.id;
      const areaLen = captureItems.length;
      setUploading(true);
      onMsg(null);
      try {
        const prepared = await prepareImageFileForUpload(file);
        const newPhotos = await uploadTeamInspectionPhotos(token, inquiryId, itemId, 'BEFORE', [prepared]);
        setLocalChecklist((prev) => mergeItemPhotos(prev, itemId, newPhotos));
        scheduleBackgroundReload();
        advanceToNextItem(areaLen);
      } catch (e) {
        onMsg(e instanceof Error ? e.message : '업로드 실패');
      } finally {
        setUploading(false);
      }
    },
    [
      advanceToNextItem,
      captureItems.length,
      currentItem,
      inquiryId,
      onMsg,
      scheduleBackgroundReload,
      token,
      uploading,
    ],
  );

  const handleShutter = useCallback(async () => {
    if (uploading || busy || !currentItem) return;
    if (cameraStatus === 'live') {
      try {
        const file = await captureFrame();
        await uploadAndAdvance(file);
      } catch (e) {
        onMsg(e instanceof Error ? e.message : '촬영 실패');
      }
      return;
    }
    fileInputRef.current?.click();
  }, [busy, cameraStatus, captureFrame, currentItem, onMsg, uploadAndAdvance, uploading]);

  const handleCapture = async (files: FileList | null) => {
    if (!files?.length || uploading) return;
    await uploadAndAdvance(files[0]!);
  };

  const handleItemNa = async () => {
    if (!currentItem) return;
    setBusy(true);
    onMsg(null);
    try {
      await patchTeamInspectionItem(token, inquiryId, currentItem.id, {
        notApplicable: true,
        naReason: null,
      });
      await onReload();
      advanceToNextItem(captureItems.length);
    } catch (e) {
      onMsg(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setBusy(false);
    }
  };

  const handleAreaNa = async (areaId: string) => {
    if (!window.confirm('이 구역 전체를 해당없음으로 처리할까요?')) return;
    setBusy(true);
    onMsg(null);
    try {
      await patchTeamInspectionArea(token, inquiryId, areaId, { notApplicable: true, naReason: null });
      await onReload();
      if (captureAreaId === areaId) setCaptureAreaId(null);
      onMsg('구역 전체를 해당없음으로 처리했습니다.');
    } catch (e) {
      onMsg(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setBusy(false);
    }
  };

  const handleRetakePhoto = async (photoId: string, itemId: string) => {
    if (uploading || busy) return;
    if (!window.confirm('선택한 사진을 삭제하고 다시 촬영할까요?')) return;
    setUploading(true);
    onMsg(null);
    try {
      await deleteTeamInspectionPhoto(token, inquiryId, itemId, photoId);
      setLocalChecklist((prev) => removeItemPhoto(prev, itemId, photoId));
      scheduleBackgroundReload();
      refreshPreview();
    } catch (e) {
      onMsg(e instanceof Error ? e.message : '삭제 실패');
    } finally {
      setUploading(false);
    }
  };

  const handleUndoAreaNa = async (areaId: string) => {
    setBusy(true);
    try {
      await patchTeamInspectionArea(token, inquiryId, areaId, { notApplicable: false, naReason: null });
      await onReload();
    } catch (e) {
      onMsg(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setBusy(false);
    }
  };

  const applyChecklist = useCallback(
    (next: InspectionChecklistDto) => {
      setLocalChecklist(next);
      onChecklistUpdate?.(next);
    },
    [onChecklistUpdate],
  );

  const handleTogglePhotoFlag = useCallback(
    async (itemId: string, photoId: string, nextFlagged: boolean) => {
      if (readOnly || flaggingPhotoId) return;
      const prev = localChecklist;
      const optimistic = updateChecklistPhotoFlag(localChecklist, itemId, photoId, nextFlagged);
      applyChecklist(optimistic);
      setFlaggingPhotoId(photoId);
      onMsg(null);
      try {
        await patchTeamInspectionPhotoFlag(token, inquiryId, itemId, photoId, nextFlagged);
      } catch (e) {
        applyChecklist(prev);
        onMsg(e instanceof Error ? e.message : '표시 저장 실패');
      } finally {
        setFlaggingPhotoId(null);
      }
    },
    [applyChecklist, flaggingPhotoId, inquiryId, localChecklist, onMsg, readOnly, token],
  );

  const handleAddAreaInstance = async (area: InspectionArea) => {
    if (readOnly || busy) return;
    setBusy(true);
    onMsg(null);
    try {
      const templateKey = normalizeAreaKeyForTemplate(area.areaKey);
      const next = await addTeamInspectionAreaInstance(token, inquiryId, templateKey);
      setLocalChecklist(next);
      onChecklistUpdate?.(next);
    } catch (e) {
      onMsg(e instanceof Error ? e.message : '구역 추가 실패');
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveAreaInstance = async (area: InspectionArea) => {
    if (readOnly || busy) return;
    if (areaHasBeforePhotos(area)) {
      if (!window.confirm(`「${area.label}」에 촬영한 사진이 있습니다. 이 구역을 삭제할까요?`)) return;
    } else if (!window.confirm(`「${area.label}」 구역을 삭제할까요?`)) {
      return;
    }
    setBusy(true);
    onMsg(null);
    try {
      const next = await removeTeamInspectionAreaInstance(token, inquiryId, area.id);
      setLocalChecklist(next);
      onChecklistUpdate?.(next);
      if (captureAreaId === area.id) setCaptureAreaId(null);
    } catch (e) {
      onMsg(e instanceof Error ? e.message : '구역 삭제 실패');
    } finally {
      setBusy(false);
    }
  };

  const inCaptureMode = !readOnly && captureArea && currentItem;

  let captureOverlay: ReactNode = null;
  if (inCaptureMode) {
    const hint = getInspectionCaptureHint({
      itemKey: currentItem.itemKey,
      label: currentItem.label,
      areaLabel: captureArea.label,
    });
    const areaBeforeEntries = collectAreaBeforePhotos(captureArea);
    const areaGallerySlides = areaBeforeEntries.map((entry) => ({
      src: entry.photo.secureUrl,
      alt: `${captureArea.label} › ${entry.itemLabel} 청소 전`,
      title: `${captureArea.label} · ${entry.itemLabel}`,
    }));
    const areaDoneCount = captureItems.filter((it) =>
      isBeforeItemComplete({ notApplicable: it.notApplicable, beforeCount: itemBeforeCount(it) }),
    ).length;

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
                onClick={exitCapture}
                disabled={busy || uploading}
                className="pointer-events-auto flex h-11 min-w-[44px] shrink-0 items-center justify-center rounded-full bg-white/15 text-sm font-medium touch-manipulation disabled:opacity-50"
                aria-label="구역 목록으로"
              >
                ←
              </button>
              <div className="min-w-0 flex-1 text-center">
                <p className="text-xs text-gray-300">
                  {captureArea.label} · {itemIndex + 1}/{captureItems.length}
                </p>
                <p className="truncate text-base font-bold">{currentItem.label}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setCaptureAreaId(null);
                  sessionStorage.removeItem(sessionKey(inquiryId));
                  onClose?.();
                }}
                disabled={busy || uploading}
                className="pointer-events-auto flex h-11 shrink-0 items-center justify-center rounded-full border border-white/25 bg-white/10 px-3 text-sm font-semibold touch-manipulation disabled:opacity-50"
              >
                닫기
              </button>
            </div>
          </div>

          <div className="absolute inset-x-0 top-[4.25rem] z-10 px-4">
            <div className="pointer-events-none mx-auto max-w-lg rounded-xl border border-sky-400/40 bg-black/55 px-4 py-3 backdrop-blur-md">
              <p className="text-[11px] font-bold tracking-wide text-sky-300">촬영 가이드</p>
              <p className="mt-1.5 text-sm font-medium leading-snug text-white">{hint}</p>
            </div>
          </div>

          {uploading && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/45">
              <p className="rounded-full bg-black/70 px-4 py-2 text-sm font-medium">저장 중…</p>
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-white/10 bg-black/90 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
          <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
            <button
              type="button"
              disabled={busy || uploading || itemIndex === 0}
              onClick={() => setItemIndex((i) => Math.max(0, i - 1))}
              className="flex h-12 min-w-[3.5rem] flex-col items-center justify-center rounded-xl text-[11px] text-gray-300 touch-manipulation disabled:opacity-40"
            >
              <span className="text-lg leading-none">←</span>
              이전
            </button>

            <button
              type="button"
              disabled={uploading || busy}
              onClick={() => void handleShutter()}
              className="flex h-[4.5rem] w-[4.5rem] shrink-0 items-center justify-center rounded-full border-4 border-white bg-white/95 shadow-lg touch-manipulation active:scale-95 disabled:opacity-50"
              aria-label="촬영"
            >
              <span className="block h-[3.25rem] w-[3.25rem] rounded-full bg-sky-500" />
            </button>

            <button
              type="button"
              disabled={busy || uploading}
              onClick={() => void handleItemNa()}
              className="flex h-12 min-w-[3.5rem] flex-col items-center justify-center rounded-xl text-[11px] text-amber-200 touch-manipulation disabled:opacity-50"
            >
              해당
              <span>없음</span>
            </button>
          </div>
          <p className="mt-2 text-center text-[11px] text-gray-400">
            셔터를 누르면 저장 후 다음 항목으로 자동 이동합니다
          </p>

          {areaBeforeEntries.length > 0 && (
            <div className="mt-3 border-t border-white/10 pt-3">
              <p className="mb-2 text-center text-[10px] text-gray-400">
                등록 {areaBeforeEntries.length}장 · {areaDoneCount}/{captureItems.length} 완료 · ☆ 오염 심함 표시
              </p>
              <div className="mx-auto flex max-w-lg gap-2 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch]">
                {areaBeforeEntries.map((entry, idx) => (
                  <CapturePhotoThumb
                    key={entry.photo.id}
                    photo={entry.photo}
                    idx={idx}
                    gallerySlides={areaGallerySlides}
                    disabled={uploading || busy}
                    caption={entry.itemLabel}
                    flagDisabled={uploading || busy || flaggingPhotoId === entry.photo.id}
                    onToggleFlag={() =>
                      void handleTogglePhotoFlag(entry.itemId, entry.photo.id, !entry.photo.flagged)
                    }
                    onRetakeAtGalleryIndex={(galleryIdx) => {
                      const target = areaBeforeEntries[galleryIdx];
                      if (target) void handleRetakePhoto(target.photo.id, target.itemId);
                    }}
                    onLightboxClose={() => {
                      refreshPreview();
                      requestAnimationFrame(() => refreshPreview());
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              void handleCapture(e.target.files);
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
    <section className="space-y-3" aria-hidden={inCaptureMode ? true : undefined}>
      <p className="text-fluid-2xs text-gray-600">
        구역을 선택한 뒤 「촬영 시작」— 화면에서 바로 찍으면 다음 항목으로 자동 이동합니다. 방·현관·욕실·베란다는 카드 오른쪽 ＋／− 로 개수를 조절할 수 있습니다. 오염이 심한 곳은 사진의 ☆를 눌러 표시해 주세요. 해당 공간이 없으면 「구역 해당없음」을 눌러 주세요.
      </p>

      <div className="grid grid-cols-2 gap-2">
        {areas.map((area) => {
          const items = visibleItems(area);
          const { beforeDone, total } = countBeforeItemProgress(
            items.map((it) => ({
              notApplicable: it.notApplicable,
              beforeCount: itemBeforeCount(it),
            })),
          );
          const complete =
            area.notApplicable ||
            (items.length > 0 &&
              isBeforeAreaItemsComplete(
                items.map((it) => ({
                  notApplicable: it.notApplicable,
                  beforeCount: itemBeforeCount(it),
                })),
              ));

          return (
            <div
              key={area.id}
              className={`min-w-0 rounded-xl border p-3 ${
                complete ? 'border-emerald-200 bg-emerald-50/50' : 'border-gray-200 bg-white'
              }`}
            >
              <div className="flex items-start justify-between gap-1">
                <span className="min-w-0 flex-1 text-fluid-xs font-semibold text-gray-900">{area.label}</span>
                <div className="flex shrink-0 items-center gap-1">
                  {!readOnly && (
                    <InspectionAreaCountButtons
                      area={area}
                      allAreas={areas}
                      disabled={busy || uploading}
                      onAdd={() => void handleAddAreaInstance(area)}
                      onRemove={() => void handleRemoveAreaInstance(area)}
                    />
                  )}
                  {complete && !area.notApplicable && (
                    <span className="text-[10px] font-medium text-emerald-700">완료</span>
                  )}
                </div>
              </div>
              <p className="mt-1 text-fluid-2xs text-gray-600">
                {area.notApplicable ? '해당없음' : `청소 전 ${beforeDone}/${total}`}
              </p>

              {!area.notApplicable && items.length > 0 && (
                <ul className="mt-2 grid grid-cols-2 gap-x-1.5 gap-y-1" aria-label={`${area.label} 촬영 항목`}>
                  {items.map((it) => {
                    const done = isBeforeItemComplete({
                      notApplicable: it.notApplicable,
                      beforeCount: itemBeforeCount(it),
                    });
                    return (
                      <li
                        key={it.id}
                        className={`truncate text-[10px] leading-tight ${
                          done ? 'font-medium text-emerald-700' : 'text-gray-600'
                        }`}
                        title={it.label}
                      >
                        {done ? '✓ ' : '○ '}
                        {it.label}
                        {it.notApplicable ? ' (해당없음)' : ''}
                      </li>
                    );
                  })}
                </ul>
              )}

              {!readOnly && (
                <div className="mt-2.5 flex flex-col gap-1.5">
                  {area.notApplicable ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handleUndoAreaNa(area.id)}
                      className="min-h-[40px] rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-fluid-2xs touch-manipulation disabled:opacity-50"
                    >
                      해당없음 해제
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        disabled={busy || !items.length}
                        onClick={() => void startCapture(area.id)}
                        className="min-h-[44px] rounded-lg bg-gray-900 px-2 py-2 text-fluid-2xs font-semibold text-white touch-manipulation disabled:opacity-50"
                      >
                        촬영 시작
                      </button>
                      <div className="grid grid-cols-2 gap-1.5">
                        <ShareAreaBeforePhotosButton
                          token={token}
                          inquiryId={inquiryId}
                          area={area}
                          customerName={checklist.inquiryHeader?.customerName}
                          preferredDate={checklist.inquiryHeader?.preferredDate}
                          disabled={busy || uploading}
                          className="min-w-0 w-full"
                        />
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void handleAreaNa(area.id)}
                          className="min-h-[36px] min-w-0 rounded-lg border border-amber-400 bg-amber-50 px-1.5 py-1 text-[11px] font-medium text-amber-900 touch-manipulation disabled:opacity-50"
                        >
                          구역 해당없음
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
    </>
  );
}
