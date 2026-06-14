/**
 * @generated-sync from shared/inquiryInspectionConsent.ts — 직접 수정하지 마세요.
 * 변경: shared/inquiryInspectionConsent.ts 수정 후 `npm run sync:inquiry-inspection-shared` (prebuild/predev 자동).
 */

import { INSPECTION_TEMPLATE_VERSION } from './inquiryInspectionTemplate.js';

export type InspectionConsentItemId =
  | 'F1'
  | 'F2'
  | 'F3'
  | 'F4_LEADER'
  | 'F4_CUSTOMER'
  | 'F5'
  | 'EMAIL';

export type InspectionConsentItem = {
  id: InspectionConsentItemId;
  title: string;
  body: string;
  required: boolean;
  checkboxLabel: string;
};

export const INSPECTION_CONSENT_ITEMS: ReadonlyArray<InspectionConsentItem> = [
  {
    id: 'F1',
    title: '개인정보 수집·이용 동의',
    required: true,
    checkboxLabel: '위 개인정보 수집·이용에 동의합니다.',
    body: `1. 수집 항목: 성함, 연락처, 서비스 주소, 이메일 주소, 현장 청소 전·후 사진, 검수 체크리스트 내용, 서명 이미지, 서비스 일시, 담당 팀장 정보

2. 수집·이용 목적: 입주·이사·거주 청소 서비스 제공, 현장 품질 검수, 고객 확인·서명 기록, 사후 A/S·민원(C/S) 대응, 분쟁 예방 및 처리, 완료본 이메일 발송

3. 보유·이용 기간: 서비스 완료일로부터 1년 (단, 관계 법령에 따라 보존이 필요한 경우 해당 기간 동안 보관)

4. 동의 거부 권리 및 불이익: 동의를 거부하실 수 있으나, 거부 시 현장 검수·서명 절차를 완료할 수 없으며, 이에 따라 당일 서비스 마감·완료 처리가 제한될 수 있습니다.`,
  },
  {
    id: 'F2',
    title: '개인정보 제3자 제공 동의',
    required: true,
    checkboxLabel: '위 개인정보 제3자 제공에 동의합니다.',
    body: `1. 제공받는 자: 서비스 운영사(귀하가 계약한 청소 서비스 제공 업체), 사진·문서 저장 처리업체(클라우드 저장 서비스), A/S·품질 관리를 위한 본사 관리 시스템(내부 CS·관리 목적)

2. 제공 목적: 현장 사진·체크리스트·서명의 안전한 저장, 담당자 간 업무 연계, A/S·품질 관리

3. 제공 항목: [F-1]과 동일

4. 보유 기간: 서비스 완료일로부터 1년 (법령상 보존 기간 해당 시 그에 따름)

5. 동의 거부 권리 및 불이익: 거부 시 현장 검수·서명·완료본 발송이 불가능합니다.`,
  },
  {
    id: 'F3',
    title: '현장 검수 및 청소 범위 확인',
    required: true,
    checkboxLabel: '위 현장 검수 및 청소 범위 확인에 동의합니다.',
    body: `1. 본인은 당일 현장에서 청소 전·후 사진 및 체크리스트를 팀장과 함께 확인하였습니다.

2. 「해당사항 없음」으로 표시된 구역·항목은 당일 청소 범위에 포함되지 않았거나 현장에 해당 공간이 없음을 의미합니다.

3. 체크·사진이 등록되지 않았거나 「해당사항 없음」으로 처리된 구역에 대해, 사후 추가 청소를 요청하실 경우 별도 견적·추가 요금이 발생할 수 있음을 이해하고 동의합니다.

4. 당일 현장에서 별도로 합의하지 않은 작업은 추가·별도 사항으로 간주될 수 있습니다.`,
  },
  {
    id: 'F4_LEADER',
    title: '현장 검수 완료 및 기록의 정확성 (팀장)',
    required: true,
    checkboxLabel: '팀장: 위 현장 검수·기록 의무 및 책임 내용을 확인하였습니다.',
    body: `담당 팀장은 본 체크리스트에 모든 구역의 청소 전·후 사진을 성실히 등록하고, 고객과 함께 최종 확인·서명을 받았음을 확인합니다.

검수·서명·사진 등록을 완료하지 않은 상태에서 서비스를 마감하거나, 허위·누락된 기록으로 인해 발생하는 고객 민원·A/S(C/S) 및 그에 따른 불이익(재방문, 환불·보상 협의, 회사·고객과의 분쟁 대응 등)에 대해, 당일 현장을 총괄한 팀장이 1차 책임을 진다는 점을 팀장이 확인합니다.`,
  },
  {
    id: 'F4_CUSTOMER',
    title: '현장 검수 완료 및 기록의 정확성 (고객)',
    required: true,
    checkboxLabel: '고객: 위 내용을 확인하였습니다.',
    body: '고객은 위 내용을 팀장의 안내 하에 확인하였으며, 당일 확인·서명한 범위를 기준으로 사후 요청이 이루어질 수 있음을 이해합니다.',
  },
  {
    id: 'F5',
    title: '사진·자료의 연구·교육·사례 활용 동의 (선택)',
    required: false,
    checkboxLabel: '위 목적의 자료 활용에 동의합니다.',
    body: `1. 활용 목적: 청소 품질 연구, 직원 교육, 내부·대외 사례 자료 작성

2. 활용 방식: 주소·성명·연락처·얼굴 등 개인을 식별할 수 있는 정보는 가명·모자이크 등 처리 후 활용을 원칙으로 합니다.

3. 보유 기간: 동의 철회 시까지, 최장 서비스 완료일로부터 1년`,
  },
  {
    id: 'EMAIL',
    title: '완료본 수신 이메일',
    required: true,
    checkboxLabel: '위 이메일 주소로 현장 검수 체크리스트 완료본을 수신하는 것에 동의합니다.',
    body: '검수·서명이 완료된 체크리스트 요약본(및 첨부 자료)을 입력한 이메일로 보내 드립니다. 오기입 시 재발송이 어려울 수 있으니 정확히 입력해 주세요.',
  },
];

export const INSPECTION_FINAL_CONFIRM_NOTICE =
  '상기 체크항목·사진·안내 사항을 현장에서 직접 확인하였으며, 위 필수 동의 항목에 모두 동의합니다. 서명 완료 후에는 고객·팀장 모두 내용 수정이 불가하며, 정정이 필요한 경우 관리자 승인 하에만 무효 처리 후 재작성할 수 있습니다.';

export function buildInspectionConsentSnapshot(): {
  templateVersion: string;
  capturedAt: string;
  items: InspectionConsentItem[];
} {
  return {
    templateVersion: INSPECTION_TEMPLATE_VERSION,
    capturedAt: new Date().toISOString(),
    items: INSPECTION_CONSENT_ITEMS.map((item) => ({ ...item })),
  };
}
