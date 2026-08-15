import { useEffect, useState } from 'react';
import { getMe, isAuthSessionExpiredError } from '../api/auth';
import { bootstrapAuthMeFromLocal, type AuthMeSnapshot } from '../api/authMeSnapshot';
import { clearToken } from '../stores/auth';
import type { TenantCapabilitiesState } from './useTenantCapabilities';
import { parseTelecrmCapabilitiesFromMe } from '../utils/telecrmCapabilities';

const loadingCapabilities: TenantCapabilitiesState = {
  features: null,
  plan: null,
  tenantSlug: null,
  telecrm: null,
};

function capabilitiesFromAuthMe(u: AuthMeSnapshot): TenantCapabilitiesState {
  return {
    features: Array.isArray(u.features) ? u.features : [],
    plan: typeof (u.tenant as { plan?: string } | undefined)?.plan === 'string'
      ? (u.tenant as { plan: string }).plan
      : null,
    tenantSlug: typeof (u.tenant as { slug?: string } | undefined)?.slug === 'string'
      ? (u.tenant as { slug: string }).slug
      : null,
    telecrm: parseTelecrmCapabilitiesFromMe((u as { telecrm?: unknown }).telecrm),
  };
}

function bootstrapCapabilities(token: string): TenantCapabilitiesState | null {
  const boot = bootstrapAuthMeFromLocal(token);
  if (!boot) return null;
  if (Array.isArray(boot.features) || boot.telecrm != null || boot.tenant != null) {
    return capabilitiesFromAuthMe(boot);
  }
  return null;
}

/**
 * AdminLayout 밖(텔레CRM 팝업 등)에서 FeatureGate가 동작하도록 /auth/me features를 조회한다.
 */
export function useStandaloneTenantCapabilities(token: string | null): TenantCapabilitiesState {
  const [state, setState] = useState<TenantCapabilitiesState>(() => {
    if (!token) return loadingCapabilities;
    return bootstrapCapabilities(token) ?? loadingCapabilities;
  });

  useEffect(() => {
    if (!token) {
      setState(loadingCapabilities);
      return;
    }
    const boot = bootstrapCapabilities(token);
    if (boot) setState(boot);
    let cancelled = false;
    void getMe(token)
      .then((u) => {
        if (cancelled) return;
        setState(capabilitiesFromAuthMe(u));
      })
      .catch((e) => {
        if (cancelled) return;
        if (isAuthSessionExpiredError(e)) {
          clearToken();
          setState(loadingCapabilities);
          return;
        }
        if (!boot) {
          setState({ features: [], plan: null, tenantSlug: null, telecrm: null });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  return state;
}
