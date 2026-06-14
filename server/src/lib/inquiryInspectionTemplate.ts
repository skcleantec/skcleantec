/**
 * @generated-sync from shared/inquiryInspectionTemplate.ts — 직접 수정하지 마세요.
 * 변경: shared/inquiryInspectionTemplate.ts 수정 후 `npm run sync:inquiry-inspection-shared` (prebuild/predev 자동).
 */

export const INSPECTION_TEMPLATE_VERSION = 'v1';

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

const FIXED_AREAS: ReadonlyArray<Omit<StandardInspectionAreaDef, 'sortOrder'>> = [
  { areaKey: 'entrance', label: '현관' },
  { areaKey: 'living', label: '거실' },
  { areaKey: 'kitchen', label: '주방' },
  { areaKey: 'bathroom', label: '욕실' },
  { areaKey: 'balcony', label: '베란다' },
  { areaKey: 'utility', label: '다용도실' },
];

/** 접수 roomCount·isOneRoom 기준 표준 구역 목록 생성 */
export function buildStandardInspectionAreas(params: {
  roomCount?: number | null;
  isOneRoom?: boolean | null;
}): StandardInspectionAreaDef[] {
  const rooms = params.isOneRoom
    ? 1
    : Math.max(1, Math.min(3, params.roomCount ?? 1));
  const roomAreas: StandardInspectionAreaDef[] = [];
  for (let i = 1; i <= rooms; i += 1) {
    roomAreas.push({
      areaKey: `room_${i}`,
      label: rooms === 1 ? '방' : `방 ${i}`,
      sortOrder: 0,
    });
  }
  const merged: StandardInspectionAreaDef[] = [
    { ...FIXED_AREAS[0]!, sortOrder: 0 },
    { ...FIXED_AREAS[1]!, sortOrder: 0 },
    { ...FIXED_AREAS[2]!, sortOrder: 0 },
    ...roomAreas,
    { ...FIXED_AREAS[3]!, sortOrder: 0 },
    { ...FIXED_AREAS[4]!, sortOrder: 0 },
    { ...FIXED_AREAS[5]!, sortOrder: 0 },
  ];
  return merged.map((a, idx) => ({ ...a, sortOrder: idx }));
}

export const INSPECTION_AREA_GUIDE =
  '각 구역마다 청소 전·청소 후 사진을 등록해야 합니다. 해당 공간이 없거나 청소 범위에 포함되지 않는 경우 「해당사항 없음」을 선택하고 사유를 입력해 주세요.';

export const INSPECTION_NA_CUSTOMER_NOTICE =
  '본 구역(또는 추가 항목)은 당일 청소 범위에 포함되지 않거나 현장 구조상 해당 공간이 없음을 확인하였습니다. 이후 해당 구역에 대한 추가 청소를 요청하실 경우 별도 견적·추가 요금이 발생할 수 있습니다.';

export const INSPECTION_CUSTOM_AREA_GUIDE =
  '현장에 표준 목록에 없는 공간(예: 추가 베란다, 창고, 외부 등)이 있으면 「구역 추가」 후 동일하게 청소 전·후 사진을 등록해 주세요.';

export function isAreaComplete(params: {
  notApplicable: boolean;
  naReason: string | null | undefined;
  beforeCount: number;
  afterCount: number;
}): boolean {
  if (params.notApplicable) {
    return Boolean(params.naReason?.trim());
  }
  return params.beforeCount >= 1 && params.afterCount >= 1;
}

export function basicAnswersComplete(answers: InspectionBasicAnswers): boolean {
  return INSPECTION_BASIC_QUESTIONS.every((q) => {
    const slot = answers[q.id];
    return slot.leader !== null && slot.customer !== null;
  });
}
