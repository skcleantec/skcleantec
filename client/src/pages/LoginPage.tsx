import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, Link, type Location as RouterLocation } from 'react-router-dom';
import { login, getMe, isAuthSessionExpiredError } from '../api/auth';
import { loginCrew, getCrewMe } from '../api/crew';
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
  const [tenantBrand, setTenantBrand] = useState<{ displayName: string; loginSubtitle: string | null } | null>(null);

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

      const data = await login(tenantSlug, email, password);
      persistLoginCredentials(false);
      const token = data.token as string;
      const user = data.user as { role?: string; email?: string };
      const role = user?.role;

      if (role === 'TEAM_LEADER' || role === 'EXTERNAL_PARTNER') {
        clearToken();
        clearCrewToken();
        setTeamToken(token);
        clearResumeLocation();
        navigate(resolveTeamResumePath(resumeFrom), { replace: true });
      } else if (role === 'ADMIN' || role === 'MARKETER') {
        clearTeamToken();
        clearCrewToken();
        setToken(token);
        setTeamToken(token);
        clearResumeLocation();
        navigate(resolveAdminResumePath(resumeFrom), { replace: true });
      } else {
        setError('지원하지 않는 계정 유형입니다.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '로그인에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    'w-full rounded-xl border border-slate-200/90 bg-slate-50/60 px-3.5 py-2.5 text-fluid-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-sky-500/80 focus:bg-white focus:outline-none focus:ring-4 focus:ring-sky-500/10';

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#f4f6f8]">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_60%_at_50%_-15%,rgba(14,165,233,0.14),transparent_55%),radial-gradient(ellipse_70%_50%_at_100%_0%,rgba(148,163,184,0.12),transparent_50%),radial-gradient(ellipse_60%_40%_at_0%_100%,rgba(45,212,191,0.08),transparent_45%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35] [background-image:linear-gradient(to_right,rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.08)_1px,transparent_1px)] [background-size:28px_28px]"
        aria-hidden
      />
      <div className="relative flex min-h-screen items-center justify-center px-4 py-10 sm:py-14">
        <div className="w-full max-w-[420px]">
          <div className="relative mb-7 text-center sm:mb-8">
            <div
              className="pointer-events-none absolute inset-x-[-10%] -top-4 bottom-[-0.5rem] overflow-visible sm:inset-x-[-14%]"
              aria-hidden
            >
              <div className="absolute left-1/2 top-1/2 h-44 w-[120%] max-w-none -translate-x-1/2 -translate-y-1/2 rounded-[100%] bg-[radial-gradient(ellipse_80%_60%_at_50%_45%,rgba(203,213,225,0.35),rgba(241,245,249,0.12)_42%,transparent_70%)] blur-3xl motion-safe:animate-login-mist-drift motion-reduce:opacity-45" />
              <div className="absolute left-1/2 top-[44%] h-28 w-full max-w-none -translate-x-1/2 -translate-y-1/2 rounded-[100%] bg-[radial-gradient(ellipse_70%_55%_at_42%_48%,rgba(255,255,255,0.6),rgba(226,232,240,0.18)_48%,transparent_68%)] blur-2xl motion-safe:animate-login-mist-drift motion-reduce:opacity-40 [animation-delay:-7s]" />
            </div>
            <div className="relative space-y-3 py-1">
              <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.34em] text-slate-400 motion-safe:animate-login-subline-shine motion-reduce:animate-none motion-reduce:opacity-90">
                {PLATFORM_NAME_EN}
              </p>
              <div className="relative inline-block px-1">
                <span
                  className="pointer-events-none absolute inset-x-[-14%] -inset-y-4 -z-10 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.55),rgba(203,213,225,0.2)_42%,transparent_72%)] blur-2xl motion-safe:animate-login-silver-sparkle motion-reduce:opacity-40"
                  aria-hidden
                />
                <h1 className="text-[1.75rem] font-bold sm:text-[2rem]">
                  <span
                    className="inline-block tracking-[0.2em] sm:tracking-[0.24em] bg-[linear-gradient(105deg,#475569_0%,#94a3b8_24%,#f8fafc_48%,#cbd5e1_52%,#64748b_76%,#334155_100%)] bg-[length:280%_100%] bg-clip-text text-transparent motion-safe:animate-login-title-sheen motion-reduce:animate-none motion-reduce:bg-none motion-reduce:text-slate-800"
                  >
                    {PLATFORM_NAME}
                  </span>
                </h1>
              </div>
              <div className="flex items-center justify-center gap-3 pt-0.5" aria-hidden>
                <span className="h-px w-9 origin-center bg-gradient-to-r from-transparent via-slate-300/80 to-slate-400/50 motion-safe:animate-login-line-grow motion-reduce:scale-x-100 motion-reduce:opacity-70" />
                <span className="h-1 w-1 rounded-full bg-slate-300/80 motion-safe:animate-login-subline-shine motion-reduce:opacity-80 [animation-delay:-1.5s]" />
                <span className="h-px w-9 origin-center bg-gradient-to-l from-transparent via-slate-300/80 to-slate-400/50 motion-safe:animate-login-line-grow motion-reduce:scale-x-100 motion-reduce:opacity-70 [animation-delay:-2.5s]" />
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200/80 bg-white/95 p-6 shadow-[0_24px_48px_-28px_rgba(15,23,42,0.28)] ring-1 ring-slate-900/[0.04] backdrop-blur-md sm:p-8">
            <div className="mb-6 border-b border-slate-100 pb-5 text-center">
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

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200/90 bg-slate-50/50 px-4 py-3.5">
                <div className="min-w-0 flex-1">
                  <p className="text-fluid-sm font-medium text-slate-800">크루 계정 로그인</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={crewLoginMode}
                  onClick={toggleCrewLoginMode}
                  className={`relative h-7 w-11 shrink-0 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
                    crewLoginMode ? 'bg-blue-600' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`absolute top-1/2 left-0.5 h-5 w-5 -translate-y-1/2 rounded-full bg-white shadow-md transition-transform duration-200 ease-out ${
                      crewLoginMode ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

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
                  required
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
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="login-password" className="block text-fluid-xs font-medium text-slate-600">
                  비밀번호
                </label>
                <input
                  id="login-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClass}
                  autoComplete="current-password"
                  required
                />
              </div>

              <label className="flex cursor-pointer items-center gap-2.5 text-fluid-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={rememberLogin}
                  onChange={(e) => setRememberLogin(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-sky-500/30"
                />
                로그인 정보 저장
              </label>

              {error && (
                <div
                  className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-fluid-sm text-red-800"
                  role="alert"
                >
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-slate-900 py-3 text-fluid-sm font-semibold text-white shadow-lg shadow-slate-900/20 transition hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
              >
                {loading ? (
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
                    로그인 중…
                  </span>
                ) : (
                  '로그인'
                )}
              </button>
            </form>
          </div>

          <p className="mt-6 text-center text-fluid-2xs text-slate-500">
            <Link to="/platform/login" className="hover:text-slate-700 underline-offset-2 hover:underline">
              {PLATFORM_NAME} 운영 콘솔
            </Link>
          </p>
          <p className="mt-4 text-center text-fluid-2xs text-slate-400">
            © {new Date().getFullYear()} {PLATFORM_NAME}
          </p>
        </div>
      </div>
    </div>
  );
}
