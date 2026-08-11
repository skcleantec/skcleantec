import type { OutboundEmailPurpose } from '../../lib/outboundEmailPurpose.js';
import { OUTBOUND_EMAIL_PURPOSE_LABELS } from '../../lib/outboundEmailPurpose.js';

export type PlatformEmailTemplateDefaults = {
  purpose: OutboundEmailPurpose;
  label: string;
  subjectTemplate: string;
  headline: string;
  preheader: string;
  introHtml: string;
  footerHtml: string;
  noreplyNoticeHtml: string;
};

const NOREPLY_DEFAULT = `<p>본 메일은 발신 전용 주소(noreply)로 발송되었으며 <strong>회신되지 않습니다</strong>. 문의는 업체 연락처 또는 <a href="https://www.cbiseo.com/help">청소비서 고객센터</a>를 이용해 주세요.</p>`;

export const PLATFORM_EMAIL_TEMPLATE_DEFAULTS: Record<
  OutboundEmailPurpose,
  PlatformEmailTemplateDefaults
> = {
  ORDER_FORM_SUBMISSION: {
    purpose: 'ORDER_FORM_SUBMISSION',
    label: OUTBOUND_EMAIL_PURPOSE_LABELS.ORDER_FORM_SUBMISSION,
    subjectTemplate: '[{{brandDisplayName}}] {{customerName}}님 발주서 접수가 완료되었습니다',
    headline: '발주서 접수 완료',
    preheader: '청소비서를 통해 예약 접수가 정상 완료되었습니다.',
    introHtml:
      '<p><strong>{{customerName}}</strong>님, 안녕하세요.</p>' +
      '<p><strong>청소비서</strong>를 통해 <strong>{{brandDisplayName}}</strong>에 청소 예약(발주서) 접수가 정상적으로 완료되었습니다.</p>' +
      '<p>아래는 접수하신 내용 요약입니다.</p>',
    footerHtml:
      '<p>담당자가 일정을 확인한 뒤 연락드릴 수 있습니다.</p>' +
      '<p>청소비서는 입주·이사 청소 예약을 돕는 서비스입니다.</p>',
    noreplyNoticeHtml: NOREPLY_DEFAULT,
  },
  INSPECTION_COMPLETION: {
    purpose: 'INSPECTION_COMPLETION',
    label: OUTBOUND_EMAIL_PURPOSE_LABELS.INSPECTION_COMPLETION,
    subjectTemplate: '[{{brandDisplayName}}] {{customerName}}님 현장 검수 완료본',
    headline: '현장 검수 완료',
    preheader: '청소비서 현장 검수 결과를 확인해 주세요.',
    introHtml:
      '<p><strong>{{customerName}}</strong>님, 안녕하세요.</p>' +
      '<p><strong>청소비서</strong>를 통해 진행된 현장 검수가 완료되었습니다. 아래에서 검수 결과를 확인하실 수 있습니다.</p>',
    footerHtml: '<p>검수 사진·PDF는 아래 링크에서 확인하실 수 있습니다.</p>',
    noreplyNoticeHtml: NOREPLY_DEFAULT,
  },
};

export function getPlatformEmailTemplateDefaults(
  purpose: OutboundEmailPurpose,
): PlatformEmailTemplateDefaults {
  return PLATFORM_EMAIL_TEMPLATE_DEFAULTS[purpose];
}
