import { API } from './apiPrefix';

function headers(token: string) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

export type DbMarketplaceListingStatus = 'DRAFT' | 'OPEN' | 'PENDING_SELLER' | 'CONFIRMED' | 'WITHDRAWN';

export type DbMarketplaceListTab = 'available' | 'my_sales' | 'pending' | 'confirmed';

export type DbMarketplaceAudienceItem = {
  id: string;
  audienceKind: 'PARTNER_TENANT' | 'EXTERNAL_COMPANY';
  partnerTenantId: string | null;
  partnerTenantName: string | null;
  externalCompanyId: string | null;
  externalCompanyName: string | null;
};

export type DbMarketplaceSellerListing = {
  id: string;
  inquiryId: string;
  listingFee: number;
  displayAmount: number | null;
  status: DbMarketplaceListingStatus;
  visibility: 'ALL' | 'SELECTED';
  publishedAt: string | null;
  audiences: DbMarketplaceAudienceItem[];
};

export type DbMarketplaceMaskedItem = {
  id: string;
  sellerTenantId: string;
  sellerTenantName: string;
  status: DbMarketplaceListingStatus;
  visibility: 'ALL' | 'SELECTED';
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

export type DbMarketplaceAudienceInput = {
  audienceKind: 'PARTNER_TENANT' | 'EXTERNAL_COMPANY';
  partnerTenantId?: string;
  externalCompanyId?: string;
};

async function parseJson<T>(res: Response): Promise<T> {
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? `요청 실패 (${res.status})`);
  return data;
}

export async function getDbMarketplaceDraftCount(token: string): Promise<number> {
  const res = await fetch(`${API}/db-marketplace/draft-count`, { headers: headers(token) });
  const data = await parseJson<{ count: number }>(res);
  return data.count;
}

export async function getDbListingByInquiry(
  token: string,
  inquiryId: string,
): Promise<DbMarketplaceSellerListing | null> {
  const res = await fetch(`${API}/db-marketplace/by-inquiry/${encodeURIComponent(inquiryId)}`, {
    headers: headers(token),
  });
  const data = await parseJson<{ listing: DbMarketplaceSellerListing | null }>(res);
  return data.listing;
}

export async function upsertDbMarketplaceDraft(
  token: string,
  inquiryId: string,
  listingFee: number,
): Promise<DbMarketplaceSellerListing> {
  const res = await fetch(`${API}/db-marketplace/draft`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({ inquiryId, listingFee }),
  });
  const data = await parseJson<{ listing: DbMarketplaceSellerListing }>(res);
  return data.listing;
}

export async function updateDbMarketplaceAudience(
  token: string,
  listingId: string,
  visibility: 'ALL' | 'SELECTED',
  audiences: DbMarketplaceAudienceInput[],
): Promise<DbMarketplaceSellerListing> {
  const res = await fetch(`${API}/db-marketplace/${encodeURIComponent(listingId)}/audience`, {
    method: 'PATCH',
    headers: headers(token),
    body: JSON.stringify({ visibility, audiences }),
  });
  const data = await parseJson<{ listing: DbMarketplaceSellerListing }>(res);
  return data.listing;
}

export async function publishDbMarketplaceListing(
  token: string,
  listingId: string,
): Promise<DbMarketplaceSellerListing> {
  const res = await fetch(`${API}/db-marketplace/${encodeURIComponent(listingId)}/publish`, {
    method: 'POST',
    headers: headers(token),
  });
  const data = await parseJson<{ listing: DbMarketplaceSellerListing }>(res);
  return data.listing;
}

export async function withdrawDbMarketplaceListing(
  token: string,
  listingId: string,
): Promise<DbMarketplaceSellerListing> {
  const res = await fetch(`${API}/db-marketplace/${encodeURIComponent(listingId)}/withdraw`, {
    method: 'POST',
    headers: headers(token),
  });
  const data = await parseJson<{ listing: DbMarketplaceSellerListing }>(res);
  return data.listing;
}

export async function listDbMarketplace(
  token: string,
  params: { tab?: DbMarketplaceListTab; limit?: number; offset?: number },
): Promise<{ items: DbMarketplaceMaskedItem[]; total: number; limit: number; offset: number }> {
  const q = new URLSearchParams();
  if (params.tab) q.set('tab', params.tab);
  if (params.limit != null) q.set('limit', String(params.limit));
  if (params.offset != null) q.set('offset', String(params.offset));
  const res = await fetch(`${API}/db-marketplace?${q}`, { headers: headers(token) });
  return parseJson(res);
}

export async function getDbMarketplaceListing(
  token: string,
  listingId: string,
): Promise<DbMarketplaceMaskedItem> {
  const res = await fetch(`${API}/db-marketplace/${encodeURIComponent(listingId)}`, {
    headers: headers(token),
  });
  const data = await parseJson<{ item: DbMarketplaceMaskedItem }>(res);
  return data.item;
}
