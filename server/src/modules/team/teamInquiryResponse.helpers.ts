import { toOperatingCompanyPublicSummary } from '../operating-companies/operatingCompanyPublicSummary.js';
import { dateToYmdKst } from '../users/userEmployment.js';
import { loadTelecrmPropertyChoiceResolver } from '../telecrm/telecrmPropertyChoices.service.js';

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

/** OPT_3 등 저장 코드를 발주서 선택지 화면 이름으로 붙인다 */
export async function attachTeamPropertyChoiceLabels<T extends object>(
  tenantId: string,
  items: T[],
): Promise<Array<T & { propertyTypeLabel: string | null; buildingTypeLabel: string | null }>> {
  if (items.length === 0) {
    return items.map((item) => ({
      ...item,
      propertyTypeLabel: null,
      buildingTypeLabel: null,
    }));
  }
  const resolver = await loadTelecrmPropertyChoiceResolver(tenantId);
  return items.map((item) => {
    const row = item as T & { propertyType?: string | null; buildingType?: string | null };
    return {
      ...item,
      propertyTypeLabel: resolver.labelOf('property', row.propertyType) || null,
      buildingTypeLabel: resolver.labelOf('building', row.buildingType) || null,
    };
  });
}

export async function attachTeamPropertyChoiceLabelsOne<T extends object>(
  tenantId: string,
  item: T,
): Promise<T & { propertyTypeLabel: string | null; buildingTypeLabel: string | null }> {
  const [row] = await attachTeamPropertyChoiceLabels(tenantId, [item]);
  return row;
}
