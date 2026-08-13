/** Service Bridges Google Workspace — 플랫폼 운영·알림 메일 도메인 */
export const PLATFORM_WORKSPACE_DOMAIN = 'service-bridges.com';

/** (참고) Workspace 그룹 예시 — 자동 수신 주소로 쓰지 않음 */
export const PLATFORM_BILLING_NOTIFY_GROUP_EMAIL = `billing@${PLATFORM_WORKSPACE_DOMAIN}`;

/** Google 그룹 표시 이름 (워크스페이스 콘솔·수신함 참고용) */
export const PLATFORM_BILLING_NOTIFY_GROUP_LABEL = '청소비서 · 이용료 입금확인';

/** 플랫폼 시스템 메일 발송 계정 (SMTP From) */
export const PLATFORM_SYSTEM_MAIL_FROM = `cbiseo@${PLATFORM_WORKSPACE_DOMAIN}`;

/** 입금 확인 요청 알림 메일 제목 — 예: [클린느] 입금확인요청 */
export function formatTenantPaymentConfirmationRequestSubject(tenantName: string): string {
  const name = tenantName.trim() || '업체';
  return `[${name}] 입금확인요청`;
}

/** DB에 저장된 입금 확인 알림 수신 이메일 (비어 있으면 빈 문자열 — billing@ 자동 기본값 없음) */
export function resolvePlatformBillingNotifyEmail(stored: string | null | undefined): string {
  return stored?.trim() ?? '';
}
