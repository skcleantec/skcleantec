/** 발주서 고객 링크 메시지 — 치환 명령어 카탈로그 (설정 UI·빌더 공통) */
export type OrderFormLinkPlaceholderId =
  | 'customerName'
  | 'customerNameHonorific'
  | 'amount'
  | 'priceLabel'
  | 'balance'
  | 'deposit'
  | 'date'
  | 'timeSlot'
  | 'timeDetail'
  | 'paybackLink';

export type OrderFormLinkPlaceholderDef = {
  id: OrderFormLinkPlaceholderId;
  token: string;
  label: string;
  description: string;
};

export const ORDER_FORM_LINK_PLACEHOLDERS: readonly OrderFormLinkPlaceholderDef[] = [
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
    description: '성함 + 님 (예: 홍길동님)',
  },
  {
    id: 'amount',
    token: '{{amount}}',
    label: '총액',
    description: '천 단위 콤마 숫자',
  },
  {
    id: 'priceLabel',
    token: '{{priceLabel}}',
    label: '금액 라벨',
    description: '금액 옆 괄호 라벨 (예: 특가)',
  },
  {
    id: 'balance',
    token: '{{balance}}',
    label: '잔금',
    description: '잔금 금액',
  },
  {
    id: 'deposit',
    token: '{{deposit}}',
    label: '예약금',
    description: '예약금 금액',
  },
  {
    id: 'date',
    token: '{{date}}',
    label: '청소 예약일',
    description: 'YYYY-MM-DD',
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
    description: '상세 시각',
  },
  {
    id: 'paybackLink',
    token: '{{paybackLink}}',
    label: '페이백 링크',
    description: '리뷰 페이백 URL (토큰 있을 때)',
  },
] as const;

export function orderFormLinkPlaceholderByToken(token: string): OrderFormLinkPlaceholderDef | undefined {
  return ORDER_FORM_LINK_PLACEHOLDERS.find((p) => p.token === token);
}
