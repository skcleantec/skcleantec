import { useEffect, useState } from 'react';
import { getMe, isAuthSessionExpiredError } from '../api/auth';
import { clearToken } from '../stores/auth';
import type { TenantCapabilitiesState } from './useTenantCapabilities';

const loadingCapabilities: TenantCapabilitiesState = {
  features: null,
  plan: null,
  tenantSlug: null,
};

/**
 * AdminLayout 밖(텔레CRM 팝업 등)에서 FeatureGate가 동작하도록 /auth/me features를 조회한다.
 */
export function useStandaloneTenantCapabilities(token: string | null): TenantCapabilitiesState {
  const [state, setState] = useState<TenantCapabilitiesState>(loadingCapabilities);

  useEffect(() => {
    if (!token) {
      setState(loadingCapabilities);
      return;
    }
    let cancelled = false;
    void getMe(token)
      .then((u: { features?: string[]; tenant?: { plan?: string; slug?: string } | null }) => {
        if (cancelled) return;
        setState({
          features: Array.isArray(u.features) ? u.features : [],
          plan: typeof u.tenant?.plan === 'string' ? u.tenant.plan : null,
          tenantSlug: typeof u.tenant?.slug === 'string' ? u.tenant.slug : null,
        });
      })
      .catch((e) => {
        if (cancelled) return;
        if (isAuthSessionExpiredError(e)) {
          clearToken();
          setState(loadingCapabilities);
          return;
        }
        setState({ features: [], plan: null, tenantSlug: null });
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  return state;
}
