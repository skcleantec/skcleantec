import { useState, useEffect } from 'react';
import { getToken } from '../../stores/auth';
import {
  listExternalCompanies,
  createExternalCompany,
  updateExternalCompany,
  deactivateExternalCompany,
  type ExternalCompanyListItem,
} from '../../api/externalCompanies';
import { ModalCloseButton } from '../../components/admin/ModalCloseButton';

const emptyCreateForm = () => ({
  name: '',
  bizNumber: '',
  phone: '',
  memo: '',
  loginEmail: '',
  loginPassword: '',
  contactName: '',
  contactPhone: '',
});

export function AdminExternalCompaniesPage() {
  const token = getToken();
  const [items, setItems] = useState<ExternalCompanyListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [listErr, setListErr] = useState<string | null>(null);
  const [createErr, setCreateErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const [form, setForm] = useState({
    name: '',
    bizNumber: '',
    phone: '',
    memo: '',
    loginEmail: '',
    loginPassword: '',
    contactName: '',
    contactPhone: '',
  });

  const closeCreateModal = () => {
    setShowCreateModal(false);
    setCreateErr(null);
    setForm(emptyCreateForm());
  };

  const [editing, setEditing] = useState<ExternalCompanyListItem | null>(null);
  const [editFields, setEditFields] = useState({
    name: '',
    bizNumber: '',
    phone: '',
    memo: '',
  });

  const load = () => {
    if (!token) return;
    setListErr(null);
    listExternalCompanies(token)
      .then((r) => setItems(r.items))
      .catch((e) => setListErr(e instanceof Error ? e.message : '불러오기 실패'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- token
  }, [token]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSubmitting(true);
    setCreateErr(null);
    try {
      await createExternalCompany(token, {
        name: form.name.trim(),
        bizNumber: form.bizNumber.trim() || undefined,
        phone: form.phone.trim() || undefined,
        memo: form.memo.trim() || undefined,
        login: {
          email: form.loginEmail.trim().toLowerCase(),
          password: form.loginPassword,
          contactName: form.contactName.trim(),
          phone: form.contactPhone.trim() || undefined,
        },
      });
      closeCreateModal();
      load();
    } catch (e) {
      setCreateErr(e instanceof Error ? e.message : '등록 실패');
    } finally {
      setSubmitting(false);
    }
  };

  const openEdit = (row: ExternalCompanyListItem) => {
    setEditing(row);
    setEditFields({
      name: row.name,
      bizNumber: row.bizNumber ?? '',
      phone: row.phone ?? '',
      memo: row.memo ?? '',
    });
  };

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !editing) return;
    setSubmitting(true);
    try {
      await updateExternalCompany(token, editing.id, {
        name: editFields.name.trim(),
        bizNumber: editFields.bizNumber.trim() || null,
        phone: editFields.phone.trim() || null,
        memo: editFields.memo.trim() || null,
      });
      setEditing(null);
      load();
    } catch (e) {
      alert(e instanceof Error ? e.message : '수정 실패');
    } finally {
      setSubmitting(false);
    }
  };

  /** 업체·소속 로그인 계정 비활성 처리(목록에서 제거됨) */
  const handleDelete = async (row: ExternalCompanyListItem) => {
    if (!token) return;
    if (
      !window.confirm(
        `"${row.name}" 타업체를 삭제할까요?\n업체와 소속 로그인 계정이 비활성화되며, 이후 해당 계정으로 로그인할 수 없습니다.`
      )
    ) {
      return;
    }
    setSubmitting(true);
    try {
      await deactivateExternalCompany(token, row.id);
      setEditing((prev) => (prev?.id === row.id ? null : prev));
      load();
    } catch (e) {
      alert(e instanceof Error ? e.message : '삭제에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 min-w-0 w-full max-w-full">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-gray-800">타업체</h1>
          <p className="text-sm text-gray-500 mt-1">
            접수·스케줄에서 타업체 담당을 배정하면 <strong className="font-medium text-gray-700">[타업체]</strong>
            로 표시됩니다. 로그인은 팀장과 같은 주소(/team)입니다.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setCreateErr(null);
            setShowCreateModal(true);
          }}
          className="shrink-0 px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700"
        >
          타업체 등록
        </button>
      </div>

      {listErr && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-100 rounded px-3 py-2">{listErr}</div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="text-base font-medium text-gray-800">등록된 타업체</h2>
        </div>
        {loading ? (
          <div className="p-8 text-center text-gray-500 text-sm">불러오는 중…</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">등록된 타업체가 없습니다.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-gray-600">
                  <th className="px-4 py-2 font-medium">업체명</th>
                  <th className="px-4 py-2 font-medium">사업자번호</th>
                  <th className="px-4 py-2 font-medium">연락처</th>
                  <th className="px-4 py-2 font-medium">로그인 계정</th>
                  <th className="px-4 py-2 font-medium w-44">작업</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id} className="border-t border-gray-100">
                    <td className="px-4 py-2 font-medium text-gray-900">{row.name}</td>
                    <td className="px-4 py-2 text-gray-600">{row.bizNumber ?? '—'}</td>
                    <td className="px-4 py-2 text-gray-600">{row.phone ?? '—'}</td>
                    <td className="px-4 py-2 text-gray-600">
                      {row.partnerUsers.length === 0 ? (
                        '—'
                      ) : (
                        <ul className="space-y-0.5">
                          {row.partnerUsers.map((u) => (
                            <li key={u.id} className="tabular-nums">
                              {u.email} <span className="text-gray-400">({u.name})</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <button
                        type="button"
                        onClick={() => openEdit(row)}
                        className="text-blue-600 hover:underline text-xs mr-2"
                      >
                        수정
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(row)}
                        className="text-red-600 hover:underline text-xs font-medium"
                        disabled={submitting}
                      >
                        삭제
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCreateModal && (
        <div
          className="fixed inset-0 z-[400] flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="external-create-title"
        >
          <div className="relative bg-white rounded-lg shadow-lg max-w-lg w-full max-h-[min(90dvh,720px)] flex flex-col">
            <ModalCloseButton onClick={() => !submitting && closeCreateModal()} disabled={submitting} />
            <div className="px-5 pt-4 pb-3 border-b border-gray-100 shrink-0">
              <h3 id="external-create-title" className="text-lg font-semibold text-gray-800 pr-10">
                타업체 등록
              </h3>
              <p className="text-xs text-gray-500 mt-1">업체 정보와 로그인 계정을 한 번에 만듭니다.</p>
            </div>
            <form
              onSubmit={handleCreate}
              className="px-5 py-4 overflow-y-auto space-y-3 text-sm flex-1 min-h-0"
            >
              {createErr && (
                <div className="text-sm text-red-700 bg-red-50 border border-red-100 rounded px-3 py-2">
                  {createErr}
                </div>
              )}
              <div>
                <label className="block text-gray-600 mb-1">업체명 *</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded"
                  required
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-600 mb-1">사업자등록번호</label>
                  <input
                    value={form.bizNumber}
                    onChange={(e) => setForm((p) => ({ ...p, bizNumber: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded"
                  />
                </div>
                <div>
                  <label className="block text-gray-600 mb-1">대표 연락처</label>
                  <input
                    value={form.phone}
                    onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded"
                  />
                </div>
              </div>
              <div>
                <label className="block text-gray-600 mb-1">메모</label>
                <textarea
                  value={form.memo}
                  onChange={(e) => setForm((p) => ({ ...p, memo: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded"
                />
              </div>
              <div className="border-t border-gray-100 pt-3 mt-1">
                <p className="text-xs font-medium text-gray-700 mb-2">로그인 (팀장과 동일 화면)</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-gray-600 mb-1">아이디 *</label>
                    <input
                      value={form.loginEmail}
                      onChange={(e) => setForm((p) => ({ ...p, loginEmail: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded"
                      required
                      autoComplete="off"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-600 mb-1">비밀번호 *</label>
                    <input
                      type="password"
                      value={form.loginPassword}
                      onChange={(e) => setForm((p) => ({ ...p, loginPassword: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded"
                      required
                      autoComplete="new-password"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-600 mb-1">담당자 이름 *</label>
                    <input
                      value={form.contactName}
                      onChange={(e) => setForm((p) => ({ ...p, contactName: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-gray-600 mb-1">담당자 연락처</label>
                    <input
                      value={form.contactPhone}
                      onChange={(e) => setForm((p) => ({ ...p, contactPhone: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded"
                    />
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {submitting ? '등록 중…' : '등록'}
                </button>
                <button
                  type="button"
                  onClick={() => !submitting && closeCreateModal()}
                  disabled={submitting}
                  className="px-4 py-2 border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-50"
                >
                  취소
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">타업체 정보 수정</h3>
            <form onSubmit={handleEditSave} className="space-y-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">업체명</label>
                <input
                  value={editFields.name}
                  onChange={(e) => setEditFields((p) => ({ ...p, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">사업자등록번호</label>
                <input
                  value={editFields.bizNumber}
                  onChange={(e) => setEditFields((p) => ({ ...p, bizNumber: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">연락처</label>
                <input
                  value={editFields.phone}
                  onChange={(e) => setEditFields((p) => ({ ...p, phone: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">메모</label>
                <textarea
                  value={editFields.memo}
                  onChange={(e) => setEditFields((p) => ({ ...p, memo: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-blue-600 text-white rounded text-sm"
                >
                  저장
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="px-4 py-2 border border-gray-300 rounded text-sm"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={() => editing && void handleDelete(editing)}
                  disabled={submitting}
                  className="ml-auto px-4 py-2 text-sm text-red-600 border border-red-200 rounded hover:bg-red-50"
                >
                  삭제
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
