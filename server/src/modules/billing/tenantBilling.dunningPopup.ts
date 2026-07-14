/** @see shared/tenantBilling.ts — resolveTenantBillingDunningPopupContent 동기화 */

export type TenantBillingDunningPopupContent = {
  title: string;
  subtitle: string;
  body: string;
  blockSoonText: string;
  blockTodayText: string;
};

export const TENANT_BILLING_DUNNING_POPUP_DEFAULTS: TenantBillingDunningPopupContent = {
  title: '이용료 납부 안내',
  subtitle: '납부기한이 지난 청구가 있습니다',
  body: '청소비서 이용료를 아직 확인하지 못했습니다. 입금 후에도 반영까지 시간이 걸릴 수 있습니다.',
  blockSoonText: '{days}일 후 업무 접속이 제한됩니다',
  blockTodayText: '오늘 중 업무 접속이 제한될 수 있습니다. 즉시 납부해 주세요.',
};

export function resolveTenantBillingDunningPopupContent(raw: {
  dunningPopupTitle?: string | null;
  dunningPopupSubtitle?: string | null;
  dunningPopupBody?: string | null;
  dunningBlockSoonText?: string | null;
  dunningBlockTodayText?: string | null;
}): TenantBillingDunningPopupContent {
  return {
    title: raw.dunningPopupTitle?.trim() || TENANT_BILLING_DUNNING_POPUP_DEFAULTS.title,
    subtitle: raw.dunningPopupSubtitle?.trim() || TENANT_BILLING_DUNNING_POPUP_DEFAULTS.subtitle,
    body: raw.dunningPopupBody?.trim() || TENANT_BILLING_DUNNING_POPUP_DEFAULTS.body,
    blockSoonText: raw.dunningBlockSoonText?.trim() || TENANT_BILLING_DUNNING_POPUP_DEFAULTS.blockSoonText,
    blockTodayText: raw.dunningBlockTodayText?.trim() || TENANT_BILLING_DUNNING_POPUP_DEFAULTS.blockTodayText,
  };
}
