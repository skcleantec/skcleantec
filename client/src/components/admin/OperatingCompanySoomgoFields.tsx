import type { SoomgoLoginMode } from '../../api/telecrmSoomgo';

export type OperatingCompanySoomgoForm = {
  email: string;
  password: string;
  enabled: boolean;
  hasPassword: boolean;
  loginMode: SoomgoLoginMode;
};

export function emptyOperatingCompanySoomgoForm(
  from?: {
    email?: string;
    enabled?: boolean;
    hasPassword?: boolean;
    loginMode?: SoomgoLoginMode;
  } | null,
): OperatingCompanySoomgoForm {
  return {
    email: from?.email?.trim() ?? '',
    enabled: from?.enabled !== false,
    hasPassword: from?.hasPassword === true,
    password: '',
    loginMode: from?.loginMode === 'kakao' ? 'kakao' : 'email',
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
  const isKakao = value.loginMode === 'kakao';
  return (
    <div className="rounded-lg border border-sky-100 bg-sky-50/50 p-3 space-y-3">
      <div>
        <p className="text-sm font-semibold text-sky-950">텔레CRM · 숨고 연동 (브랜드 전용)</p>
        <p className="mt-1 text-xs text-sky-900/80 leading-relaxed">
          이 브랜드를 작업 브랜드로 선택한 상담사 PC에서 숨고 로그인에 사용합니다. 비우면 텔레CRM 공통
          숨고 설정으로 대체됩니다.
        </p>
      </div>
      <fieldset className="space-y-1.5">
        <legend className="text-sm font-medium text-gray-800">로그인 방식</legend>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="radio"
            name={`${idPrefix}-soomgo-login-mode`}
            checked={!isKakao}
            onChange={() => onChange({ ...value, loginMode: 'email' })}
          />
          이메일 로그인 (자동)
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="radio"
            name={`${idPrefix}-soomgo-login-mode`}
            checked={isKakao}
            onChange={() => onChange({ ...value, loginMode: 'kakao' })}
          />
          카카오 로그인 (최초 1회 수동·QR, 이후 세션 유지)
        </label>
      </fieldset>
      {!isKakao ? (
        <>
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
        </>
      ) : (
        <p className="text-xs text-sky-900/80 leading-relaxed rounded-md border border-sky-200 bg-white/70 px-2.5 py-2">
          카카오 계정으로 숨고에 가입한 경우입니다. 「채팅 열기 / 로그인」 시 Chrome에서 카카오·QR로
          한 번 로그인하면, 같은 PC의 고정 프로필에 세션이 남아 다음부터는 다시 치지 않아도 됩니다.
        </p>
      )}
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
