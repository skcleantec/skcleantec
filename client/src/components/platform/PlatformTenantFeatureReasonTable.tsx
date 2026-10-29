import type { PlatformTenantFeatureRow } from '../../api/platformTenants';

function individualLabel(row: PlatformTenantFeatureRow): string {
  if (row.locked || (row.inPlan && row.enabled)) return '기본 따름';
  if (row.enabled && !row.inPlan) return '켜기';
  return '끄기';
}

function reasonLabel(row: PlatformTenantFeatureRow): string {
  if (row.locked || (row.inPlan && row.enabled)) return '플랜 기본';
  if (!row.inPlan && row.enabled) return '개별 켜기';
  if (row.inPlan && !row.enabled) return '개별 끄기';
  return '메뉴 숨김';
}

export function PlatformTenantFeatureReasonTable({ features }: { features: PlatformTenantFeatureRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-center text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-xs text-gray-500">
            <th className="px-2 py-2 text-center font-medium">기능</th>
            <th className="px-2 py-2 text-center font-medium">플랜 기본</th>
            <th className="px-2 py-2 text-center font-medium">개별 설정</th>
            <th className="px-2 py-2 text-center font-medium">최종</th>
            <th className="px-2 py-2 text-center font-medium">이유</th>
          </tr>
        </thead>
        <tbody>
          {features.map((row) => (
            <tr key={row.moduleId} className="border-b border-gray-100">
              <td className="px-2 py-2 text-center text-gray-900">{row.label}</td>
              <td className="px-2 py-2 text-center text-gray-600">{row.inPlan ? '포함' : '미포함'}</td>
              <td className="px-2 py-2 text-center text-gray-600">{individualLabel(row)}</td>
              <td className="px-2 py-2 text-center font-medium text-gray-900">{row.effective ? '켜짐' : '꺼짐'}</td>
              <td className="px-2 py-2 text-center text-gray-500">{reasonLabel(row)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
