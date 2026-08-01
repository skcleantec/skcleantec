import { useMemo } from 'react';
import type { PlatformTenantRow } from '../../api/platformTenants';
import { INPUT_BASE } from '../../utils/platformUi';

type PlatformTenantSelectProps = {
  value: string;
  onChange: (tenantId: string) => void;
  tenants: PlatformTenantRow[];
  loading?: boolean;
  required?: boolean;
  disabled?: boolean;
};

export function PlatformTenantSelect({
  value,
  onChange,
  tenants,
  loading = false,
  required = false,
  disabled = false,
}: PlatformTenantSelectProps) {
  const sorted = useMemo(
    () => [...tenants].sort((a, b) => a.name.localeCompare(b.name, 'ko')),
    [tenants],
  );

  return (
    <div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={INPUT_BASE}
        required={required}
        disabled={disabled || loading}
      >
        <option value="">{loading ? '업체 목록 불러오는 중…' : '업체를 선택하세요'}</option>
        {sorted.map((tenant) => (
          <option key={tenant.id} value={tenant.id}>
            {tenant.name} ({tenant.slug})
          </option>
        ))}
      </select>
      <p className="mt-1 text-fluid-2xs text-slate-500">
        파트너 업체의 로그인 코드(slug)와 추천 코드는 별도입니다. 같게 써도 됩니다.
      </p>
    </div>
  );
}
