import { useCallback, useEffect, useState } from 'react';
import { getToken } from '../../stores/auth';
import {
  createQuotationServiceItem,
  deleteQuotationServiceItem,
  fetchQuotationConfig,
  listQuotationServiceItems,
  moveQuotationServiceItem,
  updateQuotationConfig,
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
  const [footerNotice, setFooterNotice] = useState('');
  const [documentTitle, setDocumentTitle] = useState('');
  const [defaultEmailSubject, setDefaultEmailSubject] = useState('');
  const [defaultEmailBody, setDefaultEmailBody] = useState('');
  const [defaultValidDays, setDefaultValidDays] = useState('');
  const [configSaving, setConfigSaving] = useState(false);
  const [movingId, setMovingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [list, config] = await Promise.all([
        listQuotationServiceItems(token, { includeInactive: true }),
        fetchQuotationConfig(token),
      ]);
      setItems(list);
      setFooterNotice(config.footerNotice ?? '');
      setDocumentTitle(config.documentTitle ?? '');
      setDefaultEmailSubject(config.defaultEmailSubject ?? '');
      setDefaultEmailBody(config.defaultEmailBody ?? '');
      setDefaultValidDays(
        config.defaultValidDays != null ? String(config.defaultValidDays) : '',
      );
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

  async function handleSaveConfig() {
    if (!token) return;
    const daysRaw = defaultValidDays.trim();
    let defaultValidDaysVal: number | null = null;
    if (daysRaw) {
      const n = parseInt(daysRaw, 10);
      if (!Number.isFinite(n) || n < 0) {
        alert('기본 유효기간(일)을 올바르게 입력해 주세요.');
        return;
      }
      defaultValidDaysVal = n;
    }
    setConfigSaving(true);
    try {
      await updateQuotationConfig(token, {
        footerNotice: footerNotice.trim() || null,
        documentTitle: documentTitle.trim() || null,
        defaultEmailSubject: defaultEmailSubject.trim() || null,
        defaultEmailBody: defaultEmailBody.trim() || null,
        defaultValidDays: defaultValidDaysVal,
      });
      alert('서식 설정을 저장했습니다.');
    } catch (e) {
      alert(e instanceof Error ? e.message : '저장에 실패했습니다.');
    } finally {
      setConfigSaving(false);
    }
  }

  async function handleMove(id: string, direction: 'up' | 'down') {
    if (!token) return;
    setMovingId(id);
    try {
      const list = await moveQuotationServiceItem(token, id, direction);
      setItems(list);
    } catch (e) {
      alert(e instanceof Error ? e.message : '순서 변경에 실패했습니다.');
    } finally {
      setMovingId(null);
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

      <section className="border rounded-lg p-4 mb-6 bg-white">
        <h2 className="font-medium text-gray-900 mb-3">PDF 서식</h2>
        <label className="block text-sm mb-3 max-w-xs">
          <span className="text-gray-700">문서 제목 (PDF 상단)</span>
          <input
            className="mt-1 w-full border rounded px-2 py-1.5 text-sm"
            placeholder="기본: 견적서"
            maxLength={40}
            value={documentTitle}
            onChange={(e) => setDocumentTitle(e.target.value)}
          />
        </label>
        <label className="block text-sm mb-3">
          <span className="text-gray-700">하단 고정 안내</span>
          <textarea
            className="mt-1 w-full border rounded px-2 py-1.5 text-sm"
            rows={3}
            placeholder="예: 본 견적은 발행일로부터 7일간 유효합니다."
            value={footerNotice}
            onChange={(e) => setFooterNotice(e.target.value)}
          />
        </label>
        <label className="block text-sm mb-3 max-w-xs">
          <span className="text-gray-700">새 견적 기본 유효기간(일)</span>
          <input
            className="mt-1 w-full border rounded px-2 py-1.5 text-sm"
            inputMode="numeric"
            placeholder="비워 두면 미적용"
            value={defaultValidDays}
            onChange={(e) => setDefaultValidDays(e.target.value)}
          />
        </label>
        <h3 className="font-medium text-sm text-gray-900 mb-2 mt-4">이메일 기본값</h3>
        <p className="text-xs text-gray-500 mb-2">
          치환: {'{{customerName}}'}, {'{{quoteNumber}}'}, {'{{total}}'}, {'{{companyName}}'},{' '}
          {'{{validUntil}}'}
        </p>
        <label className="block text-sm mb-3">
          <span className="text-gray-700">기본 제목</span>
          <input
            className="mt-1 w-full border rounded px-2 py-1.5 text-sm"
            placeholder="비워 두면 시스템 기본값"
            maxLength={200}
            value={defaultEmailSubject}
            onChange={(e) => setDefaultEmailSubject(e.target.value)}
          />
        </label>
        <label className="block text-sm mb-3">
          <span className="text-gray-700">기본 본문</span>
          <textarea
            className="mt-1 w-full border rounded px-2 py-1.5 text-sm"
            rows={5}
            placeholder="비워 두면 시스템 기본값"
            value={defaultEmailBody}
            onChange={(e) => setDefaultEmailBody(e.target.value)}
          />
        </label>
        <button
          type="button"
          disabled={configSaving || loading}
          onClick={() => void handleSaveConfig()}
          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded disabled:opacity-50"
        >
          {configSaving ? '저장 중…' : '서식 저장'}
        </button>
      </section>

      <h2 className="font-medium text-gray-900 mb-2">서비스 항목</h2>
      {loading ? (
        <p className="text-sm text-gray-500">불러오는 중…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-500">등록된 서비스 항목이 없습니다.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((row, idx) => (
            <li
              key={row.id}
              className={`border rounded-lg p-3 flex flex-wrap gap-2 items-center ${row.isActive ? 'bg-white' : 'bg-gray-50 opacity-70'}`}
            >
              <span className="flex gap-0.5 shrink-0">
                <button
                  type="button"
                  disabled={movingId != null || idx === 0}
                  onClick={() => void handleMove(row.id, 'up')}
                  className="px-1 py-0.5 text-[10px] border rounded disabled:opacity-30"
                  aria-label="위로"
                >
                  ↑
                </button>
                <button
                  type="button"
                  disabled={movingId != null || idx === items.length - 1}
                  onClick={() => void handleMove(row.id, 'down')}
                  className="px-1 py-0.5 text-[10px] border rounded disabled:opacity-30"
                  aria-label="아래로"
                >
                  ↓
                </button>
              </span>
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
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !saving) setModalOpen(false);
          }}
        >
          <div
            className="relative w-full sm:max-w-md max-h-[90vh] overflow-y-auto rounded-t-xl sm:rounded-xl bg-white shadow-lg border border-gray-200"
            onClick={(e) => e.stopPropagation()}
          >
            <ModalCloseButton onClick={() => setModalOpen(false)} disabled={saving} />
            <div className="border-b border-gray-100 px-4 pb-3 pt-4 pr-12">
              <h2 className="font-semibold text-gray-900">{editing ? '항목 수정' : '항목 추가'}</h2>
            </div>
            <div className="p-4 space-y-3">
              <label className="block text-sm">
                <span className="text-gray-700">서비스명 *</span>
                <input
                  className="mt-1 w-full border rounded px-2 py-1.5 text-sm"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </label>
              <label className="block text-sm">
                <span className="text-gray-700">단가(원) *</span>
                <input
                  className="mt-1 w-full border rounded px-2 py-1.5 text-sm"
                  inputMode="numeric"
                  value={form.unitPrice}
                  onChange={(e) => setForm((f) => ({ ...f, unitPrice: e.target.value }))}
                />
              </label>
              <label className="block text-sm">
                <span className="text-gray-700">설명 (선택)</span>
                <textarea
                  className="mt-1 w-full border rounded px-2 py-1.5 text-sm"
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                />
              </label>
              {editing && (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                  />
                  사용 중
                </label>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t border-gray-100 px-4 py-3">
              <button
                type="button"
                disabled={saving}
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 text-sm border border-gray-300 rounded text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                취소
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleSave()}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded disabled:opacity-50"
              >
                {saving ? '저장 중…' : editing ? '수정' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !saving) setDeleteTarget(null);
          }}
        >
          <div
            className="relative w-full sm:max-w-sm rounded-t-xl sm:rounded-xl bg-white shadow-lg border border-gray-200"
            onClick={(e) => e.stopPropagation()}
          >
            <ModalCloseButton onClick={() => setDeleteTarget(null)} disabled={saving} />
            <div className="border-b border-gray-100 px-4 pb-3 pt-4 pr-12">
              <h2 className="font-semibold text-red-700">항목 삭제</h2>
            </div>
            <div className="p-4">
              <p className="text-sm text-gray-600 mb-3">
                「{deleteTarget.name}」을(를) 삭제합니다. 비밀번호를 입력해 주세요.
              </p>
              <input
                type="password"
                className="w-full border rounded px-2 py-1.5 text-sm"
                placeholder="로그인 비밀번호"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2 border-t border-gray-100 px-4 py-3">
              <button
                type="button"
                disabled={saving}
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-sm border border-gray-300 rounded text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                취소
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleDelete()}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded disabled:opacity-50"
              >
                {saving ? '삭제 중…' : '삭제'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
