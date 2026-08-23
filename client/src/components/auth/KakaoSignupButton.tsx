import {
  KAKAO_LOGIN_OAUTH_STATE_KEY,
  KAKAO_LOGIN_OAUTH_TENANT_KEY,
  KAKAO_SIGNUP_OAUTH_STATE_KEY,
  buildKakaoLoginAuthorizeUrl,
  buildKakaoSignupAuthorizeUrl,
} from '../../api/authSignupOAuth';

type Props = {
  restApiKey: string;
  disabled?: boolean;
  mode?: 'signup' | 'login';
  tenantSlug?: string;
};

export function KakaoSignupButton({
  restApiKey,
  disabled,
  mode = 'signup',
  tenantSlug = '',
}: Props) {
  const handleClick = () => {
    if (mode === 'login' && !tenantSlug.trim()) return;
    const state =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const stateKey = mode === 'login' ? KAKAO_LOGIN_OAUTH_STATE_KEY : KAKAO_SIGNUP_OAUTH_STATE_KEY;
    sessionStorage.setItem(stateKey, state);
    if (mode === 'login') {
      sessionStorage.setItem(KAKAO_LOGIN_OAUTH_TENANT_KEY, tenantSlug.trim().toLowerCase());
    }
    window.location.href =
      mode === 'login'
        ? buildKakaoLoginAuthorizeUrl(restApiKey, state)
        : buildKakaoSignupAuthorizeUrl(restApiKey, state);
  };

  if (!restApiKey) return null;

  const label = mode === 'login' ? '카카오로 로그인' : '카카오로 시작';
  const loginDisabled = disabled || (mode === 'login' && !tenantSlug.trim());

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loginDisabled}
      className="flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#FEE500] px-4 py-2.5 text-fluid-sm font-semibold text-[#191919] hover:bg-[#fada0a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#191919]/30 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
      aria-label={label}
    >
      <span className="inline-flex h-5 w-5 items-center justify-center rounded-sm bg-[#191919] text-[0.625rem] font-bold leading-none text-[#FEE500]">
        K
      </span>
      {label}
    </button>
  );
}
