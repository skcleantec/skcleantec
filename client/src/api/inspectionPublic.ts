import { API } from './apiPrefix';
import { resolveInitialTenantSlug } from '../utils/tenantHostResolve';
import { resolvePublicBrandSlug } from '../utils/publicTenantQuery';
import type { InspectionChecklistDto } from './inquiryInspection';

function publicQueryString(): string {
  const slug = resolveInitialTenantSlug();
  const brand = resolvePublicBrandSlug();
  const qs = new URLSearchParams();
  if (slug) qs.set('tenant', slug);
  if (brand) qs.set('brand', brand);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export type PublicInspectionResponse = {
  brandName: string;
  checklist: InspectionChecklistDto;
};

export async function fetchPublicInspection(token: string): Promise<PublicInspectionResponse> {
  const qs = publicQueryString();
  const res = await fetch(`${API}/public/inspection/${encodeURIComponent(token)}${qs}`);
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error?.trim() || '검수본을 불러올 수 없습니다.');
  }
  return res.json() as Promise<PublicInspectionResponse>;
}
