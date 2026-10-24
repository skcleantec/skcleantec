/**
 * 메뉴 노출 3단계.
 * enabled: 지금 켜져 있음
 * locked: 현재 플랜에는 없고 더 높은 플랜에는 있음
 * hidden: 플랜에는 있는데 업체가 끔, 또는 어떤 플랜에도 없음
 */
import { hasFeature, modulesForPlan, TENANT_PLANS, type TenantFeatureModuleId, type TenantPlanId } from './tenantFeatureModules.js';
import { normalizePlanId, TENANT_PLAN_IDS } from './tenantPlanNormalize.js';

export type ModuleVisibilityState = 'enabled' | 'locked' | 'hidden';

export type ModuleVisibility = {
  state: ModuleVisibilityState;
  requiredPlanId?: TenantPlanId;
  requiredPlanLabel?: string;
};

export function getModuleVisibility(
  mod: TenantFeatureModuleId,
  plan: string | null | undefined,
  enabledModules: readonly string[],
): ModuleVisibility {
  if (hasFeature(enabledModules, mod)) return { state: 'enabled' };

  const planId = normalizePlanId(plan);
  if (modulesForPlan(planId).includes(mod)) return { state: 'hidden' };

  const currentIdx = TENANT_PLAN_IDS.indexOf(planId);
  for (let i = currentIdx + 1; i < TENANT_PLAN_IDS.length; i += 1) {
    const higher = TENANT_PLAN_IDS[i];
    if (!modulesForPlan(higher).includes(mod)) continue;
    return {
      state: 'locked',
      requiredPlanId: higher,
      requiredPlanLabel: TENANT_PLANS[higher].label,
    };
  }
  return { state: 'hidden' };
}
