/**
 * 플랫폼 공통 — 에어컨 청소 발주서 템플릿 (테넌트당 1개 자동 제공)
 *
 * 업계 관행(숨고·크몽·제조사 AS·입주청소 가이드) 기준:
 * - 견적·접수 시 **기종 구분 + 대수**가 핵심
 * - 벽걸이 / 스탠드 / 천장형 1·2way / 4way / 2in1 / 원형(360°) / 실외기 추가
 */

import type { Prisma } from '@prisma/client';

export const AIRCON_ORDER_FORM_TEMPLATE_TITLE = '에어컨 청소 발주서';

export const AIRCON_ORDER_FORM_TEMPLATE_ICON = '❄️';

export const AIRCON_ORDER_FORM_TEMPLATE_DESCRIPTION =
  '에어컨 청소 전용 발주서입니다. 연락처·주소·희망 일정과 청소할 기종·대수만 입력하면 됩니다. 브랜드·오염 상태 등은 상세란에 적어 주세요.';

export const AIRCON_ORDER_FORM_TEMPLATE_SORT_ORDER = 1;

/** 에어컨 양식에서 제거·동기화 대상(레거시·입주청소 전용 항목) */
export const AIRCON_ORDER_FORM_REMOVED_FIELD_KEYS = [
  'propertyType',
  'buildingType',
  'areaPyeong',
  'professionalOptions',
  'photos',
  'totalAmount',
  'ac_wall_mount_count',
  'ac_stand_count',
  'ac_system_1way_2way_count',
  'ac_system_4way_count',
  'ac_2in1_count',
  'ac_round_360_count',
  'ac_outdoor_unit_count',
] as const;

export type AirconOrderFormTemplateFieldSeed = {
  fieldKey: string;
  label: string;
  helpText?: string | null;
  inputType: Prisma.OrderFormTemplateFieldCreateManyInput['inputType'];
  options?: string[];
  optionStyle?: string | null;
  required: boolean;
  sortOrder: number;
  systemField?: string | null;
  fillMode?: Prisma.OrderFormTemplateFieldCreateManyInput['fillMode'];
  showInInquiryList?: boolean;
};

/** 발행(TEMPLATE) 필수 시스템 필드 + 에어컨 기종별 대수 */
export const AIRCON_ORDER_FORM_TEMPLATE_FIELDS: AirconOrderFormTemplateFieldSeed[] = [
  { fieldKey: 'customerName', label: '고객명', inputType: 'TEXT', systemField: 'customerName', required: true, sortOrder: 0 },
  { fieldKey: 'customerPhone', label: '전화번호', inputType: 'PHONE', systemField: 'customerPhone', required: true, sortOrder: 1 },
  { fieldKey: 'customerEmail', label: '이메일', inputType: 'TEXT', systemField: 'customerEmail', required: true, sortOrder: 2 },
  { fieldKey: 'address', label: '주소', inputType: 'ADDRESS', systemField: 'address', required: true, sortOrder: 3 },
  { fieldKey: 'preferredDate', label: '희망 작업일', inputType: 'DATE', systemField: 'preferredDate', required: true, sortOrder: 4 },
  {
    fieldKey: 'preferredTime',
    label: '희망 시간대',
    inputType: 'SELECT',
    systemField: 'preferredTime',
    options: ['오전', '오후', '사이청소'],
    optionStyle: 'DROPDOWN',
    required: true,
    sortOrder: 5,
  },
  {
    fieldKey: 'ac_units',
    label: '청소할 에어컨',
    helpText: '기종을 선택하고 대수를 입력한 뒤 「추가하기」를 눌러 주세요. 여러 기종이면 반복해서 추가합니다.',
    inputType: 'SELECT',
    options: [
      '벽걸이',
      '스탠드',
      '천장형 1·2way',
      '천장형 4way',
      '2in1 세트',
      '원형(360°) 천장형',
      '실외기 추가',
    ],
    optionStyle: 'DROPDOWN',
    required: true,
    sortOrder: 6,
    showInInquiryList: true,
  },
  {
    fieldKey: 'ac_detail_notes',
    label: '에어컨 상세',
    helpText: '브랜드·모델명(평형), 곰팡이·냄새, 층고·사다리 필요 여부, 완전분해 희망 등',
    inputType: 'TEXTAREA',
    required: false,
    sortOrder: 7,
  },
  {
    fieldKey: 'specialNotes',
    label: '기타 특이사항',
    inputType: 'TEXTAREA',
    systemField: 'specialNotes',
    required: false,
    sortOrder: 8,
  },
];
