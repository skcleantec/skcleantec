/**
 * @generated-sync from shared/inquiryInspectionItems.ts — 직접 수정하지 마세요.
 * 변경: shared/inquiryInspectionItems.ts 수정 후 `npm run sync:inquiry-inspection-shared` (prebuild/predev 자동).
 */

export type InspectionItemDef = {
  itemKey: string;
  label: string;
};

const ENTRANCE_ITEMS: InspectionItemDef[] = [
  { itemKey: 'inside_door', label: '안쪽문' },
  { itemKey: 'entrance_door_inner', label: '현관문 안쪽' },
  { itemKey: 'shoe_closet', label: '신발장' },
  { itemKey: 'sensor_light', label: '센서등' },
  { itemKey: 'floor', label: '바닥' },
  { itemKey: 'ceiling', label: '천장' },
  { itemKey: 'baseboard', label: '걸레받이' },
  { itemKey: 'mirror', label: '거울' },
];

const LIVING_ITEMS: InspectionItemDef[] = [
  { itemKey: 'storage', label: '수납장' },
  { itemKey: 'light', label: '전등' },
  { itemKey: 'molding', label: '몰딩' },
  { itemKey: 'ceiling', label: '천장' },
  { itemKey: 'wall', label: '벽' },
  { itemKey: 'floor', label: '바닥' },
  { itemKey: 'switch', label: '스위치' },
  { itemKey: 'outlet', label: '콘센트' },
  { itemKey: 'emergency_light', label: '비상등' },
  { itemKey: 'intercom', label: '인터폰' },
  { itemKey: 'pantry', label: '팬트리' },
];

const KITCHEN_ITEMS: InspectionItemDef[] = [
  { itemKey: 'sink_faucet', label: '싱크/수전' },
  { itemKey: 'hood', label: '후드(겉면·필터)' },
  { itemKey: 'aux_cabinet', label: '보조 식기장' },
  { itemKey: 'cooktop', label: '가스레인지/인덕션' },
  { itemKey: 'cabinet', label: '상·하부장 겉면' },
  { itemKey: 'island', label: '아일랜드' },
  { itemKey: 'wall', label: '벽' },
  { itemKey: 'floor', label: '바닥' },
  { itemKey: 'window', label: '창틀/창문' },
  { itemKey: 'fridge_exterior', label: '냉장고 겉면' },
];

const ROOM_ITEMS: InspectionItemDef[] = [
  { itemKey: 'builtin_closet', label: '붙박이장/옷장' },
  { itemKey: 'molding', label: '몰딩' },
  { itemKey: 'ceiling', label: '천장' },
  { itemKey: 'wall', label: '벽' },
  { itemKey: 'floor', label: '바닥' },
  { itemKey: 'light', label: '전등' },
  { itemKey: 'switch', label: '스위치' },
  { itemKey: 'outlet', label: '콘센트' },
  { itemKey: 'window', label: '창틀/창문' },
  { itemKey: 'door', label: '방문' },
];

const BATHROOM_ITEMS: InspectionItemDef[] = [
  { itemKey: 'toilet', label: '변기' },
  { itemKey: 'sink', label: '세면대' },
  { itemKey: 'shower_bath', label: '샤워부스/욕조' },
  { itemKey: 'mirror', label: '거울' },
  { itemKey: 'floor', label: '바닥' },
  { itemKey: 'wall', label: '벽' },
  { itemKey: 'drain', label: '배수구' },
  { itemKey: 'exhaust_fan', label: '환풍기' },
];

const BALCONY_ITEMS: InspectionItemDef[] = [
  { itemKey: 'floor', label: '바닥' },
  { itemKey: 'railing', label: '난간' },
  { itemKey: 'window', label: '창틀/창문' },
  { itemKey: 'wall', label: '벽' },
  { itemKey: 'ceiling', label: '천장' },
];

const UTILITY_ITEMS: InspectionItemDef[] = [
  { itemKey: 'washer_area', label: '세탁기 주변' },
  { itemKey: 'sink', label: '싱크' },
  { itemKey: 'floor', label: '바닥' },
  { itemKey: 'wall', label: '벽' },
  { itemKey: 'ceiling', label: '천장' },
];

/** 표준 구역 areaKey → 세부 항목 (방은 areaKey가 room_N) */
export function buildStandardItemsForAreaKey(areaKey: string): InspectionItemDef[] {
  if (areaKey === 'entrance') return [...ENTRANCE_ITEMS];
  if (areaKey === 'living') return [...LIVING_ITEMS];
  if (areaKey === 'kitchen') return [...KITCHEN_ITEMS];
  if (areaKey.startsWith('room_')) return [...ROOM_ITEMS];
  if (areaKey === 'bathroom') return [...BATHROOM_ITEMS];
  if (areaKey === 'balcony') return [...BALCONY_ITEMS];
  if (areaKey === 'utility') return [...UTILITY_ITEMS];
  return [];
}

/** 커스텀 구역 — 팀장이 항목 추가 전까지 빈 목록 */
export function defaultCustomAreaItems(): InspectionItemDef[] {
  return [];
}
