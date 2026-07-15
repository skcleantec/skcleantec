import type { TenantInquiryShareMeta } from '../api/tenantInquiryShare';
import { isActiveNativePartnerShareSource, isExternalLegacyShareSource } from './tenantShareSettlement';

export const MSG_EXTERNAL_BLOCKS_PARTNER_SHARE =
  '타업체 담당이 있는 접수는 파트너 연계할 수 없습니다. 타업체 담당을 해제한 뒤 다시 시도해 주세요.';

export const MSG_PARTNER_SHARE_BLOCKS_EXTERNAL =
  '파트너 연계가 있는 접수는 타업체 담당을 배정할 수 없습니다. 접수 연계를 취소한 뒤 다시 시도해 주세요.';

export function inquiryHasExternalPartnerAssignmentFromAssignments(
  assignments: Array<{ teamLeader?: { role?: string } | null }> | null | undefined,
): boolean {
  return (assignments ?? []).some((a) => a.teamLeader?.role === 'EXTERNAL_PARTNER');
}

export function externalPartnerBlocksPartnerShare(opts: {
  resolvedExternalLeadId: string;
  assignments?: Array<{ teamLeader?: { role?: string } | null }> | null;
}): boolean {
  return (
    Boolean(opts.resolvedExternalLeadId.trim()) ||
    inquiryHasExternalPartnerAssignmentFromAssignments(opts.assignments)
  );
}

export function partnerShareBlocksExternal(
  share: TenantInquiryShareMeta | null | undefined,
): boolean {
  return isActiveNativePartnerShareSource(share);
}

export function externalLegacyShareBlocksPartnerForm(
  share: TenantInquiryShareMeta | null | undefined,
): boolean {
  return isExternalLegacyShareSource(share);
}
