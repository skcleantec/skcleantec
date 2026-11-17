import { useEffect, useState } from 'react';
import { useOperatingCompanies } from '../../../hooks/useOperatingCompanies';
import { useCrmWorkBrand } from '../../../hooks/useCrmWorkBrand';
import type { OperatingCompanyItem } from '../../../api/operatingCompanies';
import { getToken } from '../../../stores/auth';

/** 숨고 자동메시지 설정 — 지금 작업 중인 브랜드로 시작. 업체 기본 선택지는 없다. */
export function useTelecrmAutoMessageBrandId() {
  const token = getToken();
  const brands = useOperatingCompanies(token);
  const { activeOperatingCompanyId, loading } = useCrmWorkBrand();
  const [brandId, setBrandId] = useState('');

  useEffect(() => {
    if (brandId && brands.some((b) => b.id === brandId)) return;
    if (activeOperatingCompanyId && brands.some((b) => b.id === activeOperatingCompanyId)) {
      setBrandId(activeOperatingCompanyId);
      return;
    }
    if (!loading && brands[0]) setBrandId(brands[0].id);
  }, [activeOperatingCompanyId, brandId, brands, loading]);

  return { brandId, setBrandId, ready: Boolean(brandId), empty: !loading && brands.length === 0 };
}

/** 텔레CRM 설정 — 브랜드(OperatingCompany) 선택 */
export function TelecrmBrandSelect({
  token,
  value,
  onChange,
  className = 'min-w-[8rem] rounded-lg border border-slate-300 bg-white px-2 py-1 text-fluid-2xs',
  defaultOptionLabel = '업체 기본',
  allowDefault = true,
}: {
  token: string | null;
  value: string;
  onChange: (brandId: string) => void;
  className?: string;
  defaultOptionLabel?: string;
  /** 문자 템플릿 등 공통 선택이 필요한 화면만 true */
  allowDefault?: boolean;
}) {
  const brands = useOperatingCompanies(token);

  return (
    <label className="flex flex-wrap items-center gap-2 text-fluid-2xs text-slate-700">
      <span className="font-medium">브랜드</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={className}>
        {allowDefault ? <option value="default">{defaultOptionLabel}</option> : null}
        {brands.map((b: OperatingCompanyItem) => (
          <option key={b.id} value={b.id}>
            {b.displayName}
          </option>
        ))}
      </select>
    </label>
  );
}
