import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../api/auth';
import { getToken, setToken, clearToken } from '../stores/auth';
import { getTeamToken, setTeamToken, clearTeamToken } from '../stores/teamAuth';

export function LoginPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const a = getToken();
    const t = getTeamToken();
    if (a && !t) {
      navigate('/admin/dashboard', { replace: true });
      return;
    }
    if (t && !a) {
      navigate('/team/dashboard', { replace: true });
      return;
    }
    if (a && t) {
      clearToken();
      clearTeamToken();
    }
  }, [navigate]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await login(email, password);
      const token = data.token as string;
      const user = data.user as { role?: string };
      const role = user?.role;

      if (role === 'TEAM_LEADER') {
        clearToken();
        setTeamToken(token);
        navigate('/team/dashboard', { replace: true });
      } else if (role === 'ADMIN' || role === 'MARKETER') {
        clearTeamToken();
        setToken(token);
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
            관리자·마케터·팀장 모두 같은 화면에서 로그인합니다.
          </p>
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
