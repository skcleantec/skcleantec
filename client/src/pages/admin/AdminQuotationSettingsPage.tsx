import { useCallback, useEffect, useState } from 'react';
import { getToken } from '../../stores/auth';
import {
  createQuotationServiceItem,
  deleteQuotationServiceItem,
  listQuotationServiceItems,
  updateQuotationServiceItem,
  type QuotationServiceItemDto,
} from '../../api/quotations';
import { ModalCloseButton } from '../../components/admin/ModalCloseButton';
import { HelpTooltip } from '../../components/ui/HelpTooltip';

const HELP =
  '견적서 작성 시 불러올 서비스 항목(이름·단가)을 등록합니다.\n' +
  '발주서 견적 옵션과 별도로 관리됩니다.\n' +
  '삭제 시 로그인 비밀번호 확인이 필요합니다.';

function parsePriceInt(raw: string): number | null {
  const t = raw.replace(/,/g, '').trim();
  if (!t) return null;
  const n = parseInt(t, 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

type FormState = { name: string; unitPrice: string; description: string; isActive: boolean };

function emptyForm(): FormState {
  return { name: '', unitPrice: '', description: '', isActive: true };
}

export function AdminQuotationSettingsPage() {
  const token = getToken();
  const [items, setItems] = useState<QuotationServiceItemDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<QuotationServiceItemDto | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<QuotationServiceItemDto | null>(null);
  const [deletePassword, setDeletePassword] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const list = await listQuotationServiceItems(token, { includeInactive: true });
      setItems(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : '목록을 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm());
    setModalOpen(true);
  }

  function openEdit(row: QuotationServiceItemDto) {
    setEditing(row);
    setForm({
      name: row.name,
      unitPrice: String(row.unitPrice),
      description: row.description ?? '',
      isActive: row.isActive,
    });
    setModalOpen(true);
  }

  async function handleSave() {
    if (!token) return;
    if (!form.name.trim()) {
      alert('서비스명을 입력해 주세요.');
      return;
    }
    const unitPrice = parsePriceInt(form.unitPrice);
    if (unitPrice == null) {
      alert('단가(원)를 올바르게 입력해 주세요.');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await updateQuotationServiceItem(token, editing.id, {
          name: form.name.trim(),
          unitPrice,
          description: form.description.trim() || null,
          isActive: form.isActive,
        });
      } else {
        await createQuotationServiceItem(token, {
          name: form.name.trim(),
          unitPrice,
          description: form.description.trim() || null,
          sortOrder: items.length,
        });
      }
      setModalOpen(false);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!token || !deleteTarget) return;
    if (!deletePassword.trim()) {
      alert('비밀번호를 입력해 주세요.');
      return;
    }
    setSaving(true);
    try {
      await deleteQuotationServiceItem(token, deleteTarget.id, deletePassword);
      setDeleteTarget(null);
      setDeletePassword('');
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : '삭제에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-3 py-4 sm:px-4">
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <h1 className="text-lg font-semibold text-gray-900">견적 설정</h1>
        <HelpTooltip text={HELP} />
        <button
          type="button"
          onClick={openCreate}
          className="ml-auto px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          + 항목 추가
        </button>
      </div>

      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
      {loading ? (
        <p className="text-sm text-gray-500">불러오는 중…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-500">등록된 서비스 항목이 없습니다.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((row) => (
            <li
              key={row.id}
              className={`border rounded-lg p-3 flex flex-wrap gap-2 items-center ${row.isActive ? 'bg-white' : 'bg-gray-50 opacity-70'}`}
            >
              <div className="flex-1 min-w-[140px]">
                <div className="font-medium text-gray-900">{row.name}</div>
                <div className="text-sm text-gray-600">{row.unitPrice.toLocaleString('ko-KR')}원</div>
                {row.description && (
                  <div className="text-xs text-gray-500 mt-0.5">{row.description}</div>
                )}
              </div>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => openEdit(row)}
                  className="px-2 py-1 text-xs border rounded hover:bg-gray-50"
                >
                  수정
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDeleteTarget(row);
                    setDeletePassword('');
                  }}
                  className="px-2 py-1 text-xs border border-red-200 text-red-600 rounded hover:bg-red-50"
                >
                  삭제
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-md rounded-t-xl sm:rounded-xl shadow-lg p-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">{editing ? '항목 수정' : '항목 추가'}</h2>
              <ModalCloseButton onClick={() => setModalOpen(false)} />
            </div>
            <label className="block text-sm mb-3">
              <span className="text-gray-700">서비스명 *</span>
              <input
                className="mt-1 w-full border rounded px-2 py-1.5 text-sm"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </label>
            <label className="block text-sm mb-3">
              <span className="text-gray-700">단가(원) *</span>
              <input
                className="mt-1 w-full border rounded px-2 py-1.5 text-sm"
                inputMode="numeric"
                value={form.unitPrice}
                onChange={(e) => setForm((f) => ({ ...f, unitPrice: e.target.value }))}
              />
            </label>
            <label className="block text-sm mb-3">
              <span className="text-gray-700">설명 (선택)</span>
              <textarea
                className="mt-1 w-full border rounded px-2 py-1.5 text-sm"
                rows={2}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </label>
            {editing && (
              <label className="flex items-center gap-2 text-sm mb-4">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                />
                사용 중
              </label>
            )}
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleSave()}
              className="w-full py-2 bg-blue-600 text-white rounded text-sm disabled:opacity-50"
            >
              {saving ? '저장 중…' : '저장'}
            </button>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-sm rounded-t-xl sm:rounded-xl shadow-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-semibold text-red-700">항목 삭제</h2>
              <ModalCloseButton onClick={() => setDeleteTarget(null)} />
            </div>
            <p className="text-sm text-gray-600 mb-3">
              「{deleteTarget.name}」을(를) 삭제합니다. 비밀번호를 입력해 주세요.
            </p>
            <input
              type="password"
              className="w-full border rounded px-2 py-1.5 text-sm mb-3"
              placeholder="로그인 비밀번호"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
            />
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleDelete()}
              className="w-full py-2 bg-red-600 text-white rounded text-sm disabled:opacity-50"
            >
              {saving ? '삭제 중…' : '삭제 확인'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
