/**
 * @generated-sync from shared/inquiryInspectionContamination.ts — 직접 수정하지 마세요.
 * 변경: shared/inquiryInspectionContamination.ts 수정 후 `npm run sync:inquiry-inspection-shared` (prebuild/predev 자동).
 */

export const INSPECTION_CONTAMINATION_AREA_KEY = 'contamination';
export const INSPECTION_CONTAMINATION_ITEM_KEY = 'contamination_extra';

export function isContaminationInspectionArea(areaKey: string): boolean {
  return areaKey === INSPECTION_CONTAMINATION_AREA_KEY;
}
