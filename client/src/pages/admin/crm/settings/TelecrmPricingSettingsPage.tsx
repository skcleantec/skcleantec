import { useCallback, useEffect, useMemo, useState } from 'react';
import { getToken } from '../../../../stores/auth';
import {
  createTelecrmPriceCategory,
  createTelecrmPriceItem,
  deleteTelecrmPriceCategory,
  deleteTelecrmPriceItem,
  fetchTelecrmPriceCategories,
  reorderTelecrmPriceCategories,
  reorderTelecrmPriceItems,
  updateTelecrmPriceCategory,
  updateTelecrmPriceItem,
  type TelecrmPriceCategoryDto,
  type TelecrmPriceItemDto,
} from '../../../../api/telecrm';
import { DeletePasswordModal, SettingsCard } from '../../../../components/crm/settings/DeletePasswordModal';
import { TelecrmReorderButtons, formatWon, parsePriceInt } from '../../../../components/crm/settings/telecrmSettingsUi';

type DeleteTarget =
  | { kind: 'category'; row: TelecrmPriceCategoryDto }
  | { kind: 'item'; row: TelecrmPriceItemDto };

export function TelecrmPricingSettingsPage() {
  const token = getToken();
  const [categories, setCategories] = useState<TelecrmPriceCategoryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [newCategoryLabel, setNewCategoryLabel] = useState('');
  const [itemForm, setItemForm] = useState({ name: '', amountWon: '', description: '' });
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchTelecrmPriceCategories(token, { includeInactive: true });
      setCategories(res.categories);
      setSelectedCategoryId((prev) => {
        if (prev && res.categories.some((c) => c.id === prev)) return prev;
        return res.categories[0]?.id ?? null;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : '불러오기 실패');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === selectedCategoryId) ?? null,
    [categories, selectedCategoryId],
  );

  const items = selectedCategory?.items ?? [];

  const addCategory = async () => {
    if (!token || !newCategoryLabel.trim()) return;
    setBusy(true);
    try {
      await createTelecrmPriceCategory(token, { label: newCategoryLabel.trim() });
      setNewCategoryLabel('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '추가 실패');
    } finally {
      setBusy(false);
    }
  };

  const addItem = async () => {
    if (!token || !selectedCategory) return;
    const amount = parsePriceInt(itemForm.amountWon);
    if (!itemForm.name.trim() || amount == null) {
      setError('항목 이름과 금액을 입력해 주세요.');
      return;
    }
    setBusy(true);
    try {
      await createTelecrmPriceItem(token, {
        categoryId: selectedCategory.id,
        name: itemForm.name.trim(),
        amountWon: amount,
        description: itemForm.description.trim() || undefined,
      });
      setItemForm({ name: '', amountWon: '', description: '' });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '항목 추가 실패');
    } finally {
      setBusy(false);
    }
  };

  const moveCategory = async (index: number, dir: -1 | 1) => {
    if (!token) return;
    const next = index + dir;
    if (next < 0 || next >= categories.length) return;
    const ordered = [...categories];
    const [row] = ordered.splice(index, 1);
    ordered.splice(next, 0, row);
    setBusy(true);
    try {
      await reorderTelecrmPriceCategories(
        token,
        ordered.map((c) => c.id),
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '순서 변경 실패');
    } finally {
      setBusy(false);
    }
  };

  const moveItem = async (index: number, dir: -1 | 1) => {
    if (!token || !selectedCategory) return;
    const list = [...items];
    const next = index + dir;
    if (next < 0 || next >= list.length) return;
    const [row] = list.splice(index, 1);
    list.splice(next, 0, row);
    setBusy(true);
    try {
      await reorderTelecrmPriceItems(
        token,
        selectedCategory.id,
        list.map((i) => i.id),
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '순서 변경 실패');
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!token || !deleteTarget) return;
    setBusy(true);
    setDeleteError(null);
    try {
      if (deleteTarget.kind === 'category') {
        await deleteTelecrmPriceCategory(token, deleteTarget.row.id, deletePassword);
      } else {
        await deleteTelecrmPriceItem(token, deleteTarget.row.id, deletePassword);
      }
      setDeleteTarget(null);
      setDeletePassword('');
      await load();
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : '삭제 실패');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-fluid-sm text-red-700">{error}</p>
      ) : null}

      <SettingsCard title="가격 카테고리 · 항목">
        <div className="flex flex-wrap gap-2 mb-4">
          <input
            type="text"
            value={newCategoryLabel}
            onChange={(e) => setNewCategoryLabel(e.target.value)}
            placeholder="새 카테고리"
            className="min-w-[160px] flex-1 rounded-lg border border-gray-300 px-3 py-2 text-fluid-sm"
          />
          <button
            type="button"
            disabled={busy || !newCategoryLabel.trim()}
            onClick={() => void addCategory()}
            className="rounded-lg bg-slate-900 px-4 py-2 text-fluid-sm text-white disabled:opacity-50"
          >
            카테고리 추가
          </button>
        </div>

        {loading ? (
          <p className="text-fluid-sm text-gray-500">불러오는 중…</p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,220px)_1fr]">
            <ul className="space-y-1">
              {categories.map((c, index) => (
                <li key={c.id}>
                  <div
                    className={`flex items-center gap-1 rounded-lg border px-2 py-1.5 ${
                      selectedCategoryId === c.id ? 'border-slate-900 bg-slate-50' : 'border-gray-200'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedCategoryId(c.id)}
                      className="min-w-0 flex-1 truncate text-left text-fluid-sm"
                    >
                      {c.label}
                    </button>
                    <TelecrmReorderButtons
                      disabled={busy}
                      canMoveUp={index > 0}
                      canMoveDown={index < categories.length - 1}
                      onMoveUp={() => void moveCategory(index, -1)}
                      onMoveDown={() => void moveCategory(index, 1)}
                    />
                    <button
                      type="button"
                      className="text-fluid-xs text-red-600"
                      onClick={() => {
                        setDeleteTarget({ kind: 'category', row: c });
                        setDeletePassword('');
                        setDeleteError(null);
                      }}
                    >
                      삭제
                    </button>
                  </div>
                </li>
              ))}
            </ul>

            <div className="min-w-0 space-y-4">
              {selectedCategory ? (
                <>
                  <input
                    type="text"
                    defaultValue={selectedCategory.label}
                    key={selectedCategory.id}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (!token || !v || v === selectedCategory.label) return;
                      void updateTelecrmPriceCategory(token, selectedCategory.id, { label: v }).then(load);
                    }}
                    className="w-full max-w-xs rounded-lg border border-gray-300 px-3 py-2 text-fluid-sm"
                  />

                  <div className="overflow-x-auto rounded-xl border border-gray-200">
                    <table className="w-full table-fixed border-collapse text-fluid-sm">
                      <thead>
                        <tr className="bg-gray-100 text-gray-700">
                          <th className="px-2 py-2 text-center w-[28%]">항목</th>
                          <th className="px-2 py-2 text-center w-[18%]">금액</th>
                          <th className="px-2 py-2 text-center">설명</th>
                          <th className="px-2 py-2 text-center w-[88px]">순서</th>
                          <th className="px-2 py-2 text-center w-[52px]">삭제</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item, index) => (
                          <tr key={item.id} className="border-t border-gray-100">
                            <td className="px-2 py-2 text-center">
                              <input
                                type="text"
                                defaultValue={item.name}
                                className="w-full rounded border border-gray-200 px-1 py-0.5 text-center text-fluid-xs"
                                onBlur={(e) => {
                                  const v = e.target.value.trim();
                                  if (!token || !v || v === item.name) return;
                                  void updateTelecrmPriceItem(token, item.id, { name: v }).then(load);
                                }}
                              />
                            </td>
                            <td className="px-2 py-2 text-right tabular-nums">
                              <input
                                type="text"
                                defaultValue={String(item.amountWon)}
                                className="w-full rounded border border-gray-200 px-1 py-0.5 text-right text-fluid-xs tabular-nums"
                                onBlur={(e) => {
                                  const n = parsePriceInt(e.target.value);
                                  if (!token || n == null || n === item.amountWon) return;
                                  void updateTelecrmPriceItem(token, item.id, { amountWon: n }).then(load);
                                }}
                              />
                            </td>
                            <td className="px-2 py-2 text-center">
                              <input
                                type="text"
                                defaultValue={item.description ?? ''}
                                className="w-full rounded border border-gray-200 px-1 py-0.5 text-center text-fluid-xs"
                                onBlur={(e) => {
                                  if (!token) return;
                                  const v = e.target.value.trim();
                                  void updateTelecrmPriceItem(token, item.id, {
                                    description: v || null,
                                  }).then(load);
                                }}
                              />
                            </td>
                            <td className="px-2 py-2 text-center">
                              <TelecrmReorderButtons
                                disabled={busy}
                                canMoveUp={index > 0}
                                canMoveDown={index < items.length - 1}
                                onMoveUp={() => void moveItem(index, -1)}
                                onMoveDown={() => void moveItem(index, 1)}
                              />
                            </td>
                            <td className="px-2 py-2 text-center">
                              <button
                                type="button"
                                className="text-fluid-xs text-red-600"
                                onClick={() => {
                                  setDeleteTarget({ kind: 'item', row: item });
                                  setDeletePassword('');
                                  setDeleteError(null);
                                }}
                              >
                                삭제
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="rounded-xl border border-dashed border-gray-200 p-3 space-y-2">
                    <p className="text-fluid-xs font-medium text-gray-700">항목 추가</p>
                    <div className="grid gap-2 sm:grid-cols-3">
                      <input
                        type="text"
                        value={itemForm.name}
                        onChange={(e) => setItemForm((f) => ({ ...f, name: e.target.value }))}
                        placeholder="이름"
                        className="rounded-lg border border-gray-300 px-3 py-2 text-fluid-sm"
                      />
                      <input
                        type="text"
                        value={itemForm.amountWon}
                        onChange={(e) => setItemForm((f) => ({ ...f, amountWon: e.target.value }))}
                        placeholder="금액"
                        className="rounded-lg border border-gray-300 px-3 py-2 text-fluid-sm tabular-nums"
                      />
                      <input
                        type="text"
                        value={itemForm.description}
                        onChange={(e) => setItemForm((f) => ({ ...f, description: e.target.value }))}
                        placeholder="설명 (선택)"
                        className="rounded-lg border border-gray-300 px-3 py-2 text-fluid-sm sm:col-span-3"
                      />
                    </div>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void addItem()}
                      className="rounded-lg bg-slate-900 px-4 py-2 text-fluid-sm text-white disabled:opacity-50"
                    >
                      추가
                    </button>
                    <p className="text-fluid-xs text-gray-500">표시 예: {formatWon(150000)}</p>
                  </div>
                </>
              ) : (
                <p className="text-fluid-sm text-gray-500">카테고리를 추가해 주세요.</p>
              )}
            </div>
          </div>
        )}
      </SettingsCard>

      <DeletePasswordModal
        open={deleteTarget != null}
        title={deleteTarget?.kind === 'category' ? '가격 카테고리 삭제' : '가격 항목 삭제'}
        busy={busy}
        password={deletePassword}
        error={deleteError}
        onPasswordChange={setDeletePassword}
        onConfirm={() => void confirmDelete()}
        onClose={() => {
          setDeleteTarget(null);
          setDeletePassword('');
          setDeleteError(null);
        }}
      />
    </div>
  );
}
