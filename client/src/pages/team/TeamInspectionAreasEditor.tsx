import { useMemo, useState } from 'react';
import {
  addTeamInspectionItem,
  deleteTeamInspectionPhoto,
  patchTeamInspectionArea,
  patchTeamInspectionItem,
  uploadTeamInspectionPhotos,
  type InspectionChecklistDto,
} from '../../api/inquiryInspection';
import {
  InspectionAreaSection,
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
  const [customItemLabels, setCustomItemLabels] = useState<Record<string, string>>({});

  /** 청소 전 촬영에서 해당없음·− 로 제외한 구역은 현장검수 목록에 표시하지 않음 (+ 로 추가 시 다시 노출) */
  const displayAreas = useMemo(
    () => (photoMode === 'both' ? checklist.areas.filter((a) => !a.notApplicable) : checklist.areas),
    [checklist.areas, photoMode],
  );

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
      </div>

      {photoMode === 'both' && displayAreas.length === 0 && (
        <p className="text-fluid-2xs text-gray-500">
          표시할 구역이 없습니다. 청소 전 촬영에서 구역을 추가하거나 해당없음을 해제해 주세요.
        </p>
      )}

      <div className="space-y-2">
        {displayAreas.map((area, idx) => (
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
