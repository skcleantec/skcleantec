import type { TenantCompanyRegistration } from './tenantCompanyProfile.js';
import { resolveQuotationSealDisplayWidth } from './quotationSeal.js';

/** 브랜드별 사업자 정보 — 필드별로 브랜드 값 우선, 없으면 테넌트 기본값 */
export function resolveCompanyRegistration(
  brand: Partial<TenantCompanyRegistration> | undefined | null,
  tenant: TenantCompanyRegistration,
): TenantCompanyRegistration {
  const t = tenant ?? {};
  const b = brand ?? {};
  const pick = (
    key: Exclude<keyof TenantCompanyRegistration, 'sealDisplayWidthPx'>,
  ): string | undefined => {
    const brandVal = typeof b[key] === 'string' ? b[key].trim() : '';
    if (brandVal) return brandVal;
    const tenantVal = typeof t[key] === 'string' ? t[key].trim() : '';
    return tenantVal || undefined;
  };
  return {
    companyName: pick('companyName'),
    representativeName: pick('representativeName'),
    businessRegistrationNo: pick('businessRegistrationNo'),
    addressLine: pick('addressLine'),
    phone: pick('phone'),
    fax: pick('fax'),
    contactEmail: pick('contactEmail'),
    sealPublicId: pick('sealPublicId'),
    sealSecureUrl: pick('sealSecureUrl'),
    sealDisplayWidthPx:
      typeof b.sealDisplayWidthPx === 'number' && Number.isFinite(b.sealDisplayWidthPx)
        ? resolveQuotationSealDisplayWidth(b.sealDisplayWidthPx)
        : typeof t.sealDisplayWidthPx === 'number' && Number.isFinite(t.sealDisplayWidthPx)
          ? resolveQuotationSealDisplayWidth(t.sealDisplayWidthPx)
          : undefined,
  };
}
