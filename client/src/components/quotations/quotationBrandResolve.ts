import type { QuotationEditorOperatingCompanyDto } from '../../api/quotations';
import type { TenantCompanyRegistration } from '../../api/tenantCompanyProfile';
import {
  formatDocumentTitle,
  type QuotationDocumentType,
} from '@shared/quotationDocument';

export function pickQuotationOperatingCompanyId(
  companies: QuotationEditorOperatingCompanyDto[],
  preferredId?: string | null,
): string {
  if (preferredId && companies.some((c) => c.id === preferredId)) return preferredId;
  return companies.find((c) => c.isDefault)?.id ?? companies[0]?.id ?? '';
}

export function resolveQuotationSupplierRegistration(
  companies: QuotationEditorOperatingCompanyDto[],
  operatingCompanyId: string,
  tenantFallback: TenantCompanyRegistration,
): TenantCompanyRegistration {
  const brand = companies.find((c) => c.id === operatingCompanyId);
  return brand?.companyRegistration ?? tenantFallback;
}

export function resolveQuotationBrandTitle(
  companies: QuotationEditorOperatingCompanyDto[],
  operatingCompanyId: string,
  tenantFallback: TenantCompanyRegistration,
  documentType: QuotationDocumentType,
): string {
  const brand = companies.find((c) => c.id === operatingCompanyId);
  const brandName = brand
    ? (brand.displayName || brand.name).trim()
    : (tenantFallback.companyName ?? '').trim();
  return formatDocumentTitle(brandName, documentType);
}
