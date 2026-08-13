import type { CustomerOutboundEmailPurpose } from '../../lib/outboundEmailPurpose.js';
import { OUTBOUND_EMAIL_PURPOSE_LABELS } from '../../lib/outboundEmailPurpose.js';
import {
  INSPECTION_FOOTER_HTML_DEFAULT,
  INSPECTION_INTRO_HTML_DEFAULT,
  NOREPLY_NOTICE_HTML_DEFAULT,
  ORDER_FORM_FOOTER_HTML_DEFAULT,
  ORDER_FORM_INTRO_HTML_DEFAULT,
} from './platformEmailTemplateHtml.defaults.js';

export type PlatformEmailTemplateDefaults = {
  purpose: CustomerOutboundEmailPurpose;
  label: string;
  subjectTemplate: string;
  headline: string;
  preheader: string;
  introHtml: string;
  footerHtml: string;
  noreplyNoticeHtml: string;
};

const NOREPLY_DEFAULT = NOREPLY_NOTICE_HTML_DEFAULT;

export const PLATFORM_EMAIL_TEMPLATE_DEFAULTS: Record<
  CustomerOutboundEmailPurpose,
  PlatformEmailTemplateDefaults
> = {
  ORDER_FORM_SUBMISSION: {
    purpose: 'ORDER_FORM_SUBMISSION',
    label: OUTBOUND_EMAIL_PURPOSE_LABELS.ORDER_FORM_SUBMISSION,
    subjectTemplate: '[{{brandDisplayName}}] {{customerName}}님 발주서 접수가 완료되었습니다',
    headline: '발주서 접수 완료',
    preheader: '청소비서를 통해 예약 접수가 정상 완료되었습니다.',
    introHtml: ORDER_FORM_INTRO_HTML_DEFAULT,
    footerHtml: ORDER_FORM_FOOTER_HTML_DEFAULT,
    noreplyNoticeHtml: NOREPLY_DEFAULT,
  },
  INSPECTION_COMPLETION: {
    purpose: 'INSPECTION_COMPLETION',
    label: OUTBOUND_EMAIL_PURPOSE_LABELS.INSPECTION_COMPLETION,
    subjectTemplate: '[{{brandDisplayName}}] {{customerName}}님 현장 검수 완료본',
    headline: '현장 검수 완료',
    preheader: '청소비서 현장 검수 결과를 확인해 주세요.',
    introHtml: INSPECTION_INTRO_HTML_DEFAULT,
    footerHtml: INSPECTION_FOOTER_HTML_DEFAULT,
    noreplyNoticeHtml: NOREPLY_DEFAULT,
  },
};

export function getPlatformEmailTemplateDefaults(
  purpose: CustomerOutboundEmailPurpose,
): PlatformEmailTemplateDefaults {
  return PLATFORM_EMAIL_TEMPLATE_DEFAULTS[purpose];
}
