import { useCallback, useEffect, useMemo, useState } from 'react';
import { getToken } from '../../stores/auth';
import {
  createInquiryLeadSource,
  deleteInquiryLeadSource,
  listAllInquiryLeadSources,
  updateInquiryLeadSource,
  type InquiryLeadSourceOption,
} from '../../api/inquiryLeadSources';
import { HelpTooltip } from '../../components/ui/HelpTooltip';

const HELP =
  '발주서 발급·텔레CRM·접수 저장 시 마케터가 고르는 유입 플랫폼 목록입니다.\n' +
  '이름 변경·추가·비활성(삭제)이 가능합니다. 비활성 항목은 드롭다운에 나오지 않습니다.';

export function AdminOrderFormLeadSourceSettingsPage({
  onCatalogChanged,
}: {
  onCatalogChanged?: () => void;
} = {}) {
  const token = getToken();
  const [items, setItems] = useState<InquiryLeadSourceOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newLabel, setNewLabel] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [busy, setBusy] = useState(false);

  const activeItems = useMemo(() => items.filter((i) => i.isActive), [items]);

  const reload = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const r = await listAllInquiryLeadSources(token);
      setItems(r.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : '불러오기 실패');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const addItem = async () => {
    if (!token) return;
    const label = newLabel.trim();
    if (!label) {
      setError('플랫폼 이름을 입력해 주세요.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await createInquiryLeadSource(token, { label });
      setNewLabel('');
      await reload();
      await onCatalogChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : '추가 실패');
    } finally {
      setBusy(false);
    }
  };

  const saveEdit = async (row: InquiryLeadSourceOption) => {
    if (!token) return;
    const label = editDraft.trim();
    if (!label) {
      setError('플랫폼 이름을 입력해 주세요.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await updateInquiryLeadSource(token, row.id, { label });
      setEditingId(null);
      await reload();
      await onCatalogChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : '수정 실패');
    } finally {
      setBusy(false);
    }
  };

  const move = async (row: InquiryLeadSourceOption, dir: -1 | 1) => {
    if (!token) return;
    const sorted = [...activeItems].sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label));
    const idx = sorted.findIndex((x) => x.id === row.id);
    const swap = sorted[idx + dir];
    if (idx < 0 || !swap) return;
    setBusy(true);
    setError(null);
    try {
      await updateInquiryLeadSource(token, row.id, { sortOrder: swap.sortOrder });
      await updateInquiryLeadSource(token, swap.id, { sortOrder: row.sortOrder });
      await reload();
      await onCatalogChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : '순서 변경 실패');
    } finally {
      setBusy(false);
    }
  };

  const deactivate = async (row: InquiryLeadSourceOption) => {
    if (!token) return;
    if (!window.confirm(`「${row.label}」을(를) 비활성(삭제)할까요?\n기존 접수·부재 기록의 표시값은 유지됩니다.`)) return;
    setBusy(true);
    setError(null);
    try {
      await deleteInquiryLeadSource(token, row.id);
      await reload();
      await onCatalogChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : '삭제 실패');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-fluid-sm font-semibold text-gray-900">유입경로(플랫폼)</h3>
        <HelpTooltip text={HELP} />
      </div>
      {error ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-fluid-xs text-rose-800">{error}</p>
      ) : null}
      {loading ? (
        <p className="text-fluid-xs text-gray-500">불러오는 중…</p>
      ) : (
        <ul className="space-y-2">
          {activeItems.map((row, idx) => (
            <li
              key={row.id}
              className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2"
            >
              {editingId === row.id ? (
                <>
                  <input
                    className="min-w-0 flex-1 rounded border border-gray-300 px-2 py-1.5 text-fluid-sm"
                    value={editDraft}
                    onChange={(e) => setEditDraft(e.target.value)}
                  />
                  <button
                    type="button"
                    disabled={busy}
                    className="rounded bg-slate-900 px-2 py-1 text-fluid-2xs text-white disabled:opacity-50"
                    onClick={() => void saveEdit(row)}
                  >
                    저장
                  </button>
                  <button
                    type="button"
                    className="rounded border border-gray-300 px-2 py-1 text-fluid-2xs"
                    onClick={() => setEditingId(null)}
                  >
                    취소
                  </button>
                </>
              ) : (
                <>
                  <span className="min-w-0 flex-1 font-medium text-gray-900">{row.label}</span>
                  <span className="flex gap-0.5">
                    <button
                      type="button"
                      disabled={busy || idx === 0}
                      className="rounded border border-gray-300 px-1.5 py-0.5 text-[11px] disabled:opacity-30"
                      onClick={() => void move(row, -1)}
                      aria-label="위로"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      disabled={busy || idx === activeItems.length - 1}
                      className="rounded border border-gray-300 px-1.5 py-0.5 text-[11px] disabled:opacity-30"
                      onClick={() => void move(row, 1)}
                      aria-label="아래로"
                    >
                      ↓
                    </button>
                  </span>
                  <button
                    type="button"
                    disabled={busy}
                    className="rounded border border-gray-300 px-2 py-1 text-fluid-2xs"
                    onClick={() => {
                      setEditingId(row.id);
                      setEditDraft(row.label);
                    }}
                  >
                    이름 수정
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    className="rounded border border-rose-200 px-2 py-1 text-fluid-2xs text-rose-700"
                    onClick={() => void deactivate(row)}
                  >
                    삭제
                  </button>
                </>
              )}
            </li>
          ))}
          {activeItems.length === 0 ? (
            <li className="rounded-lg border border-dashed border-gray-200 px-3 py-4 text-center text-fluid-xs text-gray-500">
              등록된 유입경로가 없습니다. 아래에서 추가해 주세요.
            </li>
          ) : null}
        </ul>
      )}
      <div className="flex flex-wrap items-end gap-2 border-t border-gray-100 pt-4">
        <label className="min-w-[12rem] flex-1">
          <span className="mb-1 block text-fluid-2xs font-medium text-gray-600">플랫폼 추가</span>
          <input
            className="w-full rounded border border-gray-300 px-2 py-2 text-fluid-sm"
            value={newLabel}
            placeholder="예: 인스타"
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void addItem();
              }
            }}
          />
        </label>
        <button
          type="button"
          disabled={busy}
          className="rounded-lg bg-slate-900 px-4 py-2 text-fluid-sm font-medium text-white disabled:opacity-50"
          onClick={() => void addItem()}
        >
          추가
        </button>
      </div>
    </div>
  );
}
