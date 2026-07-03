import { toOperatingCompanyPublicSummary } from '../operating-companies/operatingCompanyPublicSummary.js';

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
