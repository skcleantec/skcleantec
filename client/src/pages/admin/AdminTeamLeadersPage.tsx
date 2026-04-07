import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Navigate } from 'react-router-dom';
import { ModalCloseButton } from '../../components/admin/ModalCloseButton';
import { getUsers, createUser, updateUser, deleteUser, type UserItem } from '../../api/users';
import { getToken } from '../../stores/auth';
import { getMe } from '../../api/auth';
import { SyncHorizontalScroll } from '../../components/ui/SyncHorizontalScroll';

type UserRole = 'TEAM_LEADER' | 'MARKETER';

export function AdminTeamLeadersPage() {
  const token = getToken();
  const [roleGate, setRoleGate] = useState<'loading' | 'admin' | 'other'>('loading');
  const [teamLeaders, setTeamLeaders] = useState<UserItem[]>([]);
  const [marketers, setMarketers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState<'team' | 'marketer' | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [editForm, setEditForm] = useState({
    email: '',
    name: '',
    phone: '',
    password: '',
  });
  const [editLoading, setEditLoading] = useState(false);
  const [form, setForm] = useState({
    email: '',
    password: '',
    name: '',
    phone: '',
  });

  const refresh = (): Promise<void> => {
    if (!token) return Promise.resolve();
    setApiError(null);
    return Promise.all([
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
    if (!token) {
      setRoleGate('other');
      return;
    }
    getMe(token)
      .then((u: { role?: string }) => setRoleGate(u.role === 'ADMIN' ? 'admin' : 'other'))
      .catch(() => setRoleGate('other'));
  }, [token]);

  useEffect(() => {
    if (!token || roleGate !== 'admin') return;
    refresh();
  }, [token, roleGate]);

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

  const openEdit = (item: UserItem) => {
    setEditingUser(item);
    setEditForm({
      email: item.email,
      name: item.name,
      phone: item.phone ?? '',
      password: '',
    });
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !editingUser) return;
    setEditLoading(true);
    try {
      const payload: {
        email: string;
        name: string;
        phone: string | null;
        password?: string;
      } = {
        email: editForm.email.trim().toLowerCase(),
        name: editForm.name.trim(),
        phone: editForm.phone.trim() || null,
      };
      if (editForm.password.trim()) {
        payload.password = editForm.password.trim();
      }
      await updateUser(token, editingUser.id, payload);
      setEditingUser(null);
      refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : '수정에 실패했습니다.');
    } finally {
      setEditLoading(false);
    }
  };

  const handleDelete = async (item: UserItem, label: '팀장' | '마케터') => {
    if (!token) return;
    const msg = `${label} "${item.name}" (${item.email}) 계정을 삭제(비활성)할까요? 이후 해당 계정으로 로그인할 수 없습니다.`;
    if (!window.confirm(msg)) return;
    setDeletingId(item.id);
    try {
      await deleteUser(token, item.id);
      await refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : '삭제에 실패했습니다.');
    } finally {
      setDeletingId(null);
    }
  };

  if (roleGate === 'loading') {
    return <div className="flex justify-center py-16 text-gray-500 text-fluid-sm">불러오는 중...</div>;
  }
  if (roleGate !== 'admin') {
    return <Navigate to="/admin/dashboard" replace />;
  }

  return (
    <div className="space-y-6 min-w-0 w-full max-w-full">
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-w-0">
        <div className="min-w-0 bg-white border border-gray-200 rounded-lg">
          <h3 className="px-4 py-3 bg-gray-50 border-b border-gray-200 font-medium text-gray-800">
            팀장 ({teamLeaders.length}명)
          </h3>
          {loading ? (
            <div className="p-8 text-center text-gray-500">로딩 중...</div>
          ) : teamLeaders.length === 0 && !apiError ? (
            <div className="p-8 text-center text-gray-500">등록된 팀장이 없습니다.</div>
          ) : (
            <>
              <p className="border-b border-gray-100 px-4 pt-2 text-fluid-2xs text-gray-500 lg:hidden">
                표는 좌우로 스크롤할 수 있습니다.
              </p>
              <SyncHorizontalScroll dockUntil="lg" contentClassName="-mx-4 px-4 sm:mx-0 sm:px-0">
                <table className="w-full border-collapse text-fluid-sm min-w-[560px]">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-center font-medium text-gray-700 whitespace-nowrap">아이디</th>
                      <th className="px-4 py-3 text-center font-medium text-gray-700 whitespace-nowrap">이름</th>
                      <th className="px-4 py-3 text-center font-medium text-gray-700 whitespace-nowrap">연락처</th>
                      <th className="px-4 py-3 text-center font-medium text-gray-700 w-28 whitespace-nowrap">관리</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teamLeaders.map((item) => (
                      <tr key={item.id} className="border-b border-gray-100">
                        <td className="px-4 py-3 text-gray-800 whitespace-nowrap">{item.email}</td>
                        <td className="px-4 py-3 text-gray-800 whitespace-nowrap">{item.name}</td>
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap tabular-nums">{item.phone || '-'}</td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => openEdit(item)}
                            className="px-2 py-1 text-xs text-blue-600 border border-blue-200 rounded hover:bg-blue-50 mr-1"
                          >
                            수정
                          </button>
                          <button
                            type="button"
                            disabled={deletingId === item.id}
                            onClick={() => handleDelete(item, '팀장')}
                            className="px-2 py-1 text-xs text-red-600 border border-red-200 rounded hover:bg-red-50 disabled:opacity-50"
                          >
                            {deletingId === item.id ? '처리 중…' : '삭제'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </SyncHorizontalScroll>
            </>
          )}
        </div>

        <div className="min-w-0 bg-white border border-gray-200 rounded-lg">
          <h3 className="px-4 py-3 bg-gray-50 border-b border-gray-200 font-medium text-gray-800">
            마케터 ({marketers.length}명)
          </h3>
          {loading ? (
            <div className="p-8 text-center text-gray-500">로딩 중...</div>
          ) : marketers.length === 0 && !apiError ? (
            <div className="p-8 text-center text-gray-500">등록된 마케터가 없습니다.</div>
          ) : (
            <>
              <p className="border-b border-gray-100 px-4 pt-2 text-fluid-2xs text-gray-500 lg:hidden">
                표는 좌우로 스크롤할 수 있습니다.
              </p>
              <SyncHorizontalScroll dockUntil="lg" contentClassName="-mx-4 px-4 sm:mx-0 sm:px-0">
                <table className="w-full border-collapse text-fluid-sm min-w-[560px]">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-center font-medium text-gray-700 whitespace-nowrap">아이디</th>
                      <th className="px-4 py-3 text-center font-medium text-gray-700 whitespace-nowrap">이름</th>
                      <th className="px-4 py-3 text-center font-medium text-gray-700 whitespace-nowrap">연락처</th>
                      <th className="px-4 py-3 text-center font-medium text-gray-700 w-28 whitespace-nowrap">관리</th>
                    </tr>
                  </thead>
                  <tbody>
                    {marketers.map((item) => (
                      <tr key={item.id} className="border-b border-gray-100">
                        <td className="px-4 py-3 text-gray-800 whitespace-nowrap">{item.email}</td>
                        <td className="px-4 py-3 text-gray-800 whitespace-nowrap">{item.name}</td>
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap tabular-nums">{item.phone || '-'}</td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => openEdit(item)}
                            className="px-2 py-1 text-xs text-blue-600 border border-blue-200 rounded hover:bg-blue-50 mr-1"
                          >
                            수정
                          </button>
                          <button
                            type="button"
                            disabled={deletingId === item.id}
                            onClick={() => handleDelete(item, '마케터')}
                            className="px-2 py-1 text-xs text-red-600 border border-red-200 rounded hover:bg-red-50 disabled:opacity-50"
                          >
                            {deletingId === item.id ? '처리 중…' : '삭제'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </SyncHorizontalScroll>
            </>
          )}
        </div>
      </div>

      {editingUser &&
        createPortal(
          <div
            className="fixed inset-0 z-[200] overflow-y-auto overscroll-y-contain bg-black/40 px-4 py-8"
            role="dialog"
            aria-modal="true"
            aria-labelledby="user-edit-title"
          >
            <div className="relative mx-auto mt-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
              <ModalCloseButton onClick={() => setEditingUser(null)} />
              <h2 id="user-edit-title" className="text-lg font-semibold text-gray-800 mb-1 pr-10">
                사용자 수정
              </h2>
              <p className="text-xs text-gray-500 mb-4">
                역할: {editingUser.role === 'MARKETER' ? '마케터' : '팀장'} · 새 비밀번호는 변경할 때만 입력
              </p>
              <form onSubmit={handleEditSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">아이디 (로그인용)</label>
                  <input
                    value={editForm.email}
                    onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                    required
                    autoComplete="username"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">이름</label>
                  <input
                    value={editForm.name}
                    onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">연락처 (선택)</label>
                  <input
                    value={editForm.phone}
                    onChange={(e) => setEditForm((p) => ({ ...p, phone: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                    placeholder="010-0000-0000"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">새 비밀번호 (선택)</label>
                  <input
                    type="password"
                    value={editForm.password}
                    onChange={(e) => setEditForm((p) => ({ ...p, password: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                    placeholder="비우면 기존 비밀번호 유지"
                    autoComplete="new-password"
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    type="submit"
                    disabled={editLoading}
                    className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                  >
                    {editLoading ? '저장 중…' : '저장'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingUser(null)}
                    className="px-4 py-2 border border-gray-300 rounded text-sm font-medium hover:bg-gray-50"
                  >
                    취소
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
