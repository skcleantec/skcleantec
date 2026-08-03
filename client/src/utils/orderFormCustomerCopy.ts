import type { OrderFormConfigPublic, OrderFormCreatedBy } from '../api/orderform';
import { labelForTimeSlot } from '../constants/orderFormSchedule';
import {
  ORDER_FORM_CONFIG_DEFAULTS,
  orderFormConfigLine,
} from '../constants/orderFormConfigDefaults';
import {
  applyCustomerLinkTemplate,
  buildDefaultCustomerLinkMessageTemplate,
  finalizeCustomerLinkMessage,
  resolveCustomerLinkCopy,
  type CustomerLinkCopyConfig,
} from '@shared/orderFormCustomerLinkCopy';
import {
  joinCustomerLinkMessageChunks,
  normalizeCustomerLinkBlockOrder,
  ORDER_FORM_CUSTOMER_LINK_BLOCK_META,
  type OrderFormCustomerLinkBlockId,
} from '@shared/orderFormCustomerLinkBlocks';
import {
  composeBrandedCsUrlLabel,
  composeCustomerLinkMessageTitle,
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
  | 'serviceDateAckTitle'
  | 'serviceDateAckBody'
  | 'serviceDateAckConsentHint'
  | 'timeSlotLabelsJson'
  | 'customerLinkTotalLine'
  | 'customerLinkBalanceLine'
  | 'customerLinkScheduleLine'
  | 'customerLinkTimeDetailLine'
  | 'customerLinkOrderIntro'
  | 'customerLinkCsNotice'
  | 'customerLinkCsUrlLabel'
  | 'customerLinkPaybackBlock'
  | 'customerLinkBlockOrder'
  | 'customerLinkMessageTemplate'
>;

/** API 응답을 편집용 상태로: 비어 있는 항목은 기본 문구로 채워 placeholder 없이 바로 수정 가능 */
export function normalizeMsgConfigForEditor(c: OrderFormConfigPublic): FormMessagesState {
  const linkCopy = resolveCustomerLinkCopy(c);
  const reviewEventText =
    c.reviewEventText == null
      ? ORDER_FORM_CONFIG_DEFAULTS.reviewEventText
      : c.reviewEventText;
  const footerNotice1 = withDefaultText(c.footerNotice1, 'footerNotice1');
  const footerNotice2 = footerNotice2ForMessage(c.footerNotice2);
  const templateRaw = c.customerLinkMessageTemplate?.trim() ?? '';
  return {
    formTitle: withDefaultText(c.formTitle, 'formTitle'),
    priceLabel: withDefaultText(c.priceLabel, 'priceLabel'),
    // 리뷰 문구는 "비우면 숨김" 가능 — null/undefined(미설정)만 기본 문구, ''(명시적 비움)은 그대로 둠
    reviewEventText,
    footerNotice1,
    footerNotice2,
    submitSuccessTitle: withDefaultText(c.submitSuccessTitle, 'submitSuccessTitle'),
    submitSuccessBody: withDefaultText(c.submitSuccessBody, 'submitSuccessBody'),
    timeSlotAckTitle: withDefaultText(c.timeSlotAckTitle, 'timeSlotAckTitle'),
    timeSlotAckBody: withDefaultText(c.timeSlotAckBody, 'timeSlotAckBody'),
    timeSlotAckConsentHint: withDefaultText(c.timeSlotAckConsentHint, 'timeSlotAckConsentHint'),
    serviceDateAckTitle: withDefaultText(c.serviceDateAckTitle, 'serviceDateAckTitle'),
    serviceDateAckBody: withDefaultText(c.serviceDateAckBody, 'serviceDateAckBody'),
    serviceDateAckConsentHint: withDefaultText(c.serviceDateAckConsentHint, 'serviceDateAckConsentHint'),
    ...linkCopy,
    customerLinkBlockOrder: normalizeCustomerLinkBlockOrder(c.customerLinkBlockOrder),
    customerLinkMessageTemplate:
      templateRaw ||
      buildDefaultCustomerLinkMessageTemplate({
        formTitle: c.formTitle,
        ...linkCopy,
        reviewEventText,
        footerNotice1,
        footerNotice2,
      }),
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
      | 'customerLinkBlockOrder'
      | 'customerLinkMessageTemplate'
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

/** 페이백 토큰 없을 때 자유 본문의 페이백 안내 단락 제거 */
function stripEmptyPaybackFreeform(text: string): string {
  const lines = text.split('\n');
  const out: string[] = [];
  let skipping = false;
  for (const line of lines) {
    const t = line.trim();
    if (!skipping && (/\u2605\s*리뷰\s*페이백|리뷰\s*페이백\s*신청|페이백\s*신청\s*:/i.test(t) || /^★/.test(t) && /페이백/.test(t))) {
      skipping = true;
      continue;
    }
    if (skipping) {
      if (t === '') {
        skipping = false;
      }
      continue;
    }
    out.push(line);
  }
  return out.join('\n');
}

function renderCustomerLinkBlockText(
  blockId: OrderFormCustomerLinkBlockId,
  ctx: {
    msgConfig: FormMessagesState;
    order: OrderFormCustomerMessageInput;
    origin?: string;
    tenantSlug?: string | null;
    brandSlug?: string | null;
    brandDisplayName?: string | null;
    linkCopy: ReturnType<typeof resolveCustomerLinkCopy>;
    baseVars: Record<string, string>;
    link: string;
    csLink: string;
    csUrlLabel: string;
    reviewText: string;
    footer1: string;
    footer2: string;
    paybackToken: string;
  },
): string | null {
  const { linkCopy, baseVars, order } = ctx;
  switch (blockId) {
    case 'title': {
      const formTitleResolved = tplLine(withDefaultText(ctx.msgConfig.formTitle, 'formTitle'), baseVars);
      return composeCustomerLinkMessageTitle(ctx.brandDisplayName, formTitleResolved);
    }
    case 'total':
      return tplLine(linkCopy.customerLinkTotalLine, baseVars);
    case 'balance':
      return tplLine(linkCopy.customerLinkBalanceLine, baseVars);
    case 'review':
      return ctx.reviewText ? tplLine(ctx.reviewText, baseVars) : null;
    case 'schedule':
      return order.preferredDate && order.preferredTime
        ? tplLine(linkCopy.customerLinkScheduleLine, baseVars)
        : null;
    case 'timeDetail':
      return order.preferredTimeDetail?.trim()
        ? tplLine(linkCopy.customerLinkTimeDetailLine, baseVars)
        : null;
    case 'optionNote': {
      const note = order.optionNote?.trim();
      return note || null;
    }
    case 'order':
      return `${tplLine(linkCopy.customerLinkOrderIntro, baseVars)}\n${ctx.link}`;
    case 'cs':
      return `${tplLine(linkCopy.customerLinkCsNotice, baseVars)}\n${ctx.csUrlLabel} ${ctx.csLink}`;
    case 'payback': {
      if (!ctx.paybackToken) return null;
      const paybackLink = getReviewPaybackPublicUrl(
        ctx.paybackToken,
        ctx.origin,
        ctx.tenantSlug,
        ctx.brandSlug,
      );
      return tplLine(linkCopy.customerLinkPaybackBlock, { ...baseVars, paybackLink });
    }
    case 'footer1':
      return tplLine(ctx.footer1, baseVars);
    case 'footer2':
      return tplLine(ctx.footer2, baseVars);
    default:
      return null;
  }
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
  const reviewText = (msgConfig.reviewEventText ?? '').trim();
  const footer1 = withDefaultText(msgConfig.footerNotice1, 'footerNotice1');
  const footer2 = footerNotice2ForMessage(msgConfig.footerNotice2);
  const paybackToken = order.reviewPaybackToken?.trim() ?? '';
  const amountFmt = order.totalAmount.toLocaleString('ko-KR');
  const balanceFmt = order.balanceAmount.toLocaleString('ko-KR');
  const depositFmt = order.depositAmount.toLocaleString('ko-KR');
  const nameVars = customerLinkNameVars(order.customerName);
  const slotLabel =
    order.preferredDate && order.preferredTime
      ? labelForTimeSlot(
          order.preferredTime,
          msgConfig.timeSlotLabelsJson ?? undefined,
        )
      : '';
  const paybackLink = paybackToken
    ? getReviewPaybackPublicUrl(paybackToken, origin, tenantSlug, brandSlug)
    : '';
  const formTitleResolved = tplLine(withDefaultText(msgConfig.formTitle, 'formTitle'), {
    ...nameVars,
    amount: amountFmt,
    priceLabel,
    balance: balanceFmt,
    deposit: depositFmt,
    date: order.preferredDate ?? '',
    timeSlot: slotLabel,
    timeDetail: order.preferredTimeDetail?.trim() ?? '',
  });
  const messageTitle = composeCustomerLinkMessageTitle(brandDisplayName, formTitleResolved);
  const brandName = brandDisplayName?.trim() ?? '';

  const hasSchedule = Boolean(order.preferredDate && order.preferredTime);
  const timeDetailRaw = order.preferredTimeDetail?.trim() ?? '';
  const scheduleLine = hasSchedule
    ? tplLine(linkCopy.customerLinkScheduleLine, {
        ...nameVars,
        amount: amountFmt,
        priceLabel,
        balance: balanceFmt,
        deposit: depositFmt,
        date: order.preferredDate ?? '',
        timeSlot: slotLabel,
        timeDetail: timeDetailRaw,
      })
    : '';
  const timeDetailLine = timeDetailRaw
    ? tplLine(linkCopy.customerLinkTimeDetailLine, {
        ...nameVars,
        date: order.preferredDate ?? '',
        timeSlot: slotLabel,
        timeDetail: timeDetailRaw,
      })
    : '';
  const paybackSection = paybackToken
    ? tplLine(linkCopy.customerLinkPaybackBlock, {
        ...nameVars,
        amount: amountFmt,
        priceLabel,
        balance: balanceFmt,
        deposit: depositFmt,
        paybackLink,
      })
    : '';

  const baseVars: Record<string, string> = {
    ...nameVars,
    messageTitle,
    brandName,
    amount: amountFmt,
    priceLabel,
    balance: balanceFmt,
    deposit: depositFmt,
    date: hasSchedule ? (order.preferredDate ?? '') : '',
    timeSlot: hasSchedule ? slotLabel : '',
    timeDetail: timeDetailRaw,
    scheduleLine,
    timeDetailLine,
    optionNote: order.optionNote?.trim() ?? '',
    reviewEvent: reviewText,
    orderLink: link,
    csLink,
    csUrlLabel,
    paybackLink,
    paybackSection,
    footer1,
    footer2,
  };

  const freeform = (msgConfig.customerLinkMessageTemplate ?? '').trim();
  if (freeform) {
    let rendered = applyCustomerLinkTemplate(freeform, baseVars);
    // 「{{brandName}} 발주서」인데 브랜드가 없으면 설정 제목으로 대체
    if (!brandName) {
      rendered = rendered.replace(/^\s*발주서\s*$/m, formTitleResolved);
    }
    if (!paybackToken) {
      rendered = stripEmptyPaybackFreeform(rendered);
    }
    return finalizeCustomerLinkMessage(rendered);
  }

  const ctx = {
    msgConfig,
    order,
    origin,
    tenantSlug,
    brandSlug,
    brandDisplayName,
    linkCopy,
    baseVars,
    link,
    csLink,
    csUrlLabel,
    reviewText,
    footer1,
    footer2,
    paybackToken,
  };

  const orderIds = normalizeCustomerLinkBlockOrder(msgConfig.customerLinkBlockOrder);
  const chunks: Array<{ spacing: 'line' | 'section'; text: string }> = [];
  for (const blockId of orderIds) {
    const text = renderCustomerLinkBlockText(blockId, ctx);
    if (!text) continue;
    chunks.push({
      spacing: ORDER_FORM_CUSTOMER_LINK_BLOCK_META[blockId].spacing,
      text,
    });
  }
  return finalizeCustomerLinkMessage(joinCustomerLinkMessageChunks(chunks));
}
