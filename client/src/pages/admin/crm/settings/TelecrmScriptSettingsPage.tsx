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
import { usePublishScriptBrandEdit } from '../../../../components/crm/settings/scriptBrandEditContext';
import { OperatingCompanyBadge } from '../../../../components/admin/OperatingCompanyBadge';
import { TelecrmScriptKindSegment } from '../../../../components/ui/TelecrmScriptKindSegment';
import type { TelecrmScriptKind } from '../../../../api/telecrm';
import { useOperatingCompanies } from '../../../../hooks/useOperatingCompanies';
import { HelpTooltip } from '../../../../components/ui/HelpTooltip';
import { OnOffSwitch } from '../../../../components/ui/OnOffSwitch';
import { fillCrmMessageFields } from '../../../../components/crm/settings/crmMessageFields';
import { CrmMessageFieldsButton } from '../../../../components/crm/settings/CrmMessageFieldsButton';

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

  const operatingCompanies = useOperatingCompanies(token);
  const brandCompanies = useMemo(
    () =>
      operatingCompanies
        .filter((c) => c.isActive)
        .map((c) => ({ id: c.id, displayName: c.displayName || c.name })),
    [operatingCompanies],
  );

  const changeBrand = useCallback(
    async (operatingCompanyId: string | null) => {
      if (!token || !selectedCategory) return;
      if ((selectedCategory.operatingCompanyId ?? null) === operatingCompanyId) return;
      setBusy(true);
      setError(null);
      try {
        await updateTelecrmScriptCategory(token, selectedCategory.id, { operatingCompanyId });
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : '브랜드를 바꾸지 못했습니다.');
      } finally {
        setBusy(false);
      }
    },
    [token, selectedCategory, load],
  );

  usePublishScriptBrandEdit(
    selectedCategory && brandCompanies.length > 1
      ? {
          visible: true,
          value: selectedCategory.operatingCompanyId ?? null,
          busy,
          companies: brandCompanies,
          onChange: (id) => {
            void changeBrand(id);
          },
        }
      : null,
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

  const changeKind = useCallback(
    async (kind: TelecrmScriptKind) => {
      if (!token || !selectedCategory) return;
      const current: TelecrmScriptKind =
        selectedCategory.kind === 'reaction' || selectedCategory.kind === 'closing' ? selectedCategory.kind : 'step';
      if (current === kind) return;
      setBusy(true);
      setError(null);
      try {
        await updateTelecrmScriptCategory(token, selectedCategory.id, { kind });
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : '구분을 바꾸지 못했습니다.');
      } finally {
        setBusy(false);
      }
    },
    [token, selectedCategory, load],
  );

  const moveCategory = async (group: readonly TelecrmScriptCategoryDto[], index: number, dir: -1 | 1) => {
    if (!token) return;
    const next = index + dir;
    if (next < 0 || next >= group.length) return;
    const ordered = [...categories];
    const ia = ordered.findIndex((row) => row.id === group[index]?.id);
    const ib = ordered.findIndex((row) => row.id === group[next]?.id);
    if (ia < 0 || ib < 0) return;
    const tmp = ordered[ia];
    ordered[ia] = ordered[ib]!;
    ordered[ib] = tmp!;
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

      {loading ? (
        <p className="text-fluid-sm text-slate-500">불러오는 중…</p>
      ) : (
        <div className="grid gap-3 lg:grid-cols-[minmax(0,220px)_1fr]">
          <SettingsCard
            title="① 단계 고르기"
            actions={
              <HelpTooltip
                text={
                  catalogScope === 'personal'
                    ? '단계는 상담 화면 위쪽 묶음 단추(첫 인사·가격 안내 등)예요. 나만 보는 스크립트예요.'
                    : '단계는 상담 화면 위쪽 묶음 단추(첫 인사·가격 안내 등)예요. 우리 업체 상담사 모두에게 보여요. 설정 권한이 있어야 바꿀 수 있어요.'
                }
              />
            }
          >
            <div className="space-y-3">
              {(
                [
                  ['대본 단계', categories.filter((c) => c.kind !== 'reaction' && c.kind !== 'closing')],
                  ['고객 반응 버튼', categories.filter((c) => c.kind === 'reaction')],
                  ['예약 끌어내기', categories.filter((c) => c.kind === 'closing')],
                ] as const
              ).map(([title, group]) => (
                <div key={title} className="space-y-1">
                  <p className="px-0.5 text-fluid-2xs font-medium text-slate-500">{title}</p>
                  {group.length === 0 ? (
                    <p className="px-0.5 text-fluid-2xs text-slate-400">없음</p>
                  ) : (
                    <ul className="space-y-1">
                      {group.map((c, index) => (
                        <li key={c.id}>
                          <div
                            className={`flex items-center gap-1 rounded-lg border px-2 py-1 ${
                              selectedCategoryId === c.id ? 'border-slate-900 bg-slate-50' : 'border-slate-200'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => setSelectedCategoryId(c.id)}
                              className="min-w-0 flex-1 whitespace-normal break-words text-left text-fluid-sm leading-snug text-slate-900"
                            >
                              {c.label}
                              <span className="ml-1 text-fluid-2xs text-slate-400">{c.tabs?.length ?? 0}</span>
                              {!c.isActive ? <span className="text-slate-400"> (숨김)</span> : null}
                              {c.operatingCompany ? (
                                <OperatingCompanyBadge
                                  company={c.operatingCompany}
                                  className="ml-1 mt-0.5 align-middle"
                                />
                              ) : null}
                            </button>
                            <TelecrmReorderButtons
                              disabled={busy}
                              canMoveUp={index > 0}
                              canMoveDown={index < group.length - 1}
                              onMoveUp={() => void moveCategory(group, index, -1)}
                              onMoveDown={() => void moveCategory(group, index, 1)}
                            />
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => {
                                setDeleteTarget({ kind: 'category', row: c });
                                setDeletePassword('');
                                setDeleteError(null);
                              }}
                              className="px-1 text-fluid-xs text-red-600"
                            >
                              삭제
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-2 flex gap-1.5">
              <input
                type="text"
                value={newCategoryLabel}
                onChange={(e) => setNewCategoryLabel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing) void addCategory();
                }}
                placeholder="새 단계 이름"
                className="min-w-0 flex-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-fluid-sm"
              />
              <button
                type="button"
                disabled={busy || !newCategoryLabel.trim()}
                onClick={() => void addCategory()}
                className="shrink-0 rounded-lg bg-slate-900 px-3 py-1.5 text-fluid-xs text-white disabled:opacity-50"
              >
                새 단계
              </button>
            </div>
          </SettingsCard>

          <SettingsCard
            title={selectedCategory ? `② 「${selectedCategory.label}」에 스크립트 넣기` : '② 스크립트 넣기'}
            actions={<CrmMessageFieldsButton menu="script" />}
          >
            {selectedCategory ? (
              <div className="min-w-0 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-fluid-2xs text-slate-500">단계 이름</span>
                  <input
                    type="text"
                    defaultValue={selectedCategory.label}
                    key={selectedCategory.id}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (!token || !v || v === selectedCategory.label) return;
                      void updateTelecrmScriptCategory(token, selectedCategory.id, { label: v }).then(load);
                    }}
                    className="rounded-lg border border-slate-300 px-2.5 py-1 text-fluid-sm font-medium"
                  />
                  <OnOffSwitch
                    checked={selectedCategory.isActive}
                    onChange={(next) => {
                      if (!token) return;
                      void updateTelecrmScriptCategory(token, selectedCategory.id, { isActive: next }).then(load);
                    }}
                    label="상담 화면에 보이기"
                  />
                  <TelecrmScriptKindSegment
                    value={
                      selectedCategory.kind === 'reaction' || selectedCategory.kind === 'closing'
                        ? selectedCategory.kind
                        : 'step'
                    }
                    disabled={busy}
                    onChange={(kind) => {
                      void changeKind(kind);
                    }}
                  />
                </div>

                <div className="flex flex-wrap gap-1.5 border-t border-slate-100 pt-3">
                  {tabs.map((t, index) => (
                    <div key={t.id} className="flex items-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => setSelectedTabId(t.id)}
                        className={`rounded-lg px-2.5 py-1 text-fluid-xs ${
                          selectedTab?.id === t.id ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-100 text-slate-700'
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
                        className="px-0.5 text-fluid-2xs text-red-600"
                        aria-label={`${t.label} 삭제`}
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

                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={newTabLabel}
                    onChange={(e) => setNewTabLabel(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.nativeEvent.isComposing) void addTab();
                    }}
                    placeholder={
                      selectedCategory.kind === 'reaction'
                        ? '버튼 이름(고객이 하는 말)'
                        : '새 스크립트 제목 (예: 꼬시기)'
                    }
                    className="min-w-0 flex-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-fluid-sm"
                  />
                  <button
                    type="button"
                    disabled={busy || !newTabLabel.trim()}
                    onClick={() => void addTab()}
                    className="shrink-0 rounded-lg border border-slate-300 px-3 py-1.5 text-fluid-xs"
                  >
                    제목 추가
                  </button>
                </div>

                {selectedTab ? (
                  <div className="space-y-2">
                    {selectedCategory.kind === 'reaction' ? (
                      <label className="block text-fluid-2xs font-medium text-slate-600" htmlFor="script-tab-label">
                        버튼 이름(고객이 하는 말)
                      </label>
                    ) : null}
                    <input
                      id="script-tab-label"
                      type="text"
                      defaultValue={selectedTab.label}
                      key={`label-${selectedTab.id}`}
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (!token || !v || v === selectedTab.label) return;
                        void updateTelecrmScriptTab(token, selectedTab.id, { label: v }).then(load);
                      }}
                      className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-fluid-sm font-medium"
                      aria-label={selectedCategory.kind === 'reaction' ? '버튼 이름(고객이 하는 말)' : '스크립트 제목'}
                    />
                    {selectedCategory.kind === 'reaction' ? (
                      <>
                        <label className="block text-fluid-2xs font-medium text-slate-600" htmlFor="script-tab-keywords">
                          비슷한 말(찾기용)
                        </label>
                        <input
                          id="script-tab-keywords"
                          type="text"
                          defaultValue={selectedTab.keywords ?? ''}
                          key={`kw-${selectedTab.id}`}
                          onBlur={(e) => {
                            const v = e.target.value.trim();
                            if (!token || v === (selectedTab.keywords ?? '').trim()) return;
                            void updateTelecrmScriptTab(token, selectedTab.id, { keywords: v || null }).then(load);
                          }}
                          placeholder="비싸, 가격 부담, 다른 데가 더 싸요"
                          className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-fluid-sm"
                        />
                        <label className="block text-fluid-2xs font-medium text-slate-600" htmlFor="script-tab-body">
                          이렇게 답해요
                        </label>
                      </>
                    ) : null}
                    <textarea
                      id="script-tab-body"
                      value={editingTabBody}
                      onChange={(e) => setEditingTabBody(e.target.value)}
                      rows={8}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-fluid-sm leading-relaxed"
                      placeholder={
                        selectedCategory.kind === 'reaction'
                          ? '고객이 그렇게 말하면 이렇게 답해요'
                          : '통화할 때 읽을 내용을 적어 주세요'
                      }
                    />
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void saveTabBody()}
                        className="rounded-lg bg-slate-900 px-4 py-1.5 text-fluid-sm text-white disabled:opacity-50"
                      >
                        내용 저장
                      </button>
                      {editingTabBody !== (selectedTab.body ?? '') ? (
                        <span className="text-fluid-2xs text-amber-700">저장 안 한 변경이 있어요</span>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="text-fluid-sm text-slate-500">왼쪽에서 단계를 고르거나 새 단계를 만들어 주세요.</p>
            )}
          </SettingsCard>

          <div className="lg:col-span-2">
            <ScriptLivePreview
              categories={categories}
              selectedCategoryId={selectedCategoryId}
              selectedTabId={selectedTab?.id ?? null}
              editingBody={editingTabBody}
            />
          </div>
        </div>
      )}

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

/** ③ 상담 화면에 이렇게 보여요 — 텔레CRM 상담 스크립트 칸 모양 그대로 (입력 중인 내용 바로 반영) */
function ScriptLivePreview({
  categories,
  selectedCategoryId,
  selectedTabId,
  editingBody,
}: {
  categories: TelecrmScriptCategoryDto[];
  selectedCategoryId: string | null;
  selectedTabId: string | null;
  editingBody: string;
}) {
  const active = categories.filter((c) => c.isActive || c.id === selectedCategoryId);
  const current = categories.find((c) => c.id === selectedCategoryId) ?? null;
  const items = current?.tabs ?? [];
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-3">
      <p className="mb-2 text-fluid-xs font-semibold text-slate-800">
        ③ 상담 화면에 이렇게 보여요 <span className="font-normal text-slate-400">· 적는 대로 바로 바뀌어요</span>
      </p>
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
        <div className="mb-2 flex flex-wrap gap-1">
          {active.map((c) => (
            <span
              key={c.id}
              className={`rounded-full px-2 py-0.5 text-fluid-2xs ${
                c.id === selectedCategoryId ? 'bg-violet-100 font-semibold text-violet-800' : 'bg-white text-slate-600 ring-1 ring-slate-200'
              }`}
            >
              {c.label} {c.tabs?.length ?? 0}
            </span>
          ))}
        </div>
        {items.length === 0 ? (
          <p className="px-1 py-2 text-fluid-2xs text-slate-400">이 단계에 스크립트를 넣으면 여기 보여요.</p>
        ) : (
          <ul className="space-y-1">
            {items.map((t, i) => {
              const body = t.id === selectedTabId ? editingBody : t.body ?? '';
              const oneLine = fillCrmMessageFields(body, 'script').replace(/\s*\n+\s*/g, ' ').trim();
              const isSel = t.id === selectedTabId;
              return (
                <li
                  key={t.id}
                  className={`flex min-w-0 items-start gap-2 rounded-lg border bg-white px-2 py-1.5 ${
                    isSel ? 'border-violet-400 ring-1 ring-violet-200' : 'border-slate-200'
                  }`}
                >
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-fluid-2xs text-slate-500">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 text-fluid-xs font-semibold text-slate-800">
                      {t.label}
                      <span className="rounded-lg bg-violet-50 px-1 text-fluid-2xs font-normal text-violet-600">
                        {current?.label}
                      </span>
                    </p>
                    <p className="line-clamp-2 text-fluid-2xs text-slate-600">{oneLine || '내용 없음'}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
