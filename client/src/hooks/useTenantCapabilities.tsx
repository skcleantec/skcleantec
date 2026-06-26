import { createContext, useContext, type ReactNode } from 'react';
import type { TenantFeatureModuleId } from '@shared/tenantFeatureModules';

export type TenantCapabilitiesState = {
  /** null = 아직 /auth/me features 미수신 */
  features: readonly string[] | null;
  plan: string | null;
  /** null = /auth/me tenant.slug 미수신 */
  tenantSlug: string | null;
};

const defaultState: TenantCapabilitiesState = { features: null, plan: null, tenantSlug: null };

export const TenantCapabilitiesContext = createContext<TenantCapabilitiesState>(defaultState);

export function TenantCapabilitiesProvider({
  value,
  children,
}: {
  value: TenantCapabilitiesState;
  children: ReactNode;
}) {
  return <TenantCapabilitiesContext.Provider value={value}>{children}</TenantCapabilitiesContext.Provider>;
}

export function useTenantCapabilities(): TenantCapabilitiesState {
  return useContext(TenantCapabilitiesContext);
}

export function useHasTenantFeature(moduleId: TenantFeatureModuleId): boolean {
  const { features } = useTenantCapabilities();
  if (!features) return false;
  return features.includes(moduleId);
}
