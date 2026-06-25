/** 구역별 세부 검수 항목 — v3 축소 템플릿 (사진 단위) */
import { INSPECTION_CONTAMINATION_AREA_KEY } from './inquiryInspectionContamination.js';

export type InspectionItemDef = {
  itemKey: string;
  label: string;
};

const ENTRANCE_ITEMS: InspectionItemDef[] = [
  { itemKey: 'entrance_overall', label: '현관전체' },
  { itemKey: 'shoe_closet', label: '신발장' },
  { itemKey: 'floor', label: '바닥' },
];

const LIVING_ITEMS: InspectionItemDef[] = [
  { itemKey: 'living_overall', label: '거실전체' },
  { itemKey: 'floor', label: '바닥' },
  { itemKey: 'ceiling', label: '천장' },
  { itemKey: 'window', label: '유리창' },
];

const KITCHEN_ITEMS: InspectionItemDef[] = [
  { itemKey: 'kitchen_overall', label: '주방전체' },
  { itemKey: 'sink', label: '싱크대' },
  { itemKey: 'hood', label: '후드' },
  { itemKey: 'cooktop', label: '가스레인지' },
  { itemKey: 'cabinet', label: '상·하부장 겉면' },
  { itemKey: 'floor', label: '바닥' },
];

const ROOM_ITEMS: InspectionItemDef[] = [
  { itemKey: 'room_overall', label: '방전체' },
  { itemKey: 'floor', label: '바닥' },
  { itemKey: 'ceiling', label: '천장' },
];

const BATHROOM_ITEMS: InspectionItemDef[] = [
  { itemKey: 'bathroom_overall', label: '욕실전체' },
  { itemKey: 'floor', label: '바닥' },
  { itemKey: 'wall', label: '벽' },
  { itemKey: 'exhaust_fan', label: '환풍기' },
];

const BALCONY_ITEMS: InspectionItemDef[] = [
  { itemKey: 'floor', label: '바닥' },
  { itemKey: 'window', label: '창틀/창문' },
  { itemKey: 'ceiling', label: '천장' },
];

const UTILITY_ITEMS: InspectionItemDef[] = [
  { itemKey: 'utility_overall', label: '다용도실전체' },
  { itemKey: 'floor', label: '바닥' },
  { itemKey: 'ceiling', label: '천장' },
];

const CONTAMINATION_ITEMS: InspectionItemDef[] = [
  { itemKey: 'contamination_extra', label: '추가 오염 촬영' },
];

/** 표준 구역 areaKey → 세부 항목 (방은 areaKey가 room_N) */
export function buildStandardItemsForAreaKey(areaKey: string): InspectionItemDef[] {
  if (areaKey === INSPECTION_CONTAMINATION_AREA_KEY) return [...CONTAMINATION_ITEMS];
  if (areaKey === 'entrance' || areaKey.startsWith('entrance_')) return [...ENTRANCE_ITEMS];
  if (areaKey === 'living' || areaKey.startsWith('living_')) return [...LIVING_ITEMS];
  if (areaKey === 'kitchen' || areaKey.startsWith('kitchen_')) return [...KITCHEN_ITEMS];
  if (areaKey.startsWith('room_')) return [...ROOM_ITEMS];
  if (areaKey === 'bathroom' || areaKey.startsWith('bathroom_')) return [...BATHROOM_ITEMS];
  if (areaKey === 'balcony' || areaKey.startsWith('balcony_')) return [...BALCONY_ITEMS];
  if (areaKey === 'utility' || areaKey.startsWith('utility_')) return [...UTILITY_ITEMS];
  return [];
}

/** 커스텀 구역 — 팀장이 항목 추가 전까지 빈 목록 */
export function defaultCustomAreaItems(): InspectionItemDef[] {
  return [];
}
