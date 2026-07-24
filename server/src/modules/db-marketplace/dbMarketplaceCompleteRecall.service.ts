import { DbMarketplaceError } from './dbMarketplace.service.js';
import { stepRecallDbListing } from './dbMarketplaceStepRecall.service.js';

export type DbMarketplaceCompleteRecallResult = {
  inquiryId: string;
  /** 정산에 환불 반영된 정보공유 수수료(listingFee) */
  refundListingFee: number;
  listingFee: number;
  buyerLabel: string | null;
};

/** @deprecated seller-complete-recall — stepRecallDbListing(mode: complete) 사용 */
export async function completeRecallDbListing(opts: {
  sellerTenantId: string;
  sellerUserId: string;
  listingId: string;
  password: string;
}): Promise<DbMarketplaceCompleteRecallResult> {
  const result = await stepRecallDbListing({
    ...opts,
    mode: 'complete',
  });
  return {
    inquiryId: result.inquiryId,
    refundListingFee: result.listingFee,
    listingFee: result.listingFee,
    buyerLabel: result.buyerLabel,
  };
}

