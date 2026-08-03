/** 발주서 고객 링크 메시지 — 치환 명령어 카탈로그 (설정 UI·빌더 공통) */
export type OrderFormLinkPlaceholderId =
  | 'brandName'
  | 'messageTitle'
  | 'customerName'
  | 'customerNameHonorific'
  | 'amount'
  | 'priceLabel'
  | 'balance'
  | 'deposit'
  | 'date'
  | 'timeSlot'
  | 'timeDetail'
  | 'optionNote'
  | 'reviewEvent'
  | 'orderLink'
  | 'csLink'
  | 'csUrlLabel'
  | 'paybackLink'
  | 'footer1'
  | 'footer2'
  | 'scheduleLine'
  | 'timeDetailLine'
  | 'paybackSection';

export type OrderFormLinkPlaceholderDef = {
  id: OrderFormLinkPlaceholderId;
  token: string;
  label: string;
  description: string;
  /** 문장 통째 — 라벨 수정이 어려움. UI에서 아래로 배치 */
  composite?: boolean;
};

/** 값만 들어가는 치환(권장) — 앞뒤 글자는 본문에서 직접 수정 */
export const ORDER_FORM_LINK_PLACEHOLDERS: readonly OrderFormLinkPlaceholderDef[] = [
  {
    id: 'brandName',
    token: '{{brandName}}',
    label: '브랜드명',
    description: '예: SK클린텍 — 「{{brandName}} 발주서」처럼 글자와 섞어 쓰세요',
  },
  {
    id: 'customerName',
    token: '{{customerName}}',
    label: '고객명',
    description: '발급 폼에 입력한 성함',
  },
  {
    id: 'customerNameHonorific',
    token: '{{customerNameHonorific}}',
    label: '고객명(님)',
    description: '성함 + 님',
  },
  {
    id: 'amount',
    token: '{{amount}}',
    label: '총액',
    description: '예: 총 금액 {{amount}}원',
  },
  {
    id: 'priceLabel',
    token: '{{priceLabel}}',
    label: '금액 라벨',
    description: '예: (특가)',
  },
  {
    id: 'balance',
    token: '{{balance}}',
    label: '잔금',
    description: '잔금 숫자만',
  },
  {
    id: 'deposit',
    token: '{{deposit}}',
    label: '예약금',
    description: '예약금 숫자만',
  },
  {
    id: 'date',
    token: '{{date}}',
    label: '청소 예약일',
    description: '예: 실제청소일시: {{date}} ({{timeSlot}})',
  },
  {
    id: 'timeSlot',
    token: '{{timeSlot}}',
    label: '시간대',
    description: '오전·오후·사이 등',
  },
  {
    id: 'timeDetail',
    token: '{{timeDetail}}',
    label: '희망 시각',
    description: '예: 희망 시각: {{timeDetail}}',
  },
  {
    id: 'optionNote',
    token: '{{optionNote}}',
    label: '옵션·특이사항',
    description: '발급 건 메모 (없으면 빈칸)',
  },
  {
    id: 'orderLink',
    token: '{{orderLink}}',
    label: '발주서 링크',
    description: '고객 발주서 URL만',
  },
  {
    id: 'csLink',
    token: '{{csLink}}',
    label: 'C/S 링크',
    description: 'C/S URL만 — 앞 라벨은 글자로 쓰세요',
  },
  {
    id: 'paybackLink',
    token: '{{paybackLink}}',
    label: '페이백 링크',
    description: '예: 페이백 신청: {{paybackLink}}',
  },
  {
    id: 'messageTitle',
    token: '{{messageTitle}}',
    label: '메시지 제목(통째)',
    description: '브랜드 규칙이 적용된 제목 한 줄',
    composite: true,
  },
  {
    id: 'reviewEvent',
    token: '{{reviewEvent}}',
    label: '리뷰 문구(통째)',
    description: '설정에 저장된 리뷰 안내 전체',
    composite: true,
  },
  {
    id: 'csUrlLabel',
    token: '{{csUrlLabel}}',
    label: 'C/S 라벨(통째)',
    description: '신고 URL: 또는 브랜드 C/S — 글자로 쓰는 편을 권장',
    composite: true,
  },
  {
    id: 'footer1',
    token: '{{footer1}}',
    label: '하단 안내 1(통째)',
    description: '하단 문구 전체 — 본문에 글자로 쓰는 편을 권장',
    composite: true,
  },
  {
    id: 'footer2',
    token: '{{footer2}}',
    label: '하단 안내 2(통째)',
    description: '하단 문구 전체',
    composite: true,
  },
  {
    id: 'scheduleLine',
    token: '{{scheduleLine}}',
    label: '청소일시 줄(통째)',
    description: '「청소일시: 날짜…」전체 — 라벨을 바꾸려면 {{date}}를 쓰세요',
    composite: true,
  },
  {
    id: 'timeDetailLine',
    token: '{{timeDetailLine}}',
    label: '희망 시각 줄(통째)',
    description: '라벨을 바꾸려면 {{timeDetail}}를 쓰세요',
    composite: true,
  },
  {
    id: 'paybackSection',
    token: '{{paybackSection}}',
    label: '페이백 블록(통째)',
    description: '페이백 안내 전체 — 문구 수정은 {{paybackLink}}와 글자 조합을 권장',
    composite: true,
  },
] as const;

export function orderFormLinkPlaceholderByToken(token: string): OrderFormLinkPlaceholderDef | undefined {
  return ORDER_FORM_LINK_PLACEHOLDERS.find((p) => p.token === token);
}
