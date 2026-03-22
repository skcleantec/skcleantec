import { useState, useEffect } from 'react';
import { getUsers, createUser, type UserItem } from '../../api/users';
import { getToken } from '../../stores/auth';

type UserRole = 'TEAM_LEADER' | 'MARKETER';

export function AdminTeamLeadersPage() {
  const token = getToken();
  const [teamLeaders, setTeamLeaders] = useState<UserItem[]>([]);
  const [marketers, setMarketers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState<'team' | 'marketer' | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [form, setForm] = useState({
    email: '',
    password: '',
    name: '',
    phone: '',
  });

  const refresh = () => {
    if (!token) return;
    setApiError(null);
    Promise.all([
      getUsers(token, 'TEAM_LEADER'),
      getUsers(token, 'MARKETER'),
    ])
      .then(([teamRes, marketerRes]) => {
        setTeamLeaders(teamRes);
        setMarketers(marketerRes);
        setApiError(null);
      })
      .catch((err) => {
        setTeamLeaders([]);
        setMarketers([]);
        setApiError(err instanceof Error ? err.message : '서버에 연결할 수 없습니다.');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!token) return;
    refresh();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent, role: UserRole) => {
    e.preventDefault();
    if (!token) return;
    setSubmitLoading(true);
    try {
      await createUser(token, {
        ...form,
        phone: form.phone || undefined,
        role,
      });
      setForm({ email: '', password: '', name: '', phone: '' });
      setShowForm(null);
      refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : '등록에 실패했습니다.');
    } finally {
      setSubmitLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <h1 className="text-xl font-semibold text-gray-800">사용자관리</h1>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowForm(showForm === 'team' ? null : 'team')}
            className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700"
          >
            {showForm === 'team' ? '취소' : '팀장 등록'}
          </button>
          <button
            onClick={() => setShowForm(showForm === 'marketer' ? null : 'marketer')}
            className="px-4 py-2 bg-green-600 text-white rounded text-sm font-medium hover:bg-green-700"
          >
            {showForm === 'marketer' ? '취소' : '마케터 등록'}
          </button>
        </div>
      </div>

      {showForm === 'team' && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-base font-medium text-gray-800 mb-4">팀장 등록</h2>
          <form
            onSubmit={(e) => handleSubmit(e, 'TEAM_LEADER')}
            className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl"
          >
            <div>
              <label className="block text-sm text-gray-600 mb-1">아이디 (로그인용)</label>
              <input
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                placeholder="team1"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">비밀번호</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">이름</label>
              <input
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                placeholder="홍길동"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">연락처 (선택)</label>
              <input
                value={form.phone}
                onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                placeholder="010-0000-0000"
              />
            </div>
            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={submitLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {submitLoading ? '등록 중...' : '등록'}
              </button>
            </div>
          </form>
        </div>
      )}

      {showForm === 'marketer' && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-base font-medium text-gray-800 mb-4">마케터 등록</h2>
          <form
            onSubmit={(e) => handleSubmit(e, 'MARKETER')}
            className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl"
          >
            <div>
              <label className="block text-sm text-gray-600 mb-1">아이디 (로그인용)</label>
              <input
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                placeholder="marketer1"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">비밀번호</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">이름</label>
              <input
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                placeholder="홍길동"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">연락처 (선택)</label>
              <input
                value={form.phone}
                onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                placeholder="010-0000-0000"
              />
            </div>
            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={submitLoading}
                className="px-4 py-2 bg-green-600 text-white rounded text-sm font-medium hover:bg-green-700 disabled:opacity-50"
              >
                {submitLoading ? '등록 중...' : '등록'}
              </button>
            </div>
          </form>
        </div>
      )}

      {apiError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {apiError} (서버가 실행 중인지 확인하세요. 터미널에서{' '}
          <code className="bg-red-100 px-1 rounded">npm run dev</code> 실행)
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <h3 className="px-4 py-3 bg-gray-50 border-b border-gray-200 font-medium text-gray-800">
            팀장 ({teamLeaders.length}명)
          </h3>
          {loading ? (
            <div className="p-8 text-center text-gray-500">로딩 중...</div>
          ) : teamLeaders.length === 0 && !apiError ? (
            <div className="p-8 text-center text-gray-500">등록된 팀장이 없습니다.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">아이디</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">이름</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">연락처</th>
                </tr>
              </thead>
              <tbody>
                {teamLeaders.map((item) => (
                  <tr key={item.id} className="border-b border-gray-100">
                    <td className="px-4 py-3 text-gray-800">{item.email}</td>
                    <td className="px-4 py-3 text-gray-800">{item.name}</td>
                    <td className="px-4 py-3 text-gray-600">{item.phone || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <h3 className="px-4 py-3 bg-gray-50 border-b border-gray-200 font-medium text-gray-800">
            마케터 ({marketers.length}명)
          </h3>
          {loading ? (
            <div className="p-8 text-center text-gray-500">로딩 중...</div>
          ) : marketers.length === 0 && !apiError ? (
            <div className="p-8 text-center text-gray-500">등록된 마케터가 없습니다.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">아이디</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">이름</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">연락처</th>
                </tr>
              </thead>
              <tbody>
                {marketers.map((item) => (
                  <tr key={item.id} className="border-b border-gray-100">
                    <td className="px-4 py-3 text-gray-800">{item.email}</td>
                    <td className="px-4 py-3 text-gray-800">{item.name}</td>
                    <td className="px-4 py-3 text-gray-600">{item.phone || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
