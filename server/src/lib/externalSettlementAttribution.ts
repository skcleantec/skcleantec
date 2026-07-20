import type { MarketplaceExternalBuyerMeta } from '../modules/db-marketplace/dbMarketplaceSettlementMeta.js';

type AssignmentRow = {
  teamLeader: {
    role: string;
    externalCompanyId: string | null;
    externalCompany?: { id: string; name: string } | null;
    name?: string | null;
  };
};

export type ExternalSettlementInquiryAttributionInput = {
  id: string;
  cancelFeeExternalCompanyId: string | null;
  cancelFeeExternalCompany?: { id: string; name: string } | null;
  assignments: AssignmentRow[];
};

/** 타업체 정산 귀속 — 배정·취소귀속 우선, 정보공유 인계 확정 listing fallback */
export function resolveExternalSettlementCompanyAttribution(
  inq: ExternalSettlementInquiryAttributionInput,
  isCancelled: boolean,
  marketplaceBuyer?: MarketplaceExternalBuyerMeta | null,
): { companyId: string; companyName: string } | null {
  const extAssign = inq.assignments.find((a) => a.teamLeader.role === 'EXTERNAL_PARTNER');

  if (isCancelled) {
    const cid = inq.cancelFeeExternalCompanyId ?? extAssign?.teamLeader.externalCompanyId ?? null;
    const cname =
      inq.cancelFeeExternalCompany?.name ??
      extAssign?.teamLeader.externalCompany?.name ??
      extAssign?.teamLeader.name ??
      null;
    if (cid && cname) return { companyId: cid, companyName: cname };
    if (marketplaceBuyer) return marketplaceBuyer;
    return null;
  }

  const assignCid = extAssign?.teamLeader.externalCompanyId ?? null;
  const assignCname =
    extAssign?.teamLeader.externalCompany?.name ?? extAssign?.teamLeader.name ?? null;
  if (assignCid && assignCname) return { companyId: assignCid, companyName: assignCname };
  if (marketplaceBuyer) return marketplaceBuyer;
  return null;
}
