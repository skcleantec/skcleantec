import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation, Link, type Location as RouterLocation } from 'react-router-dom';
import {
  login,
  getMe,
  isAuthSessionExpiredError,
  loginWithGoogleOAuth,
  loginWithKakaoOAuth,
  type StaffLoginResponse,
} from '../api/auth';
import { persistAuthMeSnapshot } from '../api/authMeSnapshot';
import { loginCrew, getCrewMe } from '../api/crew';
import {
  fetchGoogleSignupOAuthConfig,
  fetchKakaoSignupOAuthConfig,
  getLoginKakaoRedirectUri,
  KAKAO_LOGIN_OAUTH_STATE_KEY,
} from '../api/authSignupOAuth';
import { GoogleSignupButton } from '../components/auth/GoogleSignupButton';
import { KakaoSignupButton } from '../components/auth/KakaoSignupButton';
import { getToken, setToken, clearToken } from '../stores/auth';
import { getTeamToken, setTeamToken, clearTeamToken } from '../stores/teamAuth';
import { getCrewToken, setCrewToken, clearCrewToken } from '../stores/crewAuth';
import { PLATFORM_NAME, PLATFORM_NAME_EN } from '@shared/platformBrand';
import { resolveTenantSlugForLoginForm, sanitizeLoginTenantSlug } from '../utils/loginTenantSlug';
import { saveTenantSlug } from '../utils/tenantSlug';
import {
  loadSavedLoginCredentials,
  saveLoginCredentials,
  clearSavedLoginCredentials,
} from '../utils/loginCredentialsStorage';
import {
  readResumeLocation as readStoredResumeLocation,
  clearResumeLocation,
} from '../api/sessionGate';
import { useLoginScrollSurface } from '../hooks/useMobileInputVisibility';
import { PlayStoreStaffAppLink } from '../components/auth/PlayStoreStaffAppLink';
import { LOGIN_BACKGROUND_SRC } from '@shared/brandLogo';
import { ORDER_FORM_PLATFORM_FOOTER } from '@shared/orderFormPlatformFooter';

/** ProtectedRoute / TeamProtectedRoute / CrmPopupEntry 가 넘긴 `state.from` 만 안전하게 읽기 */
function readResumeLocationFromState(state: unknown): RouterLocation | undefined {
  if (!state || typeof state !== 'object') return undefined;
  const rec = state as { from?: unknown };
  if (!rec.from || typeof rec.from !== 'object') return undefined;
  const from = rec.from as { pathname?: unknown };
  if (typeof from.pathname !== 'string') return undefined;
  return rec.from as RouterLocation;
}

function readResumeLocationFromStorage(): RouterLocation | undefined {
  const stored = readStoredResumeLocation();
  if (!stored) return undefined;
  return {
    pathname: stored.pathname,
    search: stored.search,
    hash: stored.hash,
    state: null,
    key: 'default',
  } as RouterLocation;
}

/** Navigate state 우선, 세션 만료 시 sessionStorage 보조 */
function resolveLoginResumeLocation(state: unknown): RouterLocation | undefined {
  return readResumeLocationFromState(state) ?? readResumeLocationFromStorage();
}

function resolveAdminResumePath(from: RouterLocation | undefined): string {
  const fallback = '/admin/dashboard';
  if (!from?.pathname) return fallback;
  const p = from.pathname;
  if (p === '/login' || p === '/admin/login') return fallback;
  if (p === '/team' || p.startsWith('/team/')) return fallback;
  if (p === '/crew' || p.startsWith('/crew/')) return fallback;
  if (p === '/admin' || p.startsWith('/admin/')) {
    return `${p}${from.search ?? ''}${from.hash ?? ''}`;
  }
  return fallback;
}

function staffOAuthLoginErrorMessage(err: unknown, fallback: string): string {
  const msg = err instanceof Error ? err.message : fallback;
  if (msg.includes('연결된 Google·카카오 계정이 없습니다')) {
    return `${msg} 기존 아이디·비밀번호로 로그인한 뒤, 프로필 메뉴의 「카카오 계정 연결」에서 연결할 수 있습니다.`;
  }
  return msg;
}

function resolveTeamResumePath(from: RouterLocation | undefined): string {
  const fallback = '/team/dashboard';
  if (!from?.pathname) return fallback;
  const p = from.pathname;
  if (p === '/login' || p === '/admin/login') return fallback;
  if (p === '/admin' || p.startsWith('/admin/')) return fallback;
  if (p === '/crew' || p.startsWith('/crew/')) return fallback;
  if (p === '/team' || p.startsWith('/team/')) {
    return `${p}${from.search ?? ''}${from.hash ?? ''}`;
  }
  return fallback;
}

function resolveCrewResumePath(from: RouterLocation | undefined): string {
  const fallback = '/crew';
  if (!from?.pathname) return fallback;
  const p = from.pathname;
  if (p === '/login' || p === '/admin/login') return fallback;
  if (p === '/admin' || p.startsWith('/admin/')) return fallback;
  if (p === '/team' || p.startsWith('/team/')) return fallback;
  if (p === '/crew' || p.startsWith('/crew/')) {
    return `${p}${from.search ?? ''}${from.hash ?? ''}`;
  }
  return fallback;
}

function resolveDualTokenResumePath(from: RouterLocation | undefined): string {
  if (from?.pathname?.startsWith('/team')) return resolveTeamResumePath(from);
  if (from?.pathname?.startsWith('/admin')) return resolveAdminResumePath(from);
  return '/admin/dashboard';
}

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const sessionExpired = Boolean((location.state as { sessionExpired?: boolean } | null)?.sessionExpired);
  const billingAccessBlocked = Boolean(
    (location.state as { billingAccessBlocked?: boolean } | null)?.billingAccessBlocked,
  );
  const billingBlockedMessage =
    (location.state as { billingMessage?: string } | null)?.billingMessage?.trim() ||
    '이용료 미납으로 업무 접속이 제한되었습니다. 관리자에게 문의해 주세요.';
  const signupComplete = new URLSearchParams(location.search).get('signup') === '1';
  const signupGoogleComplete = new URLSearchParams(location.search).get('signup') === 'google';
  const signupKakaoComplete = new URLSearchParams(location.search).get('signup') === 'kakao';
  const passwordResetComplete = new URLSearchParams(location.search).get('passwordReset') === '1';
  /** 로그인 제출 시 증가 — 진행 중인 자동 `getMe`가 새 토큰·저장소를 덮어쓰지 않도록 */
  const sessionProbeGen = useRef(0);
  const devCrewInitRef = useRef(false);
  const loginFormInitRef = useRef(false);

  const [tenantSlug, setTenantSlug] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberLogin, setRememberLogin] = useState(false);
  const [crewLoginMode, setCrewLoginMode] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleOAuthEnabled, setGoogleOAuthEnabled] = useState(false);
  const [googleClientId, setGoogleClientId] = useState('');
  const [kakaoOAuthEnabled, setKakaoOAuthEnabled] = useState(false);
  const [kakaoRestApiKey, setKakaoRestApiKey] = useState('');
  const [oauthVerifying, setOauthVerifying] = useState(false);
  const kakaoLoginCallbackHandledRef = useRef(false);
  const showGoogleOAuthLogin = googleOAuthEnabled && !!googleClientId;
  const showKakaoOAuthLogin = kakaoOAuthEnabled && !!kakaoRestApiKey;
  const showSnsOAuthSection = !crewLoginMode && (showGoogleOAuthLogin || showKakaoOAuthLogin);
  const [tenantBrand, setTenantBrand] = useState<{ displayName: string; loginSubtitle: string | null } | null>(null);
  const { scrollRef, onFieldFocus } = useLoginScrollSurface();

  /** 업체 코드가 채워지면 해당 업체 표시명·로그인 부제를 공개 정보에서 조회 */
  useEffect(() => {
    const slug = tenantSlug.trim().toLowerCase();
    if (!slug || !/^[a-z0-9](?:[a-z0-9-]{0,46}[a-z0-9])?$/.test(slug)) {
      setTenantBrand(null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      void fetch(`/api/tenant/public-info?slug=${encodeURIComponent(slug)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((body: { displayName?: string; loginSubtitle?: string | null } | null) => {
          if (cancelled) return;
          if (body?.displayName?.trim()) {
            setTenantBrand({ displayName: body.displayName.trim(), loginSubtitle: body.loginSubtitle ?? null });
          } else {
            setTenantBrand(null);
          }
        })
        .catch(() => {
          if (!cancelled) setTenantBrand(null);
        });
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [tenantSlug]);

  useEffect(() => {
    let cancelled = false;
    void fetchGoogleSignupOAuthConfig()
      .then((cfg) => {
        if (cancelled) return;
        setGoogleOAuthEnabled(cfg.enabled);
        setGoogleClientId(cfg.clientId);
      })
      .catch(() => {
        if (!cancelled) {
          setGoogleOAuthEnabled(false);
          setGoogleClientId('');
        }
      });
    void fetchKakaoSignupOAuthConfig()
      .then((cfg) => {
        if (cancelled) return;
        setKakaoOAuthEnabled(cfg.enabled);
        setKakaoRestApiKey(cfg.restApiKey);
      })
      .catch(() => {
        if (!cancelled) {
          setKakaoOAuthEnabled(false);
          setKakaoRestApiKey('');
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const tenantFromQuery = new URLSearchParams(location.search).get('tenant')?.trim().toLowerCase();
    if (tenantFromQuery && /^[a-z0-9](?:[a-z0-9-]{0,46}[a-z0-9])?$/.test(tenantFromQuery)) {
      setTenantSlug((prev) => (prev.trim() ? prev : tenantFromQuery));
    }
  }, [location.search]);

  useEffect(() => {
    if (loginFormInitRef.current) return;
    loginFormInitRef.current = true;

    const slugFromEnv = resolveTenantSlugForLoginForm();
    const saved = loadSavedLoginCredentials();

    if (saved?.remember) {
      setRememberLogin(true);
      setEmail(saved.loginId);
      setPassword(saved.password);
      if (saved.crewMode) setCrewLoginMode(true);
      setTenantSlug(sanitizeLoginTenantSlug(saved.tenantSlug) || slugFromEnv);
    } else {
      setTenantSlug(slugFromEnv);
    }
  }, []);

  const toggleCrewLoginMode = () => {
    setCrewLoginMode((prev) => {
      const next = !prev;
      const saved = loadSavedLoginCredentials();
      if (saved?.remember && saved.crewMode === next) {
        setEmail(saved.loginId);
        setPassword(saved.password);
        setTenantSlug(sanitizeLoginTenantSlug(saved.tenantSlug) || resolveTenantSlugForLoginForm());
      }
      return next;
    });
  };

  const persistLoginCredentials = (crewMode: boolean) => {
    const slug = tenantSlug.trim().toLowerCase();
    if (slug) saveTenantSlug(slug);
    if (rememberLogin) {
      saveLoginCredentials({
        tenantSlug: tenantSlug.trim(),
        loginId: email.trim(),
        password,
        crewMode,
      });
    } else {
      clearSavedLoginCredentials();
    }
  };

  /** 관리자 미리보기 → 크루 로그인: 토큰 정리 후 크루 폼만 남김 */
  useEffect(() => {
    const sp = new URLSearchParams(location.search);
    if (sp.get('devCrew') !== '1') return;
    if (devCrewInitRef.current) return;
    devCrewInitRef.current = true;
    sessionProbeGen.current += 1;
    clearToken();
    clearTeamToken();
    clearCrewToken();
    const lid = sp.get('loginId')?.trim() ?? '';
    setCrewLoginMode(true);
    if (lid) setEmail(lid);
    navigate('/login', { replace: true, state: location.state });
  }, [navigate, location.search, location.state]);

  useEffect(() => {
    const sp = new URLSearchParams(location.search);
    if (sp.get('devCrew') === '1') return;
    let cancelled = false;
    const a = getToken();
    const t = getTeamToken();
    let c = getCrewToken();
    if (c && (a || t)) {
      clearCrewToken();
      c = getCrewToken();
    }
    if (!a && !t && !c) return;

    void (async () => {
      const myGen = sessionProbeGen.current;
      const resumeFrom = resolveLoginResumeLocation(location.state);
      try {
        if (a && !t && !c) {
          await getMe(a);
          if (cancelled || sessionProbeGen.current !== myGen) return;
          if (getToken() !== a) return;
          navigate(resolveAdminResumePath(resumeFrom), { replace: true });
          return;
        }
        if (t && !a && !c) {
          await getMe(t);
          if (cancelled || sessionProbeGen.current !== myGen) return;
          if (getTeamToken() !== t) return;
          navigate(resolveTeamResumePath(resumeFrom), { replace: true });
          return;
        }
        if (c && !a && !t) {
          await getCrewMe(c);
          if (cancelled || sessionProbeGen.current !== myGen) return;
          if (getCrewToken() !== c) return;
          navigate(resolveCrewResumePath(resumeFrom), { replace: true });
          return;
        }
        if (a && t) {
          if (a === t) {
            await getMe(a);
            if (cancelled || sessionProbeGen.current !== myGen) return;
            if (getToken() !== a || getTeamToken() !== t) return;
            navigate(resolveDualTokenResumePath(resumeFrom), { replace: true });
            return;
          }
          clearToken();
          clearTeamToken();
        }
      } catch (e) {
        if (cancelled || sessionProbeGen.current !== myGen) return;
        if (!isAuthSessionExpiredError(e)) return;
        if (a && !t && !c) {
          if (getToken() === a) clearToken();
          return;
        }
        if (t && !a && !c) {
          if (getTeamToken() === t) clearTeamToken();
          return;
        }
        if (c && !a && !t) {
          if (getCrewToken() === c) clearCrewToken();
          return;
        }
        if (a && t && a === t) {
          if (getToken() === a && getTeamToken() === t) {
            clearToken();
            clearTeamToken();
          }
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [navigate, location.state, location.search]);

  const applyStaffOAuthLogin = useCallback(
    (data: StaffLoginResponse) => {
      const resumeFrom = resolveLoginResumeLocation(location.state);
      const tenantSlugFromResponse = (data.tenant as { slug?: string } | undefined)?.slug?.trim();
      if (tenantSlugFromResponse) {
        saveTenantSlug(tenantSlugFromResponse);
        setTenantSlug(tenantSlugFromResponse);
      }
      persistLoginCredentials(false);
      const token = data.token;
      const user = data.user;
      const role = user?.role;

      if (role === 'TEAM_LEADER' || role === 'EXTERNAL_PARTNER') {
        clearToken();
        clearCrewToken();
        setTeamToken(token);
        clearResumeLocation();
        navigate(resolveTeamResumePath(resumeFrom), { replace: true });
        return;
      }

      if (role === 'ADMIN' || role === 'MARKETER') {
        clearTeamToken();
        clearCrewToken();
        setToken(token);
        setTeamToken(token);
        persistAuthMeSnapshot(token, {
          ...(user as Record<string, unknown>),
          tenant: data.tenant,
          tenantId: (data.tenant as { id?: string } | undefined)?.id,
          effectiveStaffAdminAccess: role === 'ADMIN',
          marketerOperationalAdminAccess: role === 'ADMIN',
        });
        void getMe(token);
        clearResumeLocation();
        navigate(resolveAdminResumePath(resumeFrom), { replace: true });
        return;
      }
      setError('지원하지 않는 계정 유형입니다.');
    },
    [location.state, navigate, persistLoginCredentials],
  );

  useEffect(() => {
    if (kakaoLoginCallbackHandledRef.current) return;
    const searchParams = new URLSearchParams(location.search);
    const oauthError = searchParams.get('error')?.trim();
    const code = searchParams.get('code')?.trim();
    if (!oauthError && !code) return;

    kakaoLoginCallbackHandledRef.current = true;
    const nextParams = new URLSearchParams(location.search);
    nextParams.delete('code');
    nextParams.delete('state');
    nextParams.delete('error');
    nextParams.delete('error_description');
    const nextSearch = nextParams.toString();
    navigate(`${location.pathname}${nextSearch ? `?${nextSearch}` : ''}`, {
      replace: true,
      state: location.state,
    });

    if (oauthError) {
      setError('카카오 로그인이 취소되었거나 실패했습니다.');
      return;
    }
    if (!code) return;

    const savedState = sessionStorage.getItem(KAKAO_LOGIN_OAUTH_STATE_KEY)?.trim() ?? '';
    const returnedState = searchParams.get('state')?.trim() ?? '';
    sessionStorage.removeItem(KAKAO_LOGIN_OAUTH_STATE_KEY);

    if (!savedState || savedState !== returnedState) {
      setError('카카오 인증 상태가 올바르지 않습니다. 다시 시도해 주세요.');
      return;
    }

    setOauthVerifying(true);
    setError('');
    sessionProbeGen.current += 1;
    const slugHint = tenantSlug.trim() || undefined;
    void loginWithKakaoOAuth(code, getLoginKakaoRedirectUri(), slugHint)
      .then((data) => {
        applyStaffOAuthLogin(data);
      })
      .catch((err) => {
        setError(staffOAuthLoginErrorMessage(err, '카카오 로그인에 실패했습니다.'));
      })
      .finally(() => {
        setOauthVerifying(false);
      });
  }, [applyStaffOAuthLogin, location.pathname, location.search, location.state, navigate, tenantSlug]);

  const handleGoogleLogin = async (idToken: string) => {
    sessionProbeGen.current += 1;
    setError('');
    setLoading(true);
    try {
      const slugHint = tenantSlug.trim() || undefined;
      const data = await loginWithGoogleOAuth(idToken, slugHint);
      applyStaffOAuthLogin(data);
    } catch (err) {
      setError(staffOAuthLoginErrorMessage(err, 'Google 로그인에 실패했습니다.'));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    sessionProbeGen.current += 1;
    setError('');
    setLoading(true);
    try {
      const resumeFrom = resolveLoginResumeLocation(location.state);

      if (crewLoginMode) {
        const slug = tenantSlug.trim();
        const lid = email.trim();
        if (!slug) {
          setError('업체 코드를 입력해주세요.');
          return;
        }
        if (!lid) {
          setError('크루 로그인 아이디를 입력해주세요.');
          return;
        }
        const data = await loginCrew(slug, lid, password);
        clearToken();
        clearTeamToken();
        setCrewToken(data.token);
        persistLoginCredentials(true);
        clearResumeLocation();
        navigate(resolveCrewResumePath(resumeFrom), { replace: true });
        return;
      }

      if (!tenantSlug.trim()) {
        setError('아이디·비밀번호 로그인은 업체 코드가 필요합니다.');
        return;
      }

      const data = await login(tenantSlug, email, password);
      const role = (data.user as { role?: string })?.role;

      if (role === 'TEAM_LEADER' || role === 'EXTERNAL_PARTNER') {
        clearToken();
        clearCrewToken();
        setTeamToken(data.token);
        persistLoginCredentials(false);
        clearResumeLocation();
        navigate(resolveTeamResumePath(resumeFrom), { replace: true });
        return;
      }
      if (role === 'ADMIN' || role === 'MARKETER') {
        applyStaffOAuthLogin(data);
        return;
      }
      setError('지원하지 않는 계정 유형입니다.');
    } catch (err) {
      setError(err instanceof Error ? err.message : '로그인에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    'login-field-input w-full rounded-xl border border-slate-200/90 bg-slate-50/60 px-3.5 py-2.5 text-fluid-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-sky-500/80 focus:bg-white focus:outline-none focus:ring-4 focus:ring-sky-500/10';

  return (
    <div
      ref={scrollRef}
      className="login-surface relative flex h-dvh max-h-dvh min-h-0 w-full flex-1 flex-col overflow-y-auto overscroll-y-contain bg-[#f8f7f4] sm:h-auto sm:max-h-none sm:min-h-dvh"
      onFocusCapture={onFieldFocus}
    >
      <div
        className="pointer-events-none fixed inset-0 z-0 bg-[#f8f7f4] bg-left-top bg-repeat bg-[length:320px_auto]"
        style={{ backgroundImage: `url(${LOGIN_BACKGROUND_SRC})` }}
        aria-hidden
      />
      <div className="relative z-10 flex w-full flex-col items-stretch justify-start px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:items-center sm:px-4 sm:py-8 lg:py-10">
        <div className="login-scroll-content mx-auto w-full max-w-[420px]">
          <div className="login-brand-block relative mb-3 pt-1 text-center sm:mb-6 sm:pt-0">
            <div
              className="login-brand-mist pointer-events-none absolute inset-x-[-10%] bottom-[-0.5rem] top-0 hidden overflow-visible sm:inset-x-[-14%] sm:block sm:-top-4"
              aria-hidden
            >
              <div className="absolute left-1/2 top-1/2 h-44 w-[120%] max-w-none -translate-x-1/2 -translate-y-1/2 rounded-[100%] bg-[radial-gradient(ellipse_80%_60%_at_50%_45%,rgba(203,213,225,0.35),rgba(241,245,249,0.12)_42%,transparent_70%)] blur-3xl motion-safe:animate-login-mist-drift motion-reduce:opacity-45" />
              <div className="absolute left-1/2 top-[44%] h-28 w-full max-w-none -translate-x-1/2 -translate-y-1/2 rounded-[100%] bg-[radial-gradient(ellipse_70%_55%_at_42%_48%,rgba(255,255,255,0.6),rgba(226,232,240,0.18)_48%,transparent_68%)] blur-2xl motion-safe:animate-login-mist-drift motion-reduce:opacity-40 [animation-delay:-7s]" />
            </div>
            <div className="relative space-y-2 py-0.5 sm:space-y-3 sm:py-1">
              <p className="login-brand-subline-en text-[0.625rem] font-semibold uppercase tracking-[0.28em] text-slate-400 sm:text-[0.6875rem] sm:tracking-[0.34em] motion-safe:animate-login-subline-shine motion-reduce:animate-none motion-reduce:opacity-90">
                {PLATFORM_NAME_EN}
              </p>
              <div className="relative inline-block px-1">
                <span
                  className="pointer-events-none absolute inset-x-[-14%] -inset-y-2 -z-10 hidden rounded-full bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.55),rgba(203,213,225,0.2)_42%,transparent_72%)] blur-2xl motion-safe:animate-login-silver-sparkle motion-reduce:opacity-40 sm:-inset-y-4 sm:block"
                  aria-hidden
                />
                <h1 className="text-[1.5rem] font-bold sm:text-[2rem]">
                  <span
                    className="inline-block tracking-[0.16em] sm:tracking-[0.24em] bg-[linear-gradient(105deg,#475569_0%,#94a3b8_24%,#f8fafc_48%,#cbd5e1_52%,#64748b_76%,#334155_100%)] bg-[length:280%_100%] bg-clip-text text-transparent motion-safe:animate-login-title-sheen motion-reduce:animate-none motion-reduce:bg-none motion-reduce:text-slate-800"
                  >
                    {PLATFORM_NAME}
                  </span>
                </h1>
              </div>
              <div className="login-brand-divider hidden items-center justify-center gap-3 pt-0.5 sm:flex" aria-hidden>
                <span className="h-px w-9 origin-center bg-gradient-to-r from-transparent via-slate-300/80 to-slate-400/50 motion-safe:animate-login-line-grow motion-reduce:scale-x-100 motion-reduce:opacity-70" />
                <span className="h-1 w-1 rounded-full bg-slate-300/80 motion-safe:animate-login-subline-shine motion-reduce:opacity-80 [animation-delay:-1.5s]" />
                <span className="h-px w-9 origin-center bg-gradient-to-l from-transparent via-slate-300/80 to-slate-400/50 motion-safe:animate-login-line-grow motion-reduce:scale-x-100 motion-reduce:opacity-70 [animation-delay:-2.5s]" />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white/95 p-4 shadow-[0_24px_48px_-28px_rgba(15,23,42,0.28)] ring-1 ring-slate-900/[0.04] backdrop-blur-md sm:rounded-3xl sm:p-8">
            <div className="mb-4 border-b border-slate-100 pb-4 text-center sm:mb-6 sm:pb-5">
              {tenantBrand ? (
                <p className="mb-1.5 inline-flex max-w-full items-center justify-center truncate rounded-full bg-slate-100 px-3 py-1 text-fluid-2xs font-semibold text-slate-700">
                  {tenantBrand.displayName}
                </p>
              ) : null}
              <h2 className="text-fluid-base font-semibold tracking-tight text-slate-900">로그인</h2>
              <p className="mt-1.5 text-fluid-2xs leading-relaxed text-slate-500">
                {tenantBrand?.loginSubtitle?.trim() || '업무 계정으로 안전하게 접속하세요.'}
              </p>
            </div>
            {passwordResetComplete ? (
              <div
                className="mb-6 flex gap-3 rounded-xl border border-emerald-200/80 bg-emerald-50/90 px-3.5 py-3 text-fluid-sm text-emerald-950"
                role="status"
              >
                <p>
                  비밀번호가 설정되었습니다. 업체 코드·아이디와 새 비밀번호로 로그인하거나, Google·카카오
                  로그인을 이용해 주세요.
                </p>
              </div>
            ) : null}
            {signupKakaoComplete ? (
              <div
                className="mb-6 flex gap-3 rounded-xl border border-sky-200/80 bg-sky-50/90 px-3.5 py-3 text-fluid-sm text-sky-950"
                role="status"
              >
                <p>
                  카카오로 업체 개설이 완료되었습니다. 아래 「카카오로 로그인」으로 바로 접속해 주세요.
                </p>
              </div>
            ) : signupGoogleComplete ? (
              <div
                className="mb-6 flex gap-3 rounded-xl border border-sky-200/80 bg-sky-50/90 px-3.5 py-3 text-fluid-sm text-sky-950"
                role="status"
              >
                <p>
                  Google로 업체 개설이 완료되었습니다. 아래 「Google로 로그인」으로 바로 접속해 주세요.
                </p>
              </div>
            ) : signupComplete ? (
              <div
                className="mb-6 flex gap-3 rounded-xl border border-emerald-200/80 bg-emerald-50/90 px-3.5 py-3 text-fluid-sm text-emerald-950"
                role="status"
              >
                <p>
                  업체 개설이 완료되었습니다. 인증한 이메일은 비밀번호 찾기에 사용됩니다. 아래에서 로그인해 주세요.
                  (Free는 무료 이용 · 유료 플랜은 가입 시 2개월 무료 체험)
                </p>
              </div>
            ) : null}
            {sessionExpired && (
              <div
                className="mb-6 flex gap-3 rounded-xl border border-amber-200/80 bg-amber-50/90 px-3.5 py-3 text-fluid-sm text-amber-950"
                role="status"
              >
                <span className="mt-0.5 shrink-0 text-amber-600" aria-hidden>
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                </span>
                <p>로그인이 만료되었거나 저장된 토큰이 유효하지 않습니다. 다시 로그인해 주세요.</p>
              </div>
            )}
            {billingAccessBlocked && (
              <div
                className="mb-6 flex gap-3 rounded-xl border border-rose-200/80 bg-rose-50/90 px-3.5 py-3 text-fluid-sm text-rose-950"
                role="alert"
              >
                <span className="mt-0.5 shrink-0 text-rose-600" aria-hidden>
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                </span>
                <p>{billingBlockedMessage}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-5">
              <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-200/90 bg-slate-50/50 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="text-fluid-xs font-medium text-slate-800">팀원계정로그인</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={crewLoginMode}
                  aria-label="팀원계정로그인"
                  onClick={toggleCrewLoginMode}
                  className={`relative h-6 w-10 shrink-0 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
                    crewLoginMode ? 'bg-blue-600' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`absolute top-1/2 left-0.5 h-4 w-4 -translate-y-1/2 rounded-full bg-white shadow transition-transform duration-200 ease-out ${
                      crewLoginMode ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {!crewLoginMode && showSnsOAuthSection ? (
                <div className="space-y-2">
                  <p className="text-fluid-2xs text-slate-500">
                    SNS로 연결한 계정 — 업체 코드 없이 로그인 (관리자·마케터·팀장)
                  </p>
                  <div className="space-y-2">
                    {showGoogleOAuthLogin ? (
                      <GoogleSignupButton
                        mode="login"
                        clientId={googleClientId}
                        disabled={loading || oauthVerifying}
                        onCredential={handleGoogleLogin}
                        onError={setError}
                      />
                    ) : null}
                    {showKakaoOAuthLogin ? (
                      <KakaoSignupButton
                        mode="login"
                        restApiKey={kakaoRestApiKey}
                        disabled={loading || oauthVerifying}
                      />
                    ) : null}
                  </div>
                  {oauthVerifying ? (
                    <p className="text-center text-fluid-2xs text-slate-500">카카오 로그인 확인 중…</p>
                  ) : null}
                  <div className="relative py-1">
                    <div className="absolute inset-0 flex items-center" aria-hidden>
                      <div className="w-full border-t border-slate-200" />
                    </div>
                    <div className="relative flex justify-center">
                      <span className="bg-white px-2 text-fluid-2xs text-slate-400">또는 아이디·비밀번호</span>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="space-y-1.5">
                <label htmlFor="login-tenant" className="block text-fluid-xs font-medium text-slate-600">
                  업체 코드
                </label>
                <input
                  id="login-tenant"
                  type="text"
                  value={tenantSlug}
                  onChange={(e) => setTenantSlug(e.target.value.toLowerCase())}
                  className={inputClass}
                  placeholder="업체코드를 넣어주세요"
                  autoComplete="organization"
                  enterKeyHint="next"
                  required={crewLoginMode || !showSnsOAuthSection}
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="login-id" className="block text-fluid-xs font-medium text-slate-600">
                  {crewLoginMode ? '크루 로그인 ID' : '아이디'}
                </label>
                <input
                  id="login-id"
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass}
                  placeholder={crewLoginMode ? '그룹 로그인 ID' : '아이디를 적어주세요'}
                  autoComplete="username"
                  enterKeyHint="next"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <label htmlFor="login-password" className="block text-fluid-xs font-medium text-slate-600">
                    비밀번호
                  </label>
                  {!crewLoginMode ? (
                    <Link
                      to="/forgot-password"
                      className="text-fluid-2xs font-medium text-sky-700 underline-offset-2 hover:underline"
                    >
                      비밀번호 찾기 · 설정
                    </Link>
                  ) : null}
                </div>
                <input
                  id="login-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClass}
                  autoComplete="current-password"
                  enterKeyHint="done"
                  required
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5">
                <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 text-fluid-xs text-slate-600">
                  <input
                    type="checkbox"
                    checked={rememberLogin}
                    onChange={(e) => setRememberLogin(e.target.checked)}
                    className="h-4 w-4 shrink-0 rounded border-slate-300 text-slate-900 focus:ring-sky-500/30"
                  />
                  로그인 정보 저장
                </label>
                <div className="shrink-0 md:hidden">
                  <PlayStoreStaffAppLink compact />
                </div>
              </div>

              {error && (
                <div
                  className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-fluid-sm text-red-800"
                  role="alert"
                >
                  <p>{error}</p>
                  {error.includes('비밀번호가 설정되지 않은') ? (
                    <p className="mt-2 text-fluid-2xs text-red-900/90">
                      <Link
                        to="/forgot-password"
                        className="font-semibold underline underline-offset-2"
                      >
                        비밀번호 찾기 · 설정
                      </Link>
                      에서 가입 시 인증한 이메일로 비밀번호를 설정할 수 있습니다.
                    </p>
                  ) : null}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || oauthVerifying}
                className="w-full rounded-xl bg-slate-900 py-3 text-fluid-sm font-semibold text-white shadow-lg shadow-slate-900/20 transition hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
              >
                {loading || oauthVerifying ? (
                  <span className="inline-flex items-center justify-center gap-2">
                    <svg
                      className="h-4 w-4 animate-spin"
                      viewBox="0 0 24 24"
                      fill="none"
                      aria-hidden
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    {oauthVerifying ? '카카오 확인 중…' : '로그인 중…'}
                  </span>
                ) : (
                  '로그인'
                )}
              </button>
            </form>

            <Link
              to="/signup"
              className="mt-4 flex w-full items-center justify-center rounded-xl border-2 border-slate-900 bg-white py-3 text-fluid-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2"
            >
              회원가입
            </Link>
          </div>

          <div className="login-page-footer mt-3 space-y-1 text-center sm:mt-6">
            <p className="text-fluid-2xs text-slate-500">
              <Link to="/platform/login" className="hover:text-slate-700 underline-offset-2 hover:underline">
                {PLATFORM_NAME} 운영 콘솔
              </Link>
            </p>
            <p className="text-fluid-2xs text-slate-400">
              서비스는 {ORDER_FORM_PLATFORM_FOOTER.operatorName}에서 제공합니다.
            </p>
            <p className="text-fluid-2xs text-slate-400">
              © {new Date().getFullYear()} {PLATFORM_NAME}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
