import type { InspectionArea } from '../../api/inquiryInspection';
import {
  isCountableInspectionAreaKey,
  MAX_INSPECTION_AREA_INSTANCES,
} from '@shared/inquiryInspectionAreaInstances';
import { normalizeAreaKeyForTemplate } from '@shared/inquiryInspectionTenantTemplate';

export function countInspectionAreasOfSameType(
  areas: ReadonlyArray<InspectionArea>,
  areaKey: string,
): number {
  const templateKey = normalizeAreaKeyForTemplate(areaKey);
  return areas.filter((a) => !a.isCustom && normalizeAreaKeyForTemplate(a.areaKey) === templateKey)
    .length;
}

export function areaHasBeforePhotos(area: InspectionArea): boolean {
  for (const item of area.items) {
    if (item.itemKey.startsWith('_')) continue;
    if (item.photos.some((p) => p.phase === 'BEFORE')) return true;
  }
  return false;
}

export function InspectionAreaCountButtons({
  area,
  allAreas,
  disabled,
  onAdd,
  onRemove,
}: {
  area: InspectionArea;
  allAreas: ReadonlyArray<InspectionArea>;
  disabled?: boolean;
  onAdd: () => void;
  onRemove: () => void;
}) {
  if (area.isCustom || !isCountableInspectionAreaKey(area.areaKey)) return null;

  const typeCount = countInspectionAreasOfSameType(allAreas, area.areaKey);
  const canRemove = typeCount > 1;
  const canAdd = typeCount < MAX_INSPECTION_AREA_INSTANCES;

  const btnClass =
    'flex h-8 w-8 items-center justify-center rounded-lg border text-base font-bold leading-none touch-manipulation disabled:opacity-35';

  return (
    <div className="flex shrink-0 items-center gap-0.5" aria-label={`${area.label} 개수 조절`}>
      <button
        type="button"
        disabled={disabled || !canRemove}
        onClick={onRemove}
        title={canRemove ? '이 구역 삭제' : '최소 1개는 필요합니다'}
        aria-label="구역 줄이기"
        className={`${btnClass} border-gray-300 bg-white text-gray-700`}
      >
        −
      </button>
      <button
        type="button"
        disabled={disabled || !canAdd}
        onClick={onAdd}
        title={canAdd ? '같은 종류 구역 추가' : '더 이상 추가할 수 없습니다'}
        aria-label="구역 늘리기"
        className={`${btnClass} border-sky-400 bg-sky-50 text-sky-900`}
      >
        +
      </button>
    </div>
  );
}
