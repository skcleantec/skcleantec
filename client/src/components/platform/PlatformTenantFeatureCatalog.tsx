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
}: {
  moduleId: TenantFeatureModuleId;
  features: PlatformTenantFeatureRow[];
  onToggle: (moduleId: string) => void;
  disabled?: boolean;
}) {
  const meta = featureMeta(features, moduleId);
  if (!meta) return null;
  return (
    <PlatformToggle
      checked={meta.enabled}
      disabled={disabled || meta.locked}
      onChange={() => onToggle(moduleId)}
    />
  );
}

function RowBadge({
  row,
  features,
}: {
  row: TenantNavFeatureRow;
  features: PlatformTenantFeatureRow[];
}) {
  if (!row.moduleId) {
    return (
      <span className="inline-block rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600">
        기본 포함
      </span>
    );
  }
  const meta = featureMeta(features, row.moduleId);
  const tier = TENANT_FEATURE_MODULES[row.moduleId]?.tier;
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <span className="font-mono text-[10px] text-gray-400">{row.moduleId}</span>
      {tier === 'core' || meta?.locked ? (
        <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500">core · 잠금</span>
      ) : null}
      {meta && !meta.inPlan ? (
        <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-600">플랜 외</span>
      ) : null}
    </span>
  );
}

function CategoryBlock({
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
  let lastGroup: string | undefined;

  return (
    <section className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <div className="border-b border-gray-100 bg-gray-50/80 px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">{category.label}</h3>
            {category.subtitle ? (
              <p className="mt-0.5 text-xs text-gray-500">{category.subtitle}</p>
            ) : null}
            {category.adminOnly ? (
              <p className="mt-0.5 text-[10px] font-medium text-violet-700">ADMIN 전용 영역</p>
            ) : null}
          </div>
        </div>
      </div>
      <ul className="divide-y divide-gray-50">
        {category.rows.map((row) => {
          const showGroupHeader = row.group && row.group !== lastGroup;
          if (row.group) lastGroup = row.group;
          return (
            <li key={`${row.path}:${row.label}`}>
              {showGroupHeader ? (
                <div className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                  {row.group}
                </div>
              ) : null}
              <div className="flex items-center justify-between gap-3 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-gray-900">{row.label}</div>
                  <div className="mt-0.5 font-mono text-[11px] text-gray-400 truncate">{row.path}</div>
                  <div className="mt-1">
                    <RowBadge row={row} features={features} />
                  </div>
                </div>
                <div className="shrink-0">
                  {row.moduleId ? (
                    <ModuleToggle
                      moduleId={row.moduleId}
                      features={features}
                      onToggle={onToggle}
                      disabled={disabled}
                    />
                  ) : (
                    <span className="text-[10px] text-gray-400 px-1">—</span>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function PlatformTenantFeatureCatalog({ features, onToggle, disabled }: Props) {
  return (
    <div className="mt-3 space-y-4">
      {TENANT_NAV_FEATURE_CATALOG.map((category) => (
        <CategoryBlock
          key={category.id}
          category={category}
          features={features}
          onToggle={onToggle}
          disabled={disabled}
        />
      ))}
    </div>
  );
}
