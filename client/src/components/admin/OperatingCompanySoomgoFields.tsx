export type OperatingCompanySoomgoForm = {
  email: string;
  password: string;
  enabled: boolean;
  hasPassword: boolean;
};

export function emptyOperatingCompanySoomgoForm(
  from?: {
    email?: string;
    enabled?: boolean;
    hasPassword?: boolean;
  } | null,
): OperatingCompanySoomgoForm {
  return {
    email: from?.email?.trim() ?? '',
    enabled: from?.enabled !== false,
    hasPassword: from?.hasPassword === true,
    password: '',
  };
}

export function OperatingCompanySoomgoFields({
  value,
  onChange,
  idPrefix,
}: {
  value: OperatingCompanySoomgoForm;
  onChange: (next: OperatingCompanySoomgoForm) => void;
  idPrefix: string;
}) {
  return (
    <div className="rounded-lg border border-sky-100 bg-sky-50/50 p-3 space-y-3">
      <div>
        <p className="text-sm font-semibold text-sky-950">텔레CRM · 숨고 연동 (브랜드 전용)</p>
        <p className="mt-1 text-xs text-sky-900/80 leading-relaxed">
          이 브랜드를 작업 브랜드로 선택한 상담사 PC에서 숨고 자동 로그인에 사용합니다. 비우면
          텔레CRM 공통 숨고 설정으로 대체됩니다.
        </p>
      </div>
      <label className="block text-sm" htmlFor={`${idPrefix}-soomgo-email`}>
        <span className="font-medium text-gray-800">숨고 이메일</span>
        <input
          id={`${idPrefix}-soomgo-email`}
          type="email"
          value={value.email}
          onChange={(e) => onChange({ ...value, email: e.target.value })}
          className="mt-1 w-full border border-gray-300 rounded px-3 py-2 text-sm"
          autoComplete="off"
        />
      </label>
      <label className="block text-sm" htmlFor={`${idPrefix}-soomgo-password`}>
        <span className="font-medium text-gray-800">
          숨고 비밀번호 {value.hasPassword ? '(변경 시에만 입력)' : ''}
        </span>
        <input
          id={`${idPrefix}-soomgo-password`}
          type="password"
          value={value.password}
          onChange={(e) => onChange({ ...value, password: e.target.value })}
          placeholder={value.hasPassword ? '••••••••' : ''}
          className="mt-1 w-full border border-gray-300 rounded px-3 py-2 text-sm"
          autoComplete="new-password"
        />
      </label>
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={value.enabled}
          onChange={(e) => onChange({ ...value, enabled: e.target.checked })}
          className="rounded border-gray-300"
        />
        이 브랜드 숨고 연동 사용
      </label>
    </div>
  );
}
