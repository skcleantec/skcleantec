import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getToken } from '../../../../stores/auth';
import {
  createTelecrmScriptCategory,
  createTelecrmScriptTab,
  deleteTelecrmScriptCategory,
  deleteTelecrmScriptTab,
  fetchTelecrmScripts,
  reorderTelecrmScriptCategories,
  reorderTelecrmScriptTabs,
  updateTelecrmScriptCategory,
  updateTelecrmScriptTab,
  type TelecrmCatalogOwnerScope,
  type TelecrmScriptCategoryDto,
  type TelecrmScriptTabDto,
} from '../../../../api/telecrm';
import { DeletePasswordModal, SettingsCard } from '../../../../components/crm/settings/DeletePasswordModal';
import { TelecrmReorderButtons } from '../../../../components/crm/settings/telecrmSettingsUi';
import { HelpTooltip } from '../../../../components/ui/HelpTooltip';

type DeleteTarget =
  | { kind: 'category'; row: TelecrmScriptCategoryDto }
  | { kind: 'tab'; row: TelecrmScriptTabDto };

export function TelecrmScriptSettingsPage({
  catalogScope: catalogScopeProp,
}: {
  catalogScope?: TelecrmCatalogOwnerScope;
} = {}) {
  const [searchParams] = useSearchParams();
  const catalogScope: TelecrmCatalogOwnerScope =
    catalogScopeProp ??
    (searchParams.get('catalog') === 'shared' ? 'shared' : 'personal');
  const token = getToken();
  const [categories, setCategories] = useState<TelecrmScriptCategoryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [newCategoryLabel, setNewCategoryLabel] = useState('');
  const [newTabLabel, setNewTabLabel] = useState('');
  const [editingTabBody, setEditingTabBody] = useState('');
  const [selectedTabId, setSelectedTabId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchTelecrmScripts(token, { includeInactive: true, scope: catalogScope });
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
  }, [token, catalogScope]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setSelectedCategoryId(null);
    setSelectedTabId(null);
  }, [catalogScope]);

  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === selectedCategoryId) ?? null,
    [categories, selectedCategoryId],
  );

  const tabs = selectedCategory?.tabs ?? [];

  useEffect(() => {
    const tab = tabs.find((t) => t.id === selectedTabId) ?? tabs[0] ?? null;
    setSelectedTabId(tab?.id ?? null);
    setEditingTabBody(tab?.body ?? '');
  }, [tabs, selectedTabId]);

  const selectedTab = tabs.find((t) => t.id === selectedTabId) ?? tabs[0] ?? null;

  const addCategory = async () => {
    if (!token || !newCategoryLabel.trim()) return;
    setBusy(true);
    try {
      await createTelecrmScriptCategory(token, { label: newCategoryLabel.trim(), ownerScope: catalogScope });
      setNewCategoryLabel('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '추가 실패');
    } finally {
      setBusy(false);
    }
  };

  const addTab = async () => {
    if (!token || !selectedCategory || !newTabLabel.trim()) return;
    setBusy(true);
    try {
      await createTelecrmScriptTab(token, {
        categoryId: selectedCategory.id,
        label: newTabLabel.trim(),
      });
      setNewTabLabel('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '탭 추가 실패');
    } finally {
      setBusy(false);
    }
  };

  const saveTabBody = async () => {
    if (!token || !selectedTab) return;
    setBusy(true);
    try {
      await updateTelecrmScriptTab(token, selectedTab.id, { body: editingTabBody });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 실패');
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
      await reorderTelecrmScriptCategories(
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

  const moveTab = async (index: number, dir: -1 | 1) => {
    if (!token || !selectedCategory) return;
    const list = [...tabs];
    const next = index + dir;
    if (next < 0 || next >= list.length) return;
    const [row] = list.splice(index, 1);
    list.splice(next, 0, row);
    setBusy(true);
    try {
      await reorderTelecrmScriptTabs(
        token,
        selectedCategory.id,
        list.map((t) => t.id),
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
        await deleteTelecrmScriptCategory(token, deleteTarget.row.id, deletePassword);
      } else {
        await deleteTelecrmScriptTab(token, deleteTarget.row.id, deletePassword);
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

      <SettingsCard
        title={catalogScope === 'personal' ? '내 스크립트 카테고리' : '업체 공통 스크립트'}
        actions={
          <HelpTooltip
            text={
              catalogScope === 'personal'
                ? '본인만 보는 개인 스크립트입니다. 텔레CRM 작업 화면에서 「내 스크립트」로 표시됩니다. {고객명} {평수} {예상가} 치환을 지원합니다.'
                : '업체 전체 마케터가 보는 공통 스크립트입니다. crm.settings 권한이 있어야 편집할 수 있습니다.'
            }
          />
        }
      >
        <div className="flex flex-wrap gap-2">
          <input
            type="text"
            value={newCategoryLabel}
            onChange={(e) => setNewCategoryLabel(e.target.value)}
            placeholder="새 카테고리 이름"
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
          <div className="grid gap-4 lg:grid-cols-[minmax(0,240px)_1fr]">
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
                      className="min-w-0 flex-1 truncate text-left text-fluid-sm text-gray-900"
                    >
                      {c.label}
                      {!c.isActive ? <span className="text-gray-400"> (비활성)</span> : null}
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
                      disabled={busy}
                      onClick={() => {
                        setDeleteTarget({ kind: 'category', row: c });
                        setDeletePassword('');
                        setDeleteError(null);
                      }}
                      className="text-fluid-xs text-red-600 px-1"
                    >
                      삭제
                    </button>
                  </div>
                </li>
              ))}
            </ul>

            <div className="min-w-0 space-y-3">
              {selectedCategory ? (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                      defaultValue={selectedCategory.label}
                      key={selectedCategory.id}
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (!token || !v || v === selectedCategory.label) return;
                        void updateTelecrmScriptCategory(token, selectedCategory.id, { label: v }).then(load);
                      }}
                      className="rounded-lg border border-gray-300 px-3 py-2 text-fluid-sm font-medium"
                    />
                    <label className="flex items-center gap-1 text-fluid-xs text-gray-600">
                      <input
                        type="checkbox"
                        checked={selectedCategory.isActive}
                        onChange={(e) => {
                          if (!token) return;
                          void updateTelecrmScriptCategory(token, selectedCategory.id, {
                            isActive: e.target.checked,
                          }).then(load);
                        }}
                      />
                      활성
                    </label>
                  </div>

                  <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-3">
                    {tabs.map((t, index) => (
                      <div key={t.id} className="flex items-center gap-0.5">
                        <button
                          type="button"
                          onClick={() => setSelectedTabId(t.id)}
                          className={`rounded-lg px-3 py-1.5 text-fluid-xs ${
                            selectedTab?.id === t.id ? 'bg-indigo-100 text-indigo-800' : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {t.label}
                        </button>
                        <TelecrmReorderButtons
                          disabled={busy}
                          canMoveUp={index > 0}
                          canMoveDown={index < tabs.length - 1}
                          onMoveUp={() => void moveTab(index, -1)}
                          onMoveDown={() => void moveTab(index, 1)}
                        />
                        <button
                          type="button"
                          className="text-[10px] text-red-600 px-0.5"
                          onClick={() => {
                            setDeleteTarget({ kind: 'tab', row: t });
                            setDeletePassword('');
                            setDeleteError(null);
                          }}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <input
                      type="text"
                      value={newTabLabel}
                      onChange={(e) => setNewTabLabel(e.target.value)}
                      placeholder="새 탭 이름"
                      className="min-w-[120px] flex-1 rounded-lg border border-gray-300 px-3 py-2 text-fluid-sm"
                    />
                    <button
                      type="button"
                      disabled={busy || !newTabLabel.trim()}
                      onClick={() => void addTab()}
                      className="rounded-lg border border-gray-300 px-3 py-2 text-fluid-sm"
                    >
                      탭 추가
                    </button>
                  </div>

                  {selectedTab ? (
                    <div className="space-y-2">
                      <input
                        type="text"
                        defaultValue={selectedTab.label}
                        key={`label-${selectedTab.id}`}
                        onBlur={(e) => {
                          const v = e.target.value.trim();
                          if (!token || !v || v === selectedTab.label) return;
                          void updateTelecrmScriptTab(token, selectedTab.id, { label: v }).then(load);
                        }}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-fluid-sm"
                      />
                      <textarea
                        value={editingTabBody}
                        onChange={(e) => setEditingTabBody(e.target.value)}
                        rows={12}
                        className="w-full rounded-xl border border-gray-300 px-3 py-2 text-fluid-sm font-mono leading-relaxed"
                        placeholder="상담 스크립트 본문…"
                      />
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void saveTabBody()}
                        className="rounded-lg bg-slate-900 px-4 py-2 text-fluid-sm text-white disabled:opacity-50"
                      >
                        본문 저장
                      </button>
                    </div>
                  ) : null}
                </>
              ) : (
                <p className="text-fluid-sm text-gray-500">카테고리를 선택하거나 추가해 주세요.</p>
              )}
            </div>
          </div>
        )}
      </SettingsCard>

      <DeletePasswordModal
        open={deleteTarget != null}
        title={deleteTarget?.kind === 'category' ? '카테고리 삭제' : '스크립트 탭 삭제'}
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
