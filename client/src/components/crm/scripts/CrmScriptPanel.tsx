import { useCallback, useEffect, useMemo, useState } from 'react';
import { getToken } from '../../../stores/auth';
import {
  fetchTelecrmScripts,
  type TelecrmScriptCategoryDto,
  type TelecrmScriptTabDto,
} from '../../../api/telecrm';
import { CrmColumn } from '../layout/CrmShell';
import {
  CrmActionButton,
  CrmChip,
  CrmIconCopy,
  CrmSectionLabel,
  CRM_ACCENT,
} from '../crmUi';
import { applyTelecrmScriptPlaceholders } from './applyTelecrmScriptPlaceholders';
import { partitionTelecrmCategories } from '../settings/telecrmSettingsUi';

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

export function CrmScriptPanel({
  customerName,
  pyeong,
  estimateWon,
  refreshKey = 0,
  onOpenSettings,
}: {
  customerName?: string;
  pyeong?: string;
  estimateWon?: number | null;
  refreshKey?: number;
  onOpenSettings?: () => void;
}) {
  const token = getToken();
  const [categories, setCategories] = useState<TelecrmScriptCategoryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [tabId, setTabId] = useState<string | null>(null);
  const [fontScale, setFontScale] = useState(0.875);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchTelecrmScripts(token, { scope: 'work' });
      setCategories(res.categories);
      if (res.categories.length > 0) {
        setCategoryId((prev) => prev ?? res.categories[0]?.id ?? null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '스크립트를 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const activeCategory = useMemo(
    () => categories.find((c) => c.id === categoryId) ?? categories[0] ?? null,
    [categories, categoryId],
  );

  const tabs: TelecrmScriptTabDto[] = activeCategory?.tabs ?? [];

  useEffect(() => {
    if (tabs.length === 0) {
      setTabId(null);
      return;
    }
    if (!tabId || !tabs.some((t) => t.id === tabId)) {
      setTabId(tabs[0]?.id ?? null);
    }
  }, [tabs, tabId]);

  const activeTab = tabs.find((t) => t.id === tabId) ?? tabs[0] ?? null;

  const estimateLabel =
    estimateWon != null && Number.isFinite(estimateWon)
      ? `${Number(estimateWon).toLocaleString('ko-KR')}원`
      : undefined;

  const body = activeTab
    ? applyTelecrmScriptPlaceholders(activeTab.body, {
        customerName,
        pyeong,
        estimate: estimateLabel,
      })
    : '';

  const selectCategory = useCallback((id: string) => {
    setCategoryId(id);
    setTabId(null);
  }, []);

  const copyScript = useCallback(async () => {
    if (!body) return;
    try {
      await navigator.clipboard.writeText(body);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }, [body]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;

      if (e.key >= '1' && e.key <= '5') {
        const idx = Number(e.key) - 1;
        const cat = categories[idx];
        if (cat) {
          e.preventDefault();
          selectCategory(cat.id);
        }
        return;
      }

      if (e.shiftKey && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
        if (tabs.length <= 1) return;
        e.preventDefault();
        const idx = tabs.findIndex((t) => t.id === tabId);
        const delta = e.key === 'ArrowRight' ? 1 : -1;
        const next = tabs[(idx + delta + tabs.length) % tabs.length];
        if (next) setTabId(next.id);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [categories, tabs, tabId, selectCategory]);

  const { personal: personalCategories, shared: sharedCategories } = useMemo(
    () => partitionTelecrmCategories(categories),
    [categories],
  );

  const renderCategoryButtons = (list: TelecrmScriptCategoryDto[], startIndex: number) =>
    list.map((c, i) => {
      const globalIndex = startIndex + i;
      return (
        <CrmChip
          key={c.id}
          accent="script"
          active={activeCategory?.id === c.id}
          onClick={() => selectCategory(c.id)}
          title={globalIndex < 5 ? `Ctrl+${globalIndex + 1}` : undefined}
          compact
        >
          {c.label}
        </CrmChip>
      );
    });

  return (
    <CrmColumn
      accent="script"
      title="상담 스크립트"
      subtitle="Ctrl+1~5 · Shift+←→ · 복사"
      disableBodyScroll
      bodyClassName="p-0"
    >
      {loading ? (
        <p className="px-2 py-1.5 text-[11px] text-gray-500">불러오는 중…</p>
      ) : error ? (
        <p className="px-2 py-1.5 text-[11px] text-red-600">{error}</p>
      ) : categories.length === 0 ? (
        <div className="space-y-2 px-2 py-1.5">
          <p className="text-[11px] text-gray-500">등록된 스크립트가 없습니다.</p>
          {onOpenSettings ? (
            <CrmActionButton accent="script" onClick={onOpenSettings} className="!px-2 !py-1 !text-[10px]">
              설정에서 스크립트 추가
            </CrmActionButton>
          ) : null}
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          {/* 상단 툴바 */}
          <div className="flex shrink-0 items-center gap-2 border-b border-violet-100/80 px-2 py-1">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-0.5">
              {personalCategories.length > 0 ? (
                <div className="min-w-0">
                  <CrmSectionLabel accent="script">내 스크립트</CrmSectionLabel>
                  <div className="flex flex-wrap gap-1">{renderCategoryButtons(personalCategories, 0)}</div>
                </div>
              ) : null}
              {sharedCategories.length > 0 ? (
                <div className="min-w-0">
                  <CrmSectionLabel accent="script">업체 공통</CrmSectionLabel>
                  <div className="flex flex-wrap gap-1">
                    {renderCategoryButtons(sharedCategories, personalCategories.length)}
                  </div>
                </div>
              ) : null}
            </div>
            <CrmActionButton
              accent="script"
              variant="solid"
              onClick={() => void copyScript()}
              disabled={!body}
              className="!shrink-0 !px-2 !py-1 !text-[10px]"
            >
              <CrmIconCopy className="h-3 w-3" />
              {copied ? '복사됨' : '복사'}
            </CrmActionButton>
          </div>

          {/* 탭 + 글자 크기 */}
          <div className="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1 border-b border-slate-100 px-2 py-1">
            {tabs.length > 1 ? (
              <div className="flex min-w-0 flex-1 flex-wrap gap-1">
                {tabs.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTabId(t.id)}
                    className={`rounded-md px-2 py-0.5 text-[10px] font-semibold transition-colors ${
                      activeTab?.id === t.id
                        ? 'bg-violet-600 text-white shadow-sm'
                        : 'text-violet-700 hover:bg-violet-50'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            ) : activeTab ? (
              <span className="min-w-0 flex-1 truncate text-[10px] font-semibold text-violet-800" title={activeTab.label}>
                {activeTab.label}
              </span>
            ) : null}
            <div className="ml-auto flex shrink-0 items-center gap-1 text-[10px] text-gray-500">
              <span>글자</span>
              <button
                type="button"
                onClick={() => setFontScale((s) => Math.max(0.75, s - 0.05))}
                className="rounded border border-gray-300 px-1.5 py-0.5 leading-none hover:bg-gray-50"
                aria-label="글자 크기 줄이기"
              >
                −
              </button>
              <button
                type="button"
                onClick={() => setFontScale((s) => Math.min(1.15, s + 0.05))}
                className="rounded border border-gray-300 px-1.5 py-0.5 leading-none hover:bg-gray-50"
                aria-label="글자 크기 키우기"
              >
                +
              </button>
            </div>
          </div>

          {/* 본문 — 스크롤 영역 */}
          <div className="min-h-0 flex-1 overflow-y-auto px-2 py-1.5">
            <div
              className={`whitespace-pre-wrap rounded-lg border p-2 leading-snug text-slate-800 ${CRM_ACCENT.script.panel}`}
              style={{ fontSize: `${fontScale}rem` }}
            >
              {body || '(스크립트 본문이 비어 있습니다)'}
            </div>
          </div>
        </div>
      )}
    </CrmColumn>
  );
}
