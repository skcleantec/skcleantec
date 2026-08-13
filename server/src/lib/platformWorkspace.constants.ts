/** @see shared/platformWorkspace.ts — 동기화 */

export const PLATFORM_WORKSPACE_DOMAIN = 'service-bridges.com';

export const PLATFORM_BILLING_NOTIFY_GROUP_EMAIL = `billing@${PLATFORM_WORKSPACE_DOMAIN}`;

export const PLATFORM_BILLING_NOTIFY_GROUP_LABEL = '청소비서 · 이용료 입금확인';

export const PLATFORM_SYSTEM_MAIL_FROM = `cbiseo@${PLATFORM_WORKSPACE_DOMAIN}`;

export function formatTenantPaymentConfirmationRequestSubject(tenantName: string): string {
  const name = tenantName.trim() || '업체';
  return `[${name}] 입금확인요청`;
}

export function resolvePlatformBillingNotifyEmail(stored: string | null | undefined): string {
  const trimmed = stored?.trim();
  return trimmed || PLATFORM_BILLING_NOTIFY_GROUP_EMAIL;
}
