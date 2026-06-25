import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  countAfterItemProgress,
  countBeforeItemProgress,
  isAfterAreaItemsComplete,
  isAfterItemComplete,
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
import { mergeItemPhotos, removeItemPhoto, replaceItemPhoto } from '../../utils/inspectionChecklistPhotoMerge';
import { useInlineCamera } from '../../hooks/useInlineCamera';
import { ShareAreaBeforePhotosButton } from '../../components/inquiry-inspection/ShareAreaBeforePhotosButton';
import { InspectionPhotoFlagButton } from '../../components/inquiry-inspection/InspectionPhotoFlagButton';
import {
  InspectionAreaCountButtons,
  areaHasBeforePhotos,
} from '../../components/inquiry-inspection/InspectionAreaCountButtons';
import { updateChecklistPhotoFlag } from '../../utils/inspectionFlaggedPhotos';
import { normalizeAreaKeyForTemplate } from '@shared/inquiryInspectionTenantTemplate';
import { isContaminationInspectionArea } from '@shared/inquiryInspectionContamination';

export type InspectionCapturePhase = 'BEFORE' | 'AFTER';

const SESSION_PREFIX: Record<InspectionCapturePhase, string> = {
  BEFORE: 'preCleanWizard',
  AFTER: 'postCleanWizard',
};

function visibleItems(area: InspectionArea): InspectionItem[] {
  return area.items.filter((it) => !it.itemKey.startsWith('_'));
}

function itemPhaseCount(item: InspectionItem, phase: InspectionCapturePhase): number {
  return item.photos.filter((p) => p.phase === phase).length;
}

function isPhaseItemComplete(item: InspectionItem, phase: InspectionCapturePhase): boolean {
  if (item.notApplicable) return true;
  if (phase === 'BEFORE') {
    return isBeforeItemComplete({ notApplicable: false, beforeCount: itemPhaseCount(item, 'BEFORE') });
  }
  return isAfterItemComplete({ notApplicable: false, afterCount: itemPhaseCount(item, 'AFTER') });
}

function findFirstIncompleteIndex(area: InspectionArea, phase: InspectionCapturePhase): number {
  const items = visibleItems(area);
  const idx = items.findIndex((it) => !isPhaseItemComplete(it, phase));
  return idx >= 0 ? idx : 0;
}

function findFirstIncompleteCaptureTarget(
  areas: InspectionArea[],
  phase: InspectionCapturePhase,
  afterAreaId?: string,
): { areaId: string; idx: number } | null {
  const list = areas.filter((a) => !a.notApplicable);
  const startAt = afterAreaId ? list.findIndex((a) => a.id === afterAreaId) + 1 : 0;
  for (let i = Math.max(0, startAt); i < list.length; i += 1) {
    const area = list[i]!;
    const items = visibleItems(area);
    const idx = items.findIndex((it) => !isPhaseItemComplete(it, phase));
    if (idx >= 0) return { areaId: area.id, idx };
  }
  return null;
}

function sessionKey(inquiryId: string, phase: InspectionCapturePhase) {
  return `${SESSION_PREFIX[phase]}:${inquiryId}`;
}

function readCaptureSession(
  inquiryId: string,
  phase: InspectionCapturePhase,
): { areaId?: string; idx?: number } | null {
  const raw = sessionStorage.getItem(sessionKey(inquiryId, phase));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as { areaId?: string; idx?: number };
  } catch {
    return null;
  }
}

function writeCaptureSession(
  inquiryId: string,
  phase: InspectionCapturePhase,
  areaId: string,
  idx: number,
) {
  sessionStorage.setItem(sessionKey(inquiryId, phase), JSON.stringify({ areaId, idx }));
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

function isPendingInspectionPhotoId(id: string): boolean {
  return id.startsWith('pending-');
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
  pending,
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
  pending?: boolean;
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
            flagged ? 'border-amber-400' : pending ? 'border-sky-400/70' : 'border-white/25'
          }`}
          onRetake={disabled || pending ? undefined : onRetakeAtGalleryIndex}
          onLightboxClose={onLightboxClose}
        />
        {pending ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-lg bg-black/45">
            <span className="text-[10px] font-semibold text-white">저장</span>
          </div>
        ) : null}
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
  phase = 'BEFORE',
  hideAreaGrid = false,
  captureActive = false,
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
  /** BEFORE: 청소 전, AFTER: 청소 후 연속 촬영 */
  phase?: InspectionCapturePhase;
  /** true면 구역 카드 없이 촬영 오버레이만 (현장검수 청소 후) */
  hideAreaGrid?: boolean;
  /** hideAreaGrid일 때 true면 첫 미완료 항목부터 촬영 시작 */
  captureActive?: boolean;
}) {
  const [captureAreaId, setCaptureAreaId] = useState<string | null>(null);
  const [itemIndex, setItemIndex] = useState(0);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [localChecklist, setLocalChecklist] = useState(checklist);
  const [pendingUploadCount, setPendingUploadCount] = useState(0);
  const [showCapturedPhotos, setShowCapturedPhotos] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [deletingPhotoId, setDeletingPhotoId] = useState<string | null>(null);
  const [flaggingPhotoId, setFlaggingPhotoId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const restoredRef = useRef(false);
  const globalStartRef = useRef(false);
  /** 페이지에 머무는 동안 카메라 세션 유지 — 촬영 화면 나갔다 들어와도 권한 재요청 방지 */
  const [cameraSessionWarm, setCameraSessionWarm] = useState(false);

  const isBeforePhase = phase === 'BEFORE';
  const phaseLabel = isBeforePhase ? '청소 전' : '청소 후';

  useEffect(() => {
    if (captureAreaId || (hideAreaGrid && captureActive)) {
      setCameraSessionWarm(true);
    }
  }, [captureAreaId, hideAreaGrid, captureActive]);

  const cameraActive =
    !readOnly &&
    (cameraSessionWarm || !!captureAreaId || (hideAreaGrid && captureActive));
  const { videoRef, status: cameraStatus, error: cameraError, captureFrame, refreshPreview } =
    useInlineCamera(cameraActive);

  useEffect(() => {
    if (pendingUploadCount <= 0) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [pendingUploadCount]);

  useEffect(() => {
    if (!captureAreaId) {
      setShowCapturedPhotos(false);
      return;
    }
    if (!cameraSessionWarm) return;
    refreshPreview();
    requestAnimationFrame(() => refreshPreview());
  }, [captureAreaId, cameraSessionWarm, refreshPreview]);

  useEffect(() => {
    if (!captureAreaId) {
      setLocalChecklist(checklist);
    }
  }, [checklist, captureAreaId]);

  const areas = useMemo(
    () => localChecklist.areas.filter((a) => !isContaminationInspectionArea(a.areaKey)),
    [localChecklist.areas],
  );

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
    if (hideAreaGrid || restoredRef.current || readOnly) return;
    restoredRef.current = true;
    const saved = readCaptureSession(inquiryId, phase);
    if (!saved?.areaId || !areas.some((a) => a.id === saved.areaId)) return;
    const area = areas.find((a) => a.id === saved.areaId);
    if (!area) return;
    const items = visibleItems(area);
    const idx =
      typeof saved.idx === 'number' ? Math.min(Math.max(0, saved.idx), Math.max(0, items.length - 1)) : 0;
    setCaptureAreaId(saved.areaId);
    setItemIndex(idx);
    setActiveItemId(items[idx]?.id ?? null);
  }, [hideAreaGrid, inquiryId, areas, readOnly, phase]);

  useEffect(() => {
    if (!captureActive) {
      globalStartRef.current = false;
      return;
    }
    if (!hideAreaGrid || readOnly || captureAreaId || globalStartRef.current) return;
    globalStartRef.current = true;
    void (async () => {
      setBusy(true);
      onMsg(null);
      try {
        const fresh = await onReload();
        const src = (fresh ?? checklist).areas.filter((a) => !a.notApplicable);
        if (fresh) {
          setLocalChecklist(fresh);
          onChecklistUpdate?.(fresh);
        }
        const saved = readCaptureSession(inquiryId, phase);
        if (saved?.areaId && src.some((a) => a.id === saved.areaId)) {
          beginCaptureForArea(saved.areaId, src, saved.idx);
        } else {
          const target = findFirstIncompleteCaptureTarget(src, phase);
          if (!target) {
            onMsg(`${phaseLabel} 촬영할 항목이 없습니다.`);
            onClose?.();
            return;
          }
          beginCaptureForArea(target.areaId, src, target.idx);
        }
      } catch (e) {
        onMsg(e instanceof Error ? e.message : '불러오기 실패');
        onClose?.();
      } finally {
        setBusy(false);
      }
    })();
  }, [
    captureActive,
    captureAreaId,
    checklist,
    hideAreaGrid,
    inquiryId,
    onChecklistUpdate,
    onClose,
    onMsg,
    onReload,
    phase,
    phaseLabel,
    readOnly,
    setBusy,
  ]);

  useEffect(() => {
    if (!captureAreaId || !captureItems[itemIndex]) return;
    setActiveItemId(captureItems[itemIndex].id);
  }, [captureAreaId, itemIndex, captureItems]);

  useEffect(() => {
    if (readOnly || !captureAreaId) return;
    writeCaptureSession(inquiryId, phase, captureAreaId, itemIndex);
  }, [captureAreaId, itemIndex, inquiryId, phase, readOnly]);

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
      writeCaptureSession(inquiryId, phase, captureAreaId, itemIndex);
    }
    setCaptureAreaId(null);
    await onReload();
    if (hideAreaGrid) onClose?.();
  }, [captureAreaId, hideAreaGrid, itemIndex, inquiryId, onClose, onReload, phase]);

  const beginCaptureForArea = (
    areaId: string,
    areasSource: InspectionArea[],
    forcedIdx?: number,
  ) => {
    const area = areasSource.find((a) => a.id === areaId);
    if (!area || area.notApplicable) return;
    const items = visibleItems(area);
    const saved = readCaptureSession(inquiryId, phase);
    let idx =
      typeof forcedIdx === 'number'
        ? forcedIdx
        : findFirstIncompleteIndex(area, phase);
    if (typeof forcedIdx !== 'number' && saved?.areaId === areaId && typeof saved.idx === 'number') {
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
          const src = localChecklist.areas.filter((a) => !a.notApplicable);
          const next = captureAreaId
            ? findFirstIncompleteCaptureTarget(src, phase, captureAreaId)
            : null;
          if (hideAreaGrid && next) {
            onMsg(`「${src.find((a) => a.id === next.areaId)?.label ?? '다음 구역'}」으로 이동합니다.`);
            beginCaptureForArea(next.areaId, src, next.idx);
            return;
          }
          if (!hideAreaGrid) {
            onMsg(
              isBeforePhase
                ? '이 구역의 청소 전 촬영을 마쳤습니다.'
                : '이 구역의 청소 후 촬영을 마쳤습니다.',
            );
          }
          setCaptureAreaId(null);
          sessionStorage.removeItem(sessionKey(inquiryId, phase));
          if (hideAreaGrid) {
            onMsg(`${phaseLabel} 촬영을 모두 마쳤습니다.`);
            onClose?.();
          }
        });
        return i;
      });
    },
    [captureAreaId, hideAreaGrid, inquiryId, isBeforePhase, localChecklist.areas, onClose, onMsg, phase, phaseLabel],
  );

  const uploadAndAdvance = useCallback(
    async (file: File) => {
      if (!currentItem) return;
      const itemId = currentItem.id;
      const areaLen = captureItems.length;
      const optimisticId = `pending-${Date.now()}`;
      const blobUrl = URL.createObjectURL(file);
      const optimisticPhoto: InspectionAreaPhoto = {
        id: optimisticId,
        phase,
        secureUrl: blobUrl,
        width: null,
        height: null,
        flagged: false,
        uploadedBy: { id: '', name: '' },
        createdAt: new Date().toISOString(),
      };

      setLocalChecklist((prev) => {
        const next = mergeItemPhotos(prev, itemId, [optimisticPhoto]);
        onChecklistUpdate?.(next);
        return next;
      });
      advanceToNextItem(areaLen);
      onMsg(null);

      setPendingUploadCount((n) => n + 1);
      void (async () => {
        try {
          const prepared = await prepareImageFileForUpload(file);
          const newPhotos = await uploadTeamInspectionPhotos(token, inquiryId, itemId, phase, [prepared]);
          setLocalChecklist((prev) => {
            const next = replaceItemPhoto(prev, itemId, optimisticId, newPhotos);
            onChecklistUpdate?.(next);
            return next;
          });
        } catch (e) {
          setLocalChecklist((prev) => {
            const next = removeItemPhoto(prev, itemId, optimisticId);
            onChecklistUpdate?.(next);
            return next;
          });
          onMsg(e instanceof Error ? e.message : '업로드 실패');
        } finally {
          URL.revokeObjectURL(blobUrl);
          setPendingUploadCount((n) => Math.max(0, n - 1));
        }
      })();
    },
    [
      advanceToNextItem,
      captureItems.length,
      currentItem,
      inquiryId,
      onChecklistUpdate,
      onMsg,
      token,
      phase,
    ],
  );

  const handleShutter = useCallback(async () => {
    if (busy || !currentItem || capturing) return;
    if (cameraStatus === 'live') {
      setCapturing(true);
      try {
        const file = await captureFrame();
        await uploadAndAdvance(file);
      } catch (e) {
        onMsg(e instanceof Error ? e.message : '촬영 실패');
      } finally {
        setCapturing(false);
      }
      return;
    }
    onMsg(null);
    fileInputRef.current?.click();
  }, [busy, cameraStatus, captureFrame, capturing, currentItem, onMsg, uploadAndAdvance]);

  const handleCapture = async (files: FileList | null) => {
    if (!files?.length || capturing) return;
    setCapturing(true);
    try {
      await uploadAndAdvance(files[0]!);
    } finally {
      setCapturing(false);
    }
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
    if (busy || capturing || isPendingInspectionPhotoId(photoId)) return;
    if (!window.confirm('선택한 사진을 삭제하고 다시 촬영할까요?')) return;
    setDeletingPhotoId(photoId);
    onMsg(null);
    try {
      await deleteTeamInspectionPhoto(token, inquiryId, itemId, photoId);
      setLocalChecklist((prev) => {
        const next = removeItemPhoto(prev, itemId, photoId);
        onChecklistUpdate?.(next);
        return next;
      });
      refreshPreview();
    } catch (e) {
      onMsg(e instanceof Error ? e.message : '삭제 실패');
    } finally {
      setDeletingPhotoId(null);
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
      phase,
    });
    const areaBeforeEntries = collectAreaBeforePhotos(captureArea);
    const areaGallerySlides = areaBeforeEntries.map((entry) => ({
      src: entry.photo.secureUrl,
      alt: `${captureArea.label} › ${entry.itemLabel} 청소 전`,
      title: `${captureArea.label} · ${entry.itemLabel}`,
    }));
    const areaDoneCount = captureItems.filter((it) => isPhaseItemComplete(it, phase)).length;
    const shutterColor = isBeforePhase ? 'bg-sky-500' : 'bg-emerald-500';
    const currentBeforePhoto =
      currentItem.photos.find((p) => p.phase === 'BEFORE') ?? null;

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
                disabled={busy || capturing}
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
                  sessionStorage.removeItem(sessionKey(inquiryId, phase));
                  onClose?.();
                }}
                disabled={busy || capturing}
                className="pointer-events-auto flex h-11 shrink-0 items-center justify-center rounded-full border border-white/25 bg-white/10 px-3 text-sm font-semibold touch-manipulation disabled:opacity-50"
              >
                닫기
              </button>
            </div>
            {pendingUploadCount > 0 ? (
              <p className="pointer-events-none mx-auto mt-1 max-w-lg text-center text-[10px] text-sky-200/90">
                백그라운드 저장 {pendingUploadCount}건 — 촬영은 계속할 수 있습니다
              </p>
            ) : null}
          </div>

          <div className="absolute inset-x-0 top-[4.25rem] z-10 px-4">
            <div
              className={`pointer-events-none mx-auto max-w-lg rounded-xl border px-4 py-3 backdrop-blur-md ${
                isBeforePhase
                  ? 'border-sky-400/40 bg-black/55'
                  : 'border-emerald-400/40 bg-black/55'
              }`}
            >
              <p
                className={`text-[11px] font-bold tracking-wide ${
                  isBeforePhase ? 'text-sky-300' : 'text-emerald-300'
                }`}
              >
                {phaseLabel} 촬영 가이드
              </p>
              <p className="mt-1.5 text-sm font-medium leading-snug text-white">{hint}</p>
              {!isBeforePhase && currentBeforePhoto ? (
                <p className="mt-2 text-[11px] leading-snug text-emerald-100/90">
                  왼쪽 하단 「청소 전」 사진과 같은 각도로 맞춰 촬영해 주세요.
                </p>
              ) : null}
            </div>
          </div>

          {!isBeforePhase && (
            <div className="pointer-events-auto absolute bottom-4 left-4 z-10">
              <p className="mb-1 text-[10px] font-semibold tracking-wide text-sky-200">청소 전 참고</p>
              {currentBeforePhoto ? (
                <ImageThumbLightbox
                  src={currentBeforePhoto.secureUrl}
                  alt={`${captureArea.label} ${currentItem.label} 청소 전`}
                  thumbClassName="h-full w-full object-cover"
                  buttonClassName="relative block h-[4.75rem] w-[4.75rem] overflow-hidden rounded-lg border-2 border-sky-300/70 bg-black/50 shadow-lg touch-manipulation active:scale-[0.97]"
                  onLightboxClose={() => {
                    refreshPreview();
                    requestAnimationFrame(() => refreshPreview());
                  }}
                />
              ) : (
                <div className="flex h-[4.75rem] w-[4.75rem] items-center justify-center rounded-lg border-2 border-dashed border-white/25 bg-black/45 px-1.5 text-center text-[9px] leading-snug text-white/55">
                  청소 전
                  <br />
                  사진 없음
                </div>
              )}
            </div>
          )}

          {isBeforePhase && areaBeforeEntries.length > 0 ? (
            <>
              <button
                type="button"
                onClick={() => setShowCapturedPhotos((open) => !open)}
                className="pointer-events-auto absolute bottom-4 right-3 z-10 flex min-h-9 items-center gap-1.5 rounded-full border border-white/20 bg-black/55 px-3 py-1.5 text-[11px] font-semibold text-white backdrop-blur-sm touch-manipulation active:scale-[0.98]"
                aria-expanded={showCapturedPhotos}
                aria-label={`촬영 목록 ${areaBeforeEntries.length}장`}
              >
                <span className="tabular-nums">
                  {areaBeforeEntries.length}장 · {areaDoneCount}/{captureItems.length}
                </span>
                {pendingUploadCount > 0 ? (
                  <span className="rounded-full bg-sky-500/90 px-1.5 py-0.5 text-[9px] font-bold text-white">
                    저장 {pendingUploadCount}
                  </span>
                ) : null}
                <span className="text-white/70">{showCapturedPhotos ? '접기' : '목록'}</span>
              </button>

              {showCapturedPhotos ? (
                <div className="pointer-events-auto absolute inset-x-0 bottom-0 z-20 max-h-[38%] border-t border-white/15 bg-black/88 px-3 pb-3 pt-2 backdrop-blur-md">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-[10px] text-gray-300">
                      등록 {areaBeforeEntries.length}장 · ☆ 오염 심함 표시
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowCapturedPhotos(false)}
                      className="rounded-full px-2 py-1 text-[10px] font-semibold text-gray-300 touch-manipulation"
                    >
                      접기
                    </button>
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch]">
                    {areaBeforeEntries.map((entry, idx) => (
                      <CapturePhotoThumb
                        key={entry.photo.id}
                        photo={entry.photo}
                        idx={idx}
                        gallerySlides={areaGallerySlides}
                        disabled={busy || capturing || !!deletingPhotoId}
                        pending={isPendingInspectionPhotoId(entry.photo.id)}
                        caption={entry.itemLabel}
                        flagDisabled={
                          busy ||
                          capturing ||
                          isPendingInspectionPhotoId(entry.photo.id) ||
                          flaggingPhotoId === entry.photo.id
                        }
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
              ) : null}
            </>
          ) : null}
        </div>

        <div className="shrink-0 border-t border-white/10 bg-black/90 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
          <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
            <button
              type="button"
              disabled={busy || capturing || itemIndex === 0}
              onClick={() => setItemIndex((i) => Math.max(0, i - 1))}
              className="flex h-12 min-w-[3.5rem] flex-col items-center justify-center rounded-xl text-[11px] text-gray-300 touch-manipulation disabled:opacity-40"
            >
              <span className="text-lg leading-none">←</span>
              이전
            </button>

            <button
              type="button"
              disabled={capturing || busy || cameraStatus === 'starting'}
              onClick={() => void handleShutter()}
              className="flex h-[4.5rem] w-[4.5rem] shrink-0 items-center justify-center rounded-full border-4 border-white bg-white/95 shadow-lg touch-manipulation active:scale-95 disabled:opacity-50"
              aria-label="촬영"
            >
              <span className={`block h-[3.25rem] w-[3.25rem] rounded-full ${shutterColor}`} />
            </button>

            <button
              type="button"
              disabled={busy || capturing}
              onClick={() => void handleItemNa()}
              className="flex h-12 min-w-[3.5rem] flex-col items-center justify-center rounded-xl text-[11px] text-amber-200 touch-manipulation disabled:opacity-50"
            >
              해당
              <span>없음</span>
            </button>
          </div>
          <p className="mt-2 text-center text-[11px] text-gray-400">
            셔터를 누르면 바로 다음 항목으로 이동합니다
            {isBeforePhase && areaBeforeEntries.length > 0 ? ' · 우하단에서 촬영 목록 확인' : ''}
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            disabled={capturing}
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
      {!hideAreaGrid && (
    <section className="space-y-3" aria-hidden={inCaptureMode ? true : undefined}>
      <div className="grid grid-cols-2 gap-2">
        {areas.map((area) => {
          const items = visibleItems(area);
          const itemStats = items.map((it) => ({
            notApplicable: it.notApplicable,
            beforeCount: itemPhaseCount(it, 'BEFORE'),
            afterCount: itemPhaseCount(it, 'AFTER'),
          }));
          const { beforeDone, total } = countBeforeItemProgress(
            itemStats.map(({ notApplicable, beforeCount }) => ({ notApplicable, beforeCount })),
          );
          const { afterDone } = countAfterItemProgress(
            itemStats.map(({ notApplicable, afterCount }) => ({ notApplicable, afterCount })),
          );
          const complete =
            area.notApplicable ||
            (items.length > 0 &&
              (isBeforePhase
                ? isBeforeAreaItemsComplete(
                    itemStats.map(({ notApplicable, beforeCount }) => ({ notApplicable, beforeCount })),
                  )
                : isAfterAreaItemsComplete(
                    itemStats.map(({ notApplicable, afterCount }) => ({ notApplicable, afterCount })),
                  )));

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
                      disabled={busy || capturing}
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
                {area.notApplicable
                  ? '해당없음'
                  : isBeforePhase
                    ? `청소 전 ${beforeDone}/${total}`
                    : `청소 후 ${afterDone}/${total}`}
              </p>

              {!area.notApplicable && items.length > 0 && (
                <ul className="mt-2 grid grid-cols-2 gap-x-1.5 gap-y-1" aria-label={`${area.label} 촬영 항목`}>
                  {items.map((it) => {
                    const done = isPhaseItemComplete(it, phase);
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
                <div className="mt-2 flex flex-col gap-1">
                  {area.notApplicable ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handleUndoAreaNa(area.id)}
                      className="min-h-[28px] rounded-lg border border-gray-300 bg-white px-1.5 py-0.5 text-[10px] touch-manipulation disabled:opacity-50"
                    >
                      해당없음 해제
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        disabled={busy || !items.length}
                        onClick={() => void startCapture(area.id)}
                        className="min-h-[32px] rounded-lg bg-gray-900 px-2 py-1 text-[11px] font-semibold text-white touch-manipulation disabled:opacity-50"
                      >
                        {isBeforePhase ? '촬영 시작' : '청소 후 촬영'}
                      </button>
                      {isBeforePhase && (
                      <div className="grid grid-cols-2 gap-1">
                        <ShareAreaBeforePhotosButton
                          token={token}
                          inquiryId={inquiryId}
                          area={area}
                          customerName={checklist.inquiryHeader?.customerName}
                          preferredDate={checklist.inquiryHeader?.preferredDate}
                          disabled={busy || capturing}
                          size="compact"
                          className="min-w-0 w-full"
                        />
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void handleAreaNa(area.id)}
                          className="min-h-[28px] min-w-0 rounded-lg border border-amber-400 bg-amber-50 px-1 py-0.5 text-[10px] font-medium leading-tight text-amber-900 touch-manipulation disabled:opacity-50"
                        >
                          해당없음
                        </button>
                      </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
      )}
    </>
  );
}
