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
import { CrmReactionBrowser } from './CrmReactionBrowser';
import {
  browseTelecrmResponseCards,
  type TelecrmResponseCardCustomer,
  type TelecrmResponseCardDto,
} from '../../../api/telecrmResponseCards';

export const CRM_SCRIPT_SHORTCUT_HELP = [
  '상담 스크립트',
  '• / : 찾기 칸으로 이동',
  '• Esc : 찾기 칸을 비워요',
  '• 「대본」 탭은 단계별 대본, 「고객 반응」 탭은 고객이 한 말에 대한 답이에요',
  '• 고객 반응: 찾기 칸에서 ↓ 로 목록, ↑↓ 이동, Enter 펼치기, 1~4 그 문장 복사',
].join('\n');

type ScriptAudience = 'shared' | 'personal';

const AUDIENCE_KEY = 'crm.scriptAudience.v1';
const CARD_COPIES_KEY = 'crm.cardCopies.v1';

type ScriptView = 'script' | 'reaction';

function readCardCopies(brand: string | null): Record<string, number> {
  try {
    const raw = JSON.parse(localStorage.getItem(`${CARD_COPIES_KEY}:${brand ?? 'all'}`) ?? '{}') as unknown;
    if (!raw || typeof raw !== 'object') return {};
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (typeof v === 'number' && v > 0) out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

type FlowTab = {
  id: string;
  categoryId: string;
  categoryLabel: string;
  kind: TelecrmScriptKind;
  shared: boolean;
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
  if (category.kind === 'reaction' || category.kind === 'closing') return category.kind;
  return 'step';
}

function readAudience(): ScriptAudience {
  try {
    return localStorage.getItem(AUDIENCE_KEY) === 'personal' ? 'personal' : 'shared';
  } catch {
    return 'shared';
  }
}

function stepShortLabel(label: string): string {
  const stripped = label.replace(/^\d+\.\s*/, '').trim();
  return stripped || label.trim();
}

/** 탭에만 쓴다. 「4. 신뢰 (하청 비교)」 → 「신뢰」. 본문 제목은 카테고리 이름 그대로. */
function stepTabLabel(label: string): string {
  const stripped = label
    .replace(/^\d+\.\s*/, '')
    .replace(/\s*[（(][^）)]*[）)]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return stripped || stepShortLabel(label);
}

function reactionButtonLabel(tab: FlowTab): string {
  const name = tab.title.trim();
  if (!name || name === '기본') return tab.categoryLabel;
  return name;
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
  coachQuote,
  refreshKey = 0,
  onOpenSettings,
  compact = false,
  embedded = false,
}: {
  customerName?: string;
  pyeong?: string;
  estimateWon?: number | null;
  /** 가격 안내 칸에 있는 구조·합계·항목. 빈 값은 넣지 않는다. */
  coachQuote?: Pick<TelecrmResponseCardCustomer, 'structure' | 'cleaningType' | 'quoteTotalManWon' | 'quoteItems'>;
  refreshKey?: number;
  onOpenSettings?: () => void;
  compact?: boolean;
  embedded?: boolean;
}) {
  const token = getToken();
  const { loading: brandLoading, activeOperatingCompanyId, active: activeBrand } = useCrmWorkBrand();
  const [categories, setCategories] = useState<TelecrmScriptCategoryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [audience, setAudience] = useState<ScriptAudience>(readAudience);
  const [query, setQuery] = useState('');
  const [stepId, setStepId] = useState<string | null>(null);
  const [tabId, setTabId] = useState<string | null>(null);
  const [view, setView] = useState<ScriptView>('script');
  const [cards, setCards] = useState<TelecrmResponseCardDto[]>([]);
  const [cardsLoading, setCardsLoading] = useState(false);
  const [cardsError, setCardsError] = useState<string | null>(null);
  const [openCardId, setOpenCardId] = useState<string | null>(null);
  const [copyCounts, setCopyCounts] = useState<Record<string, number>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [reactionOrder, setReactionOrder] = useState<string[]>([]);
  const [closingIndex, setClosingIndex] = useState(0);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const reactionSourceRef = useRef<FlowTab[]>([]);
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

  // 고객 반응 탭에 쓸 「사용 중」 대응 카드 전체
  useEffect(() => {
    if (!token || brandLoading) return;
    let alive = true;
    setCardsLoading(true);
    setCopyCounts(readCardCopies(activeOperatingCompanyId));
    browseTelecrmResponseCards(token, activeOperatingCompanyId)
      .then((res) => {
        if (!alive) return;
        setCards(res.items ?? []);
        setCardsError(null);
      })
      .catch((e) => {
        if (!alive) return;
        setCards([]);
        setCardsError(e instanceof Error ? e.message : '대응 카드를 불러오지 못했어요.');
      })
      .finally(() => alive && setCardsLoading(false));
    return () => {
      alive = false;
    };
  }, [token, brandLoading, activeOperatingCompanyId, refreshKey]);

  const onCardCopied = useCallback(
    (cardId: string) => {
      setCopyCounts((prev) => {
        const next = { ...prev, [cardId]: (prev[cardId] ?? 0) + 1 };
        try {
          localStorage.setItem(`${CARD_COPIES_KEY}:${activeOperatingCompanyId ?? 'all'}`, JSON.stringify(next));
        } catch {
          /* 저장이 안 돼도 화면은 그대로 쓴다 */
        }
        return next;
      });
    },
    [activeOperatingCompanyId],
  );

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

  const inAudience = useCallback(
    (shared: boolean) => (audience === 'shared' ? shared : !shared),
    [audience],
  );

  const personalCount = useMemo(
    () => categories.filter((category) => category.isActive !== false && Boolean(category.ownerUserId)).length,
    [categories],
  );

  const steps = useMemo(
    () =>
      categories.filter(
        (category) =>
          kindOf(category) === 'step' &&
          category.isActive !== false &&
          inAudience(!category.ownerUserId),
      ),
    [categories, inAudience],
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
          shared: !category.ownerUserId,
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

  const reactionSource = useMemo(
    () => flowTabs.filter((tab) => tab.kind === 'reaction' && inAudience(tab.shared)),
    [flowTabs, inAudience],
  );
  reactionSourceRef.current = flowTabs.filter((tab) => tab.kind === 'reaction');
  const reactionIdKey = reactionSource
    .map((tab) => tab.id)
    .sort()
    .join(',');

  useEffect(() => {
    const pool = reactionSourceRef.current.filter((tab) => (audience === 'shared' ? tab.shared : !tab.shared));
    const sorted = [...pool].sort((a, b) => b.useCount - a.useCount || a.sortOrder - b.sortOrder);
    setReactionOrder(sorted.map((tab) => tab.id));
  }, [audience, customerName, reactionIdKey]);

  const reactions = useMemo(() => {
    const byId = new Map(reactionSource.map((tab) => [tab.id, tab]));
    const ordered = reactionOrder.map((id) => byId.get(id)).filter((tab): tab is FlowTab => Boolean(tab));
    const rest = reactionSource.filter((tab) => !reactionOrder.includes(tab.id));
    return [...ordered, ...rest];
  }, [reactionOrder, reactionSource]);

  const closingTabs = useMemo(
    () => flowTabs.filter((tab) => tab.kind === 'closing' && inAudience(tab.shared)),
    [flowTabs, inAudience],
  );
  const closingPhrase = closingTabs.length > 0 ? closingTabs[closingIndex % closingTabs.length] : null;

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

  const markOldReactionUsed = useCallback(
    (reactionTabId: string) => {
      const tab = { id: reactionTabId };
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
        if (query) {
          e.preventDefault();
          setQuery('');
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [query]);

  const selectStep = (step: TelecrmScriptCategoryDto) => {
    setQuery('');
    setView('script');
    setStepId(step.id);
    setTabId(null);
  };

  const stepBtn = (step: TelecrmScriptCategoryDto) => {
    const current = step.id === currentStep?.id;
    return (
      <ScriptBtn
        key={step.id}
        data-step={step.id}
        role="tab"
        aria-selected={current}
        onClick={() => selectStep(step)}
        className="inline-flex max-w-full shrink-0 items-center whitespace-nowrap bg-transparent"
        style={{
          height: 32,
          marginBottom: -1,
          padding: '6px 0',
          boxSizing: 'border-box',
          borderBottom: current ? '2px solid #6d28d9' : '2px solid transparent',
          fontSize: '0.75rem',
          lineHeight: 1.25,
          fontWeight: current ? 700 : 400,
          color: current ? '#6d28d9' : '#64748b',
        }}
      >
        {stepTabLabel(step.label)}
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

  const shownView: ScriptView = searching ? 'reaction' : view;
  const reactionTotal = cards.length + reactions.length;
  const quickCards = useMemo(() => {
    const mine = cards
      .filter((c) => (copyCounts[c.id] ?? 0) > 0)
      .sort((a, b) => (copyCounts[b.id] ?? 0) - (copyCounts[a.id] ?? 0));
    const rest = cards
      .filter((c) => !mine.includes(c))
      .sort((a, b) => Number(b.wonInCall) - Number(a.wonInCall) || (b.useCount ?? 0) - (a.useCount ?? 0));
    return [...mine, ...rest].slice(0, 3);
  }, [cards, copyCounts]);

  const scriptMatchesNode = searching ? (
    <div className="space-y-2">
            <p className="pt-1 text-fluid-xs font-semibold text-slate-700">내 대본에서 찾은 것 {matches.length}개</p>
            {matches.length === 0 ? (
              <p className="text-fluid-xs text-slate-500">「{query.trim()}」와 맞는 대본이 없어요.</p>
            ) : (
              matches.map((tab) => (
                <article key={tab.id} className="rounded-lg border border-slate-200 bg-white p-2">
                  <div className="mb-1 flex flex-wrap items-center gap-1">
                    <span className="rounded-full bg-slate-100 px-1.5 text-fluid-2xs font-medium text-slate-600">
                      {tab.shared ? '공용' : '내 것'}
                    </span>
                    <span className="rounded-full bg-violet-50 px-1.5 text-fluid-2xs font-medium text-[#6d28d9]">
                      {tab.kind === 'reaction' ? '고객 반응' : tab.kind === 'closing' ? '예약 끌어내기' : '대본'}
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
  ) : null;

  const inner = loading ? (
    <p className="px-2 py-1.5 text-fluid-xs text-slate-500">불러오는 중…</p>
  ) : error ? (
    <p className="px-2 py-1.5 text-fluid-xs text-red-600">{error}</p>
  ) : (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        className="flex shrink-0 gap-1 px-2"
        style={{ borderBottom: '1px solid #e2e8f0' }}
        role="tablist"
        aria-label="대본 또는 고객 반응"
      >
        {(['script', 'reaction'] as const).map((v) => {
          const on = shownView === v;
          return (
            <ScriptBtn
              key={v}
              role="tab"
              aria-selected={on}
              onClick={() => {
                setView(v);
                if (v === 'script') setQuery('');
              }}
              className="inline-flex items-center gap-1 bg-transparent px-2.5"
              style={{
                height: 36,
                marginBottom: -1,
                borderBottom: on ? '2px solid #6d28d9' : '2px solid transparent',
                fontSize: '0.875rem',
                fontWeight: on ? 700 : 500,
                color: on ? '#6d28d9' : '#475569',
              }}
            >
              {v === 'script' ? '대본' : '고객 반응'}
              {v === 'reaction' && reactionTotal > 0 ? <span style={{ fontWeight: 500 }}>{reactionTotal}</span> : null}
            </ScriptBtn>
          );
        })}
      </div>
      <div className={`shrink-0 space-y-1.5 px-2 py-1.5 ${shownView === 'script' ? 'border-b border-violet-100' : ''}`}>
        <div className="flex items-center gap-1">
          <div className="relative min-w-0 flex-1">
            <CrmIconSearch className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-violet-400" />
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="고객이 뭐라고 했나요? (예: 외창, 비싸, 상의)"
              aria-label="고객 말 그대로 찾기"
              data-crm-script-search="1"
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
          {shownView === 'script' ? (
          <div className="inline-flex h-7 shrink-0 rounded-lg border border-slate-200 bg-slate-50 p-0.5" role="group" aria-label="공용 또는 내 것">
            <ScriptBtn
              onClick={() => {
                setAudience('shared');
                try {
                  localStorage.setItem(AUDIENCE_KEY, 'shared');
                } catch {
                  /* ignore */
                }
              }}
              className={`inline-flex h-full items-center rounded-lg px-2 text-fluid-2xs font-semibold ${
                audience === 'shared' ? 'bg-slate-900 text-white hover:bg-slate-800' : 'text-slate-600 hover:bg-white'
              }`}
            >
              공용
            </ScriptBtn>
            <ScriptBtn
              onClick={() => {
                setAudience('personal');
                try {
                  localStorage.setItem(AUDIENCE_KEY, 'personal');
                } catch {
                  /* ignore */
                }
              }}
              className={`inline-flex h-full items-center rounded-lg px-2 text-fluid-2xs font-semibold ${
                audience === 'personal' ? 'bg-slate-900 text-white hover:bg-slate-800' : 'text-slate-600 hover:bg-white'
              }`}
            >
              내 것 {personalCount}
            </ScriptBtn>
          </div>
          ) : null}
        </div>
        {shownView === 'script' ? (
        <div
          className="flex w-full min-w-0 flex-wrap overflow-x-hidden"
          style={{ columnGap: 14, borderBottom: '1px solid #e2e8f0' }}
          role="tablist"
          aria-label="대본 단계"
          onKeyDown={(e) => {
            if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
            const dir = e.key === 'ArrowRight' ? 1 : -1;
            const next = steps[stepIndex + dir];
            if (!next) return;
            e.preventDefault();
            selectStep(next);
            const row = e.currentTarget;
            window.requestAnimationFrame(() => {
              row.querySelector<HTMLButtonElement>(`button[data-step="${next.id}"]`)?.focus();
            });
          }}
        >
          {steps.length > 0 ? (
            steps.map(stepBtn)
          ) : (
            <p className="text-fluid-2xs text-slate-500">
              {audience === 'personal' ? '내 대본 단계가 아직 없어요.' : '대본 단계가 아직 없어요.'}
            </p>
          )}
        </div>
        ) : null}
      </div>

      {shownView === 'reaction' ? (
        <CrmReactionBrowser
          query={query}
          operatingCompanyId={activeOperatingCompanyId}
          customer={{
            ...(pyeong ? { pyeong } : {}),
            ...(activeBrand?.name ? { brand: activeBrand.name } : {}),
            ...(currentStep?.label ? { step: currentStep.label } : {}),
            ...coachQuote,
          }}
          stageLabel={currentStep ? stepTabLabel(currentStep.label) : undefined}
          cards={cards}
          cardsLoading={cardsLoading}
          cardsError={cardsError}
          openCardId={openCardId}
          onOpenCard={setOpenCardId}
          copyCounts={copyCounts}
          onCardCopied={onCardCopied}
          oldReactions={reactions.map((tab) => ({ id: tab.id, label: reactionButtonLabel(tab), body: tab.body }))}
          onUseOldReaction={markOldReactionUsed}
          scriptMatches={scriptMatchesNode}
        />
      ) : (
      <>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {currentStep && currentTab ? (
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
                {nextStep ? `다음 단계 · ${stepShortLabel(nextStep.label)}` : '다음 단계'}
              </ScriptBtn>
            </div>
            {closingPhrase ? (
              <div className="rounded-lg border border-[#fed7aa] bg-[#fff7ed] px-2 py-2">
                <p className="text-fluid-2xs font-semibold text-[#c2410c]">
                  예약 끌어내기 · 고객이 「할게요」 하기 전에 먼저
                </p>
                <p className="mt-1 whitespace-pre-wrap text-slate-800" style={bodyStyle}>
                  {closingPhrase.body || '(멘트가 비어 있어요)'}
                </p>
                {closingTabs.length > 1 ? (
                  <ScriptBtn
                    onClick={() => setClosingIndex((index) => index + 1)}
                    className="mt-2 inline-flex h-8 items-center rounded-lg border border-[#fed7aa] bg-white px-2 text-fluid-xs font-semibold text-[#c2410c] hover:bg-[#ffedd5]"
                  >
                    다른 멘트
                  </ScriptBtn>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : (
          <p className="text-fluid-xs text-slate-500">이 단계에 읽을 대본이 아직 없어요.</p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1 border-t border-violet-100 bg-violet-50/60 px-2 py-1.5">
        <ScriptBtn
          onClick={() => setView('reaction')}
          className="inline-flex h-8 shrink-0 items-center rounded-lg bg-[#6d28d9] px-2.5 text-fluid-2xs font-bold text-white hover:bg-[#5b21b6]"
        >
          고객 반응 보기{reactionTotal > 0 ? ` (${reactionTotal})` : ''}
        </ScriptBtn>
        {quickCards.map((card) => (
          <ScriptBtn
            key={card.id}
            onClick={() => {
              setOpenCardId(card.id);
              setView('reaction');
            }}
            className="h-8 min-w-0 truncate rounded-lg border border-violet-200 bg-white px-2 text-fluid-2xs font-medium text-slate-800 hover:bg-violet-50"
          >
            {(card.triggers[0] || card.title).trim()}
          </ScriptBtn>
        ))}
      </div>
      </>
      )}
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
