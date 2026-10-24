/**
 * 1인 사업자 판별 — 이 함수만 고친다.
 * 지금 기준은 배정(`core_assignments`)이 꺼진 업체.
 * 나중에 운영방식(solo/small/hq) 필드로 바꾸면 여기만 수정한다.
 */
import { hasFeature } from './tenantFeatureModules.js';

export function isSoloOperatorTenant(enabledModules: readonly string[] | null | undefined): boolean {
  if (!enabledModules) return false;
  return !hasFeature(enabledModules, 'core_assignments');
}
