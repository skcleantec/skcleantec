import {
  KAKAO_SIGNUP_OAUTH_STATE_KEY,
  buildKakaoSignupAuthorizeUrl,
} from '../../api/authSignupOAuth';

type Props = {
  restApiKey: string;
  disabled?: boolean;
};

export function KakaoSignupButton({ restApiKey, disabled }: Props) {
  const handleClick = () => {
    const state =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    sessionStorage.setItem(KAKAO_SIGNUP_OAUTH_STATE_KEY, state);
    window.location.href = buildKakaoSignupAuthorizeUrl(restApiKey, state);
  };

  if (!restApiKey) return null;

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      className="flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#FEE500] px-4 py-2.5 text-fluid-sm font-semibold text-[#191919] hover:bg-[#fada0a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#191919]/30 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
      aria-label="카카오로 가입"
    >
      <span className="inline-flex h-5 w-5 items-center justify-center rounded-sm bg-[#191919] text-[0.625rem] font-bold leading-none text-[#FEE500]">
        K
      </span>
      카카오로 시작
    </button>
  );
}
