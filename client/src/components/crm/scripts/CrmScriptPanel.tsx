import { useCallback, useEffect, useMemo, useState } from 'react';
import { getToken } from '../../../stores/auth';
import {
  fetchTelecrmScripts,
  type TelecrmScriptCategoryDto,
  type TelecrmScriptTabDto,
} from '../../../api/telecrm';
import { CrmColumn } from '../layout/CrmShell';

function applyPlaceholders(body: string, ctx: { customerName?: string; pyeong?: string; estimate?: string }) {
  return body
    .replace(/\{고객명\}/g, ctx.customerName || '고객님')
    .replace(/\{평수\}/g, ctx.pyeong || '—')
    .replace(/\{예상가\}/g, ctx.estimate || '—');
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
    ? applyPlaceholders(activeTab.body, {
        customerName,
        pyeong,
        estimate: estimateLabel,
      })
    : '';

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
          <div className="flex flex-wrap gap-1.5">
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setCategoryId(c.id);
                  setTabId(null);
                }}
                className={`rounded-lg px-3 py-1.5 text-fluid-xs font-medium transition-colors ${
                  activeCategory?.id === c.id
                    ? 'bg-slate-900 text-white'
                    : 'border border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100'
                }`}
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
