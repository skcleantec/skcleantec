import { useEffect, useState } from 'react';
import { getToken } from '../../stores/auth';
import {
  createOperatingCompany,
  listOperatingCompanies,
  updateOperatingCompany,
  type OperatingCompanyItem,
} from '../../api/operatingCompanies';
import { ModalCloseButton } from '../../components/admin/ModalCloseButton';

function emptyCreateForm() {
  return {
    name: '',
    slug: '',
    displayName: '',
    numberPrefix: '',
    publicSubtitle: '',
  };
}

function slugFromName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

export function AdminOperatingCompaniesPage() {
  const token = getToken();
  const [items, setItems] = useState<OperatingCompanyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [listErr, setListErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [createErr, setCreateErr] = useState<string | null>(null);
  const [form, setForm] = useState(emptyCreateForm());
  const [editing, setEditing] = useState<OperatingCompanyItem | null>(null);
  const [editForm, setEditForm] = useState(emptyCreateForm());

  const load = () => {
    if (!token) return;
    setListErr(null);
    listOperatingCompanies(token)
      .then((r) => setItems(r.items))
      .catch((e) => setListErr(e instanceof Error ? e.message : '불러오기 실패'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const openEdit = (row: OperatingCompanyItem) => {
    setEditing(row);
    setEditForm({
      name: row.name,
      slug: row.slug,
      displayName: row.config.branding?.displayName ?? '',
      numberPrefix: row.config.inquiry?.numberPrefix ?? '',
      publicSubtitle: row.config.orderForm?.publicSubtitle ?? '',
    });
  };

  const buildConfig = (f: typeof form) => ({
    branding: f.displayName.trim() ? { displayName: f.displayName.trim() } : undefined,
    orderForm: f.publicSubtitle.trim() ? { publicSubtitle: f.publicSubtitle.trim() } : undefined,
    inquiry: f.numberPrefix.trim() ? { numberPrefix: f.numberPrefix.trim() } : undefined,
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSubmitting(true);
    setCreateErr(null);
    try {
      await createOperatingCompany(token, {
        name: form.name.trim(),
        slug: form.slug.trim() || slugFromName(form.name),
        config: buildConfig(form),
      });
      setShowCreate(false);
      setForm(emptyCreateForm());
      load();
    } catch (err) {
      setCreateErr(err instanceof Error ? err.message : '등록 실패');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !editing) return;
    setSubmitting(true);
    try {
      await updateOperatingCompany(token, editing.id, {
        name: editForm.name.trim(),
        slug: editForm.slug.trim(),
        config: buildConfig(editForm),
      });
      setEditing(null);
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : '수정 실패');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeactivate = async (row: OperatingCompanyItem) => {
    if (!token || row.isDefault) return;
    if (
      !window.confirm(
        `"${row.displayName}" 브랜드를 비활성화할까요?\n신규 접수·발주서 유입만 차단되며, 기존 접수는 조회·수정할 수 있습니다.`,
      )
    ) {
      return;
    }
    setSubmitting(true);
    try {
      await updateOperatingCompany(token, row.id, { isActive: false });
      setEditing((p) => (p?.id === row.id ? null : p));
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : '비활성화 실패');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReactivate = async (row: OperatingCompanyItem) => {
    if (!token) return;
    setSubmitting(true);
    try {
      await updateOperatingCompany(token, row.id, { isActive: true });
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : '활성화 실패');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 min-w-0 w-full max-w-full">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-gray-800">영업 브랜드</h1>
          <p className="mt-1 text-sm text-gray-500">
            SK클린텍·타나클린 등 내부 영업 단위입니다. 타업체(협력사)와 별개입니다.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setCreateErr(null);
            setShowCreate(true);
          }}
          className="shrink-0 px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700"
        >
          브랜드 등록
        </button>
      </div>

      {listErr ? (
        <div className="text-sm text-red-700 bg-red-50 border border-red-100 rounded px-3 py-2">{listErr}</div>
      ) : null}

      <div className="bg-white border border-gray-200 rounded-lg">
        {loading ? (
          <div className="p-8 text-center text-gray-500 text-sm">불러오는 중…</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">등록된 영업 브랜드가 없습니다.</div>
        ) : (
          <>
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full table-fixed text-fluid-sm border-collapse">
                <colgroup>
                  <col className="w-[22%]" />
                  <col className="w-[14%]" />
                  <col className="w-[12%]" />
                  <col className="w-[12%]" />
                  <col className="w-[10%]" />
                  <col className="w-[18%]" />
                </colgroup>
                <thead>
                  <tr className="bg-gray-100 text-gray-600">
                    <th className="px-3 py-2 text-center font-medium">표시명</th>
                    <th className="px-3 py-2 text-center font-medium">영문 slug</th>
                    <th className="px-3 py-2 text-center font-medium">접수 접두</th>
                    <th className="px-3 py-2 text-center font-medium">상태</th>
                    <th className="px-3 py-2 text-center font-medium">기본</th>
                    <th className="px-3 py-2 text-center font-medium">작업</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row) => (
                    <tr key={row.id} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-3 py-2 text-center truncate" title={row.displayName}>
                        {row.displayName}
                      </td>
                      <td className="px-3 py-2 text-center font-mono text-xs text-gray-600">{row.slug}</td>
                      <td className="px-3 py-2 text-center text-gray-600">
                        {row.config.inquiry?.numberPrefix ?? '—'}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {row.isActive ? (
                          <span className="text-green-700">활성</span>
                        ) : (
                          <span className="text-gray-500">비활성</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center">{row.isDefault ? '✓' : '—'}</td>
                      <td className="px-3 py-2 text-center">
                        <div className="flex flex-wrap justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => openEdit(row)}
                            className="text-blue-600 hover:underline text-xs"
                          >
                            수정
                          </button>
                          {row.isActive && !row.isDefault ? (
                            <button
                              type="button"
                              onClick={() => handleDeactivate(row)}
                              className="text-red-600 hover:underline text-xs"
                            >
                              비활성
                            </button>
                          ) : null}
                          {!row.isActive ? (
                            <button
                              type="button"
                              onClick={() => handleReactivate(row)}
                              className="text-gray-700 hover:underline text-xs"
                            >
                              활성화
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="lg:hidden divide-y divide-gray-100">
              {items.map((row) => (
                <div key={row.id} className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 truncate">{row.displayName}</p>
                      <p className="text-xs font-mono text-gray-500">{row.slug}</p>
                    </div>
                    <span
                      className={`shrink-0 text-xs px-2 py-0.5 rounded ${
                        row.isActive ? 'bg-green-50 text-green-800' : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {row.isActive ? '활성' : '비활성'}
                      {row.isDefault ? ' · 기본' : ''}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600">
                    접수 접두: {row.config.inquiry?.numberPrefix ?? '없음'}
                  </p>
                  <div className="flex gap-3 pt-1">
                    <button type="button" onClick={() => openEdit(row)} className="text-sm text-blue-600">
                      수정
                    </button>
                    {row.isActive && !row.isDefault ? (
                      <button type="button" onClick={() => handleDeactivate(row)} className="text-sm text-red-600">
                        비활성
                      </button>
                    ) : null}
                    {!row.isActive ? (
                      <button type="button" onClick={() => handleReactivate(row)} className="text-sm text-gray-700">
                        활성화
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {showCreate ? (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h2 className="font-semibold text-gray-900">영업 브랜드 등록</h2>
              <ModalCloseButton onClick={() => setShowCreate(false)} />
            </div>
            <form onSubmit={handleCreate} className="p-4 space-y-3">
              {createErr ? <p className="text-sm text-red-600">{createErr}</p> : null}
              <label className="block text-sm">
                <span className="font-medium text-gray-800">표시명</span>
                <input
                  required
                  value={form.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    setForm((f) => ({
                      ...f,
                      name,
                      slug: f.slug || slugFromName(name),
                    }));
                  }}
                  className="mt-1 w-full border border-gray-300 rounded px-3 py-2 text-sm"
                  placeholder="예: 타나클린"
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium text-gray-800">영문 slug</span>
                <span className="block text-xs text-gray-500 mt-0.5">고객 링크 ?brand= 값</span>
                <input
                  required
                  value={form.slug}
                  onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value.toLowerCase() }))}
                  className="mt-1 w-full border border-gray-300 rounded px-3 py-2 text-sm font-mono"
                  placeholder="tanaclean"
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium text-gray-800">고객 화면 표시명 (선택)</span>
                <input
                  value={form.displayName}
                  onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
                  className="mt-1 w-full border border-gray-300 rounded px-3 py-2 text-sm"
                  placeholder="비우면 표시명과 동일"
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium text-gray-800">접수번호 접두 (선택)</span>
                <input
                  value={form.numberPrefix}
                  onChange={(e) => setForm((f) => ({ ...f, numberPrefix: e.target.value }))}
                  className="mt-1 w-full border border-gray-300 rounded px-3 py-2 text-sm font-mono"
                  placeholder="예: TN-"
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium text-gray-800">발주서 부제 (선택)</span>
                <input
                  value={form.publicSubtitle}
                  onChange={(e) => setForm((f) => ({ ...f, publicSubtitle: e.target.value }))}
                  className="mt-1 w-full border border-gray-300 rounded px-3 py-2 text-sm"
                />
              </label>
              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2 bg-gray-800 text-white rounded text-sm font-medium disabled:opacity-50"
                >
                  등록
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="px-4 py-2 border border-gray-300 rounded text-sm"
                >
                  취소
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {editing ? (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h2 className="font-semibold text-gray-900">영업 브랜드 수정</h2>
              <ModalCloseButton onClick={() => setEditing(null)} />
            </div>
            <form onSubmit={handleEditSave} className="p-4 space-y-3">
              <label className="block text-sm">
                <span className="font-medium text-gray-800">표시명</span>
                <input
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                  className="mt-1 w-full border border-gray-300 rounded px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium text-gray-800">영문 slug</span>
                <input
                  required
                  value={editForm.slug}
                  onChange={(e) => setEditForm((f) => ({ ...f, slug: e.target.value.toLowerCase() }))}
                  className="mt-1 w-full border border-gray-300 rounded px-3 py-2 text-sm font-mono"
                  disabled={editing.isDefault}
                />
                {editing.isDefault ? (
                  <span className="text-xs text-gray-500">기본 브랜드 slug는 변경하지 않습니다.</span>
                ) : null}
              </label>
              <label className="block text-sm">
                <span className="font-medium text-gray-800">고객 화면 표시명 (선택)</span>
                <input
                  value={editForm.displayName}
                  onChange={(e) => setEditForm((f) => ({ ...f, displayName: e.target.value }))}
                  className="mt-1 w-full border border-gray-300 rounded px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium text-gray-800">접수번호 접두 (선택)</span>
                <input
                  value={editForm.numberPrefix}
                  onChange={(e) => setEditForm((f) => ({ ...f, numberPrefix: e.target.value }))}
                  className="mt-1 w-full border border-gray-300 rounded px-3 py-2 text-sm font-mono"
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium text-gray-800">발주서 부제 (선택)</span>
                <input
                  value={editForm.publicSubtitle}
                  onChange={(e) => setEditForm((f) => ({ ...f, publicSubtitle: e.target.value }))}
                  className="mt-1 w-full border border-gray-300 rounded px-3 py-2 text-sm"
                />
              </label>
              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2 bg-gray-800 text-white rounded text-sm font-medium disabled:opacity-50"
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
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
