import { useMemo, useState } from 'react';
import {
  TENANT_FEATURE_MODULES,
  type TenantFeatureModuleId,
} from '@shared/tenantFeatureModules';
import {
  TENANT_NAV_FEATURE_CATALOG,
  type TenantNavFeatureCategory,
  type TenantNavFeatureRow,
} from '@shared/tenantNavFeatureCatalog';
import type { PlatformTenantFeatureRow } from '../../api/platformTenants';
import { PlatformToggle } from '../../utils/platformUi';

type Props = {
  features: PlatformTenantFeatureRow[];
  onToggle: (moduleId: string) => void;
  disabled?: boolean;
};

function featureMeta(features: PlatformTenantFeatureRow[], moduleId: TenantFeatureModuleId) {
  return features.find((f) => f.moduleId === moduleId);
}

function ModuleToggle({
  moduleId,
  features,
  onToggle,
  disabled,
  size = 'default',
}: {
  moduleId: TenantFeatureModuleId;
  features: PlatformTenantFeatureRow[];
  onToggle: (moduleId: string) => void;
  disabled?: boolean;
  size?: 'default' | 'sm';
}) {
  const meta = featureMeta(features, moduleId);
  if (!meta) return null;
  return (
    <div className={size === 'sm' ? 'scale-90 origin-right' : undefined}>
      <PlatformToggle
        checked={meta.enabled}
        disabled={disabled || meta.locked}
        onChange={() => onToggle(moduleId)}
      />
    </div>
  );
}

function ModuleBadge({
  moduleId,
  features,
}: {
  moduleId: TenantFeatureModuleId | null;
  features: PlatformTenantFeatureRow[];
}) {
  if (!moduleId) {
    return (
      <span className="inline-block rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600">
        기본 포함
      </span>
    );
  }
  const meta = featureMeta(features, moduleId);
  const tier = TENANT_FEATURE_MODULES[moduleId]?.tier;
  const label = TENANT_FEATURE_MODULES[moduleId]?.label ?? moduleId;
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <span className="text-[10px] text-gray-500">{label}</span>
      <span className="font-mono text-[10px] text-gray-400">{moduleId}</span>
      {tier === 'core' || meta?.locked ? (
        <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500">잠금</span>
      ) : null}
      {meta && !meta.inPlan ? (
        <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-600">플랜 외</span>
      ) : null}
    </span>
  );
}

function groupRows(rows: TenantNavFeatureRow[]): { groupLabel: string; items: TenantNavFeatureRow[] }[] {
  const order: string[] = [];
  const map = new Map<string, TenantNavFeatureRow[]>();
  for (const row of rows) {
    const key = row.group?.trim() || '';
    if (!map.has(key)) {
      map.set(key, []);
      order.push(key);
    }
    map.get(key)!.push(row);
  }
  return order.map((key) => ({
    groupLabel: key || '메뉴',
    items: map.get(key)!,
  }));
}

function resolveGroupModuleId(items: TenantNavFeatureRow[]): TenantFeatureModuleId | null | 'mixed' {
  const modItems = items.filter((r) => r.moduleId);
  if (modItems.length === 0) return null;
  const first = modItems[0]!.moduleId!;
  if (modItems.every((r) => r.moduleId === first)) return first;
  return 'mixed';
}

function MenuRow({
  row,
  features,
  onToggle,
  disabled,
  showToggle,
}: {
  row: TenantNavFeatureRow;
  features: PlatformTenantFeatureRow[];
  onToggle: (moduleId: string) => void;
  disabled?: boolean;
  showToggle: boolean;
}) {
  return (
    <li className="flex items-center justify-between gap-3 py-2.5 px-3 rounded-lg hover:bg-gray-50/80">
      <div className="min-w-0 flex-1">
        <div className="text-sm text-gray-900">{row.label}</div>
        <div className="mt-0.5 font-mono text-[10px] text-gray-400 truncate">{row.path}</div>
        {showToggle ? (
          <div className="mt-1">
            <ModuleBadge moduleId={row.moduleId} features={features} />
          </div>
        ) : null}
      </div>
      <div className="shrink-0">
        {showToggle && row.moduleId ? (
          <ModuleToggle
            moduleId={row.moduleId}
            features={features}
            onToggle={onToggle}
            disabled={disabled}
            size="sm"
          />
        ) : (
          <span className="text-[10px] text-gray-400 px-1">{row.moduleId ? '' : '항상'}</span>
        )}
      </div>
    </li>
  );
}

function CategoryPanel({
  category,
  features,
  onToggle,
  disabled,
}: {
  category: TenantNavFeatureCategory;
  features: PlatformTenantFeatureRow[];
  onToggle: (moduleId: string) => void;
  disabled?: boolean;
}) {
  const groups = useMemo(() => groupRows(category.rows), [category.rows]);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-gray-100 bg-gray-50/60 px-3 py-2.5 text-xs text-gray-600">
        {category.subtitle ? <p>{category.subtitle}</p> : null}
        {category.adminOnly ? (
          <p className="mt-0.5 font-medium text-violet-700">ADMIN 전용 영역</p>
        ) : null}
        {!category.subtitle && !category.adminOnly ? (
          <p>이 메뉴에 속한 화면·하위 메뉴입니다. off 시 테넌트 관리 화면에서 숨겨집니다.</p>
        ) : null}
      </div>

      {groups.map(({ groupLabel, items }) => {
        const groupModule = resolveGroupModuleId(items);
        const showGroupToggle = groupModule !== null && groupModule !== 'mixed';
        return (
          <section
            key={groupLabel}
            className="rounded-xl border border-gray-200 bg-white overflow-hidden"
          >
            <div className="flex items-center justify-between gap-3 border-b border-gray-100 bg-white px-4 py-2.5">
              <h4 className="text-xs font-semibold text-gray-800">{groupLabel}</h4>
              {showGroupToggle ? (
                <div className="flex items-center gap-2">
                  <ModuleBadge moduleId={groupModule} features={features} />
                  <ModuleToggle
                    moduleId={groupModule}
                    features={features}
                    onToggle={onToggle}
                    disabled={disabled}
                    size="sm"
                  />
                </div>
              ) : null}
            </div>
            <ul className="divide-y divide-gray-50 px-1 py-1">
              {items.map((row) => (
                <MenuRow
                  key={`${row.path}:${row.label}`}
                  row={row}
                  features={features}
                  onToggle={onToggle}
                  disabled={disabled}
                  showToggle={!showGroupToggle}
                />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

export function PlatformTenantFeatureCatalog({ features, onToggle, disabled }: Props) {
  const [activeId, setActiveId] = useState(TENANT_NAV_FEATURE_CATALOG[0]?.id ?? 'common');
  const activeCategory = TENANT_NAV_FEATURE_CATALOG.find((c) => c.id === activeId);

  return (
    <div className="mt-3 space-y-3">
      <div
        className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-thin"
        role="tablist"
        aria-label="테넌트 메인 메뉴"
      >
        {TENANT_NAV_FEATURE_CATALOG.map((category) => {
          const selected = category.id === activeId;
          return (
            <button
              key={category.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setActiveId(category.id)}
              className={[
                'shrink-0 rounded-lg px-3 py-2 text-xs font-medium transition-colors',
                selected
                  ? 'bg-gray-900 text-white shadow-sm'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50',
              ].join(' ')}
            >
              {category.label}
              {category.adminOnly ? (
                <span className={selected ? 'text-gray-300' : 'text-violet-600'}> · Admin</span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        className="rounded-xl border border-gray-200 bg-gray-50/40 p-3 sm:p-4 min-h-[240px]"
      >
        {activeCategory ? (
          <CategoryPanel
            category={activeCategory}
            features={features}
            onToggle={onToggle}
            disabled={disabled}
          />
        ) : null}
      </div>
    </div>
  );
}
