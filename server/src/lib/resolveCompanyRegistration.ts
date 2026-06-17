/** @see shared/resolveCompanyRegistration.ts — 클라이언트와 동기화 */
import type { TenantCompanyRegistrationConfig } from '../modules/tenants/tenantConfig.schema.js';
import { resolveQuotationSealDisplayWidth } from './quotationSeal.js';

export function resolveCompanyRegistration(
  brand: Partial<TenantCompanyRegistrationConfig> | undefined | null,
  tenant: TenantCompanyRegistrationConfig,
): TenantCompanyRegistrationConfig {
  const t = tenant ?? {};
  const b = brand ?? {};
  const pick = (key: Exclude<keyof TenantCompanyRegistrationConfig, 'sealDisplayWidthPx'>): string | undefined => {
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
