/**
 * @generated-sync from shared/inspectionCompletionValidation.ts — 직접 수정하지 마세요.
 * 변경: shared/inspectionCompletionValidation.ts 수정 후 `npm run sync:inquiry-inspection-shared` (prebuild/predev 자동).
 */

export type InspectionCompletionIssue = {
  code: string;
  message: string;
};

export type InspectionCompletionFields = {
  customerEmail: string | null | undefined;
  consentPersonalInfo: boolean;
  consentThirdParty: boolean;
  consentScopeConfirm: boolean;
  consentLeaderLiability: boolean;
  consentCustomerConfirm: boolean;
  consentEmailDelivery: boolean;
  signatureSecureUrl: string | null | undefined;
  signaturePublicId: string | null | undefined;
};

export function collectInspectionCompletionIssues(
  fields: InspectionCompletionFields,
): InspectionCompletionIssue[] {
  const issues: InspectionCompletionIssue[] = [];

  const email = fields.customerEmail?.trim() ?? '';
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    issues.push({ code: 'email_invalid', message: '완료본 수신 이메일을 올바르게 입력해 주세요.' });
  }

  if (!fields.consentPersonalInfo) {
    issues.push({ code: 'consent_f1', message: '개인정보 수집·이용 동의가 필요합니다.' });
  }
  if (!fields.consentThirdParty) {
    issues.push({ code: 'consent_f2', message: '개인정보 제3자 제공 동의가 필요합니다.' });
  }
  if (!fields.consentScopeConfirm) {
    issues.push({ code: 'consent_f3', message: '현장 검수 및 청소 범위 확인 동의가 필요합니다.' });
  }
  if (!fields.consentLeaderLiability) {
    issues.push({ code: 'consent_f4_leader', message: '팀장 책임 확인 체크가 필요합니다.' });
  }
  if (!fields.consentCustomerConfirm) {
    issues.push({ code: 'consent_f4_customer', message: '고객 확인 체크가 필요합니다.' });
  }
  if (!fields.consentEmailDelivery) {
    issues.push({ code: 'consent_email', message: '완료본 이메일 수신 동의가 필요합니다.' });
  }

  if (!fields.signatureSecureUrl?.trim() || !fields.signaturePublicId?.trim()) {
    issues.push({ code: 'signature_missing', message: '고객 서명이 필요합니다.' });
  }

  return issues;
}
