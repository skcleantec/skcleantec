/** @see shared/resolveCompanyRegistration.ts — 클라이언트와 동기화 */
import type { TenantCompanyRegistrationConfig } from '../modules/tenants/tenantConfig.schema.js';

export function resolveCompanyRegistration(
  brand: Partial<TenantCompanyRegistrationConfig> | undefined | null,
  tenant: TenantCompanyRegistrationConfig,
): TenantCompanyRegistrationConfig {
  const t = tenant ?? {};
  const b = brand ?? {};
  const pick = (key: keyof TenantCompanyRegistrationConfig): string | undefined => {
    const brandVal = b[key]?.trim();
    if (brandVal) return brandVal;
    const tenantVal = t[key]?.trim();
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
  };
}
