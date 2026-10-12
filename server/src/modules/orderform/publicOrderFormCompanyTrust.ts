import type { PrismaClient } from '@prisma/client';
import { parseOperatingCompanyConfig } from '../operating-companies/operatingCompany.schema.js';
import { getTenantConfig } from '../tenants/tenantConfig.service.js';
import {
  parseTenantConfig,
  type TenantCompanyRegistrationConfig,
} from '../tenants/tenantConfig.schema.js';

/** 고객 발주서 하단 — 보이스피싱 안심용 공개 사업자 정보 */
export type PublicOrderFormCompanyTrustDto = {
  companyName: string;
  representativeName: string | null;
  businessRegistrationNo: string | null;
  addressLine: string | null;
  phone: string | null;
};

function mergeRegistration(
  tenantReg: Partial<TenantCompanyRegistrationConfig> | undefined,
  brandReg: Partial<TenantCompanyRegistrationConfig> | undefined,
): Partial<TenantCompanyRegistrationConfig> {
  return {
    companyName: brandReg?.companyName?.trim() || tenantReg?.companyName?.trim(),
    representativeName: brandReg?.representativeName?.trim() || tenantReg?.representativeName?.trim(),
    businessRegistrationNo:
      brandReg?.businessRegistrationNo?.trim() || tenantReg?.businessRegistrationNo?.trim(),
    addressLine: brandReg?.addressLine?.trim() || tenantReg?.addressLine?.trim(),
    phone: brandReg?.phone?.trim() || tenantReg?.phone?.trim(),
  };
}

function toTrustDto(
  reg: Partial<TenantCompanyRegistrationConfig>,
  displayNameFallback: string,
): PublicOrderFormCompanyTrustDto | null {
  const companyName = reg.companyName?.trim() || displayNameFallback.trim();
  if (!companyName) return null;
  return {
    companyName,
    representativeName: reg.representativeName?.trim() || null,
    businessRegistrationNo: reg.businessRegistrationNo?.trim() || null,
    addressLine: reg.addressLine?.trim() || null,
    phone: reg.phone?.trim() || null,
  };
}

/** 이미 읽은 테넌트·브랜드 설정으로 안심 정보를 만든다. 추가 조회 없음. */
export function companyTrustFromLoaded(params: {
  tenantConfig: unknown;
  operatingCompany?: { name: string; config: unknown } | null;
  displayNameFallback?: string | null;
}): PublicOrderFormCompanyTrustDto | null {
  const tenantParsed = parseTenantConfig(params.tenantConfig);
  const fallback =
    params.displayNameFallback?.trim() || tenantParsed.branding?.displayName?.trim() || '';
  const oc = params.operatingCompany;
  if (oc) {
    const config = parseOperatingCompanyConfig(oc.config);
    const brandDisplay = config.branding?.displayName?.trim() || oc.name;
    const merged = mergeRegistration(tenantParsed.companyRegistration, config.companyRegistration);
    return toTrustDto(merged, brandDisplay || fallback);
  }
  return toTrustDto(tenantParsed.companyRegistration ?? {}, fallback);
}

export async function resolvePublicOrderFormCompanyTrust(params: {
  db: PrismaClient;
  tenantId: string;
  operatingCompanyId?: string | null;
  displayNameFallback?: string | null;
}): Promise<PublicOrderFormCompanyTrustDto | null> {
  const tenantConfig = await getTenantConfig(params.tenantId);
  const fallback = params.displayNameFallback?.trim() || tenantConfig.branding?.displayName?.trim() || '';

  if (params.operatingCompanyId?.trim()) {
    const row = await params.db.operatingCompany.findFirst({
      where: { id: params.operatingCompanyId.trim(), tenantId: params.tenantId, isActive: true },
    });
    if (row) {
      const config = parseOperatingCompanyConfig(row.config);
      const brandDisplay = config.branding?.displayName?.trim() || row.name;
      const merged = mergeRegistration(tenantConfig.companyRegistration, config.companyRegistration);
      return toTrustDto(merged, brandDisplay || fallback);
    }
  }

  return toTrustDto(tenantConfig.companyRegistration ?? {}, fallback);
}
