import { toOperatingCompanyPublicSummary } from '../operating-companies/operatingCompanyPublicSummary.js';
import { dateToYmdKst } from '../users/userEmployment.js';

type OperatingCompanyEmbed = {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  config?: unknown;
};

export type TeamInquiryOperatingCompanyDto = ReturnType<typeof toOperatingCompanyPublicSummary>;

/** Prisma include row → API (badgeColorKey 등 공개 요약) */
export function serializeTeamInquiryOperatingCompany<T extends Record<string, unknown>>(
  item: T & { operatingCompany?: OperatingCompanyEmbed | null },
): Omit<T, 'operatingCompany'> & { operatingCompany: TeamInquiryOperatingCompanyDto | null } {
  const { operatingCompany, ...rest } = item;
  return {
    ...(rest as Omit<T, 'operatingCompany'>),
    operatingCompany: operatingCompany ? toOperatingCompanyPublicSummary(operatingCompany) : null,
  };
}

export function serializeTeamInquiryOperatingCompanies<T extends Record<string, unknown>>(
  items: Array<T & { operatingCompany?: OperatingCompanyEmbed | null }>,
): Array<Omit<T, 'operatingCompany'> & { operatingCompany: TeamInquiryOperatingCompanyDto | null }> {
  return items.map(serializeTeamInquiryOperatingCompany);
}

/** 팀장 API — 예약일을 KST `YYYY-MM-DD` 로 내려 구 WebView·`slice(0,10)` 오차 방지 */
export function serializeTeamInquiryPreferredDateKst<T extends Record<string, unknown>>(
  item: T,
): T & { preferredDate: string | null } {
  const pd = (item as { preferredDate?: Date | string | null }).preferredDate;
  if (pd == null) return { ...item, preferredDate: null };
  if (typeof pd === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(pd.trim())) return { ...item, preferredDate: pd.trim() };
    const parsed = new Date(pd);
    if (Number.isNaN(parsed.getTime())) return { ...item, preferredDate: null };
    return { ...item, preferredDate: dateToYmdKst(parsed) };
  }
  return { ...item, preferredDate: dateToYmdKst(pd) };
}

export function serializeTeamInquiryPreferredDatesKst<T extends Record<string, unknown>>(
  items: T[],
): Array<T & { preferredDate: string | null }> {
  return items.map(serializeTeamInquiryPreferredDateKst);
}
