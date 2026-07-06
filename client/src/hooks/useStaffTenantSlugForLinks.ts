import { useTenantCapabilities } from './useTenantCapabilities';
import { resolveStaffTenantSlugForLinks } from '../utils/staffTenantSlugForLinks';

/** 스태ff 세션 tenant.slug → 고객 링크용 slug (apex SK Host 오염 방지) */
export function useStaffTenantSlugForLinks(_token?: string | null | undefined): string {
  const { tenantSlug } = useTenantCapabilities();
  return resolveStaffTenantSlugForLinks(tenantSlug ?? '');
}
