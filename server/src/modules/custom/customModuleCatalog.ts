/**
 * L3 커스텀 모듈 카탈로그 — slug별 `custom_{slug}_*` feature
 * 새 업체 전용 기능: 이 목록 + `modules/custom/{slug}/` 폴더
 * @see docs/MULTI_TENANT_PLATFORM.md §5
 */

export type CustomModuleDef = {
  moduleId: string;
  label: string;
};

/** slug → 해당 업체에만 노출되는 커스텀 모듈 (플랫폼 기능 탭) */
export const CUSTOM_MODULES_BY_SLUG: Record<string, CustomModuleDef[]> = {
  skcleanteck: [
    {
      moduleId: 'custom_skcleanteck_ops_ui',
      label: '[SK] 운영 UI (원/투룸·스케줄 태극기 원/투룸 건수)',
    },
  ],
  sk: [
    {
      moduleId: 'custom_skcleanteck_ops_ui',
      label: '[SK] 운영 UI (원/투룸·스케줄 태극기 원/투룸 건수)',
    },
  ],
};

export function isCustomModuleId(moduleId: string): boolean {
  return moduleId.startsWith('custom_');
}

export function customModulesForTenantSlug(slug: string): CustomModuleDef[] {
  return CUSTOM_MODULES_BY_SLUG[slug.trim().toLowerCase()] ?? [];
}

export function isRegisteredCustomModuleId(moduleId: string): boolean {
  if (!isCustomModuleId(moduleId)) return false;
  for (const list of Object.values(CUSTOM_MODULES_BY_SLUG)) {
    if (list.some((m) => m.moduleId === moduleId)) return true;
  }
  return false;
}

export function customModuleIdForSlug(slug: string, key: string): string {
  const s = slug.trim().toLowerCase().replace(/-/g, '_');
  const k = key.trim().toLowerCase().replace(/-/g, '_');
  return `custom_${s}_${k}`;
}
