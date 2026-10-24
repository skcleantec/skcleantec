import { Link } from 'react-router-dom';
import { TENANT_FEATURE_MODULES, moduleUpsellDescription, type TenantFeatureModuleId } from '@shared/tenantFeatureModules';
import { LineMdIcon } from '../ui/LineMdIcon';

type Props = {
  module: TenantFeatureModuleId;
  planLabel: string;
};

/** 잠긴 메뉴를 열었을 때 본문. 대시보드로 보내지 않는다. */
export function PlanLockedNotice({ module, planLabel }: Props) {
  const name = TENANT_FEATURE_MODULES[module].label;
  const description = moduleUpsellDescription(module);
  return (
    <div className="mx-auto flex min-h-[40vh] w-full max-w-md items-center px-3 py-6">
      <section className="w-full rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex items-center gap-2">
          <LineMdIcon name="lock" className="size-5 text-slate-700" />
          <h1 className="text-fluid-sm font-semibold text-slate-900">{name}</h1>
        </div>
        <p className="mt-2 text-fluid-xs leading-snug text-slate-600">{description}</p>
        <p className="mt-3 text-fluid-xs text-slate-800">
          이 기능은 <span className="font-semibold">{planLabel}</span>부터 사용할 수 있습니다.
        </p>
        <Link
          to="/admin/subscription"
          className="mt-4 inline-flex min-h-10 items-center justify-center rounded-lg bg-slate-900 px-4 text-fluid-sm font-medium text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
        >
          업그레이드 보기
        </Link>
      </section>
    </div>
  );
}
