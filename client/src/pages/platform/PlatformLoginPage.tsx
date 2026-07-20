import { useState } from 'react';
import { PLATFORM_NAME, PLATFORM_TAGLINE } from '@shared/platformBrand';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { platformLogin } from '../../api/platformTenants';
import { setPlatformToken } from '../../stores/platformAuth';
import { useLoginScrollSurface } from '../../hooks/useMobileInputVisibility';

export function PlatformLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;
  const { scrollRef, onFieldFocus } = useLoginScrollSurface();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await platformLogin(email.trim(), password);
      setPlatformToken(data.token);
      navigate(from && from.startsWith('/platform') ? from : '/platform/tenants', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : '로그인에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    'login-field-input w-full min-h-[44px] rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-fluid-sm focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/15';

  return (
    <div
      ref={scrollRef}
      className="login-surface flex min-h-dvh min-h-screen flex-col items-stretch justify-start overflow-y-auto overscroll-y-contain bg-slate-100 px-4 pt-[max(1.25rem,env(safe-area-inset-top))] sm:items-center sm:justify-center"
    >
      <div className="login-scroll-content mx-auto w-full max-w-sm py-6 sm:py-10">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h1 className="text-fluid-lg font-semibold text-slate-900 text-center mb-1">{PLATFORM_NAME}</h1>
          <p className="text-fluid-xs text-slate-500 text-center mb-6">{PLATFORM_TAGLINE}</p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="platform-login-id" className="block text-fluid-xs text-slate-600 mb-1">
                아이디
              </label>
              <input
                id="platform-login-id"
                type="text"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onFocus={onFieldFocus}
                enterKeyHint="next"
                className={inputClass}
                required
              />
            </div>
            <div>
              <label htmlFor="platform-login-password" className="block text-fluid-xs text-slate-600 mb-1">
                비밀번호
              </label>
              <input
                id="platform-login-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={onFieldFocus}
                enterKeyHint="done"
                className={inputClass}
                required
              />
            </div>
            {error ? <p className="text-fluid-xs text-red-600">{error}</p> : null}
            <button
              type="submit"
              disabled={loading}
              className="w-full min-h-[48px] rounded-xl bg-slate-900 text-white py-2.5 text-fluid-sm font-medium hover:bg-slate-800 disabled:opacity-50"
            >
              {loading ? '로그인 중…' : '로그인'}
            </button>
          </form>
          <p className="mt-6 text-center text-fluid-2xs text-slate-500">
            <Link to="/login" className="hover:text-slate-700 underline-offset-2 hover:underline">
              업무 로그인
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
