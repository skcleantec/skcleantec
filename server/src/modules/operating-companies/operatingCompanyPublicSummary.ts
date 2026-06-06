import { parseOperatingCompanyConfig } from './operatingCompany.schema.js';

/** 목록·접수 embed — 배지 색 추출용 config 포함 select */
export const operatingCompanySummarySelect = {
  id: true,
  name: true,
  slug: true,
  isActive: true,
  config: true,
} as const;

/** API 응답 — config 원문 대신 badgeColorKey 만 노출 */
export function toOperatingCompanyPublicSummary(row: {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  config?: unknown;
}) {
  const config = parseOperatingCompanyConfig(row.config ?? null);
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    isActive: row.isActive,
    badgeColorKey: config.branding?.badgeColorKey ?? null,
  };
}
