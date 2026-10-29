import type { PlatformTenantFeatureRow } from '../../api/platformTenants';
import { PlatformStatusBadge } from './PlatformStatusBadge';
import {
  featureSelectMode,
  previewEffective,
  previewReason,
  type FeatureSelectMode,
} from './platformFeatureChoice';

type Props = {
  features: PlatformTenantFeatureRow[];
  plan: string;
  disabled?: boolean;
  onChange: (moduleId: string, mode: FeatureSelectMode) => void;
};

export function PlatformTenantFeatureReasonTable({ features, plan, disabled, onChange }: Props) {
  const enabledModules = features
    .filter((row) => previewEffective(row, featureSelectMode(row)))
    .map((row) => row.moduleId);

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-fluid-sm">
        <thead>
          <tr className="border-b border-gray-200 text-fluid-xs text-gray-500">
            <th className="px-2 py-2 text-center font-medium">기능</th>
            <th className="px-2 py-2 text-center font-medium">플랜 기본</th>
            <th className="px-2 py-2 text-center font-medium">개별 설정</th>
            <th className="px-2 py-2 text-center font-medium">최종</th>
            <th className="px-2 py-2 text-center font-medium">이유</th>
          </tr>
        </thead>
        <tbody>
          {features.map((row) => {
            const mode = featureSelectMode(row);
            const on = previewEffective(row, mode);
            const reason = previewReason(row, mode, plan, enabledModules);
            return (
              <tr key={row.moduleId} className="border-b border-gray-100">
                <td className="px-2 py-1.5 text-left text-gray-900">{row.label}</td>
                <td className="px-2 py-1.5 text-left text-gray-700">{row.inPlan ? '포함' : '미포함'}</td>
                <td className="px-2 py-1.5 text-left">
                  <select
                    aria-label={`${row.label} 개별 설정`}
                    value={mode}
                    disabled={disabled || row.locked}
                    onChange={(e) => onChange(row.moduleId, e.target.value as FeatureSelectMode)}
                    className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-fluid-xs text-gray-800 hover:border-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="inherit">기본 따름</option>
                    <option value="on">켜기</option>
                    <option value="off">끄기</option>
                  </select>
                </td>
                <td className="px-2 py-1.5 text-left">
                  <PlatformStatusBadge tone={row.locked ? 'lock' : on ? 'ok' : 'muted'}>
                    {row.locked ? '잠김' : on ? '켜짐' : '꺼짐'}
                  </PlatformStatusBadge>
                </td>
                <td className="px-2 py-1.5 text-left text-gray-600">{reason}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
