import { API } from './apiPrefix';
import { withTeamPreviewQuery } from '../utils/teamPreviewQuery';

function headers(token: string) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

export type DbMarketplaceListingStatus =
  'DRAFT' | 'OPEN' | 'PENDING_SELLER' | 'CONFIRMED' | 'WITHDRAWN' | 'EXPIRED';

export type InquiryDbListingMeta = {
  listingId: string;
  status: Exclude<DbMarketplaceListingStatus, 'WITHDRAWN'>;
};

export type DbMarketplaceListTab = 'available' | 'cart' | 'my_sales' | 'pending' | 'confirmed';

export type DbMarketplaceAudienceOptionPartner = { id: string; name: string; slug: string };
export type DbMarketplaceAudienceOptionExternal = { id: string; name: string };

export async function listDbMarketplaceAudienceOptions(token: string): Promise<{
  partners: DbMarketplaceAudienceOptionPartner[];
  externalCompanies: DbMarketplaceAudienceOptionExternal[];
}> {
  const res = await fetch(`${API}/db-marketplace/audience-options`, { headers: headers(token) });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '노출 대상 목록을 불러올 수 없습니다.');
  }
  return res.json();
}

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
  buyerKind?: 'PARTNER_TENANT' | 'EXTERNAL_COMPANY' | null;
  expiresAt?: string | null;
  platformSuspendedAt?: string | null;
  buyerTenantId?: string | null;
  buyerExternalCompanyId?: string | null;
  buyerName?: string | null;
  buyerConfirmedAt?: string | null;
  sellerConfirmedAt?: string | null;
  audiences: DbMarketplaceAudienceItem[];
};

export type DbMarketplaceFullInquiry = {
  id: string;
  inquiryNumber: string | null;
  customerName: string;
  customerPhone: string;
  customerPhone2: string | null;
  address: string;
  addressDetail: string | null;
  propertyType: string | null;
  areaPyeong: number | null;
  preferredDate: string | null;
  preferredTime: string | null;
  specialNotes: string | null;
  memo: string | null;
  serviceTotalAmount: number | null;
  serviceDepositAmount: number | null;
  serviceBalanceAmount: number | null;
  status: string;
};

export type DbMarketplaceListingDetail = DbMarketplaceMaskedItem & {
  inquiryId: string;
  buyerKind: 'PARTNER_TENANT' | 'EXTERNAL_COMPANY' | null;
  buyerName: string | null;
  buyerConfirmedAt: string | null;
  sellerConfirmedAt: string | null;
  inquiryFull: DbMarketplaceFullInquiry | null;
  targetInquiryId: string | null;
};

export type DbMarketplaceMaskedItem = {
  id: string;
  sellerTenantId: string;
  sellerTenantName: string;
  status: DbMarketplaceListingStatus;
  visibility: 'ALL' | 'SELECTED';
  displayAmount: number | null;
  publishedAt: string | null;
  expiresAt: string | null;
  platformSuspended: boolean;
  holdActive: boolean;
  holdIsMine: boolean;
  heldUntil: string | null;
  holdBuyerName: string | null;
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
  scheduleMemo: string | null;
  source: string | null;
  moveInDate: string | null;
  moveInDateUndecided: boolean;
  role: 'SELLER' | 'BUYER' | 'VIEWER';
  /** 판매자 목록(cart·my_sales) 전용 */
  listingFee?: number;
  inquiryId?: string;
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

export async function getDbMarketplaceNavCounts(
  token: string,
): Promise<{ draftCount: number; sellerPendingCount: number; buyerPendingCount: number }> {
  const res = await fetch(`${API}/db-marketplace/draft-count`, { headers: headers(token) });
  const data = await parseJson<{ count: number; sellerPendingCount?: number; buyerPendingCount?: number }>(res);
  return {
    draftCount: data.count,
    sellerPendingCount: data.sellerPendingCount ?? 0,
    buyerPendingCount: data.buyerPendingCount ?? 0,
  };
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

export type DbMarketplaceBulkFailed = { id: string; error: string };

export type DbMarketplaceBulkPublishResult = {
  published: Array<{ id: string; inquiryId?: string; displayAmount?: number | null }>;
  failed: DbMarketplaceBulkFailed[];
};

export type DbMarketplaceBulkBuyerConfirmResult = {
  requested: Array<{ id: string; inquiryId?: string; sellerTenantName?: string; displayAmount?: number | null }>;
  failed: DbMarketplaceBulkFailed[];
};

export async function bulkPublishDbMarketplace(
  token: string,
  body: {
    listingIds: string[];
    visibility: 'ALL' | 'SELECTED';
    audiences: DbMarketplaceAudienceInput[];
  },
): Promise<DbMarketplaceBulkPublishResult> {
  const res = await fetch(`${API}/db-marketplace/bulk/publish`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify(body),
  });
  return parseJson(res);
}

export async function bulkBuyerConfirmDbMarketplace(
  token: string,
  listingIds: string[],
): Promise<DbMarketplaceBulkBuyerConfirmResult> {
  const res = await fetch(`${API}/db-marketplace/bulk/buyer-confirm`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({ listingIds }),
  });
  return parseJson(res);
}

export async function bulkTeamBuyerConfirmDbMarketplace(
  token: string,
  listingIds: string[],
): Promise<DbMarketplaceBulkBuyerConfirmResult> {
  const res = await fetch(withTeamPreviewQuery(`${API}/team/db-marketplace/bulk/buyer-confirm`), {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({ listingIds }),
  });
  return parseJson(res);
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
): Promise<DbMarketplaceListingDetail> {
  const res = await fetch(`${API}/db-marketplace/${encodeURIComponent(listingId)}`, {
    headers: headers(token),
  });
  const data = await parseJson<{ item: DbMarketplaceListingDetail }>(res);
  return data.item;
}

export async function confirmDbMarketplaceBuyer(
  token: string,
  listingId: string,
): Promise<DbMarketplaceSellerListing> {
  const res = await fetch(`${API}/db-marketplace/${encodeURIComponent(listingId)}/buyer-confirm`, {
    method: 'POST',
    headers: headers(token),
  });
  const data = await parseJson<{ listing: DbMarketplaceSellerListing }>(res);
  return data.listing;
}

export async function confirmDbMarketplaceSeller(
  token: string,
  listingId: string,
): Promise<{ listing: DbMarketplaceSellerListing; targetInquiryId: string | null }> {
  const res = await fetch(`${API}/db-marketplace/${encodeURIComponent(listingId)}/seller-confirm`, {
    method: 'POST',
    headers: headers(token),
  });
  return parseJson(res);
}

export async function declineDbMarketplaceSeller(
  token: string,
  listingId: string,
): Promise<DbMarketplaceSellerListing> {
  const res = await fetch(`${API}/db-marketplace/${encodeURIComponent(listingId)}/seller-decline`, {
    method: 'POST',
    headers: headers(token),
  });
  const data = await parseJson<{ listing: DbMarketplaceSellerListing }>(res);
  return data.listing;
}

export type TeamDbMarketplaceListTab = 'available' | 'pending' | 'confirmed';

export async function listTeamDbMarketplace(
  token: string,
  params: { tab?: TeamDbMarketplaceListTab; limit?: number; offset?: number },
): Promise<{ items: DbMarketplaceMaskedItem[]; total: number; limit: number; offset: number }> {
  const q = new URLSearchParams();
  if (params.tab) q.set('tab', params.tab);
  if (params.limit != null) q.set('limit', String(params.limit));
  if (params.offset != null) q.set('offset', String(params.offset));
  const res = await fetch(withTeamPreviewQuery(`${API}/team/db-marketplace?${q}`), { headers: headers(token) });
  return parseJson(res);
}

export async function getTeamDbMarketplaceListing(
  token: string,
  listingId: string,
): Promise<DbMarketplaceListingDetail> {
  const res = await fetch(
    withTeamPreviewQuery(`${API}/team/db-marketplace/${encodeURIComponent(listingId)}`),
    { headers: headers(token) },
  );
  const data = await parseJson<{ item: DbMarketplaceListingDetail }>(res);
  return data.item;
}

export async function confirmTeamDbMarketplaceBuyer(
  token: string,
  listingId: string,
): Promise<DbMarketplaceSellerListing> {
  const res = await fetch(
    withTeamPreviewQuery(`${API}/team/db-marketplace/${encodeURIComponent(listingId)}/buyer-confirm`),
    { method: 'POST', headers: headers(token) },
  );
  const data = await parseJson<{ listing: DbMarketplaceSellerListing }>(res);
  return data.listing;
}

export type DbMarketplaceListingMessage = {
  id: string;
  authorRole: 'SELLER' | 'BUYER';
  authorName: string;
  authorTenantId: string;
  body: string;
  createdAt: string;
  canWrite: boolean;
};

export async function listDbMarketplaceMessages(
  token: string,
  listingId: string,
): Promise<{ items: DbMarketplaceListingMessage[]; canWrite: boolean }> {
  const res = await fetch(`${API}/db-marketplace/${encodeURIComponent(listingId)}/messages`, {
    headers: headers(token),
  });
  return parseJson(res);
}

export async function postDbMarketplaceMessage(
  token: string,
  listingId: string,
  body: string,
): Promise<DbMarketplaceListingMessage> {
  const res = await fetch(`${API}/db-marketplace/${encodeURIComponent(listingId)}/messages`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({ body }),
  });
  const data = await parseJson<{ item: DbMarketplaceListingMessage }>(res);
  return data.item;
}

export async function listTeamDbMarketplaceMessages(
  token: string,
  listingId: string,
): Promise<{ items: DbMarketplaceListingMessage[]; canWrite: boolean }> {
  const res = await fetch(
    withTeamPreviewQuery(`${API}/team/db-marketplace/${encodeURIComponent(listingId)}/messages`),
    { headers: headers(token) },
  );
  return parseJson(res);
}

export async function postTeamDbMarketplaceMessage(
  token: string,
  listingId: string,
  body: string,
): Promise<DbMarketplaceListingMessage> {
  const res = await fetch(
    withTeamPreviewQuery(`${API}/team/db-marketplace/${encodeURIComponent(listingId)}/messages`),
    {
      method: 'POST',
      headers: headers(token),
      body: JSON.stringify({ body }),
    },
  );
  const data = await parseJson<{ item: DbMarketplaceListingMessage }>(res);
  return data.item;
}

export type DbMarketplaceHoldState = {
  holdActive: boolean;
  holdIsMine: boolean;
  heldUntil: string | null;
  holdBuyerName: string | null;
};

export async function holdDbMarketplaceListing(
  token: string,
  listingId: string,
): Promise<{ hold: DbMarketplaceHoldState }> {
  const res = await fetch(`${API}/db-marketplace/${encodeURIComponent(listingId)}/hold`, {
    method: 'POST',
    headers: headers(token),
  });
  return parseJson(res);
}

export async function releaseDbMarketplaceHold(token: string, listingId: string): Promise<void> {
  const res = await fetch(`${API}/db-marketplace/${encodeURIComponent(listingId)}/hold`, {
    method: 'DELETE',
    headers: headers(token),
  });
  await parseJson(res);
}

export async function holdTeamDbMarketplaceListing(
  token: string,
  listingId: string,
): Promise<{ hold: DbMarketplaceHoldState }> {
  const res = await fetch(
    withTeamPreviewQuery(`${API}/team/db-marketplace/${encodeURIComponent(listingId)}/hold`),
    { method: 'POST', headers: headers(token) },
  );
  return parseJson(res);
}

export async function releaseTeamDbMarketplaceHold(token: string, listingId: string): Promise<void> {
  const res = await fetch(
    withTeamPreviewQuery(`${API}/team/db-marketplace/${encodeURIComponent(listingId)}/hold`),
    { method: 'DELETE', headers: headers(token) },
  );
  await parseJson(res);
}
