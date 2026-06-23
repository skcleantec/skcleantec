import type { Inquiry } from '@prisma/client';
import {
  computeMarketplaceDisplayAmount,
} from '../../lib/dbMarketplaceAmount.js';
import {
  maskMarketplaceAddressRegion,
  maskMarketplaceCustomerName,
} from '../../lib/marketplaceListingMask.js';

/** 마켓 목록·구매 전 상세 — PII 마스킹 + 표시금액만 */
export type MarketplaceListingMaskedDto = {
  id: string;
  sellerTenantId: string;
  sellerTenantName: string;
  status: string;
  visibility: string;
  displayAmount: number | null;
  publishedAt: string | null;
  customerNameMasked: string;
  addressRegion: string;
  propertyType: string | null;
  areaPyeong: number | null;
  areaBasis: string | null;
  exclusiveAreaSqm: number | null;
  isOneRoom: boolean;
  roomCount: number | null;
  bathroomCount: number | null;
  balconyCount: number | null;
  kitchenCount: number | null;
  buildingType: string | null;
  preferredDate: string | null;
  preferredTime: string | null;
  preferredTimeDetail: string | null;
  betweenScheduleSlot: string | null;
  specialNotes: string | null;
  memo: string | null;
  moveInDate: string | null;
  moveInDateUndecided: boolean;
  role: 'SELLER' | 'BUYER' | 'VIEWER';
};

const INQUIRY_MASK_SELECT = {
  customerName: true,
  address: true,
  propertyType: true,
  areaPyeong: true,
  areaBasis: true,
  exclusiveAreaSqm: true,
  isOneRoom: true,
  roomCount: true,
  bathroomCount: true,
  balconyCount: true,
  kitchenCount: true,
  buildingType: true,
  preferredDate: true,
  preferredTime: true,
  preferredTimeDetail: true,
  betweenScheduleSlot: true,
  specialNotes: true,
  memo: true,
  moveInDate: true,
  moveInDateUndecided: true,
  serviceBalanceAmount: true,
} as const;

export { INQUIRY_MASK_SELECT };

type InquiryMaskFields = Pick<Inquiry, keyof typeof INQUIRY_MASK_SELECT>;

export function buildMaskedListingDto(input: {
  id: string;
  sellerTenantId: string;
  sellerTenantName: string;
  status: string;
  visibility: string;
  listingFee: number;
  displayAmount: number | null;
  publishedAt: Date | null;
  inquiry: InquiryMaskFields;
  role: 'SELLER' | 'BUYER' | 'VIEWER';
}): MarketplaceListingMaskedDto {
  const displayAmount =
    input.displayAmount ??
    computeMarketplaceDisplayAmount(input.inquiry.serviceBalanceAmount, input.listingFee);

  return {
    id: input.id,
    sellerTenantId: input.sellerTenantId,
    sellerTenantName: input.sellerTenantName,
    status: input.status,
    visibility: input.visibility,
    displayAmount,
    publishedAt: input.publishedAt?.toISOString() ?? null,
    customerNameMasked: maskMarketplaceCustomerName(input.inquiry.customerName),
    addressRegion: maskMarketplaceAddressRegion(input.inquiry.address),
    propertyType: input.inquiry.propertyType,
    areaPyeong: input.inquiry.areaPyeong,
    areaBasis: input.inquiry.areaBasis,
    exclusiveAreaSqm: input.inquiry.exclusiveAreaSqm,
    isOneRoom: input.inquiry.isOneRoom,
    roomCount: input.inquiry.roomCount,
    bathroomCount: input.inquiry.bathroomCount,
    balconyCount: input.inquiry.balconyCount,
    kitchenCount: input.inquiry.kitchenCount,
    buildingType: input.inquiry.buildingType,
    preferredDate: input.inquiry.preferredDate?.toISOString() ?? null,
    preferredTime: input.inquiry.preferredTime,
    preferredTimeDetail: input.inquiry.preferredTimeDetail,
    betweenScheduleSlot: input.inquiry.betweenScheduleSlot,
    specialNotes: input.inquiry.specialNotes,
    memo: input.inquiry.memo,
    moveInDate: input.inquiry.moveInDate?.toISOString() ?? null,
    moveInDateUndecided: input.inquiry.moveInDateUndecided,
    role: input.role,
  };
}

export function listingStatusSortRank(status: string): number {
  if (status === 'OPEN') return 0;
  if (status === 'PENDING_SELLER') return 1;
  if (status === 'DRAFT') return 2;
  if (status === 'CONFIRMED') return 3;
  return 4;
}
