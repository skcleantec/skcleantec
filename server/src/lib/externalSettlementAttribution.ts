import type { MarketplaceExternalBuyerMeta } from '../modules/db-marketplace/dbMarketplaceSettlementMeta.js';

type AssignmentRow = {
  teamLeader: {
    role: string;
    externalCompanyId: string | null;
    externalCompany?: { id: string; name: string } | null;
    name?: string | null;
  };
};

export type TenantShareAsSourceRow = {
  syncStatus: string;
  settlementMode: string;
  settlementExternalCompanyId: string | null;
  settlementExternalCompany?: { id: string; name: string } | null;
} | null;

export type HybridLegacySettlementMeta = { companyId: string; companyName: string };

export type ExternalSettlementInquiryAttributionInput = {
  id: string;
  cancelFeeExternalCompanyId: string | null;
  cancelFeeExternalCompany?: { id: string; name: string } | null;
  assignments: AssignmentRow[];
  hybridLegacySettlement?: HybridLegacySettlementMeta | null;
};

export function hybridLegacySettlementFromShare(
  share: TenantShareAsSourceRow | undefined,
): HybridLegacySettlementMeta | null {
  if (!share || share.syncStatus !== 'ACTIVE' || share.settlementMode !== 'EXTERNAL_LEGACY') return null;
  if (!share.settlementExternalCompanyId) return null;
  return {
    companyId: share.settlementExternalCompanyId,
    companyName: share.settlementExternalCompany?.name ?? share.settlementExternalCompanyId,
  };
}

/** 타업체 정산 귀속 — 정보공유 인계 확정 listing 우선(overview SQL과 동일), 취소는 cancelFee 우선 */
export function resolveExternalSettlementCompanyAttribution(
  inq: ExternalSettlementInquiryAttributionInput,
  isCancelled: boolean,
  marketplaceBuyer?: MarketplaceExternalBuyerMeta | null,
): { companyId: string; companyName: string } | null {
  const extAssign = inq.assignments.find((a) => a.teamLeader.role === 'EXTERNAL_PARTNER');
  const hybrid = inq.hybridLegacySettlement ?? null;

  if (isCancelled) {
    if (inq.cancelFeeExternalCompanyId) {
      const cname =
        inq.cancelFeeExternalCompany?.name ??
        extAssign?.teamLeader.externalCompany?.name ??
        extAssign?.teamLeader.name ??
        inq.cancelFeeExternalCompanyId;
      return { companyId: inq.cancelFeeExternalCompanyId, companyName: cname };
    }
    if (marketplaceBuyer) return marketplaceBuyer;
    const assignCid = extAssign?.teamLeader.externalCompanyId ?? null;
    const assignCname =
      extAssign?.teamLeader.externalCompany?.name ?? extAssign?.teamLeader.name ?? null;
    if (assignCid) return { companyId: assignCid, companyName: assignCname ?? assignCid };
    if (hybrid) return hybrid;
    return null;
  }

  if (marketplaceBuyer) return marketplaceBuyer;

  const assignCid = extAssign?.teamLeader.externalCompanyId ?? null;
  const assignCname =
    extAssign?.teamLeader.externalCompany?.name ?? extAssign?.teamLeader.name ?? null;
  if (assignCid) return { companyId: assignCid, companyName: assignCname ?? assignCid };
  if (hybrid) return hybrid;
  return null;
}

export function inquiryAttributedToExternalCompany(
  inq: ExternalSettlementInquiryAttributionInput,
  isCancelled: boolean,
  marketplaceBuyer: MarketplaceExternalBuyerMeta | null | undefined,
  externalCompanyId: string,
): boolean {
  return (
    resolveExternalSettlementCompanyAttribution(inq, isCancelled, marketplaceBuyer)?.companyId ===
    externalCompanyId
  );
}
