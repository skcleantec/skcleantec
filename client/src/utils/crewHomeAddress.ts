/** 크루 팀원 집 주소 — 카카오 검색 기본 + 상세(저장 시 둘 다 필수) */

export type CrewHomeAddressFields = {
  homeAddress?: string | null;
  homeAddressDetail?: string | null;
};

export function hasCrewHomeAddress(m: CrewHomeAddressFields): boolean {
  return Boolean(m.homeAddress?.trim() && m.homeAddressDetail?.trim());
}

/** 네비·복사용 한 줄 */
export function formatCrewHomeAddressLine(
  homeAddress: string | null | undefined,
  homeAddressDetail: string | null | undefined,
): string | null {
  const road = homeAddress?.trim();
  const detail = homeAddressDetail?.trim();
  if (!road || !detail) return null;
  return `${road} ${detail}`;
}

export function formatCrewHomeAddressMultiline(
  homeAddress: string | null | undefined,
  homeAddressDetail: string | null | undefined,
): { road: string; detail: string } | null {
  const road = homeAddress?.trim();
  const detail = homeAddressDetail?.trim();
  if (!road || !detail) return null;
  return { road, detail };
}
