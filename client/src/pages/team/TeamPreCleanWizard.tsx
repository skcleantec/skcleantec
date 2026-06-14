import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  countBeforeItemProgress,
  isBeforeAreaItemsComplete,
  isBeforeItemComplete,
} from '@shared/inquiryInspectionTemplate';
import { getInspectionCaptureHint } from '@shared/inquiryInspectionCaptureGuides';
import {
  patchTeamInspectionArea,
  patchTeamInspectionItem,
  uploadTeamInspectionPhotos,
  type InspectionArea,
  type InspectionChecklistDto,
  type InspectionItem,
} from '../../api/inquiryInspection';

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
}: {
  checklist: InspectionChecklistDto;
  inquiryId: string;
  token: string;
  readOnly: boolean;
  busy: boolean;
  setBusy: (v: boolean) => void;
  onReload: () => Promise<void>;
  onMsg: (msg: string | null) => void;
  onClose?: () => void;
}) {
  const [captureAreaId, setCaptureAreaId] = useState<string | null>(null);
  const [itemIndex, setItemIndex] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const restoredRef = useRef(false);

  const areas = checklist.areas;

  const captureArea = useMemo(
    () => (captureAreaId ? areas.find((a) => a.id === captureAreaId) ?? null : null),
    [areas, captureAreaId],
  );

  const captureItems = useMemo(
    () => (captureArea ? visibleItems(captureArea) : []),
    [captureArea],
  );

  const currentItem = captureItems[itemIndex] ?? null;

  useEffect(() => {
    if (restoredRef.current || readOnly) return;
    restoredRef.current = true;
    const raw = sessionStorage.getItem(sessionKey(inquiryId));
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as { areaId?: string; idx?: number };
      if (parsed.areaId && areas.some((a) => a.id === parsed.areaId)) {
        setCaptureAreaId(parsed.areaId);
        setItemIndex(typeof parsed.idx === 'number' ? parsed.idx : 0);
      }
    } catch {
      /* ignore */
    }
  }, [inquiryId, areas, readOnly]);

  useEffect(() => {
    if (readOnly) return;
    if (captureAreaId) {
      sessionStorage.setItem(sessionKey(inquiryId), JSON.stringify({ areaId: captureAreaId, idx: itemIndex }));
    } else {
      sessionStorage.removeItem(sessionKey(inquiryId));
    }
  }, [captureAreaId, itemIndex, inquiryId, readOnly]);

  const exitCapture = useCallback(() => {
    setCaptureAreaId(null);
    void onReload();
  }, [onReload]);

  const startCapture = (areaId: string) => {
    const area = areas.find((a) => a.id === areaId);
    if (!area || area.notApplicable) return;
    setCaptureAreaId(areaId);
    setItemIndex(findFirstIncompleteIndex(area));
  };

  const advanceAfterAction = useCallback(
    (areaItemsLength: number) => {
      if (itemIndex < areaItemsLength - 1) {
        setItemIndex((i) => i + 1);
      } else {
        onMsg('이 구역의 청소 전 촬영을 마쳤습니다.');
        setCaptureAreaId(null);
      }
    },
    [itemIndex, onMsg],
  );

  const handleCapture = async (files: FileList | null) => {
    if (!currentItem || !files?.length) return;
    setBusy(true);
    onMsg(null);
    try {
      await uploadTeamInspectionPhotos(token, inquiryId, currentItem.id, 'BEFORE', Array.from(files));
      await onReload();
      advanceAfterAction(captureItems.length);
    } catch (e) {
      onMsg(e instanceof Error ? e.message : '업로드 실패');
    } finally {
      setBusy(false);
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
      advanceAfterAction(captureItems.length);
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

  if (!readOnly && captureArea && currentItem) {
    const hint = getInspectionCaptureHint({
      itemKey: currentItem.itemKey,
      label: currentItem.label,
      areaLabel: captureArea.label,
    });
    const beforePhotos = currentItem.photos.filter((p) => p.phase === 'BEFORE');
    const latestPhoto = beforePhotos[beforePhotos.length - 1];

    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-gray-950 text-white">
        <div className="shrink-0 border-b border-white/10 bg-black/80 px-3 py-2.5 backdrop-blur-sm">
          <div className="mx-auto flex max-w-lg items-center gap-2">
            <button
              type="button"
              onClick={exitCapture}
              disabled={busy}
              className="flex h-11 min-w-[44px] shrink-0 items-center justify-center rounded-xl bg-white/10 px-2 text-sm font-medium touch-manipulation disabled:opacity-50"
              aria-label="구역 목록으로"
            >
              ←
            </button>
            <div className="min-w-0 flex-1 text-center">
              <p className="text-xs text-gray-400">
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
              disabled={busy}
              className="flex h-11 shrink-0 items-center justify-center rounded-xl border border-white/25 bg-white/10 px-3 text-sm font-semibold touch-manipulation disabled:opacity-50"
            >
              닫기
            </button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
          <div className="mx-auto w-full max-w-lg rounded-xl border border-sky-400/50 bg-sky-950/80 px-4 py-3.5 shadow-lg">
            <p className="text-xs font-bold tracking-wide text-sky-300">촬영 가이드 — 어디를 찍을까요?</p>
            <p className="mt-2 text-base font-medium leading-relaxed text-white">{hint}</p>
            <p className="mt-2 text-xs leading-snug text-sky-200/80">
              모서리·틈새·얼룩이 보이도록 가까이 또는 넓게 한 장 이상 촬영해 주세요.
            </p>
          </div>

          {latestPhoto ? (
            <div className="mx-auto w-full max-w-lg">
              <p className="mb-2 text-center text-xs text-gray-400">등록된 청소 전 사진</p>
              <img
                src={latestPhoto.secureUrl}
                alt="청소 전"
                className="w-full rounded-xl object-contain shadow-lg max-h-[45vh]"
              />
              {beforePhotos.length > 1 && (
                <p className="mt-2 text-center text-xs text-gray-500">
                  등록된 사진 {beforePhotos.length}장 (추가 촬영 가능)
                </p>
              )}
            </div>
          ) : (
            <div className="mx-auto flex w-full max-w-lg flex-1 min-h-[8rem] items-center justify-center rounded-xl border border-dashed border-white/20 bg-white/5 px-4 py-6 text-center text-sm text-gray-400">
              아래 「촬영」 버튼을 눌러 사진을 등록하세요
            </div>
          )}

          {currentItem.notApplicable && (
            <p className="mx-auto max-w-lg text-center text-sm text-amber-300">
              이 항목은 해당없음으로 표시되어 있습니다. 「촬영」 또는 「해당없음」으로 다음으로 넘어갈 수 있습니다.
            </p>
          )}
        </div>

        <div className="shrink-0 border-t border-white/10 bg-black/85 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
          <div className="mx-auto grid max-w-lg grid-cols-3 gap-2">
            <button
              type="button"
              disabled={busy || itemIndex === 0}
              onClick={() => setItemIndex((i) => Math.max(0, i - 1))}
              className="flex min-h-[52px] items-center justify-center rounded-xl border border-white/20 bg-white/5 text-sm font-medium touch-manipulation disabled:opacity-40"
            >
              ← 이전
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => fileInputRef.current?.click()}
              className="flex min-h-[52px] items-center justify-center rounded-xl bg-sky-500 text-sm font-bold text-white touch-manipulation disabled:opacity-50"
            >
              {busy ? '처리 중…' : '촬영'}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleItemNa()}
              className="flex min-h-[52px] items-center justify-center rounded-xl border border-amber-500/60 bg-amber-500/15 text-sm font-medium text-amber-100 touch-manipulation disabled:opacity-50"
            >
              해당없음
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            disabled={busy}
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
    <section className="space-y-3">
      <p className="text-fluid-2xs text-gray-600">
        구역을 선택한 뒤 「촬영 시작」으로 항목별 연속 촬영을 진행하세요. 해당 공간이 없으면 「구역 해당없음」을 눌러 주세요.
      </p>

      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 snap-x snap-mandatory">
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
              className={`min-w-[9.5rem] shrink-0 snap-start rounded-xl border p-3 ${
                complete ? 'border-emerald-200 bg-emerald-50/50' : 'border-gray-200 bg-white'
              }`}
            >
              <div className="flex items-start justify-between gap-1">
                <span className="text-fluid-xs font-semibold text-gray-900">{area.label}</span>
                {complete && !area.notApplicable && (
                  <span className="text-[10px] font-medium text-emerald-700">완료</span>
                )}
              </div>
              <p className="mt-1 text-fluid-2xs text-gray-600">
                {area.notApplicable ? '해당없음' : `청소 전 ${beforeDone}/${total}`}
              </p>

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
                        onClick={() => startCapture(area.id)}
                        className="min-h-[44px] rounded-lg bg-gray-900 px-2 py-2 text-fluid-2xs font-semibold text-white touch-manipulation disabled:opacity-50"
                      >
                        촬영 시작
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void handleAreaNa(area.id)}
                        className="min-h-[36px] rounded-lg border border-amber-400 bg-amber-50 px-2 py-1 text-[11px] text-amber-900 touch-manipulation disabled:opacity-50"
                      >
                        구역 해당없음
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
