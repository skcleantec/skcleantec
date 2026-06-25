/**
 * @generated-sync from shared/inquiryInspectionTemplate.ts — 직접 수정하지 마세요.
 * 변경: shared/inquiryInspectionTemplate.ts 수정 후 `npm run sync:inquiry-inspection-shared` (prebuild/predev 자동).
 */

import {
  MAX_INSPECTION_AREA_INSTANCES,
  buildAreaInstanceKey,
  buildAreaInstanceLabel,
} from './inquiryInspectionAreaInstances.js';

export const INSPECTION_TEMPLATE_VERSION = 'v3';

export const INSPECTION_HEADER_INTRO =
  '담당 팀장이 「내가 살 집이라 생각하고」 청소하였으며, 아래 내용을 고객님과 함께 확인·기록합니다. 본 문서는 서비스 품질 확인 및 사후 A/S·분쟁 예방을 위해 작성됩니다.';

export type InspectionBasicQuestionId = 'q1' | 'q2' | 'q3' | 'q4';

export const INSPECTION_BASIC_QUESTIONS: ReadonlyArray<{
  id: InspectionBasicQuestionId;
  text: string;
}> = [
  { id: 'q1', text: '서비스 전날 담당 팀장으로부터 연락을 받으셨습니까?' },
  { id: 'q2', text: '추가 비용이 발생할 수 있는 사항에 대해 안내를 받으셨습니까?' },
  { id: 'q3', text: '약속된 시간에 청소가 시작되었습니까?' },
  { id: 'q4', text: '청소 중 발생한 쓰레기를 봉투에 담아 정리하였습니까?' },
];

export type InspectionBasicAnswerSlot = {
  leader: boolean | null;
  customer: boolean | null;
};

export type InspectionBasicAnswers = Record<InspectionBasicQuestionId, InspectionBasicAnswerSlot>;

export function emptyBasicAnswers(): InspectionBasicAnswers {
  return {
    q1: { leader: null, customer: null },
    q2: { leader: null, customer: null },
    q3: { leader: null, customer: null },
    q4: { leader: null, customer: null },
  };
}

export type StandardInspectionAreaDef = {
  areaKey: string;
  label: string;
  sortOrder: number;
};

/** 접수 필드 → 체크리스트 표준 구역 개수 */
export type InquiryInspectionAreaStructureInput = {
  roomCount?: number | null;
  isOneRoom?: boolean | null;
  kitchenCount?: number | null;
  bathroomCount?: number | null;
};

function clampAreaInstanceCount(n: number): number {
  return Math.max(1, Math.min(MAX_INSPECTION_AREA_INSTANCES, Math.floor(n)));
}

/** 접수 roomCount·kitchenCount·bathroomCount·isOneRoom 기준 표준 구역 목록 */
export function buildStandardInspectionAreas(
  params: InquiryInspectionAreaStructureInput,
): StandardInspectionAreaDef[] {
  const rooms = params.isOneRoom ? 1 : clampAreaInstanceCount(params.roomCount ?? 1);
  const kitchens = clampAreaInstanceCount(params.kitchenCount ?? 1);
  const bathrooms = clampAreaInstanceCount(params.bathroomCount ?? 1);

  const merged: StandardInspectionAreaDef[] = [
    {
      areaKey: 'entrance',
      label: buildAreaInstanceLabel('entrance', 1, 1),
      sortOrder: 0,
    },
    {
      areaKey: 'living',
      label: buildAreaInstanceLabel('living', 1, 1),
      sortOrder: 0,
    },
  ];

  for (let i = 1; i <= kitchens; i += 1) {
    merged.push({
      areaKey: buildAreaInstanceKey('kitchen', i),
      label: buildAreaInstanceLabel('kitchen', i, kitchens),
      sortOrder: 0,
    });
  }

  for (let i = 1; i <= rooms; i += 1) {
    merged.push({
      areaKey: buildAreaInstanceKey('room', i),
      label: buildAreaInstanceLabel('room', i, rooms),
      sortOrder: 0,
    });
  }

  for (let i = 1; i <= bathrooms; i += 1) {
    merged.push({
      areaKey: buildAreaInstanceKey('bathroom', i),
      label: buildAreaInstanceLabel('bathroom', i, bathrooms),
      sortOrder: 0,
    });
  }

  merged.push(
    {
      areaKey: 'balcony',
      label: buildAreaInstanceLabel('balcony', 1, 1),
      sortOrder: 0,
    },
    {
      areaKey: 'utility',
      label: buildAreaInstanceLabel('utility', 1, 1),
      sortOrder: 0,
    },
  );

  return merged.map((a, idx) => ({ ...a, sortOrder: idx }));
}

export const INSPECTION_AREA_GUIDE =
  '구역별 핵심 항목만 촬영합니다. 항목마다 청소 전·후 사진을 1장씩 등록하세요. 오염이 심한 곳은 촬영 중 별표(★)를 눌러 추가로 기록할 수 있습니다.';

export const INSPECTION_PRE_CLEAN_GUIDE =
  '청소 시작 전, 아래 항목 순서대로 「청소 전」 사진을 촬영합니다. 해당 공간이 없으면 「해당없음」을 선택하세요.';

export const INSPECTION_ITEM_GUIDE =
  '항목별로 청소 전·후 사진을 각 1장 등록하세요. 없는 항목은 「해당없음」을 눌러 주세요.';

export const INSPECTION_NA_CUSTOMER_NOTICE =
  '본 구역(또는 추가 항목)은 당일 청소 범위에 포함되지 않거나 현장 구조상 해당 공간이 없음을 확인하였습니다. 이후 해당 구역에 대한 추가 청소를 요청하실 경우 별도 견적·추가 요금이 발생할 수 있습니다.';

export const INSPECTION_CUSTOM_AREA_GUIDE =
  '현장에 표준 목록에 없는 공간(예: 추가 베란다, 창고, 외부 등)이 있으면 「구역 추가」 후 동일하게 청소 전·후 사진을 등록해 주세요.';

/** PDF·고객 열람 — 사유 미입력 시 표시 */
export const INSPECTION_NA_DEFAULT_LABEL = '현장에 해당 항목(공간) 없음을 확인함';

export function formatInspectionNaReason(reason: string | null | undefined): string {
  const t = typeof reason === 'string' ? reason.trim() : '';
  return t || INSPECTION_NA_DEFAULT_LABEL;
}

/** 청소 전 촬영만 — 사진 1장 또는 해당없음 */
export function isBeforeItemComplete(params: { notApplicable: boolean; beforeCount: number }): boolean {
  if (params.notApplicable) return true;
  return params.beforeCount >= 1;
}

export function isBeforeAreaItemsComplete(
  items: ReadonlyArray<{ notApplicable: boolean; beforeCount: number }>,
): boolean {
  if (!items.length) return false;
  return items.every((it) => isBeforeItemComplete(it));
}

export function countBeforeItemProgress(
  items: ReadonlyArray<{ notApplicable: boolean; beforeCount: number }>,
): { beforeDone: number; total: number } {
  let beforeDone = 0;
  for (const it of items) {
    if (isBeforeItemComplete(it)) beforeDone += 1;
  }
  return { beforeDone, total: items.length };
}

/** 청소 후 촬영만 — 사진 1장 또는 해당없음 */
export function isAfterItemComplete(params: { notApplicable: boolean; afterCount: number }): boolean {
  if (params.notApplicable) return true;
  return params.afterCount >= 1;
}

export function isAfterAreaItemsComplete(
  items: ReadonlyArray<{ notApplicable: boolean; afterCount: number }>,
): boolean {
  if (!items.length) return false;
  return items.every((it) => isAfterItemComplete(it));
}

export function countAfterItemProgress(
  items: ReadonlyArray<{ notApplicable: boolean; afterCount: number }>,
): { afterDone: number; total: number } {
  let afterDone = 0;
  for (const it of items) {
    if (isAfterItemComplete(it)) afterDone += 1;
  }
  return { afterDone, total: items.length };
}

export function isItemComplete(params: {
  notApplicable: boolean;
  naReason: string | null | undefined;
  beforeCount: number;
  afterCount: number;
}): boolean {
  if (params.notApplicable) {
    return true;
  }
  return params.beforeCount >= 1 && params.afterCount >= 1;
}

/** @deprecated 구역 단위 — v2는 세부 항목 기준 */
export function isAreaComplete(params: {
  notApplicable: boolean;
  naReason: string | null | undefined;
  beforeCount: number;
  afterCount: number;
}): boolean {
  return isItemComplete(params);
}

export function isAreaItemsComplete(
  items: ReadonlyArray<{
    notApplicable: boolean;
    naReason: string | null | undefined;
    beforeCount: number;
    afterCount: number;
  }>,
): boolean {
  if (!items.length) return false;
  return items.every((it) => isItemComplete(it));
}

export function countItemPhotoProgress(
  items: ReadonlyArray<{
    notApplicable: boolean;
    naReason: string | null | undefined;
    beforeCount: number;
    afterCount: number;
  }>,
): { beforeDone: number; afterDone: number; total: number; naDone: number } {
  let beforeDone = 0;
  let afterDone = 0;
  let naDone = 0;
  for (const it of items) {
    if (it.notApplicable) {
      naDone += 1;
      beforeDone += 1;
      afterDone += 1;
      continue;
    }
    if (it.beforeCount >= 1) beforeDone += 1;
    if (it.afterCount >= 1) afterDone += 1;
  }
  return { beforeDone, afterDone, total: items.length, naDone };
}

export function basicAnswersComplete(answers: InspectionBasicAnswers): boolean {
  return INSPECTION_BASIC_QUESTIONS.every((q) => {
    const slot = answers[q.id];
    return slot.leader !== null && slot.customer !== null;
  });
}
