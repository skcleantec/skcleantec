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
  expiresAt: string | null;
  platformSuspended: boolean;
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
  expiresAt?: Date | null;
  platformSuspendedAt?: Date | null;
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
    expiresAt: input.expiresAt?.toISOString() ?? null,
    platformSuspended: input.platformSuspendedAt != null,
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
  if (status === 'EXPIRED') return 4;
  if (status === 'WITHDRAWN') return 5;
  return 6;
}

export const INQUIRY_FULL_SELECT = {
  id: true,
  inquiryNumber: true,
  customerName: true,
  nickname: true,
  customerPhone: true,
  customerPhone2: true,
  customerEmail: true,
  address: true,
  addressDetail: true,
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
  consultationMemo: true,
  moveInDate: true,
  moveInDateUndecided: true,
  serviceTotalAmount: true,
  serviceDepositAmount: true,
  serviceBalanceAmount: true,
  status: true,
} as const;

export type MarketplaceListingFullInquiryDto = {
  id: string;
  inquiryNumber: string | null;
  customerName: string;
  nickname: string | null;
  customerPhone: string;
  customerPhone2: string | null;
  customerEmail: string | null;
  address: string;
  addressDetail: string | null;
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
  consultationMemo: string | null;
  moveInDate: string | null;
  moveInDateUndecided: boolean;
  serviceTotalAmount: number | null;
  serviceDepositAmount: number | null;
  serviceBalanceAmount: number | null;
  status: string;
};

export function buildFullInquiryDto(
  inquiry: Pick<Inquiry, keyof typeof INQUIRY_FULL_SELECT>,
): MarketplaceListingFullInquiryDto {
  return {
    id: inquiry.id,
    inquiryNumber: inquiry.inquiryNumber,
    customerName: inquiry.customerName,
    nickname: inquiry.nickname,
    customerPhone: inquiry.customerPhone,
    customerPhone2: inquiry.customerPhone2,
    customerEmail: inquiry.customerEmail,
    address: inquiry.address,
    addressDetail: inquiry.addressDetail,
    propertyType: inquiry.propertyType,
    areaPyeong: inquiry.areaPyeong,
    areaBasis: inquiry.areaBasis,
    exclusiveAreaSqm: inquiry.exclusiveAreaSqm,
    isOneRoom: inquiry.isOneRoom,
    roomCount: inquiry.roomCount,
    bathroomCount: inquiry.bathroomCount,
    balconyCount: inquiry.balconyCount,
    kitchenCount: inquiry.kitchenCount,
    buildingType: inquiry.buildingType,
    preferredDate: inquiry.preferredDate?.toISOString() ?? null,
    preferredTime: inquiry.preferredTime,
    preferredTimeDetail: inquiry.preferredTimeDetail,
    betweenScheduleSlot: inquiry.betweenScheduleSlot,
    specialNotes: inquiry.specialNotes,
    memo: inquiry.memo,
    consultationMemo: inquiry.consultationMemo,
    moveInDate: inquiry.moveInDate?.toISOString() ?? null,
    moveInDateUndecided: inquiry.moveInDateUndecided,
    serviceTotalAmount: inquiry.serviceTotalAmount,
    serviceDepositAmount: inquiry.serviceDepositAmount,
    serviceBalanceAmount: inquiry.serviceBalanceAmount,
    status: inquiry.status,
  };
}

export type MarketplaceListingDetailDto = MarketplaceListingMaskedDto & {
  inquiryId: string;
  buyerKind: string | null;
  buyerName: string | null;
  buyerConfirmedAt: string | null;
  sellerConfirmedAt: string | null;
  inquiryFull: MarketplaceListingFullInquiryDto | null;
  targetInquiryId: string | null;
};
