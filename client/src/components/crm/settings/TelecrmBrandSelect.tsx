import { useOperatingCompanies } from '../../../hooks/useOperatingCompanies';
import type { OperatingCompanyItem } from '../../../api/operatingCompanies';

/** 텔레CRM 설정 — 브랜드(OperatingCompany) 선택 */
export function TelecrmBrandSelect({
  token,
  value,
  onChange,
  className = 'min-w-[8rem] rounded border border-gray-300 bg-white px-2 py-1 text-[11px]',
  defaultOptionLabel = '업체 기본',
}: {
  token: string | null;
  value: string;
  onChange: (brandId: string) => void;
  className?: string;
  defaultOptionLabel?: string;
}) {
  const brands = useOperatingCompanies(token);

  return (
    <label className="flex flex-wrap items-center gap-2 text-[11px] text-gray-700">
      <span className="font-medium">브랜드</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={className}>
        <option value="default">{defaultOptionLabel}</option>
        {brands.map((b: OperatingCompanyItem) => (
          <option key={b.id} value={b.id}>
            {b.displayName}
          </option>
        ))}
      </select>
    </label>
  );
}
