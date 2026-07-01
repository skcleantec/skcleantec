import { useCallback, useEffect, useMemo, useState } from 'react';
import { getToken } from '../../../stores/auth';
import {
  fetchTelecrmScripts,
  type TelecrmScriptCategoryDto,
  type TelecrmScriptTabDto,
} from '../../../api/telecrm';
import { CrmColumn } from '../layout/CrmShell';
import { applyTelecrmScriptPlaceholders } from './applyTelecrmScriptPlaceholders';

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

export function CrmScriptPanel({
  customerName,
  pyeong,
  estimateWon,
}: {
  customerName?: string;
  pyeong?: string;
  estimateWon?: number | null;
}) {
  const token = getToken();
  const [categories, setCategories] = useState<TelecrmScriptCategoryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [tabId, setTabId] = useState<string | null>(null);
  const [fontScale, setFontScale] = useState(1);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchTelecrmScripts(token);
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
  }, [load]);

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

  return (
    <CrmColumn title="상담 스크립트" subtitle="설정에서 등록한 스크립트를 읽기 전용으로 표시합니다">
      {loading ? (
        <p className="text-fluid-sm text-gray-500">불러오는 중…</p>
      ) : error ? (
        <p className="text-fluid-sm text-red-600">{error}</p>
      ) : categories.length === 0 ? (
        <p className="text-fluid-sm text-gray-500">등록된 스크립트가 없습니다. 설정에서 추가해 주세요.</p>
      ) : (
        <div className="flex min-h-0 flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[10px] text-gray-500">
              Ctrl+1~5 카테고리 · Ctrl+Shift+←→ 탭 · 복사 버튼으로 클립보드
            </p>
            <button
              type="button"
              onClick={() => void copyScript()}
              disabled={!body}
              className="shrink-0 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-fluid-xs font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-40"
            >
              {copied ? '복사됨' : '스크립트 복사'}
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {categories.map((c, i) => (
              <button
                key={c.id}
                type="button"
                onClick={() => selectCategory(c.id)}
                className={`rounded-lg px-3 py-1.5 text-fluid-xs font-medium transition-colors ${
                  activeCategory?.id === c.id
                    ? 'bg-slate-900 text-white'
                    : 'border border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100'
                }`}
                title={i < 5 ? `Ctrl+${i + 1}` : undefined}
              >
                {c.label}
              </button>
            ))}
          </div>

          {tabs.length > 1 ? (
            <div className="flex flex-wrap gap-1 border-b border-gray-100 pb-2">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTabId(t.id)}
                  className={`rounded-md px-2.5 py-1 text-fluid-xs ${
                    activeTab?.id === t.id
                      ? 'bg-indigo-50 text-indigo-700 font-medium'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          ) : null}

          <div className="flex items-center gap-2 text-fluid-xs text-gray-500">
            <span>글자 크기</span>
            <button
              type="button"
              onClick={() => setFontScale((s) => Math.max(0.85, s - 0.1))}
              className="rounded border border-gray-300 px-2 py-0.5"
            >
              −
            </button>
            <button
              type="button"
              onClick={() => setFontScale((s) => Math.min(1.4, s + 0.1))}
              className="rounded border border-gray-300 px-2 py-0.5"
            >
              +
            </button>
          </div>

          <div
            className="whitespace-pre-wrap rounded-xl border border-gray-100 bg-slate-50 p-4 text-gray-800 leading-relaxed"
            style={{ fontSize: `${fontScale}rem` }}
          >
            {body || '(스크립트 본문이 비어 있습니다)'}
          </div>
        </div>
      )}
    </CrmColumn>
  );
}
