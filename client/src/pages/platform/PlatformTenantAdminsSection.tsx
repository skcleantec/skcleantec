import { useState } from 'react';
import {
  createPlatformTenantAdmin,
  patchPlatformTenantAdmin,
  type PlatformTenantAdmin,
} from '../../api/platformTenants';
import { getPlatformToken } from '../../stores/platformAuth';
import {
  BTN_PRIMARY,
  BTN_SECONDARY,
  BTN_LINK,
} from '../../utils/platformUi';
import { tenantLoginIdErrorMessage } from '@shared/tenantLoginId';

type Props = {
  tenantId: string;
  admins: PlatformTenantAdmin[];
  onChanged: () => Promise<void>;
  saving: boolean;
  setSaving: (v: boolean) => void;
  setMessage: (v: string) => void;
  setError: (v: string) => void;
};

type EditDraft = {
  loginId: string;
  name: string;
  password: string;
  isActive: boolean;
  isTenantOwner: boolean;
};

const EMPTY_ADD = { loginId: '', name: '관리자', password: '', isTenantOwner: false };

export function PlatformTenantAdminsSection({
  tenantId,
  admins,
  onChanged,
  saving,
  setSaving,
  setMessage,
  setError,
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<EditDraft | null>(null);
  const [addForm, setAddForm] = useState(EMPTY_ADD);

  const startEdit = (admin: PlatformTenantAdmin) => {
    setEditingId(admin.id);
    setDraft({
      loginId: admin.loginId,
      name: admin.name,
      password: '',
      isActive: admin.isActive,
      isTenantOwner: admin.isTenantOwner,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft(null);
  };

  const handleSaveEdit = async () => {
    if (!editingId || !draft) return;
    const token = getPlatformToken();
    if (!token) return;
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const body: {
        loginId: string;
        name: string;
        isActive: boolean;
        isTenantOwner: boolean;
        password?: string;
      } = {
        loginId: draft.loginId.trim(),
        name: draft.name.trim(),
        isActive: draft.isActive,
        isTenantOwner: draft.isTenantOwner,
      };
      if (draft.password.trim()) body.password = draft.password.trim();
      await patchPlatformTenantAdmin(token, tenantId, editingId, body);
      setMessage('관리자 계정을 저장했습니다.');
      cancelEdit();
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : '관리자 저장 실패');
    } finally {
      setSaving(false);
    }
  };

  const handleAdd = async () => {
    const token = getPlatformToken();
    if (!token) return;
    setSaving(true);
    setMessage('');
    setError('');
    try {
      await createPlatformTenantAdmin(token, tenantId, {
        loginId: addForm.loginId.trim(),
        password: addForm.password,
        name: addForm.name.trim(),
        isTenantOwner: addForm.isTenantOwner,
      });
      setAddForm(EMPTY_ADD);
      setMessage('관리자 계정을 추가했습니다.');
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : '관리자 추가 실패');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500">
        업체 로그인(/login?tenant=…)에 쓰는 ADMIN 계정입니다. 여러 개를 등록할 수 있습니다.
      </p>

      {admins.length === 0 ? (
        <p className="text-fluid-xs text-amber-700 bg-amber-50 border border-amber-100 rounded px-3 py-2">
          등록된 관리자가 없습니다. 아래에서 추가해 주세요.
        </p>
      ) : (
        <>
          <div className="hidden lg:block overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
            <table className="w-full table-fixed border-collapse text-fluid-sm min-w-[640px]">
              <thead>
                <tr className="bg-gray-100 border-b border-gray-200">
                  <th className="px-3 py-2 text-center">아이디</th>
                  <th className="px-3 py-2 text-center w-28">이름</th>
                  <th className="px-3 py-2 text-center w-20">상태</th>
                  <th className="px-3 py-2 text-center w-20">소유</th>
                  <th className="px-3 py-2 text-center w-24">작업</th>
                </tr>
              </thead>
              <tbody>
                {admins.map((admin) => (
                  <tr key={admin.id} className="border-b border-gray-100">
                    <td className="px-3 py-2 text-center font-mono text-fluid-xs truncate" title={admin.loginId}>
                      {admin.loginId}
                    </td>
                    <td className="px-3 py-2 text-center truncate" title={admin.name}>
                      {admin.name}
                    </td>
                    <td className="px-3 py-2 text-center text-fluid-xs">
                      {admin.isActive ? '활성' : '비활성'}
                    </td>
                    <td className="px-3 py-2 text-center text-fluid-xs">
                      {admin.isTenantOwner ? '예' : '—'}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => startEdit(admin)}
                        disabled={saving}
                        className={`${BTN_LINK} text-xs disabled:opacity-50`}
                      >
                        수정
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="lg:hidden divide-y divide-gray-100 border border-gray-100 rounded-lg">
            {admins.map((admin) => (
              <div key={admin.id} className="p-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-mono text-fluid-sm text-gray-900">{admin.loginId}</div>
                  <div className="text-fluid-xs text-gray-500 mt-0.5">
                    {admin.name}
                    {admin.isTenantOwner ? ' · 소유' : ''}
                    {admin.isActive ? '' : ' · 비활성'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => startEdit(admin)}
                  disabled={saving}
                  className={`${BTN_LINK} shrink-0 text-xs`}
                >
                  수정
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {editingId && draft ? (
        <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 space-y-3">
          <h3 className="text-fluid-xs font-semibold text-gray-700">관리자 수정</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-fluid-xs text-gray-600 mb-1">아이디</label>
              <input
                value={draft.loginId}
                onChange={(e) => setDraft({ ...draft, loginId: e.target.value.toLowerCase() })}
                className="w-full border border-gray-300 rounded px-3 py-2 text-fluid-sm font-mono bg-white"
                spellCheck={false}
              />
            </div>
            <div>
              <label className="block text-fluid-xs text-gray-600 mb-1">이름</label>
              <input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                className="w-full border border-gray-300 rounded px-3 py-2 text-fluid-sm bg-white"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-fluid-xs text-gray-600 mb-1">새 비밀번호</label>
              <input
                type="password"
                value={draft.password}
                onChange={(e) => setDraft({ ...draft, password: e.target.value })}
                placeholder="변경할 때만 입력"
                className="w-full border border-gray-300 rounded px-3 py-2 text-fluid-sm bg-white max-w-md"
                autoComplete="new-password"
              />
            </div>
            <label className="flex items-center gap-2 text-fluid-xs text-gray-700">
              <input
                type="checkbox"
                checked={draft.isActive}
                onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })}
              />
              활성
            </label>
            <label className="flex items-center gap-2 text-fluid-xs text-gray-700">
              <input
                type="checkbox"
                checked={draft.isTenantOwner}
                onChange={(e) => setDraft({ ...draft, isTenantOwner: e.target.checked })}
              />
              소유 관리자
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void handleSaveEdit()}
              disabled={saving}
              className={`${BTN_PRIMARY} px-3 py-1.5 text-xs`}
            >
              저장
            </button>
            <button
              type="button"
              onClick={cancelEdit}
              disabled={saving}
              className={`${BTN_SECONDARY} px-3 py-1.5 text-xs`}
            >
              취소
            </button>
          </div>
        </div>
      ) : null}

      <div className="border-t border-gray-100 pt-4 space-y-3">
        <h3 className="text-fluid-xs font-semibold text-gray-700">관리자 추가</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-fluid-xs text-gray-600 mb-1">아이디</label>
            <input
              value={addForm.loginId}
              onChange={(e) => setAddForm({ ...addForm, loginId: e.target.value.toLowerCase() })}
              className="w-full border border-gray-300 rounded px-3 py-2 text-fluid-sm font-mono"
              spellCheck={false}
            />
          </div>
          <div>
            <label className="block text-fluid-xs text-gray-600 mb-1">이름</label>
            <input
              value={addForm.name}
              onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
              className="w-full border border-gray-300 rounded px-3 py-2 text-fluid-sm"
            />
          </div>
          <div>
            <label className="block text-fluid-xs text-gray-600 mb-1">비밀번호</label>
            <input
              type="password"
              value={addForm.password}
              onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
              className="w-full border border-gray-300 rounded px-3 py-2 text-fluid-sm"
              autoComplete="new-password"
            />
          </div>
          <label className="flex items-end gap-2 pb-2 text-fluid-xs text-gray-700">
            <input
              type="checkbox"
              checked={addForm.isTenantOwner}
              onChange={(e) => setAddForm({ ...addForm, isTenantOwner: e.target.checked })}
            />
            소유 관리자로 등록
          </label>
        </div>
        <p className="text-fluid-2xs text-gray-500">{tenantLoginIdErrorMessage()}</p>
        <button
          type="button"
          onClick={() => void handleAdd()}
          disabled={saving || !addForm.loginId.trim() || !addForm.password.trim()}
          className={`${BTN_PRIMARY} w-full sm:w-auto`}
        >
          관리자 추가
        </button>
      </div>
    </div>
  );
}
