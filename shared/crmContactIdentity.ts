/** CRM 접촉 이력 — 닉네임·호칭·지역 기준 (안심번호는 보조) */

export function extractCrmRegionKey(address: string): string {
  const trimmed = address.trim();
  if (!trimmed) return '';
  const head = trimmed.split(/[,，·/|]/)[0]?.trim() ?? trimmed;
  const parts = head.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0]} ${parts[1]}`;
  return parts[0] ?? '';
}

export type CrmContactIdentity = {
  customerName: string;
  nickname: string;
  address: string;
};

export function crmContactIdentityKey(identity: CrmContactIdentity): string {
  const region = extractCrmRegionKey(identity.address);
  return [identity.customerName.trim(), identity.nickname.trim(), region].join('|');
}

/** 닉네임/호칭 + 지역(2자+)이 있을 때 이력 조회 */
export function canSearchCrmContactTimeline(identity: CrmContactIdentity): boolean {
  const region = extractCrmRegionKey(identity.address);
  const hasName =
    identity.customerName.trim().length >= 2 || identity.nickname.trim().length >= 2;
  return hasName && region.length >= 2;
}
