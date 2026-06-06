import { useState } from 'react';
import { PLATFORM_NAME, PLATFORM_TAGLINE } from '@shared/platformBrand';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { platformLogin } from '../../api/platformTenants';
import { setPlatformToken } from '../../stores/platformAuth';

export function PlatformLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;

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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <div className="w-full max-w-sm bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
        <h1 className="text-fluid-lg font-semibold text-gray-900 text-center mb-1">{PLATFORM_NAME}</h1>
        <p className="text-fluid-xs text-gray-500 text-center mb-6">{PLATFORM_TAGLINE}</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-fluid-xs text-gray-600 mb-1">아이디</label>
            <input
              type="text"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-fluid-sm"
              required
            />
          </div>
          <div>
            <label className="block text-fluid-xs text-gray-600 mb-1">비밀번호</label>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-fluid-sm"
              required
            />
          </div>
          {error ? <p className="text-fluid-xs text-red-600">{error}</p> : null}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gray-800 text-white rounded py-2 text-fluid-sm font-medium hover:bg-gray-900 disabled:opacity-50"
          >
            {loading ? '로그인 중…' : '로그인'}
          </button>
        </form>
        <p className="mt-6 text-center text-fluid-2xs text-gray-500">
          <Link to="/login" className="hover:text-gray-700 underline-offset-2 hover:underline">
            업무 로그인
          </Link>
        </p>
      </div>
    </div>
  );
}
