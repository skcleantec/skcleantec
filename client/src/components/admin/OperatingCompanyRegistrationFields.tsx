import type { TenantCompanyRegistration } from '@shared/tenantCompanyProfile';

type Props = {
  value: TenantCompanyRegistration;
  onChange: (next: TenantCompanyRegistration) => void;
  idPrefix?: string;
};

export function OperatingCompanyRegistrationFields({ value, onChange, idPrefix = 'oc-reg' }: Props) {
  const set = (key: keyof TenantCompanyRegistration, raw: string) => {
    onChange({ ...value, [key]: raw });
  };

  return (
    <fieldset className="space-y-3 rounded-lg border border-gray-200 bg-gray-50/80 p-3">
      <legend className="px-1 text-sm font-semibold text-gray-800">사업자 정보 (견적서 공급자)</legend>
      <p className="text-xs text-gray-500 -mt-1">
        이 브랜드 전용 상호·사업자번호 등입니다. 비워 두면 업체 기본 사업자 정보가 사용됩니다.
      </p>
      <label className="block text-sm">
        <span className="font-medium text-gray-800">상호</span>
        <input
          id={`${idPrefix}-companyName`}
          value={value.companyName ?? ''}
          onChange={(e) => set('companyName', e.target.value)}
          className="mt-1 w-full border border-gray-300 rounded px-3 py-2 text-sm"
        />
      </label>
      <label className="block text-sm">
        <span className="font-medium text-gray-800">대표자명</span>
        <input
          value={value.representativeName ?? ''}
          onChange={(e) => set('representativeName', e.target.value)}
          className="mt-1 w-full border border-gray-300 rounded px-3 py-2 text-sm"
        />
      </label>
      <label className="block text-sm">
        <span className="font-medium text-gray-800">사업자등록번호</span>
        <input
          value={value.businessRegistrationNo ?? ''}
          onChange={(e) => set('businessRegistrationNo', e.target.value)}
          className="mt-1 w-full border border-gray-300 rounded px-3 py-2 text-sm"
        />
      </label>
      <label className="block text-sm">
        <span className="font-medium text-gray-800">주소</span>
        <input
          value={value.addressLine ?? ''}
          onChange={(e) => set('addressLine', e.target.value)}
          className="mt-1 w-full border border-gray-300 rounded px-3 py-2 text-sm"
        />
      </label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block text-sm">
          <span className="font-medium text-gray-800">전화</span>
          <input
            value={value.phone ?? ''}
            onChange={(e) => set('phone', e.target.value)}
            className="mt-1 w-full border border-gray-300 rounded px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-gray-800">팩스</span>
          <input
            value={value.fax ?? ''}
            onChange={(e) => set('fax', e.target.value)}
            className="mt-1 w-full border border-gray-300 rounded px-3 py-2 text-sm"
          />
        </label>
      </div>
      <label className="block text-sm">
        <span className="font-medium text-gray-800">이메일</span>
        <input
          type="email"
          value={value.contactEmail ?? ''}
          onChange={(e) => set('contactEmail', e.target.value)}
          className="mt-1 w-full border border-gray-300 rounded px-3 py-2 text-sm"
        />
      </label>
    </fieldset>
  );
}

function pickRegistrationFields(
  source: Partial<TenantCompanyRegistration> | undefined,
): TenantCompanyRegistration {
  return {
    companyName: source?.companyName ?? '',
    representativeName: source?.representativeName ?? '',
    businessRegistrationNo: source?.businessRegistrationNo ?? '',
    addressLine: source?.addressLine ?? '',
    phone: source?.phone ?? '',
    fax: source?.fax ?? '',
    contactEmail: source?.contactEmail ?? '',
  };
}

export function companyRegistrationFromForm(
  value: TenantCompanyRegistration,
): Partial<TenantCompanyRegistration> | undefined {
  const out: Partial<TenantCompanyRegistration> = {};
  for (const [key, raw] of Object.entries(value) as [keyof TenantCompanyRegistration, string][]) {
    const trimmed = raw.trim();
    if (trimmed) out[key] = trimmed;
  }
  return Object.keys(out).length > 0 ? out : {};
}

export { pickRegistrationFields as emptyCompanyRegistrationForm };
