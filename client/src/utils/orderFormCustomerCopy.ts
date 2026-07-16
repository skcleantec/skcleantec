import type { OrderFormConfigPublic, OrderFormCreatedBy } from '../api/orderform';
import { ORDER_TIME_SLOT_OPTIONS } from '../constants/orderFormSchedule';
import {
  ORDER_FORM_CONFIG_DEFAULTS,
  orderFormConfigLine,
} from '../constants/orderFormConfigDefaults';
import {
  applyCustomerLinkTemplate,
  resolveCustomerLinkCopy,
  type CustomerLinkCopyConfig,
} from '@shared/orderFormCustomerLinkCopy';
import {
  composeBrandedCsUrlLabel,
  composeBrandedOrderFormTitle,
} from '@shared/publicBrandTitles';
import { appendPublicQuery } from './publicTenantQuery';
import { getReviewPaybackPublicUrl } from './reviewPaybackCustomerCopy';

type FormMsgDefaultKey = keyof typeof ORDER_FORM_CONFIG_DEFAULTS;

export function withDefaultText(raw: string | null | undefined, key: FormMsgDefaultKey): string {
  return orderFormConfigLine(raw, ORDER_FORM_CONFIG_DEFAULTS[key]);
}

const LEGACY_FOOTER_NOTICE2 = '❌ 연락 없을 시, 본사 확인 요청 필';

/** 하단 안내 2 — 기본값 오타(「필」) 저장 건도 「필수」로 보정 */
export function footerNotice2ForMessage(raw: string | null | undefined): string {
  const t = raw != null ? String(raw).trim() : '';
  if (!t || t === LEGACY_FOOTER_NOTICE2) {
    return ORDER_FORM_CONFIG_DEFAULTS.footerNotice2;
  }
  return t;
}

/** 제출 완료 화면·고객 안내 문자 — 하단 안내 1·2 */
export function resolveOrderFormFooterNotices(
  formConfig?: Pick<OrderFormConfigPublic, 'footerNotice1' | 'footerNotice2'> | null,
): { line1: string; line2: string } {
  return {
    line1: withDefaultText(formConfig?.footerNotice1, 'footerNotice1'),
    line2: footerNotice2ForMessage(formConfig?.footerNotice2),
  };
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
  | 'customerLinkTotalLine'
  | 'customerLinkBalanceLine'
  | 'customerLinkScheduleLine'
  | 'customerLinkTimeDetailLine'
  | 'customerLinkOrderIntro'
  | 'customerLinkCsNotice'
  | 'customerLinkCsUrlLabel'
  | 'customerLinkPaybackBlock'
>;

/** API 응답을 편집용 상태로: 비어 있는 항목은 기본 문구로 채워 placeholder 없이 바로 수정 가능 */
export function normalizeMsgConfigForEditor(c: OrderFormConfigPublic): FormMessagesState {
  const linkCopy = resolveCustomerLinkCopy(c);
  return {
    formTitle: withDefaultText(c.formTitle, 'formTitle'),
    priceLabel: withDefaultText(c.priceLabel, 'priceLabel'),
    // 리뷰 문구는 "비우면 숨김" 가능 — null/undefined(미설정)만 기본 문구, ''(명시적 비움)은 그대로 둠
    reviewEventText:
      c.reviewEventText == null
        ? ORDER_FORM_CONFIG_DEFAULTS.reviewEventText
        : c.reviewEventText,
    footerNotice1: withDefaultText(c.footerNotice1, 'footerNotice1'),
    footerNotice2: footerNotice2ForMessage(c.footerNotice2),
    submitSuccessTitle: withDefaultText(c.submitSuccessTitle, 'submitSuccessTitle'),
    submitSuccessBody: withDefaultText(c.submitSuccessBody, 'submitSuccessBody'),
    timeSlotAckTitle: withDefaultText(c.timeSlotAckTitle, 'timeSlotAckTitle'),
    timeSlotAckBody: withDefaultText(c.timeSlotAckBody, 'timeSlotAckBody'),
    timeSlotAckConsentHint: withDefaultText(c.timeSlotAckConsentHint, 'timeSlotAckConsentHint'),
    ...linkCopy,
  };
}

export function customerLinkCopyPayloadFromEditor(
  msg: Pick<FormMessagesState, keyof CustomerLinkCopyConfig>,
): Record<keyof CustomerLinkCopyConfig, string | null> {
  return {
    customerLinkTotalLine: msg.customerLinkTotalLine || null,
    customerLinkBalanceLine: msg.customerLinkBalanceLine || null,
    customerLinkScheduleLine: msg.customerLinkScheduleLine || null,
    customerLinkTimeDetailLine: msg.customerLinkTimeDetailLine || null,
    customerLinkOrderIntro: msg.customerLinkOrderIntro || null,
    customerLinkCsNotice: msg.customerLinkCsNotice || null,
    customerLinkCsUrlLabel: msg.customerLinkCsUrlLabel || null,
    customerLinkPaybackBlock: msg.customerLinkPaybackBlock || null,
  };
}

export type BrandCustomerLinkMsgConfigMap = Record<string, FormMessagesState>;

/** 브랜드별 고객 링크 문구 맵에서 operatingCompanyId에 맞는 설정 반환 */
export function customerLinkMsgConfigForBrand(
  map: BrandCustomerLinkMsgConfigMap | null | undefined,
  operatingCompanyId: string | null | undefined,
  tenantFallback: FormMessagesState,
): FormMessagesState {
  const id = operatingCompanyId?.trim();
  if (id && map?.[id]) return map[id];
  return tenantFallback;
}

/** API 브랜드별 설정 배열 → 맵 */
export function brandCustomerLinkConfigMapFromItems(
  items: Array<
    Pick<
      OrderFormConfigPublic,
      | 'formTitle'
      | 'priceLabel'
      | 'reviewEventText'
      | 'footerNotice1'
      | 'footerNotice2'
      | 'customerLinkTotalLine'
      | 'customerLinkBalanceLine'
      | 'customerLinkScheduleLine'
      | 'customerLinkTimeDetailLine'
      | 'customerLinkOrderIntro'
      | 'customerLinkCsNotice'
      | 'customerLinkCsUrlLabel'
      | 'customerLinkPaybackBlock'
    > & { operatingCompanyId: string }
  >,
): BrandCustomerLinkMsgConfigMap {
  const out: BrandCustomerLinkMsgConfigMap = {};
  for (const item of items) {
    out[item.operatingCompanyId] = normalizeMsgConfigForEditor({
      ...item,
      infoContent: null,
      infoLinkText: null,
      submitSuccessTitle: null,
      submitSuccessBody: null,
    });
  }
  return out;
}

/** 발주서 목록 — 발급자(마케터 이름 / 관리자는 문구만) */
export function labelOrderFormIssuer(user: OrderFormCreatedBy | null | undefined): string {
  if (!user) return '—';
  if (user.role === 'ADMIN') return '관리자';
  if (!user.name?.trim()) return '—';
  return user.name.trim();
}

/** 발주서·접수 embed 영업 브랜드 — URL ?brand= 및 고객 메시지 제목 */
export function orderFormBrandFromOperatingCompany(
  operatingCompany?: { slug?: string | null; displayName?: string | null; name?: string | null } | null,
): { brandSlug: string | null; brandDisplayName: string | null } {
  const brandSlug = operatingCompany?.slug?.trim() || null;
  const brandDisplayName =
    operatingCompany?.displayName?.trim() || operatingCompany?.name?.trim() || null;
  return { brandSlug, brandDisplayName };
}

export function getOrderFormPublicUrl(
  orderToken: string,
  origin?: string,
  tenantSlug?: string | null,
  brandSlug?: string | null,
): string {
  const base =
    origin ??
    (typeof window !== 'undefined' && window.location?.origin ? window.location.origin : '');
  return appendPublicQuery(`${base}/order/${encodeURIComponent(orderToken)}`, {
    tenantSlug,
    brandSlug,
  });
}

export function getCsPublicUrl(
  origin?: string,
  tenantSlug?: string | null,
  brandSlug?: string | null,
): string {
  const base =
    origin ??
    (typeof window !== 'undefined' && window.location?.origin ? window.location.origin : '');
  return appendPublicQuery(`${base}/cs`, { tenantSlug, brandSlug });
}

/** 고객에게 보낼 안내 메시지 (발주서 목록·접수 목록 공통) */
export type OrderFormCustomerMessageInput = {
  token: string;
  customerName?: string | null;
  reviewPaybackToken?: string | null;
  totalAmount: number;
  depositAmount: number;
  balanceAmount: number;
  preferredDate?: string | null;
  preferredTime?: string | null;
  preferredTimeDetail?: string | null;
  optionNote?: string | null;
};

function customerLinkNameVars(customerName?: string | null): {
  customerName: string;
  customerNameHonorific: string;
} {
  const name = customerName?.trim() ?? '';
  return {
    customerName: name,
    customerNameHonorific: name ? `${name}님` : '',
  };
}

function tplLine(text: string, vars: Record<string, string>): string {
  return applyCustomerLinkTemplate(text, vars);
}

export function buildOrderFormCustomerMessage(
  msgConfig: FormMessagesState,
  order: OrderFormCustomerMessageInput,
  origin?: string,
  tenantSlug?: string | null,
  brandSlug?: string | null,
  brandDisplayName?: string | null,
): string {
  const link = getOrderFormPublicUrl(order.token, origin, tenantSlug, brandSlug);
  const csLink = getCsPublicUrl(origin, tenantSlug, brandSlug);
  const linkCopy = resolveCustomerLinkCopy(msgConfig);
  const csUrlLabel = composeBrandedCsUrlLabel(brandDisplayName, linkCopy.customerLinkCsUrlLabel);
  const priceLabel = withDefaultText(msgConfig.priceLabel, 'priceLabel');
  // 리뷰 문구는 비우면 숨김 (normalizeMsgConfigForEditor에서 ''는 그대로 유지)
  const reviewText = (msgConfig.reviewEventText ?? '').trim();
  const footer1 = withDefaultText(msgConfig.footerNotice1, 'footerNotice1');
  const footer2 = footerNotice2ForMessage(msgConfig.footerNotice2);
  const paybackToken = order.reviewPaybackToken?.trim();
  const amountFmt = order.totalAmount.toLocaleString('ko-KR');
  const balanceFmt = order.balanceAmount.toLocaleString('ko-KR');
  const depositFmt = order.depositAmount.toLocaleString('ko-KR');
  const nameVars = customerLinkNameVars(order.customerName);
  const slotLabel =
    order.preferredDate && order.preferredTime
      ? (ORDER_TIME_SLOT_OPTIONS.find((o) => o.value === order.preferredTime)?.label ??
        order.preferredTime)
      : '';
  const baseVars: Record<string, string> = {
    ...nameVars,
    amount: amountFmt,
    priceLabel,
    balance: balanceFmt,
    deposit: depositFmt,
    date: order.preferredDate ?? '',
    timeSlot: slotLabel,
    timeDetail: order.preferredTimeDetail?.trim() ?? '',
    paybackLink: '',
  };

  const formTitleResolved = tplLine(withDefaultText(msgConfig.formTitle, 'formTitle'), baseVars);
  const title = composeBrandedOrderFormTitle(brandDisplayName, formTitleResolved);

  let msg = `${title}

${tplLine(linkCopy.customerLinkTotalLine, baseVars)}
${tplLine(linkCopy.customerLinkBalanceLine, baseVars)}`;
  if (reviewText) msg += `\n${tplLine(reviewText, baseVars)}`;

  if (order.preferredDate && order.preferredTime) {
    msg += `\n${tplLine(linkCopy.customerLinkScheduleLine, baseVars)}`;
  }
  if (order.preferredTimeDetail?.trim()) {
    msg += `\n${tplLine(linkCopy.customerLinkTimeDetailLine, baseVars)}`;
  }
  if (order.optionNote) {
    msg += `\n${order.optionNote}`;
  }

  msg += `

${tplLine(linkCopy.customerLinkOrderIntro, baseVars)}
${link}

${tplLine(linkCopy.customerLinkCsNotice, baseVars)}
${csUrlLabel} ${csLink}`;
  if (paybackToken) {
    const paybackLink = getReviewPaybackPublicUrl(paybackToken, origin, tenantSlug, brandSlug);
    msg += `\n\n${tplLine(linkCopy.customerLinkPaybackBlock, { ...baseVars, paybackLink })}`;
  }

  msg += `

${tplLine(footer1, baseVars)}
${tplLine(footer2, baseVars)}`;

  return msg;
}
