import { useState } from 'react';
import {
  addTeamInspectionArea,
  addTeamInspectionItem,
  deleteTeamInspectionPhoto,
  patchTeamInspectionArea,
  patchTeamInspectionItem,
  uploadTeamInspectionPhotos,
  type InspectionChecklistDto,
} from '../../api/inquiryInspection';
import {
  InspectionAreaSection,
  INSPECTION_AREA_GUIDE,
  INSPECTION_CUSTOM_AREA_GUIDE,
  INSPECTION_ITEM_GUIDE,
  type InspectionPhotoMode,
} from '../../components/inquiry-inspection/inspectionUiBlocks';
import { ShareAreaBeforePhotosButton } from '../../components/inquiry-inspection/ShareAreaBeforePhotosButton';

export function TeamInspectionAreasEditor({
  checklist,
  inquiryId,
  token,
  readOnly,
  busy,
  setBusy,
  photoMode,
  onReload,
  onMsg,
}: {
  checklist: InspectionChecklistDto;
  inquiryId: string;
  token: string;
  readOnly: boolean;
  busy: boolean;
  setBusy: (v: boolean) => void;
  photoMode: InspectionPhotoMode;
  onReload: () => Promise<unknown>;
  onMsg: (msg: string | null) => void;
}) {
  const [customAreaLabel, setCustomAreaLabel] = useState('');
  const [customItemLabels, setCustomItemLabels] = useState<Record<string, string>>({});

  const handleToggleItemNa = async (itemId: string, na: boolean) => {
    setBusy(true);
    try {
      await patchTeamInspectionItem(token, inquiryId, itemId, {
        notApplicable: na,
        naReason: null,
      });
      await onReload();
    } catch (e) {
      onMsg(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setBusy(false);
    }
  };

  const handleToggleAreaNa = async (areaId: string, na: boolean) => {
    setBusy(true);
    try {
      await patchTeamInspectionArea(token, inquiryId, areaId, { notApplicable: na, naReason: null });
      await onReload();
    } catch (e) {
      onMsg(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-fluid-sm font-semibold text-gray-900">
          {photoMode === 'before-only' ? '청소 전 촬영 (세부 항목)' : '구역별 검수 (세부 항목)'}
        </h3>
        <p className="mt-1 text-fluid-2xs text-gray-600">{INSPECTION_AREA_GUIDE}</p>
        <p className="mt-1 text-fluid-2xs text-gray-600">{INSPECTION_ITEM_GUIDE}</p>
        {photoMode === 'both' && (
          <p className="mt-1 text-fluid-2xs text-gray-600">{INSPECTION_CUSTOM_AREA_GUIDE}</p>
        )}
      </div>

      {!readOnly && photoMode === 'both' && (
        <div className="flex flex-wrap gap-2">
          <input
            value={customAreaLabel}
            onChange={(e) => setCustomAreaLabel(e.target.value)}
            placeholder="추가 구역 이름"
            className="flex-1 min-w-[8rem] rounded-lg border border-gray-300 px-2 py-1.5 text-fluid-xs"
          />
          <button
            type="button"
            disabled={busy || !customAreaLabel.trim()}
            onClick={async () => {
              setBusy(true);
              try {
                await addTeamInspectionArea(token, inquiryId, customAreaLabel.trim());
                setCustomAreaLabel('');
                await onReload();
              } catch (e) {
                onMsg(e instanceof Error ? e.message : '구역 추가 실패');
              } finally {
                setBusy(false);
              }
            }}
            className="rounded-lg border border-blue-600 bg-blue-50 px-3 py-1.5 text-fluid-xs text-blue-900 touch-manipulation disabled:opacity-50"
          >
            구역 추가
          </button>
        </div>
      )}

      <div className="space-y-2">
        {checklist.areas.map((area, idx) => (
          <InspectionAreaSection
            key={area.id}
            area={area}
            readOnly={readOnly}
            busy={busy}
            photoMode={photoMode}
            defaultOpen={idx === 0}
            onToggleAreaNa={
              photoMode !== 'after-only' ? (na) => void handleToggleAreaNa(area.id, na) : undefined
            }
            customItemLabel={customItemLabels[area.id] ?? ''}
            onCustomItemLabelChange={(v) =>
              setCustomItemLabels((prev) => ({ ...prev, [area.id]: v }))
            }
            onAddItem={
              area.isCustom
                ? async () => {
                    const label = customItemLabels[area.id]?.trim();
                    if (!label) return;
                    setBusy(true);
                    try {
                      await addTeamInspectionItem(token, inquiryId, area.id, label);
                      setCustomItemLabels((prev) => ({ ...prev, [area.id]: '' }));
                      await onReload();
                    } catch (e) {
                      onMsg(e instanceof Error ? e.message : '항목 추가 실패');
                    } finally {
                      setBusy(false);
                    }
                  }
                : undefined
            }
            onToggleItemNa={(itemId, na) => void handleToggleItemNa(itemId, na)}
            onUpload={async (itemId, phase, files) => {
              if (!files?.length) return;
              setBusy(true);
              try {
                await uploadTeamInspectionPhotos(token, inquiryId, itemId, phase, Array.from(files));
                await onReload();
              } catch (e) {
                onMsg(e instanceof Error ? e.message : '업로드 실패');
              } finally {
                setBusy(false);
              }
            }}
            onDeletePhoto={async (itemId, photoId) => {
              if (!window.confirm('사진을 삭제할까요?')) return;
              setBusy(true);
              try {
                await deleteTeamInspectionPhoto(token, inquiryId, itemId, photoId);
                await onReload();
              } catch (e) {
                onMsg(e instanceof Error ? e.message : '삭제 실패');
              } finally {
                setBusy(false);
              }
            }}
            areaShareAction={
              photoMode === 'before-only' ? (
                <ShareAreaBeforePhotosButton
                  token={token}
                  inquiryId={inquiryId}
                  area={area}
                  customerName={checklist.inquiryHeader?.customerName}
                  preferredDate={checklist.inquiryHeader?.preferredDate}
                  disabled={busy}
                  className="w-full"
                />
              ) : undefined
            }
          />
        ))}
      </div>
    </section>
  );
}
