import type { OrderFormConfigPublic, OrderFormCreatedBy } from '../api/orderform';
import { ORDER_TIME_SLOT_OPTIONS } from '../constants/orderFormSchedule';
import {
  ORDER_FORM_CONFIG_DEFAULTS,
  orderFormConfigLine,
} from '../constants/orderFormConfigDefaults';
import { appendPublicTenantQuery } from './publicTenantQuery';

type FormMsgDefaultKey = keyof typeof ORDER_FORM_CONFIG_DEFAULTS;

export function withDefaultText(raw: string | null | undefined, key: FormMsgDefaultKey): string {
  return orderFormConfigLine(raw, ORDER_FORM_CONFIG_DEFAULTS[key]);
}

/** 폼 메시지 필드 — 편집 UI는 발주서 미리보기·설정 탭 연계 (고객 안내 본문은 안내사항설정에서 편집) */
export type FormMessagesState = Pick<
  OrderFormConfigPublic,
  | 'formTitle'
  | 'priceLabel'
  | 'reviewEventText'
  | 'footerNotice1'
  | 'footerNotice2'
  | 'submitSuccessTitle'
  | 'submitSuccessBody'
  | 'timeSlotAckTitle'
  | 'timeSlotAckBody'
  | 'timeSlotAckConsentHint'
>;

/** API 응답을 편집용 상태로: 비어 있는 항목은 기본 문구로 채워 placeholder 없이 바로 수정 가능 */
export function normalizeMsgConfigForEditor(c: OrderFormConfigPublic): FormMessagesState {
  return {
    formTitle: withDefaultText(c.formTitle, 'formTitle'),
    priceLabel: withDefaultText(c.priceLabel, 'priceLabel'),
    // 리뷰 문구는 "비우면 숨김" 가능 — null/undefined(미설정)만 기본 문구, ''(명시적 비움)은 그대로 둠
    reviewEventText:
      c.reviewEventText == null
        ? ORDER_FORM_CONFIG_DEFAULTS.reviewEventText
        : c.reviewEventText,
    footerNotice1: withDefaultText(c.footerNotice1, 'footerNotice1'),
    footerNotice2: withDefaultText(c.footerNotice2, 'footerNotice2'),
    submitSuccessTitle: withDefaultText(c.submitSuccessTitle, 'submitSuccessTitle'),
    submitSuccessBody: withDefaultText(c.submitSuccessBody, 'submitSuccessBody'),
    timeSlotAckTitle: withDefaultText(c.timeSlotAckTitle, 'timeSlotAckTitle'),
    timeSlotAckBody: withDefaultText(c.timeSlotAckBody, 'timeSlotAckBody'),
    timeSlotAckConsentHint: withDefaultText(c.timeSlotAckConsentHint, 'timeSlotAckConsentHint'),
  };
}

/** 발주서 목록 — 발급자(마케터 이름 / 관리자는 문구만) */
export function labelOrderFormIssuer(user: OrderFormCreatedBy | null | undefined): string {
  if (!user) return '—';
  if (user.role === 'ADMIN') return '관리자';
  if (!user.name?.trim()) return '—';
  return user.name.trim();
}

export function getOrderFormPublicUrl(orderToken: string, origin?: string, tenantSlug?: string | null): string {
  const base =
    origin ??
    (typeof window !== 'undefined' && window.location?.origin ? window.location.origin : '');
  return appendPublicTenantQuery(`${base}/order/${encodeURIComponent(orderToken)}`, tenantSlug);
}

export function getCsPublicUrl(origin?: string, tenantSlug?: string | null): string {
  const base =
    origin ??
    (typeof window !== 'undefined' && window.location?.origin ? window.location.origin : '');
  return appendPublicTenantQuery(`${base}/cs`, tenantSlug);
}

/** 고객에게 보낼 안내 메시지 (발주서 목록·접수 목록 공통) */
export function buildOrderFormCustomerMessage(
  msgConfig: FormMessagesState,
  order: {
    token: string;
    totalAmount: number;
    depositAmount: number;
    balanceAmount: number;
    preferredDate?: string | null;
    preferredTime?: string | null;
    preferredTimeDetail?: string | null;
    optionNote?: string | null;
  },
  origin?: string
): string {
  const link = getOrderFormPublicUrl(order.token, origin);
  const csLink = getCsPublicUrl(origin);
  const title = withDefaultText(msgConfig.formTitle, 'formTitle');
  const priceLabel = withDefaultText(msgConfig.priceLabel, 'priceLabel');
  // 리뷰 문구는 비우면 숨김 (normalizeMsgConfigForEditor에서 ''는 그대로 유지)
  const reviewText = (msgConfig.reviewEventText ?? '').trim();
  const footer1 = withDefaultText(msgConfig.footerNotice1, 'footerNotice1');
  const footer2 = withDefaultText(msgConfig.footerNotice2, 'footerNotice2');

  let msg = `${title}

총 금액 ${order.totalAmount.toLocaleString('ko-KR')}원 ${priceLabel}
잔금 ${order.balanceAmount.toLocaleString('ko-KR')}원, 예약금 ${order.depositAmount.toLocaleString('ko-KR')}원`;
  if (reviewText) msg += `\n${reviewText}`;

  if (order.preferredDate && order.preferredTime) {
    const slotLabel =
      ORDER_TIME_SLOT_OPTIONS.find((o) => o.value === order.preferredTime)?.label ??
      order.preferredTime;
    msg += `\n청소일시: ${order.preferredDate} (${slotLabel})`;
  }
  if (order.preferredTimeDetail?.trim()) {
    msg += `\n희망 시각: ${order.preferredTimeDetail.trim()}`;
  }
  if (order.optionNote) {
    msg += `\n${order.optionNote}`;
  }

  msg += `

아래 링크에서 예약확정서를 작성해 주세요.
${link}

청소 후 청소팀 태도, 고객 불편 관련 신고는 본사에 직접 요청해주시면 바로 시정처리 해드리겠습니다.
신고 URL: ${csLink}

${footer1}
${footer2}`;

  return msg;
}
