import { useCallback, useEffect, useMemo, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { getToken } from '../../../stores/auth';
import { useCrmWorkBrand } from '../../../hooks/useCrmWorkBrand';
import {
  fetchTelecrmScripts,
  markTelecrmScriptTabUsed,
  type TelecrmScriptCategoryDto,
  type TelecrmScriptKind,
} from '../../../api/telecrm';
import { HelpTooltip } from '../../ui/HelpTooltip';
import { CrmColumn } from '../layout/CrmShell';
import { CrmIconCopy, CrmIconSearch } from '../crmUi';
import { applyTelecrmScriptPlaceholders } from './applyTelecrmScriptPlaceholders';
import { findScriptMatches, normalizeScriptQuery } from './scriptSearch';

export const CRM_SCRIPT_SHORTCUT_HELP = [
  '상담 스크립트',
  '• / : 찾기 칸으로 이동',
  '• Esc : 답 카드를 닫거나, 찾기 칸을 비워요',
  '• 위 숫자 단추로 단계를 옮기고, 아래는 고객이 한 말에 대한 답이에요',
].join('\n');

type FlowTab = {
  id: string;
  categoryId: string;
  categoryLabel: string;
  kind: TelecrmScriptKind;
  title: string;
  body: string;
  keywords: string;
  useCount: number;
  sortOrder: number;
};

const bodyStyle = { fontSize: '0.875rem', lineHeight: 1.75 } as const;

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

function ScriptBtn({ className = '', type = 'button', ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={`focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 disabled:cursor-not-allowed disabled:opacity-40 disabled:pointer-events-none ${className}`}
      {...rest}
    />
  );
}

function Highlighted({ text, needle }: { text: string; needle: string }) {
  const ranges = needle ? findScriptMatches(text, needle) : [];
  if (ranges.length === 0) return <>{text}</>;
  const out: ReactNode[] = [];
  let pos = 0;
  ranges.forEach(([s, e], i) => {
    if (s > pos) out.push(text.slice(pos, s));
    out.push(
      <mark key={i} className="bg-yellow-200 text-inherit">
        {text.slice(s, e)}
      </mark>,
    );
    pos = e;
  });
  if (pos < text.length) out.push(text.slice(pos));
  return <>{out}</>;
}

function kindOf(category: TelecrmScriptCategoryDto): TelecrmScriptKind {
  return category.kind === 'reaction' ? 'reaction' : 'step';
}

function tabMatches(tab: FlowTab, needle: string): boolean {
  if (!needle) return false;
  const bits = [tab.title, tab.body, tab.keywords, tab.categoryLabel];
  return bits.some((bit) => normalizeScriptQuery(bit).includes(needle));
}

export function CrmScriptPanel({
  customerName,
  pyeong,
  estimateWon,
  refreshKey = 0,
  onOpenSettings,
  compact = false,
  embedded = false,
}: {
  customerName?: string;
  pyeong?: string;
  estimateWon?: number | null;
  refreshKey?: number;
  onOpenSettings?: () => void;
  compact?: boolean;
  embedded?: boolean;
}) {
  const token = getToken();
  const { loading: brandLoading, activeOperatingCompanyId } = useCrmWorkBrand();
  const [categories, setCategories] = useState<TelecrmScriptCategoryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [stepId, setStepId] = useState<string | null>(null);
  const [tabId, setTabId] = useState<string | null>(null);
  const [reactionId, setReactionId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const copyTimer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (copyTimer.current) window.clearTimeout(copyTimer.current);
    },
    [],
  );

  const load = useCallback(async () => {
    if (!token || brandLoading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchTelecrmScripts(token, {
        scope: 'work',
        operatingCompanyId: activeOperatingCompanyId,
      });
      setCategories(res.categories);
    } catch (e) {
      setError(e instanceof Error ? e.message : '스크립트를 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  }, [token, brandLoading, activeOperatingCompanyId]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const estimateLabel =
    estimateWon != null && Number.isFinite(estimateWon)
      ? `${Number(estimateWon).toLocaleString('ko-KR')}원`
      : undefined;

  const fill = useCallback(
    (body: string) =>
      applyTelecrmScriptPlaceholders(body, {
        customerName,
        pyeong,
        estimate: estimateLabel,
      }),
    [customerName, pyeong, estimateLabel],
  );

  const steps = useMemo(
    () => categories.filter((c) => kindOf(c) === 'step' && c.isActive !== false),
    [categories],
  );

  const flowTabs = useMemo<FlowTab[]>(() => {
    const out: FlowTab[] = [];
    for (const category of categories) {
      if (category.isActive === false) continue;
      for (const tab of category.tabs ?? []) {
        if (tab.isActive === false) continue;
        out.push({
          id: tab.id,
          categoryId: category.id,
          categoryLabel: category.label.trim(),
          kind: kindOf(category),
          title: tab.label,
          body: fill(tab.body),
          keywords: tab.keywords ?? '',
          useCount: tab.useCount ?? 0,
          sortOrder: tab.sortOrder,
        });
      }
    }
    return out;
  }, [categories, fill]);

  const reactions = useMemo(
    () =>
      flowTabs
        .filter((tab) => tab.kind === 'reaction')
        .sort((a, b) => b.useCount - a.useCount || a.sortOrder - b.sortOrder),
    [flowTabs],
  );

  useEffect(() => {
    if (stepId && steps.some((step) => step.id === stepId)) return;
    setStepId(steps[0]?.id ?? null);
  }, [stepId, steps]);

  const stepIndex = Math.max(0, steps.findIndex((step) => step.id === stepId));
  const currentStep = steps[stepIndex] ?? null;
  const currentTabs = useMemo(() => {
    const tabs = (currentStep?.tabs ?? []).filter((tab) => tab.isActive !== false);
    return [...tabs].sort((a, b) => a.sortOrder - b.sortOrder);
  }, [currentStep]);

  useEffect(() => {
    if (tabId && currentTabs.some((tab) => tab.id === tabId)) return;
    setTabId(currentTabs[0]?.id ?? null);
  }, [tabId, currentTabs]);

  const currentTab = currentTabs.find((tab) => tab.id === tabId) ?? currentTabs[0] ?? null;
  const nextStep = steps[stepIndex + 1] ?? null;
  const needle = normalizeScriptQuery(query);
  const searching = needle.length > 0;
  const matches = useMemo(() => {
    if (!searching) return [];
    return flowTabs
      .filter((tab) => tabMatches(tab, needle))
      .sort((a, b) => {
        if (a.kind !== b.kind) return a.kind === 'reaction' ? -1 : 1;
        return a.sortOrder - b.sortOrder;
      });
  }, [flowTabs, needle, searching]);

  const openReaction = reactions.find((tab) => tab.id === reactionId) ?? null;

  const copyText = useCallback(async (id: string, text: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      if (copyTimer.current) window.clearTimeout(copyTimer.current);
      copyTimer.current = window.setTimeout(() => setCopiedId(null), 1500);
    } catch {
      /* ignore */
    }
  }, []);

  const openReactionCard = useCallback(
    (tab: FlowTab) => {
      setReactionId(tab.id);
      setCategories((prev) =>
        prev.map((category) => ({
          ...category,
          tabs: category.tabs?.map((row) =>
            row.id === tab.id ? { ...row, useCount: (row.useCount ?? 0) + 1 } : row,
          ),
        })),
      );
      if (!token) return;
      void markTelecrmScriptTabUsed(token, tab.id).catch(() => {
        void load();
      });
    },
    [load, token],
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (document.querySelector('[role="dialog"],[aria-modal="true"]')) return;
      const typing = isTypingTarget(e.target);
      if (!typing && !e.ctrlKey && !e.metaKey && !e.altKey && e.key === '/') {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
        return;
      }
      if (e.key === 'Escape') {
        if (reactionId) {
          e.preventDefault();
          setReactionId(null);
          return;
        }
        if (query) {
          e.preventDefault();
          setQuery('');
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [query, reactionId]);

  const stepBtn = (step: TelecrmScriptCategoryDto, index: number) => {
    const current = step.id === currentStep?.id;
    const past = index < stepIndex;
    return (
      <ScriptBtn
        key={step.id}
        onClick={() => {
          setQuery('');
          setReactionId(null);
          setStepId(step.id);
          setTabId(null);
        }}
        className={`flex min-h-8 flex-col items-center justify-center rounded-lg px-1 py-1 text-center text-fluid-2xs font-semibold leading-tight hover:bg-violet-50 ${
          current
            ? 'bg-[#6d28d9] text-white hover:bg-[#5b21b6]'
            : past
              ? 'border border-[#ddd6fe] bg-white text-[#6d28d9]'
              : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
        }`}
      >
        <span>{index + 1}</span>
        <span className="w-full break-words">{step.label}</span>
      </ScriptBtn>
    );
  };

  const bodyBlock = (id: string, text: string) => (
    <div className="whitespace-pre-wrap text-slate-800" style={bodyStyle}>
      {text ? <Highlighted text={text} needle={needle} /> : '(스크립트 본문이 비어 있습니다)'}
      <div className="mt-2">
        <ScriptBtn
          onClick={() => void copyText(id, text)}
          disabled={!text}
          className="inline-flex h-8 items-center gap-1 rounded-lg border border-violet-200 bg-white px-2 text-fluid-xs font-semibold text-[#6d28d9] hover:bg-violet-50"
        >
          <CrmIconCopy className="h-3.5 w-3.5" />
          {copiedId === id ? '복사됨' : '복사'}
        </ScriptBtn>
      </div>
    </div>
  );

  const inner = loading ? (
    <p className="px-2 py-1.5 text-fluid-xs text-slate-500">불러오는 중…</p>
  ) : error ? (
    <p className="px-2 py-1.5 text-fluid-xs text-red-600">{error}</p>
  ) : (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 space-y-1.5 border-b border-violet-100 px-2 py-1.5">
        <div className="relative">
          <CrmIconSearch className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-violet-400" />
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="고객 말 그대로 찾기 (예: 비싸, 부모님, 환불)"
            aria-label="고객 말 그대로 찾기"
            className="h-[34px] w-full rounded-lg border border-violet-300 bg-white pl-8 pr-14 text-fluid-xs text-slate-800 shadow-sm placeholder:text-slate-400 focus:border-[#6d28d9] focus:outline-none focus:ring-2 focus:ring-violet-200 [&::-webkit-search-cancel-button]:hidden"
          />
          {query ? (
            <ScriptBtn
              onClick={() => {
                setQuery('');
                searchRef.current?.focus();
              }}
              className="absolute right-1.5 top-1/2 inline-flex h-6 -translate-y-1/2 items-center rounded-lg px-1.5 text-fluid-2xs font-semibold text-[#6d28d9] hover:bg-violet-50"
            >
              지우기
            </ScriptBtn>
          ) : onOpenSettings ? (
            <ScriptBtn
              onClick={onOpenSettings}
              className="absolute right-1.5 top-1/2 inline-flex h-6 -translate-y-1/2 items-center rounded-lg px-1.5 text-fluid-2xs font-semibold text-[#6d28d9] hover:bg-violet-50"
            >
              관리
            </ScriptBtn>
          ) : null}
        </div>
        {steps.length > 0 ? (
          <div className="grid grid-cols-6 gap-1">{steps.map(stepBtn)}</div>
        ) : (
          <p className="text-fluid-2xs text-slate-500">대본 단계가 아직 없어요.</p>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {searching ? (
          <div className="space-y-2">
            <p className="text-fluid-xs font-semibold text-slate-700">찾은 답 {matches.length}개</p>
            {matches.length === 0 ? (
              <p className="text-fluid-xs text-slate-500">「{query.trim()}」와 맞는 답이 없어요.</p>
            ) : (
              matches.map((tab) => (
                <article key={tab.id} className="rounded-lg border border-slate-200 bg-white p-2">
                  <div className="mb-1 flex flex-wrap items-center gap-1">
                    <span className="rounded-full bg-violet-50 px-1.5 text-fluid-2xs font-medium text-[#6d28d9]">
                      {tab.kind === 'reaction' ? '고객 반응' : '대본'}
                    </span>
                    <span className="min-w-0 text-fluid-xs font-semibold text-slate-800">
                      {tab.categoryLabel} · {tab.title}
                    </span>
                  </div>
                  {bodyBlock(tab.id, tab.body)}
                </article>
              ))
            )}
          </div>
        ) : currentStep && currentTab ? (
          <div className="space-y-2">
            <h3 className="text-fluid-sm font-semibold text-slate-900">{currentStep.label}</h3>
            {currentTabs.length >= 2 ? (
              <div className="flex flex-wrap gap-1">
                {currentTabs.map((tab) => (
                  <ScriptBtn
                    key={tab.id}
                    onClick={() => setTabId(tab.id)}
                    className={`inline-flex h-6 items-center rounded-lg px-2 text-fluid-2xs font-semibold ${
                      tab.id === currentTab.id
                        ? 'bg-[#6d28d9] text-white hover:bg-[#5b21b6]'
                        : 'bg-violet-50 text-[#6d28d9] hover:bg-violet-100'
                    }`}
                  >
                    {tab.label}
                  </ScriptBtn>
                ))}
              </div>
            ) : null}
            {bodyBlock(currentTab.id, fill(currentTab.body))}
            <div className="flex gap-1 pt-1">
              <ScriptBtn
                disabled={stepIndex <= 0}
                onClick={() => {
                  const prev = steps[stepIndex - 1];
                  if (!prev) return;
                  setStepId(prev.id);
                  setTabId(null);
                }}
                className="inline-flex h-8 flex-1 items-center justify-center rounded-lg border border-slate-200 bg-white px-2 text-fluid-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                이전 단계
              </ScriptBtn>
              <ScriptBtn
                disabled={!nextStep}
                onClick={() => {
                  if (!nextStep) return;
                  setStepId(nextStep.id);
                  setTabId(null);
                }}
                className="inline-flex h-8 flex-[1.4] items-center justify-center rounded-lg bg-[#6d28d9] px-2 text-center text-fluid-xs font-semibold text-white hover:bg-[#5b21b6]"
              >
                {nextStep ? `다음 단계 · ${nextStep.label}` : '다음 단계'}
              </ScriptBtn>
            </div>
          </div>
        ) : (
          <p className="text-fluid-xs text-slate-500">이 단계에 읽을 대본이 아직 없어요.</p>
        )}
      </div>

      <div className="shrink-0 border-t border-violet-100 bg-violet-50/40 px-2 py-1.5">
        <p className="mb-1 text-fluid-2xs font-semibold text-[#6d28d9]">고객이 이렇게 말하면</p>
        {reactions.length === 0 ? (
          <p className="text-fluid-2xs text-slate-500">고객 반응 버튼이 아직 없어요.</p>
        ) : (
          <div className="grid grid-cols-2 gap-1">
            {reactions.map((tab) => (
              <ScriptBtn
                key={tab.id}
                onClick={() => openReactionCard(tab)}
                className={`min-h-8 rounded-lg border bg-white px-2 py-1 text-left text-fluid-2xs font-medium leading-snug text-slate-800 hover:bg-violet-50 ${
                  reactionId === tab.id ? 'border-[#6d28d9]' : 'border-violet-200'
                }`}
              >
                {tab.title}
              </ScriptBtn>
            ))}
          </div>
        )}
      </div>

      {openReaction ? (
        <div className="absolute inset-x-0 bottom-0 z-10 flex max-h-[75%] flex-col rounded-t-2xl border border-violet-200 bg-white shadow-lg">
          <div className="flex items-center gap-2 border-b border-violet-100 px-2 py-1.5">
            <p className="min-w-0 flex-1 text-fluid-xs font-semibold text-slate-900">{openReaction.title}</p>
            <ScriptBtn
              onClick={() => setReactionId(null)}
              className="inline-flex h-8 shrink-0 items-center rounded-lg px-2 text-fluid-2xs font-semibold text-[#6d28d9] hover:bg-violet-50"
            >
              대본으로 돌아가기 · {currentStep?.label ?? '지금 단계'}
            </ScriptBtn>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
            {bodyBlock(openReaction.id, openReaction.body)}
          </div>
        </div>
      ) : null}
    </div>
  );

  if (embedded) {
    return <div className="flex min-h-0 flex-1 flex-col">{inner}</div>;
  }

  return (
    <CrmColumn
      accent="script"
      title="상담 스크립트"
      titleAddon={<HelpTooltip text={CRM_SCRIPT_SHORTCUT_HELP} />}
      disableBodyScroll
      bodyClassName="p-0"
      className={compact ? 'min-h-0' : undefined}
    >
      {inner}
    </CrmColumn>
  );
}
