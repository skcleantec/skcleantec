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
  '에어컨 청소 전용 발주서입니다. 기종별 청소 대수를 입력받고, 브랜드·오염 상태 등은 상세란에 적어 주세요. (벽걸이·스탠드·천장형 1·2way·4way 등 업계 표준 분류)';

export const AIRCON_ORDER_FORM_TEMPLATE_SORT_ORDER = 1;

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
  {
    fieldKey: 'propertyType',
    label: '건물 유형',
    inputType: 'SELECT',
    systemField: 'propertyType',
    options: ['아파트', '오피스텔', '빌라(연립)', '상가', '사무실', '기타'],
    optionStyle: 'DROPDOWN',
    required: true,
    sortOrder: 4,
  },
  {
    fieldKey: 'buildingType',
    label: '신축/구축',
    inputType: 'SELECT',
    systemField: 'buildingType',
    options: ['신축', '구축', '인테리어', '거주(짐이있는상태)'],
    optionStyle: 'DROPDOWN',
    required: true,
    sortOrder: 5,
  },
  { fieldKey: 'preferredDate', label: '희망 작업일', inputType: 'DATE', systemField: 'preferredDate', required: true, sortOrder: 6 },
  {
    fieldKey: 'preferredTime',
    label: '희망 시간대',
    inputType: 'SELECT',
    systemField: 'preferredTime',
    options: ['오전', '오후', '사이청소'],
    optionStyle: 'DROPDOWN',
    required: true,
    sortOrder: 7,
  },
  {
    fieldKey: 'areaPyeong',
    label: '평수(참고)',
    helpText: '현장·견적 참고용입니다. 모르시면 0을 입력해 주세요.',
    inputType: 'NUMBER',
    systemField: 'areaPyeong',
    required: true,
    sortOrder: 8,
  },
  {
    fieldKey: 'totalAmount',
    label: '청소 비용(총액)',
    helpText: '발주서 발급 시 담당자가 입력합니다.',
    inputType: 'MONEY',
    systemField: 'totalAmount',
    fillMode: 'ADMIN_PREFILL',
    required: true,
    sortOrder: 9,
  },
  {
    fieldKey: 'ac_wall_mount_count',
    label: '벽걸이 (대)',
    helpText: '가정용 벽걸이형(기본·와이드형 포함). 없으면 0',
    inputType: 'NUMBER',
    required: false,
    sortOrder: 10,
    showInInquiryList: true,
  },
  {
    fieldKey: 'ac_stand_count',
    label: '스탠드 (대)',
    helpText: '스탠드형·무풍 스탠드 포함. 없으면 0',
    inputType: 'NUMBER',
    required: false,
    sortOrder: 11,
    showInInquiryList: true,
  },
  {
    fieldKey: 'ac_system_1way_2way_count',
    label: '천장형 1·2way (대)',
    helpText: '바람 토출구 1~2개 천장형 시스템 에어컨',
    inputType: 'NUMBER',
    required: false,
    sortOrder: 12,
    showInInquiryList: true,
  },
  {
    fieldKey: 'ac_system_4way_count',
    label: '천장형 4way (대)',
    helpText: '바람 토출구 4개 · 사무실·상가에서 흔함',
    inputType: 'NUMBER',
    required: false,
    sortOrder: 13,
  },
  {
    fieldKey: 'ac_2in1_count',
    label: '2in1 세트 (대)',
    helpText: '벽걸이+스탠드 한 세트(투인원)',
    inputType: 'NUMBER',
    required: false,
    sortOrder: 14,
  },
  {
    fieldKey: 'ac_round_360_count',
    label: '원형(360°) 천장형 (대)',
    helpText: '삼성 360 등 원형 천장형',
    inputType: 'NUMBER',
    required: false,
    sortOrder: 15,
  },
  {
    fieldKey: 'ac_outdoor_unit_count',
    label: '실외기 추가 청소 (대)',
    helpText: '실내기와 별도로 실외기 청소를 원할 때',
    inputType: 'NUMBER',
    required: false,
    sortOrder: 16,
  },
  {
    fieldKey: 'ac_detail_notes',
    label: '에어컨 상세',
    helpText: '브랜드·모델명(평형), 곰팡이·냄새, 층고·사다리 필요 여부, 완전분해 희망 등',
    inputType: 'TEXTAREA',
    required: false,
    sortOrder: 17,
  },
  {
    fieldKey: 'specialNotes',
    label: '기타 특이사항',
    inputType: 'TEXTAREA',
    systemField: 'specialNotes',
    required: false,
    sortOrder: 18,
  },
];
