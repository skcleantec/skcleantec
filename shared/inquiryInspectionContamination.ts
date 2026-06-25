/** 오염사진 전용 구역 — 위저드 순서·필수 촬영에서 제외 */
export const INSPECTION_CONTAMINATION_AREA_KEY = 'contamination';
export const INSPECTION_CONTAMINATION_ITEM_KEY = 'contamination_extra';

export function isContaminationInspectionArea(areaKey: string): boolean {
  return areaKey === INSPECTION_CONTAMINATION_AREA_KEY;
}
