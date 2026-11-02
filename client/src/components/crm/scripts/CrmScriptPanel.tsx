import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react';
import { getToken } from '../../../stores/auth';
import {
  fetchTelecrmScripts,
  type TelecrmScriptCategoryDto,
  type TelecrmScriptTabDto,
} from '../../../api/telecrm';
import { parseJwtPayload } from '../../../utils/jwtPayload';
import { HelpTooltip } from '../../ui/HelpTooltip';
import { CrmColumn } from '../layout/CrmShell';
import { CrmActionButton, CrmIconCopy, CrmIconSearch, CRM_ACCENT } from '../crmUi';
import { applyTelecrmScriptPlaceholders } from './applyTelecrmScriptPlaceholders';
import { partitionTelecrmCategories } from '../settings/telecrmSettingsUi';
import {
  findScriptMatches,
  loadScriptPins,
  normalizeScriptQuery,
  saveScriptPins,
} from './scriptSearch';

/** 패널 제목 옆 「?」에 보여 줄 단축키 안내 */
export const CRM_SCRIPT_SHORTCUT_HELP = [
  '빠르게 찾는 방법',
  '• / : 검색창으로 이동 (Esc 로 지우기)',
  '• 1~9 : 목록의 N번째 스크립트 펼치기',
  '• Enter : 펼친 스크립트 복사',
  '• Ctrl+1~5 : 단계 바꾸기',
  '• Shift+← → : 이전·다음 스크립트',
  '• ☆ 를 누르면 「자주 씀」에 모여요',
].join('\n');

type Scope = 'all' | 'mine' | 'shared';

type ScriptItem = {
  tab: TelecrmScriptTabDto;
  stageKey: string;
  stageLabel: string;
  shared: boolean;
  title: string;
  body: string;
};

type Stage = { key: string; label: string };

const ALL_STAGE = '__all__';

const SCOPE_OPTIONS: { id: Scope; label: string }[] = [
  { id: 'all', label: '전체' },
  { id: 'mine', label: '내 것' },
  { id: 'shared', label: '공통' },
];

const chipBase =
  'inline-flex h-6 shrink-0 items-center gap-1 rounded-lg px-2 text-fluid-2xs font-semibold whitespace-nowrap transition-colors';

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

function stageKeyOf(label: string): string {
  return label.trim().replace(/\s+/g, ' ');
}

/** 스크립트 열 전용 작은 버튼 — 색·크기는 className 으로 */
function ScriptBtn({ className = '', type = 'button', ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={`focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
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
  /** 접촉 이력 열과 함께 쓸 때 본문·글자 축소 */
  compact?: boolean;
  /** CrmScriptAiCenterPanel 내부 — CrmColumn 래퍼 생략 */
  embedded?: boolean;
}) {
  const token = getToken();
  const userId = useMemo(
    () => (token ? parseJwtPayload<{ userId?: string }>(token)?.userId ?? null : null),
    [token],
  );
  const [categories, setCategories] = useState<TelecrmScriptCategoryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scope, setScope] = useState<Scope>('all');
  const [stage, setStage] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [fontScale, setFontScale] = useState(compact ? 0.8 : 0.875);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [pins, setPins] = useState<string[]>(() => loadScriptPins(userId));
  const searchRef = useRef<HTMLInputElement | null>(null);
  const itemRefs = useRef(new Map<string, HTMLLIElement>());
  const copyTimer = useRef<number | null>(null);

  useEffect(() => {
    setPins(loadScriptPins(userId));
  }, [userId]);

  useEffect(
    () => () => {
      if (copyTimer.current) window.clearTimeout(copyTimer.current);
    },
    [],
  );

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchTelecrmScripts(token, { scope: 'work' });
      setCategories(res.categories);
    } catch (e) {
      setError(e instanceof Error ? e.message : '스크립트를 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const estimateLabel =
    estimateWon != null && Number.isFinite(estimateWon)
      ? `${Number(estimateWon).toLocaleString('ko-KR')}원`
      : undefined;

  const { personal: personalCategories, shared: sharedCategories } = useMemo(
    () => partitionTelecrmCategories(categories),
    [categories],
  );

  /** 내 것 → 공통 순서로 모든 스크립트 펼침 */
  const allItems = useMemo<ScriptItem[]>(() => {
    const out: ScriptItem[] = [];
    const push = (list: TelecrmScriptCategoryDto[], shared: boolean) => {
      for (const c of list) {
        for (const t of c.tabs ?? []) {
          if (t.isActive === false) continue;
          out.push({
            tab: t,
            stageKey: stageKeyOf(c.label),
            stageLabel: c.label.trim(),
            shared,
            title: t.label,
            body: applyTelecrmScriptPlaceholders(t.body, {
              customerName,
              pyeong,
              estimate: estimateLabel,
            }),
          });
        }
      }
    };
    push(personalCategories, false);
    push(sharedCategories, true);
    return out;
  }, [personalCategories, sharedCategories, customerName, pyeong, estimateLabel]);

  const inScope = useCallback(
    (shared: boolean) => scope === 'all' || (scope === 'shared' ? shared : !shared),
    [scope],
  );

  /** 단계 칩 — 같은 이름의 단계(내 것·공통)는 하나로 묶음 */
  const stages = useMemo<Stage[]>(() => {
    const seen = new Map<string, Stage>();
    const add = (list: TelecrmScriptCategoryDto[], shared: boolean) => {
      if (!inScope(shared)) return;
      for (const c of list) {
        const key = stageKeyOf(c.label);
        if (!seen.has(key)) seen.set(key, { key, label: c.label.trim() });
      }
    };
    add(personalCategories, false);
    add(sharedCategories, true);
    return [...seen.values()];
  }, [personalCategories, sharedCategories, inScope]);

  const scopedItems = useMemo(() => allItems.filter((it) => inScope(it.shared)), [allItems, inScope]);

  const stageCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const it of scopedItems) m.set(it.stageKey, (m.get(it.stageKey) ?? 0) + 1);
    return m;
  }, [scopedItems]);

  // 처음엔 첫 단계, 고른 단계가 범위에서 사라지면 첫 단계로
  useEffect(() => {
    if (stage === ALL_STAGE) return;
    if (stage && stages.some((s) => s.key === stage)) return;
    setStage(stages[0]?.key ?? ALL_STAGE);
  }, [stage, stages]);

  const needle = normalizeScriptQuery(query);
  const searching = needle.length > 0;
  const activeStage = stage ?? ALL_STAGE;

  const visibleItems = useMemo(() => {
    if (searching) {
      return scopedItems.filter(
        (it) =>
          normalizeScriptQuery(it.title).includes(needle) || normalizeScriptQuery(it.body).includes(needle),
      );
    }
    if (activeStage === ALL_STAGE) return scopedItems;
    return scopedItems.filter((it) => it.stageKey === activeStage);
  }, [scopedItems, searching, needle, activeStage]);

  const expandedItem = visibleItems.find((it) => it.tab.id === expandedId) ?? null;

  const pinnedItems = useMemo(
    () =>
      pins
        .map((id) => allItems.find((it) => it.tab.id === id))
        .filter((it): it is ScriptItem => Boolean(it)),
    [pins, allItems],
  );

  const selectStage = useCallback(
    (key: string) => {
      setStage(key);
      const list = key === ALL_STAGE ? scopedItems : scopedItems.filter((it) => it.stageKey === key);
      setExpandedId(list.length === 1 ? (list[0]?.tab.id ?? null) : null);
    },
    [scopedItems],
  );

  const copyItem = useCallback(async (item: ScriptItem) => {
    if (!item.body) return;
    try {
      await navigator.clipboard.writeText(item.body);
      setCopiedId(item.tab.id);
      if (copyTimer.current) window.clearTimeout(copyTimer.current);
      copyTimer.current = window.setTimeout(() => setCopiedId(null), 1500);
    } catch {
      /* ignore */
    }
  }, []);

  const togglePin = useCallback(
    (id: string) => {
      setPins((prev) => {
        const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
        saveScriptPins(userId, next);
        return next;
      });
    },
    [userId],
  );

  const openPinned = useCallback(
    (item: ScriptItem) => {
      setQuery('');
      if (!inScope(item.shared)) setScope('all');
      setStage(item.stageKey);
      setExpandedId(item.tab.id);
      void copyItem(item);
    },
    [inScope, copyItem],
  );

  const toggleExpand = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  // 펼친 항목이 보이도록
  useEffect(() => {
    if (!expandedId) return;
    itemRefs.current.get(expandedId)?.scrollIntoView({ block: 'nearest' });
  }, [expandedId]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      // 다른 팝업이 열려 있으면 단축키 쉼
      if (document.querySelector('[role="dialog"],[aria-modal="true"]')) return;
      const typing = isTypingTarget(e.target);
      const mod = e.ctrlKey || e.metaKey;

      if (!typing && !mod && !e.altKey && e.key === '/') {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
        return;
      }
      if (typing) return;

      if (mod) {
        if (!e.shiftKey && e.key >= '1' && e.key <= '5') {
          const s = stages[Number(e.key) - 1];
          if (s) {
            e.preventDefault();
            setQuery('');
            selectStage(s.key);
          }
        }
        return;
      }
      if (e.altKey) return;

      if (e.key === 'Escape' && query) {
        setQuery('');
        return;
      }

      if (e.shiftKey && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
        const len = visibleItems.length;
        if (len === 0) return;
        e.preventDefault();
        const idx = visibleItems.findIndex((it) => it.tab.id === expandedId);
        const delta = e.key === 'ArrowRight' ? 1 : -1;
        const nextIdx = idx < 0 ? (delta > 0 ? 0 : len - 1) : (idx + delta + len) % len;
        const next = visibleItems[nextIdx];
        if (next) setExpandedId(next.tab.id);
        return;
      }

      if (!e.shiftKey && /^[1-9]$/.test(e.key)) {
        const item = visibleItems[Number(e.key) - 1];
        if (item) {
          e.preventDefault();
          setExpandedId(item.tab.id);
        }
        return;
      }

      if (e.key === 'Enter' && expandedItem) {
        const el = e.target instanceof HTMLElement ? e.target : null;
        // 다른 버튼(복사·별표 등)에 초점이 있으면 그 버튼 동작을 그대로
        if (el && el.closest('button, a') && !el.closest('[data-script-head]')) return;
        e.preventDefault();
        void copyItem(expandedItem);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [stages, selectStage, query, visibleItems, expandedId, expandedItem, copyItem]);

  const renderItem = (item: ScriptItem, index: number) => {
    const id = item.tab.id;
    const expanded = expandedId === id;
    const pinned = pins.includes(id);
    const copied = copiedId === id;
    const showStage = searching || activeStage === ALL_STAGE;
    let preview = item.body;
    if (searching && !expanded) {
      const first = findScriptMatches(item.body, needle)[0];
      if (first && first[0] > 50) preview = `…${item.body.slice(Math.max(0, first[0] - 20))}`;
    }
    return (
      <li
        key={id}
        ref={(el) => {
          if (el) itemRefs.current.set(id, el);
          else itemRefs.current.delete(id);
        }}
        className={`rounded-lg border transition-colors ${
          expanded ? 'border-violet-300 bg-violet-50/60 shadow-sm' : 'border-slate-200 bg-white hover:border-violet-200'
        }`}
      >
        <div className="flex items-start gap-1 px-1.5 py-1">
          <ScriptBtn
            data-script-head="1"
            onClick={() => toggleExpand(id)}
            aria-expanded={expanded}
            title={expanded ? '접기 (Enter 로 복사)' : index < 9 ? `펼치기 (숫자 ${index + 1})` : '펼치기'}
            className="flex min-w-0 flex-1 items-start gap-1.5 rounded-lg text-left"
          >
            <span
              className={`mt-px inline-flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full px-1 text-fluid-2xs font-bold ${
                index < 9 ? (expanded ? CRM_ACCENT.script.chipActive : 'bg-violet-100 text-violet-700') : 'text-slate-300'
              }`}
              aria-hidden
            >
              {index < 9 ? index + 1 : '·'}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex min-w-0 items-center gap-1">
                <span className="truncate text-fluid-xs font-bold text-slate-800">
                  <Highlighted text={item.title} needle={needle} />
                </span>
                {showStage ? (
                  <span className="shrink-0 rounded-full bg-violet-50 px-1.5 text-fluid-2xs font-medium text-violet-600">
                    {item.stageLabel}
                  </span>
                ) : null}
                {item.shared ? (
                  <span className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-1.5 text-fluid-2xs text-slate-500">
                    공통
                  </span>
                ) : null}
              </span>
              {!expanded ? (
                <span className="mt-0.5 line-clamp-2 whitespace-pre-line text-fluid-2xs leading-snug text-slate-500">
                  {preview ? <Highlighted text={preview} needle={needle} /> : '(본문이 비어 있어요)'}
                </span>
              ) : null}
            </span>
          </ScriptBtn>
          <ScriptBtn
            onClick={() => togglePin(id)}
            aria-pressed={pinned}
            aria-label={pinned ? '자주 씀에서 빼기' : '자주 씀에 추가'}
            title={pinned ? '자주 씀에서 빼기' : '자주 씀에 추가'}
            className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-fluid-xs leading-none hover:bg-amber-50 ${
              pinned ? 'text-amber-500' : 'text-slate-300 hover:text-amber-500'
            }`}
          >
            {pinned ? '★' : '☆'}
          </ScriptBtn>
          <ScriptBtn
            onClick={() => void copyItem(item)}
            disabled={!item.body}
            title="복사"
            className={`${chipBase} px-1.5 ${copied ? CRM_ACCENT.script.chipActive : CRM_ACCENT.script.chipIdle}`}
          >
            <CrmIconCopy className="h-3 w-3" />
            {copied ? '복사됨' : '복사'}
          </ScriptBtn>
        </div>
        {expanded ? (
          <div
            className={`mx-1.5 mb-1.5 whitespace-pre-wrap rounded-lg border p-2 leading-snug text-slate-800 ${CRM_ACCENT.script.panel}`}
            style={{ fontSize: `${fontScale}rem` }}
          >
            {item.body ? <Highlighted text={item.body} needle={needle} /> : '(스크립트 본문이 비어 있습니다)'}
          </div>
        ) : null}
      </li>
    );
  };

  const settingsButton = onOpenSettings ? (
    <CrmActionButton accent="script" onClick={onOpenSettings} className="!px-2 !py-1 !text-fluid-2xs">
      설정에서 스크립트 추가
    </CrmActionButton>
  ) : null;

  const listBody = (() => {
    if (scopedItems.length === 0 && !searching) {
      return (
        <div className="space-y-2 py-1">
          <p className="text-fluid-xs text-slate-500">
            {scope === 'mine'
              ? '아직 내 스크립트가 없어요.'
              : scope === 'shared'
                ? '아직 공통 스크립트가 없어요.'
                : '등록된 스크립트가 없습니다.'}
          </p>
          {settingsButton}
        </div>
      );
    }
    if (visibleItems.length === 0) {
      return searching ? (
        <p className="py-1 text-fluid-xs text-slate-500">「{query.trim()}」와 맞는 스크립트가 없어요.</p>
      ) : (
        <div className="space-y-2 py-1">
          <p className="text-fluid-xs text-slate-500">이 단계에는 아직 스크립트가 없어요.</p>
          {settingsButton}
        </div>
      );
    }
    return (
      <>
        {searching ? (
          <p className="mb-1 text-fluid-2xs text-slate-500">
            모든 단계에서 찾았어요 · {visibleItems.length}개
          </p>
        ) : null}
        <ul className="space-y-1">{visibleItems.map(renderItem)}</ul>
      </>
    );
  })();

  const inner = loading ? (
    <p className="px-2 py-1.5 text-fluid-xs text-slate-500">불러오는 중…</p>
  ) : error ? (
    <p className="px-2 py-1.5 text-fluid-xs text-red-600">{error}</p>
  ) : categories.length === 0 ? (
    <div className="space-y-2 px-2 py-1.5">
      <p className="text-fluid-xs text-slate-500">등록된 스크립트가 없습니다.</p>
      {settingsButton}
    </div>
  ) : (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 space-y-1.5 border-b border-violet-100/80 px-2 py-1.5">
        {/* 검색 */}
        <div className="relative">
          <CrmIconSearch className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-violet-400" />
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault();
                if (query) setQuery('');
                else e.currentTarget.blur();
              } else if (e.key === 'Enter' && visibleItems[0]) {
                e.preventDefault();
                setExpandedId(visibleItems[0].tab.id);
              }
            }}
            placeholder="스크립트 찾기 (제목·내용)"
            aria-label="스크립트 찾기"
            className="h-[34px] w-full rounded-lg border border-violet-300 bg-white pl-8 pr-14 text-fluid-xs text-slate-800 shadow-sm placeholder:text-slate-400 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200 [&::-webkit-search-cancel-button]:hidden"
          />
          {query ? (
            <ScriptBtn
              onClick={() => {
                setQuery('');
                searchRef.current?.focus();
              }}
              className="absolute right-1.5 top-1/2 inline-flex h-6 -translate-y-1/2 items-center rounded-lg px-1.5 text-fluid-2xs font-semibold text-violet-700 hover:bg-violet-50"
            >
              지우기
            </ScriptBtn>
          ) : (
            <span
              className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded-lg border border-slate-200 bg-slate-50 px-1.5 text-fluid-2xs text-slate-400"
              title="/ 를 누르면 바로 검색"
            >
              /
            </span>
          )}
        </div>

        {/* 자주 씀 */}
        <div className="flex min-w-0 items-center gap-1">
          <span className="shrink-0 text-fluid-2xs font-bold text-amber-700">★ 자주 씀</span>
          {pinnedItems.length > 0 ? (
            <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto pb-px">
              {pinnedItems.map((it) => (
                <ScriptBtn
                  key={it.tab.id}
                  onClick={() => openPinned(it)}
                  title={`${it.stageLabel} · ${it.title} — 누르면 펼치고 복사해요`}
                  className={`${chipBase} max-w-[8.5rem] border ${
                    copiedId === it.tab.id
                      ? 'border-amber-400 bg-amber-100 text-amber-900'
                      : 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100'
                  }`}
                >
                  <span className="truncate">{copiedId === it.tab.id ? '복사됨' : it.title}</span>
                </ScriptBtn>
              ))}
            </div>
          ) : (
            <span className="truncate text-fluid-2xs text-slate-400">☆ 를 누르면 여기 모여요</span>
          )}
        </div>

        {/* 범위 · 관리 · 글자 */}
        <div className="flex flex-wrap items-center gap-1">
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5" role="group" aria-label="스크립트 범위">
            {SCOPE_OPTIONS.map((o) => (
              <ScriptBtn
                key={o.id}
                onClick={() => {
                  setScope(o.id);
                  setExpandedId(null);
                }}
                aria-pressed={scope === o.id}
                className={`inline-flex h-5 items-center rounded-lg px-2 text-fluid-2xs font-semibold transition-colors ${
                  scope === o.id ? CRM_ACCENT.script.segmentActive : 'text-slate-600 hover:bg-white'
                }`}
              >
                {o.label}
              </ScriptBtn>
            ))}
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-1 text-fluid-2xs text-slate-500">
            {onOpenSettings ? (
              <ScriptBtn
                onClick={onOpenSettings}
                title="스크립트 추가·수정"
                className="inline-flex h-6 items-center rounded-lg px-1.5 font-semibold text-violet-700 hover:bg-violet-50"
              >
                관리
              </ScriptBtn>
            ) : null}
            <span>글자</span>
            <ScriptBtn
              onClick={() => setFontScale((s) => Math.max(0.75, s - 0.05))}
              className="inline-flex h-6 w-6 items-center justify-center rounded-lg border border-slate-300 bg-white leading-none hover:bg-slate-50"
              aria-label="글자 크기 줄이기"
            >
              −
            </ScriptBtn>
            <ScriptBtn
              onClick={() => setFontScale((s) => Math.min(1.15, s + 0.05))}
              className="inline-flex h-6 w-6 items-center justify-center rounded-lg border border-slate-300 bg-white leading-none hover:bg-slate-50"
              aria-label="글자 크기 키우기"
            >
              +
            </ScriptBtn>
          </div>
        </div>

        {/* 단계 — 한 줄 */}
        <div
          className={`flex gap-1 overflow-x-auto pb-px transition-opacity ${searching ? 'opacity-50' : ''}`}
          title={searching ? '검색 중에는 모든 단계에서 찾아요' : undefined}
        >
          <ScriptBtn
            onClick={() => {
              setQuery('');
              selectStage(ALL_STAGE);
            }}
            className={`${chipBase} ${!searching && activeStage === ALL_STAGE ? CRM_ACCENT.script.chipActive : CRM_ACCENT.script.chipIdle}`}
          >
            전체 <span className="opacity-70">{scopedItems.length}</span>
          </ScriptBtn>
          {stages.map((s, i) => (
            <ScriptBtn
              key={s.key}
              onClick={() => {
                setQuery('');
                selectStage(s.key);
              }}
              title={i < 5 ? `Ctrl+${i + 1}` : undefined}
              className={`${chipBase} ${!searching && activeStage === s.key ? CRM_ACCENT.script.chipActive : CRM_ACCENT.script.chipIdle}`}
            >
              {s.label} <span className="opacity-70">{stageCounts.get(s.key) ?? 0}</span>
            </ScriptBtn>
          ))}
        </div>
      </div>

      {/* 목록 — 스크롤 영역 */}
      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-1.5">{listBody}</div>
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
