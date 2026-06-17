import { resolveCompanyRegistration } from '../../lib/resolveCompanyRegistration.js';
import type { TenantCompanyRegistrationConfig } from '../tenants/tenantConfig.schema.js';
import { parseOperatingCompanyConfig } from './operatingCompany.schema.js';

export function resolveOperatingCompanyRegistration(
  operatingCompany: { config: unknown } | null | undefined,
  tenantRegistration: TenantCompanyRegistrationConfig,
): TenantCompanyRegistrationConfig {
  const brand =
    operatingCompany != null
      ? parseOperatingCompanyConfig(operatingCompany.config).companyRegistration
      : undefined;
  return resolveCompanyRegistration(brand, tenantRegistration);
}
