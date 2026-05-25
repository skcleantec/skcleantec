import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, Link, type Location as RouterLocation } from 'react-router-dom';
import { login, getMe, isAuthSessionExpiredError } from '../api/auth';
import { loginCrew, getCrewMe } from '../api/crew';
import { getToken, setToken, clearToken } from '../stores/auth';
import { getTeamToken, setTeamToken, clearTeamToken } from '../stores/teamAuth';
import { getCrewToken, setCrewToken, clearCrewToken } from '../stores/crewAuth';
import { PLATFORM_NAME } from '@shared/platformBrand';
import { DEFAULT_TENANT_SLUG, loadTenantSlug, saveTenantSlug } from '../utils/tenantSlug';
import { resolveTenantSlugWithApiFallback } from '../utils/tenantHostResolve';

/** ProtectedRoute / TeamProtectedRoute 가 넘긴 `state.from` 만 안전하게 읽기 */
function readResumeLocation(state: unknown): RouterLocation | undefined {
  if (!state || typeof state !== 'object') return undefined;
  const rec = state as { from?: unknown };
  if (!rec.from || typeof rec.from !== 'object') return undefined;
  const from = rec.from as { pathname?: unknown };
  if (typeof from.pathname !== 'string') return undefined;
  return rec.from as RouterLocation;
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

  const [tenantSlug, setTenantSlug] = useState(loadTenantSlug);

  useEffect(() => {
    let cancelled = false;
    void resolveTenantSlugWithApiFallback().then((slug) => {
      if (cancelled) return;
      setTenantSlug(slug);
      saveTenantSlug(slug);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [crewLoginMode, setCrewLoginMode] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
    let a = getToken();
    let t = getTeamToken();
    let c = getCrewToken();
    if (c && (a || t)) {
      clearCrewToken();
      c = getCrewToken();
    }
    if (!a && !t && !c) return;

    void (async () => {
      const myGen = sessionProbeGen.current;
      const resumeFrom = readResumeLocation(location.state);
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
      const resumeFrom = readResumeLocation(location.state);

      if (crewLoginMode) {
        const lid = email.trim();
        if (!lid) {
          setError('크루 로그인 아이디를 입력해주세요.');
          return;
        }
        const data = await loginCrew(lid, password);
        clearToken();
        clearTeamToken();
        setCrewToken(data.token);
        navigate(resolveCrewResumePath(resumeFrom), { replace: true });
        return;
      }

      const data = await login(tenantSlug, email, password);
      saveTenantSlug(tenantSlug);
      const token = data.token as string;
      const user = data.user as { role?: string; email?: string };
      const role = user?.role;

      if (role === 'TEAM_LEADER' || role === 'EXTERNAL_PARTNER') {
        clearToken();
        clearCrewToken();
        setTeamToken(token);
        navigate(resolveTeamResumePath(resumeFrom), { replace: true });
      } else if (role === 'ADMIN' || role === 'MARKETER') {
        clearTeamToken();
        clearCrewToken();
        setToken(token);
        setTeamToken(token);
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
    'w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 py-2.5 text-fluid-sm text-slate-900 placeholder:text-slate-400 shadow-inner shadow-slate-900/5 transition-colors focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/15';

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-100">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,rgba(59,130,246,0.2),transparent_55%),radial-gradient(ellipse_80%_50%_at_100%_50%,rgba(148,163,184,0.22),transparent_50%)]"
        aria-hidden
      />
      <div className="relative flex min-h-screen items-center justify-center px-4 py-10 sm:py-14">
        <div className="w-full max-w-[420px]">
          <div className="relative mb-8 text-center sm:mb-10">
            <div className="pointer-events-none absolute inset-x-[-12%] -top-6 bottom-[-1.5rem] overflow-visible sm:inset-x-[-18%]" aria-hidden>
              <div className="absolute left-1/2 top-1/2 h-44 w-[125%] max-w-none -translate-x-1/2 -translate-y-1/2 rounded-[100%] bg-[radial-gradient(ellipse_80%_60%_at_50%_45%,rgba(59,130,246,0.38),rgba(96,165,250,0.18)_38%,rgba(148,163,184,0.12)_52%,transparent_70%)] blur-3xl motion-safe:animate-login-mist-drift motion-reduce:opacity-[0.55]" />
              <div className="absolute left-1/2 top-[42%] h-28 w-[100%] max-w-none -translate-x-1/2 -translate-y-1/2 rounded-[100%] bg-[radial-gradient(ellipse_72%_55%_at_38%_48%,rgba(255,255,255,0.62),rgba(224,231,255,0.22)_45%,transparent_68%)] blur-2xl motion-safe:animate-login-mist-drift motion-reduce:opacity-45 [animation-delay:-6s]" />
            </div>
            <div className="relative">
              <p className="text-fluid-xs font-medium uppercase tracking-[0.22em] text-slate-500 motion-safe:animate-login-subline-shine motion-reduce:animate-none motion-reduce:opacity-90 [animation-delay:-1s]">
                SK Cleantec
              </p>
              <h1 className="mt-2 text-fluid-lg font-semibold tracking-tight sm:text-2xl">
                <span className="inline-block bg-gradient-to-r from-slate-950 via-sky-100 from-25% via-50% to-slate-950 to-75% bg-[length:260%_100%] bg-clip-text text-transparent motion-safe:animate-login-title-shimmer motion-reduce:animate-none motion-reduce:bg-none motion-reduce:text-slate-900">
                  로그인
                </span>
              </h1>
              <p className="mx-auto mt-2 max-w-xs text-fluid-xs text-slate-500 motion-safe:animate-login-subline-shine motion-reduce:animate-none motion-reduce:opacity-90 [animation-delay:-3.5s]">
                업무 계정으로 안전하게 접속하세요.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-white/60 bg-white/90 p-6 shadow-xl shadow-slate-900/10 ring-1 ring-slate-900/5 backdrop-blur-sm sm:p-8">
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
                  onClick={() => setCrewLoginMode((v) => !v)}
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

              {!crewLoginMode && (
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
                    placeholder={DEFAULT_TENANT_SLUG}
                    autoComplete="organization"
                    required
                  />
                  <p className="text-fluid-2xs text-slate-500">
                    SK클린텍 운영: <span className="font-medium text-slate-700">{DEFAULT_TENANT_SLUG}</span>
                  </p>
                </div>
              )}

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
                className="w-full rounded-xl bg-blue-600 py-3 text-fluid-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition hover:bg-blue-700 hover:shadow-blue-600/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
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
