import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  fetchKakaoSignupOAuthConfig,
  getLinkKakaoRedirectUri,
  KAKAO_LINK_OAUTH_STATE_KEY,
  buildKakaoLinkAuthorizeUrl,
} from '../../api/authSignupOAuth';
import {
  fetchOAuthIdentities,
  linkKakaoOAuthAccount,
  unlinkKakaoOAuthAccount,
  type OAuthIdentityItem,
} from '../../api/authOAuthLink';
import { isAuthSessionExpiredError } from '../../api/auth';
import { getToken } from '../../stores/auth';
import { getTeamToken } from '../../stores/teamAuth';
import { useLoginScrollSurface } from '../../hooks/useMobileInputVisibility';

function resolveStaffKakaoLinkAuthToken(): string | null {
  return getToken() ?? getTeamToken();
}

export function AdminKakaoLinkPage() {
  const token = resolveStaffKakaoLinkAuthToken();
  const backHref = getToken() ? '/admin/dashboard' : '/team/dashboard';
  const backLabel = getToken() ? '← 대시보드' : '← 팀 대시보드';
  const location = useLocation();
  const navigate = useNavigate();
  const { scrollRef, onFieldFocus } = useLoginScrollSurface();

  const [loading, setLoading] = useState(true);
  const [kakaoEnabled, setKakaoEnabled] = useState(false);
  const [kakaoRestApiKey, setKakaoRestApiKey] = useState('');
  const [identities, setIdentities] = useState<OAuthIdentityItem[]>([]);
  const [password, setPassword] = useState('');
  const [pendingCode, setPendingCode] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const oauthCallbackHandledRef = useRef(false);

  const kakaoIdentity = identities.find((row) => row.provider === 'kakao') ?? null;

  const reloadIdentities = useCallback(async () => {
    if (!token) return;
    const items = await fetchOAuthIdentities(token);
    setIdentities(items);
  }, [token]);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError('');
      try {
        const [config, items] = await Promise.all([
          fetchKakaoSignupOAuthConfig(),
          fetchOAuthIdentities(token),
        ]);
        if (cancelled) return;
        setKakaoEnabled(Boolean(config.enabled && config.restApiKey));
        setKakaoRestApiKey(config.restApiKey ?? '');
        setIdentities(items);
      } catch (e) {
        if (cancelled) return;
        if (isAuthSessionExpiredError(e)) {
          navigate('/login', { replace: true, state: { sessionExpired: true } });
          return;
        }
        setError(e instanceof Error ? e.message : '설정을 불러오지 못했습니다.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate, token]);

  useEffect(() => {
    if (oauthCallbackHandledRef.current) return;
    const params = new URLSearchParams(location.search);
    const oauthError = params.get('error')?.trim();
    const code = params.get('code')?.trim();
    if (!oauthError && !code) return;

    oauthCallbackHandledRef.current = true;
    const nextParams = new URLSearchParams(location.search);
    nextParams.delete('code');
    nextParams.delete('state');
    nextParams.delete('error');
    nextParams.delete('error_description');
    const nextSearch = nextParams.toString();
    navigate(`${location.pathname}${nextSearch ? `?${nextSearch}` : ''}`, { replace: true });

    if (oauthError) {
      setError('카카오 인증이 취소되었거나 실패했습니다.');
      return;
    }
    if (!code) return;

    const savedState = sessionStorage.getItem(KAKAO_LINK_OAUTH_STATE_KEY)?.trim() ?? '';
    const returnedState = params.get('state')?.trim() ?? '';
    sessionStorage.removeItem(KAKAO_LINK_OAUTH_STATE_KEY);

    if (!savedState || savedState !== returnedState) {
      setError('카카오 인증 상태가 올바르지 않습니다. 다시 시도해 주세요.');
      return;
    }

    setPendingCode(code);
    setMessage('카카오 인증이 완료되었습니다. 비밀번호를 입력하고 「연결 완료」를 눌러 주세요.');
  }, [location.pathname, location.search, navigate]);

  const startKakaoLink = () => {
    if (!kakaoRestApiKey) return;
    const state =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    sessionStorage.setItem(KAKAO_LINK_OAUTH_STATE_KEY, state);
    window.location.href = buildKakaoLinkAuthorizeUrl(kakaoRestApiKey, state);
  };

  const completeLink = async () => {
    if (!token || !pendingCode) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await linkKakaoOAuthAccount(token, {
        code: pendingCode,
        redirectUri: getLinkKakaoRedirectUri(),
        password,
      });
      setPendingCode(null);
      setPassword('');
      setMessage('카카오 계정이 연결되었습니다. 이제 카카오로 로그인할 수 있습니다.');
      await reloadIdentities();
    } catch (e) {
      if (isAuthSessionExpiredError(e)) {
        navigate('/login', { replace: true, state: { sessionExpired: true } });
        return;
      }
      setError(e instanceof Error ? e.message : '카카오 계정 연결에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const handleUnlink = async () => {
    if (!token) return;
    if (!window.confirm('카카오 연결을 해제하면 카카오로 로그인할 수 없습니다. 계속할까요?')) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await unlinkKakaoOAuthAccount(token, password);
      setPassword('');
      setMessage('카카오 연결이 해제되었습니다.');
      await reloadIdentities();
    } catch (e) {
      if (isAuthSessionExpiredError(e)) {
        navigate('/login', { replace: true, state: { sessionExpired: true } });
        return;
      }
      setError(e instanceof Error ? e.message : '카카오 연결 해제에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  if (!token) {
    return (
      <div className="py-8 text-center text-fluid-xs text-slate-500">로그인이 필요합니다.</div>
    );
  }

  return (
    <div
      ref={scrollRef}
      onFocusCapture={onFieldFocus}
      className="login-surface mx-auto w-full max-w-lg overflow-y-auto overscroll-y-contain"
    >
      <div className="login-scroll-content rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm">
        <Link
          to={backHref}
          className="text-fluid-xs text-slate-600 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
        >
          {backLabel}
        </Link>
        <h1 className="mt-3 text-fluid-sm font-semibold text-slate-900">카카오 계정 연결</h1>
        <p className="mt-2 text-fluid-2xs leading-snug text-slate-600">
          아이디·비밀번호로 사용 중인 관리자·마케터·팀장 계정에 카카오 로그인을 연결합니다. 연결 전 본인
          확인을 위해 비밀번호가 필요합니다.
        </p>

        {loading ? (
          <p className="mt-6 text-fluid-xs text-slate-500">불러오는 중…</p>
        ) : !kakaoEnabled ? (
          <p className="mt-6 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-fluid-2xs text-amber-900">
            카카오 로그인이 아직 설정되지 않았습니다. 운영 설정을 확인해 주세요.
          </p>
        ) : (
          <div className="mt-4 space-y-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
              <p className="text-fluid-2xs font-medium text-slate-700">연결 상태</p>
              {kakaoIdentity ? (
                <p className="mt-1 text-fluid-xs text-slate-900">
                  카카오 연결됨
                  {kakaoIdentity.providerEmail ? (
                    <span className="text-slate-600"> · {kakaoIdentity.providerEmail}</span>
                  ) : null}
                </p>
              ) : (
                <p className="mt-1 text-fluid-xs text-slate-600">연결된 카카오 계정 없음</p>
              )}
            </div>

            {message ? (
              <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-fluid-2xs text-emerald-900">
                {message}
              </p>
            ) : null}
            {error ? (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-fluid-2xs text-red-800">
                {error}
              </p>
            ) : null}

            <label className="block">
              <span className="mb-1 block text-fluid-2xs font-medium text-slate-600">비밀번호 확인</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="login-field-input w-full min-h-10 rounded-lg border border-slate-300 px-3 text-fluid-xs"
                placeholder="현재 비밀번호"
                autoComplete="current-password"
              />
            </label>

            {pendingCode ? (
              <button
                type="button"
                onClick={() => void completeLink()}
                disabled={busy || !password.trim()}
                className="min-h-10 w-full rounded-lg bg-slate-900 px-4 text-fluid-xs font-medium text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
              >
                {busy ? '연결 중…' : '연결 완료'}
              </button>
            ) : kakaoIdentity ? (
              <button
                type="button"
                onClick={() => void handleUnlink()}
                disabled={busy || !password.trim()}
                className="min-h-10 w-full rounded-lg border border-red-300 bg-white px-4 text-fluid-xs font-medium text-red-700 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
              >
                {busy ? '처리 중…' : '카카오 연결 해제'}
              </button>
            ) : (
              <button
                type="button"
                onClick={startKakaoLink}
                disabled={busy}
                className="flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#FEE500] px-4 text-fluid-xs font-semibold text-[#191919] hover:bg-[#fada0a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#191919]/30 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
              >
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-sm bg-[#191919] text-[0.625rem] font-bold leading-none text-[#FEE500]">
                  K
                </span>
                카카오 계정 연결하기
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
