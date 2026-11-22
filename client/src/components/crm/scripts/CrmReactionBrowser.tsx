import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { getToken } from '../../../stores/auth';
import {
  coachTelecrmResponseCardsStream,
  feedbackTelecrmResponseCard,
  searchTelecrmResponseCards,
  type TelecrmResponseCardCustomer,
  type TelecrmResponseCardDto,
  type TelecrmResponseCoachResult,
} from '../../../api/telecrmResponseCards';
import { CrmIconCopy } from '../crmUi';

const bodyStyle = { fontSize: '0.875rem', lineHeight: 1.7 } as const;
const ALL = '전체';

export type CrmOldReaction = { id: string; label: string; body: string };

/** 지금 대본 단계에서 먼저 보여 줄 카드 분류 */
function stageCategories(stage: string | undefined): string[] {
  const s = stage ?? '';
  if (/가격|금액|견적/.test(s)) return ['가격', '비교·신뢰'];
  if (/신뢰|불안|비교/.test(s)) return ['비교·신뢰'];
  if (/결제|예약|클로징|마무리/.test(s)) return ['예약·결제', '상의·보류'];
  if (/날짜|일정|성함/.test(s)) return ['일정·시간'];
  if (/구성|범위/.test(s)) return ['범위', '추가시공'];
  return [];
}

function cardLabel(card: TelecrmResponseCardDto): string {
  return (card.triggers[0] || card.title).trim();
}

function cardHasText(card: TelecrmResponseCardDto, q: string): boolean {
  return [card.code, card.title, card.category, ...card.triggers, ...card.responses.map((r) => r[1])].some((t) =>
    t.includes(q),
  );
}

function Mark({ text, q }: { text: string; q: string }) {
  const needle = q.trim();
  if (needle.length < 2) return <>{text}</>;
  const at = text.indexOf(needle);
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <mark className="rounded-sm bg-yellow-100 text-inherit">{needle}</mark>
      {text.slice(at + needle.length)}
    </>
  );
}

function CopyBtn({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-7 shrink-0 items-center gap-1 rounded-lg px-2 text-fluid-2xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 ${
        active ? 'bg-emerald-600 text-white' : 'bg-[#6d28d9] text-white hover:bg-[#5b21b6]'
      }`}
    >
      <CrmIconCopy className="h-3 w-3" />
      {active ? '복사됨' : '복사'}
    </button>
  );
}

type CoachState = { busy: boolean; result: TelecrmResponseCoachResult | null; error: string | null; voted: 'up' | 'down' | null };

/**
 * 상담 스크립트 「고객 반응」 탭 — 대응 카드를 훑어보고, 분류로 좁히고, 고객 말로 찾는다.
 * 검색어는 위 찾기 칸(부모)이 갖고 있다. AI 코치는 카드에서 누를 때만 돈다.
 */
export function CrmReactionBrowser({
  query,
  operatingCompanyId,
  customer,
  stageLabel,
  cards,
  cardsLoading,
  cardsError,
  openCardId,
  onOpenCard,
  copyCounts,
  onCardCopied,
  oldReactions,
  onUseOldReaction,
  scriptMatches,
}: {
  query: string;
  operatingCompanyId: string | null;
  customer: TelecrmResponseCardCustomer;
  stageLabel?: string;
  cards: TelecrmResponseCardDto[];
  cardsLoading: boolean;
  cardsError: string | null;
  openCardId: string | null;
  onOpenCard: (id: string | null) => void;
  /** 이 PC에서 내가 복사한 횟수 (카드 id → 횟수) */
  copyCounts: Record<string, number>;
  onCardCopied: (cardId: string) => void;
  /** 예전 「고객이 이렇게 말하면」 버튼 */
  oldReactions: CrmOldReaction[];
  onUseOldReaction: (id: string) => void;
  /** 찾는 중일 때 아래에 붙는 「내 대본에서 찾은 것」 */
  scriptMatches?: ReactNode;
}) {
  const token = getToken();
  const q = query.trim();
  const [pickedCat, setCat] = useState(ALL);
  const [found, setFound] = useState<TelecrmResponseCardDto[] | null>(null);
  const [finding, setFinding] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [coach, setCoach] = useState<Record<string, CoachState>>({});
  const [openOld, setOpenOld] = useState<string | null>(null);
  const copyTimer = useRef<number | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const customerKey = JSON.stringify(customer);

  useEffect(
    () => () => {
      if (copyTimer.current) window.clearTimeout(copyTimer.current);
    },
    [],
  );

  // 고객 말로 찾기 — 글자가 맞는 카드는 바로, 뜻이 비슷한 카드는 서버가 찾아 준다
  useEffect(() => {
    setFound(null);
    if (!token || !q) {
      setFinding(false);
      return;
    }
    let alive = true;
    setFinding(true);
    const timer = window.setTimeout(() => {
      searchTelecrmResponseCards(token, q, operatingCompanyId)
        .then((res) => alive && setFound(res.items ?? []))
        .catch(() => alive && setFound(null))
        .finally(() => alive && setFinding(false));
    }, 220);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [token, q, operatingCompanyId]);

  const stageFirst = useMemo(() => stageCategories(stageLabel), [stageLabel]);

  const ordered = useMemo(() => {
    const rank = (c: TelecrmResponseCardDto) => (stageFirst.includes(c.category) ? 0 : 1);
    return [...cards].sort(
      (a, b) =>
        rank(a) - rank(b) ||
        Number(b.wonInCall) - Number(a.wonInCall) ||
        (b.useCount ?? 0) - (a.useCount ?? 0) ||
        a.code.localeCompare(b.code),
    );
  }, [cards, stageFirst]);

  const base = useMemo(() => {
    if (!q) return ordered;
    if (found) return found;
    return ordered.filter((c) => cardHasText(c, q));
  }, [q, found, ordered]);

  const cats = useMemo(() => {
    const count = new Map<string, number>();
    for (const c of base) count.set(c.category, (count.get(c.category) ?? 0) + 1);
    const names = [...count.keys()].sort(
      (a, b) =>
        Number(stageFirst.includes(b)) - Number(stageFirst.includes(a)) || (count.get(b) ?? 0) - (count.get(a) ?? 0),
    );
    return [{ name: ALL, count: base.length }, ...names.map((name) => ({ name, count: count.get(name) ?? 0 }))];
  }, [base, stageFirst]);

  // 고른 분류가 지금 목록에 없으면 「전체」로 본다
  const cat = cats.some((c) => c.name === pickedCat) ? pickedCat : ALL;

  const rows = useMemo(() => (cat === ALL ? base : base.filter((c) => c.category === cat)), [base, cat]);

  const frequent = useMemo(() => {
    const mine = cards
      .filter((c) => (copyCounts[c.id] ?? 0) > 0)
      .sort((a, b) => (copyCounts[b.id] ?? 0) - (copyCounts[a.id] ?? 0));
    const team = cards
      .filter((c) => (c.useCount ?? 0) > 0 && !mine.includes(c))
      .sort((a, b) => (b.useCount ?? 0) - (a.useCount ?? 0));
    return { items: [...mine, ...team].slice(0, 6), mine: mine.length > 0 };
  }, [cards, copyCounts]);

  const flashCopied = useCallback((key: string) => {
    setCopied(key);
    if (copyTimer.current) window.clearTimeout(copyTimer.current);
    copyTimer.current = window.setTimeout(() => setCopied(null), 1500);
  }, []);

  const copyText = useCallback(
    async (key: string, text: string): Promise<boolean> => {
      if (!text) return false;
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        return false;
      }
      flashCopied(key);
      return true;
    },
    [flashCopied],
  );

  const sendFeedback = useCallback(
    (id: string, action: 'copy' | 'up' | 'down') => {
      if (!token) return;
      void feedbackTelecrmResponseCard(token, id, { action }).catch(() => undefined);
    },
    [token],
  );

  const copyResponse = useCallback(
    async (card: TelecrmResponseCardDto, idx: number) => {
      const text = card.responses[idx]?.[1];
      if (!text) return;
      if (await copyText(`${card.id}:${idx}`, text)) {
        sendFeedback(card.id, 'copy');
        onCardCopied(card.id);
      }
    },
    [copyText, onCardCopied, sendFeedback],
  );

  const askCoach = useCallback(
    (card: TelecrmResponseCardDto) => {
      if (!token) return;
      setCoach((prev) => ({ ...prev, [card.id]: { busy: true, result: null, error: null, voted: null } }));
      coachTelecrmResponseCardsStream(
        token,
        { q: q || cardLabel(card), cardIds: [card.id], customer: JSON.parse(customerKey) as TelecrmResponseCardCustomer },
        { operatingCompanyId },
      )
        .then((result) => setCoach((prev) => ({ ...prev, [card.id]: { busy: false, result, error: null, voted: null } })))
        .catch((e) =>
          setCoach((prev) => ({
            ...prev,
            [card.id]: {
              busy: false,
              result: null,
              error: e instanceof Error ? e.message : 'AI 코치가 답하지 못했어요.',
              voted: null,
            },
          })),
        );
    },
    [token, q, customerKey, operatingCompanyId],
  );

  // 펼친 카드가 보이게
  useEffect(() => {
    if (!openCardId) return;
    const el = listRef.current?.querySelector<HTMLElement>(`[data-card="${openCardId}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [openCardId, rows.length]);

  // 키보드: 찾기 칸에서 ↓ 로 목록, 목록에서 ↑↓ 이동, 1~4 로 펼친 카드의 문장 복사
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
      if (document.querySelector('[role="dialog"],[aria-modal="true"]')) return;
      const target = e.target instanceof HTMLElement ? e.target : null;
      const rowBtns = () => [...(listRef.current?.querySelectorAll<HTMLButtonElement>('button[data-card-row]') ?? [])];
      const inSearch = target?.getAttribute('data-crm-script-search') === '1';
      if (inSearch && e.key === 'ArrowDown') {
        const first = rowBtns()[0];
        if (first) {
          e.preventDefault();
          first.focus();
        }
        return;
      }
      if (target?.hasAttribute('data-card-row') && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
        const all = rowBtns();
        const next = all[all.indexOf(target as HTMLButtonElement) + (e.key === 'ArrowDown' ? 1 : -1)];
        if (next) {
          e.preventDefault();
          next.focus();
        }
        return;
      }
      const tag = target?.tagName;
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || Boolean(target?.isContentEditable);
      if (!typing && openCardId && /^[1-4]$/.test(e.key)) {
        const card = cards.find((c) => c.id === openCardId) ?? found?.find((c) => c.id === openCardId);
        if (card?.responses[Number(e.key) - 1]) {
          e.preventDefault();
          void copyResponse(card, Number(e.key) - 1);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [cards, found, openCardId, copyResponse]);

  const chip = (name: string, count: number) => {
    const on = cat === name;
    return (
      <button
        key={name}
        type="button"
        aria-pressed={on}
        onClick={() => setCat(name)}
        className={`inline-flex h-7 shrink-0 items-center gap-1 rounded-full border px-2.5 text-fluid-2xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 ${
          on ? 'border-[#6d28d9] bg-[#6d28d9] text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-violet-50'
        }`}
      >
        {name}
        <span className="font-normal">{count}</span>
      </button>
    );
  };

  const cardRow = (card: TelecrmResponseCardDto) => {
    const open = openCardId === card.id;
    const state = coach[card.id];
    return (
      <article
        key={card.id}
        data-card={card.id}
        className={`rounded-xl border bg-white ${open ? 'border-violet-400' : 'border-slate-200'}`}
      >
        <button
          type="button"
          data-card-row
          aria-expanded={open}
          onClick={() => onOpenCard(open ? null : card.id)}
          className="flex min-h-[46px] w-full items-center gap-2 rounded-xl px-3 py-2 text-left hover:bg-violet-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
        >
          <span className="shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-bold text-slate-600">
            {card.category}
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-fluid-sm font-bold text-slate-900">
              <Mark text={card.title} q={q} />
            </span>
            {card.triggers.length > 0 ? (
              <span className="truncate text-fluid-2xs text-slate-600">
                {card.triggers.map((t) => `「${t}」`).join(' · ')}
              </span>
            ) : null}
          </span>
          {card.wonInCall ? (
            <span className="shrink-0 rounded-md bg-emerald-100 px-1.5 py-0.5 text-[11px] font-bold text-emerald-800">
              예약 성사
            </span>
          ) : null}
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className={`h-3.5 w-3.5 shrink-0 text-slate-500 ${open ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>

        {open ? (
          <div className="space-y-2 px-3 pb-3 pt-0.5">
            {card.responses.map(([style, text], idx) => (
              <div key={`${style}-${idx}`} className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2">
                <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-violet-100 text-[11px] font-bold text-[#5b21b6]">
                  {idx + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-fluid-2xs font-bold text-[#5b21b6]">{style}</p>
                  <p className="whitespace-pre-wrap text-slate-900" style={bodyStyle}>
                    <Mark text={text} q={q} />
                  </p>
                </div>
                <CopyBtn active={copied === `${card.id}:${idx}`} onClick={() => void copyResponse(card, idx)} />
              </div>
            ))}
            {card.avoid.length > 0 ? (
              <p className="text-fluid-2xs leading-relaxed text-red-700">
                <b>피할 말</b> {card.avoid.join(' · ')}
              </p>
            ) : null}
            {card.rule ? (
              <p className="text-fluid-2xs leading-relaxed text-amber-800">
                <b>기준</b> {card.rule}
              </p>
            ) : null}

            {!state ? (
              <button
                type="button"
                onClick={() => askCoach(card)}
                className="inline-flex h-8 items-center rounded-lg border border-violet-300 bg-white px-2.5 text-fluid-2xs font-bold text-[#5b21b6] hover:bg-violet-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
              >
                AI 코치에게 이 고객에 맞게 물어보기
              </button>
            ) : (
              <div className="space-y-1.5 rounded-lg border border-violet-200 bg-violet-50/70 px-2.5 py-2">
                <p className="text-fluid-2xs font-bold text-[#5b21b6]">
                  AI 코치 · 지금 이 고객에게{state.busy ? ' · 생각 중…' : ''}
                </p>
                {state.error ? <p className="text-fluid-2xs text-red-700">{state.error}</p> : null}
                {state.result?.suggestions.map((s, idx) => (
                  <div key={`${s.label}-${idx}`} className="flex items-start gap-2 rounded-lg bg-white px-2 py-1.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-fluid-2xs font-bold text-[#5b21b6]">{s.label}</p>
                      <p className="whitespace-pre-wrap text-slate-900" style={bodyStyle}>
                        {s.text}
                      </p>
                    </div>
                    <CopyBtn
                      active={copied === `coach:${card.id}:${idx}`}
                      onClick={() => void copyText(`coach:${card.id}:${idx}`, s.text)}
                    />
                  </div>
                ))}
                {state.result?.nextQuestion ? (
                  <p className="text-fluid-2xs text-slate-700">
                    <b>다음에 물어볼 것</b> {state.result.nextQuestion}
                  </p>
                ) : null}
                {state.result ? (
                  <div className="flex items-center gap-1.5 text-fluid-2xs text-slate-600">
                    도움이 됐나요?
                    {(['up', 'down'] as const).map((v) => (
                      <button
                        key={v}
                        type="button"
                        disabled={state.voted != null}
                        onClick={() => {
                          sendFeedback(card.id, v);
                          setCoach((prev) => ({ ...prev, [card.id]: { ...state, voted: v } }));
                        }}
                        className={`inline-flex h-6 items-center rounded-md border px-2 font-semibold disabled:cursor-default ${
                          state.voted === v
                            ? 'border-[#6d28d9] bg-[#6d28d9] text-white'
                            : 'border-slate-300 bg-white text-slate-700 hover:bg-violet-50 disabled:opacity-50'
                        }`}
                      >
                        {v === 'up' ? '네' : '아니요'}
                      </button>
                    ))}
                    {!state.busy ? (
                      <button
                        type="button"
                        onClick={() => askCoach(card)}
                        className="ml-auto inline-flex h-6 items-center rounded-md px-1.5 font-semibold text-[#5b21b6] hover:bg-white"
                      >
                        다시 묻기
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            )}
          </div>
        ) : null}
      </article>
    );
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b border-violet-100 px-2 py-1.5">
        <div className="flex flex-wrap gap-1">{cats.map((c) => chip(c.name, c.count))}</div>
      </div>

      <div ref={listRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto px-2 py-2">
        {!q && cat === ALL && frequent.items.length > 0 ? (
          <div className="space-y-1.5 rounded-xl bg-violet-50 px-2.5 py-2">
            <p className="text-fluid-2xs">
              <b className="text-[#5b21b6]">{frequent.mine ? '내가 자주 쓰는 것' : '우리 업체가 자주 쓰는 것'}</b>
              <span className="ml-1.5 text-slate-600">복사를 많이 한 순서</span>
            </p>
            <div className="grid grid-cols-2 gap-1">
              {frequent.items.map((card) => (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => {
                    setCat(ALL);
                    onOpenCard(card.id);
                  }}
                  className="h-8 truncate rounded-lg border border-violet-200 bg-white px-2 text-left text-fluid-xs text-slate-900 hover:bg-violet-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
                >
                  {cardLabel(card)}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <p className="px-0.5 pt-0.5 text-fluid-2xs">
          <b className="text-slate-700">{q || cat !== ALL ? `찾은 카드 ${rows.length}장` : `전체 카드 ${rows.length}장`}</b>
          {finding ? <span className="ml-1.5 text-slate-500">뜻이 비슷한 카드도 찾는 중…</span> : null}
          {!q && cat === ALL && stageFirst.length > 0 && stageLabel ? (
            <span className="ml-1.5 text-slate-600">
              지금 「{stageLabel}」 단계라 {stageFirst.join('·')} 카드를 먼저 보여 줘요
            </span>
          ) : null}
        </p>

        {cardsLoading && cards.length === 0 ? (
          <p className="text-fluid-xs text-slate-500">대응 카드를 불러오는 중…</p>
        ) : cardsError && cards.length === 0 && !q ? (
          <p className="rounded-xl border border-dashed border-slate-300 px-3 py-3 text-fluid-xs leading-relaxed text-slate-700">
            카드 목록을 불러오지 못했어요. 위 찾기 칸에 고객 말을 치면 카드를 찾을 수 있어요.
          </p>
        ) : rows.length === 0 && !finding ? (
          <p className="rounded-xl border border-dashed border-slate-300 px-3 py-3 text-fluid-xs leading-relaxed text-slate-700">
            {q
              ? `「${q}」와 맞는 카드가 없어요. 다른 말로 쳐 보세요. 못 찾은 검색어는 설정의 「카드 없던 검색」에 모여요.`
              : '사용 중인 대응 카드가 아직 없어요. 설정 › 대응 카드에서 불러오고 승인해 주세요.'}
          </p>
        ) : (
          rows.map(cardRow)
        )}

        {!q && cat === ALL && oldReactions.length > 0 ? (
          <div className="space-y-1.5 pt-1">
            <p className="px-0.5 text-fluid-2xs font-bold text-slate-700">내 대본의 반응 버튼 {oldReactions.length}개</p>
            {oldReactions.map((r) => {
              const open = openOld === r.id;
              return (
                <article key={r.id} className={`rounded-xl border bg-white ${open ? 'border-violet-400' : 'border-slate-200'}`}>
                  <button
                    type="button"
                    data-card-row
                    aria-expanded={open}
                    onClick={() => {
                      setOpenOld(open ? null : r.id);
                      if (!open) onUseOldReaction(r.id);
                    }}
                    className="flex min-h-[40px] w-full items-center gap-2 rounded-xl px-3 py-1.5 text-left text-fluid-sm font-semibold text-slate-900 hover:bg-violet-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
                  >
                    <span className="min-w-0 flex-1">{r.label}</span>
                  </button>
                  {open ? (
                    <div className="flex items-start gap-2 px-3 pb-3">
                      <p className="min-w-0 flex-1 whitespace-pre-wrap text-slate-900" style={bodyStyle}>
                        {r.body || '(본문이 비어 있어요)'}
                      </p>
                      <CopyBtn active={copied === `old:${r.id}`} onClick={() => void copyText(`old:${r.id}`, r.body)} />
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        ) : null}

        {q ? scriptMatches : null}
      </div>
    </div>
  );
}
