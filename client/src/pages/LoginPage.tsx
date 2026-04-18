import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { login, getMe, isAuthSessionExpiredError } from '../api/auth';
import { getToken, setToken, clearToken } from '../stores/auth';
import { getTeamToken, setTeamToken, clearTeamToken } from '../stores/teamAuth';
import { isTeamPreviewAdminEmail } from '../utils/teamPreview';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const sessionExpired = Boolean((location.state as { sessionExpired?: boolean } | null)?.sessionExpired);
  /** 로그인 제출 시 증가 — 진행 중인 자동 `getMe`가 새 토큰·저장소를 덮어쓰지 않도록 */
  const sessionProbeGen = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const a = getToken();
    const t = getTeamToken();
    if (!a && !t) return;

    void (async () => {
      const myGen = sessionProbeGen.current;
      try {
        if (a && !t) {
          await getMe(a);
          if (cancelled || sessionProbeGen.current !== myGen) return;
          if (getToken() !== a) return;
          navigate('/admin/dashboard', { replace: true });
          return;
        }
        if (t && !a) {
          await getMe(t);
          if (cancelled || sessionProbeGen.current !== myGen) return;
          if (getTeamToken() !== t) return;
          navigate('/team/dashboard', { replace: true });
          return;
        }
        if (a && t) {
          if (a === t) {
            await getMe(a);
            if (cancelled || sessionProbeGen.current !== myGen) return;
            if (getToken() !== a || getTeamToken() !== t) return;
            navigate('/admin/dashboard', { replace: true });
            return;
          }
          clearToken();
          clearTeamToken();
        }
      } catch (e) {
        if (cancelled || sessionProbeGen.current !== myGen) return;
        if (!isAuthSessionExpiredError(e)) return;
        if (a && !t) {
          if (getToken() === a) clearToken();
          return;
        }
        if (t && !a) {
          if (getTeamToken() === t) clearTeamToken();
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
  }, [navigate]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    sessionProbeGen.current += 1;
    setError('');
    setLoading(true);
    try {
      const data = await login(email, password);
      const token = data.token as string;
      const user = data.user as { role?: string; email?: string };
      const role = user?.role;

      if (role === 'TEAM_LEADER' || role === 'EXTERNAL_PARTNER') {
        clearToken();
        setTeamToken(token);
        navigate('/team/dashboard', { replace: true });
      } else if (role === 'ADMIN' || role === 'MARKETER') {
        clearTeamToken();
        setToken(token);
        if (user?.email && isTeamPreviewAdminEmail(user.email)) {
          setTeamToken(token);
        }
        navigate('/admin/dashboard', { replace: true });
      } else {
        setError('지원하지 않는 계정 유형입니다.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '로그인에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-gray-800 text-center mb-6">
            SK클린텍 로그인
          </h1>
          <p className="text-sm text-gray-500 text-center mb-4">
            관리자·마케터·팀장·타업체 담당 모두 같은 화면에서 로그인합니다.
          </p>
          {sessionExpired && (
            <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded px-3 py-2 mb-4">
              로그인이 만료되었거나 저장된 토큰이 유효하지 않습니다. 다시 로그인해 주세요.
            </p>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                아이디
              </label>
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="admin 또는 이메일"
                autoComplete="username"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                비밀번호
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                autoComplete="current-password"
                required
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? '로그인 중...' : '로그인'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
