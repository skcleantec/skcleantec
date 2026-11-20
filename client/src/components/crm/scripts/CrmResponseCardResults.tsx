import { useCallback, useEffect, useRef, useState } from 'react';
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

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  const timer = useRef<number | null>(null);
  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);
  const copy = useCallback(async (key: string, text: string) => {
    if (!text) return false;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      return false;
    }
    setCopied(key);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(null), 1500);
    return true;
  }, []);
  return { copied, copy };
}

function Highlight({ text, q }: { text: string; q: string }) {
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

/**
 * 상담 스크립트 검색 결과 위쪽 — 우리 자료로 만든 「대응 카드」(즉시) + 「AI 코치」(지금 고객에 맞춘 답).
 * 기존 대본 검색 결과는 이 아래에 그대로 붙는다.
 */
export function CrmResponseCardResults({
  query,
  operatingCompanyId,
  customer,
}: {
  query: string;
  operatingCompanyId: string | null;
  customer: TelecrmResponseCardCustomer;
}) {
  const token = getToken();
  const q = query.trim();
  const [cards, setCards] = useState<TelecrmResponseCardDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [coach, setCoach] = useState<TelecrmResponseCoachResult | null>(null);
  const [coachBusy, setCoachBusy] = useState(false);
  const [coachError, setCoachError] = useState<string | null>(null);
  const [voted, setVoted] = useState<'up' | 'down' | null>(null);
  const { copied, copy } = useCopy();
  const customerKey = JSON.stringify(customer);

  // 1단계: 카드 — 치는 동안 짧게 기다렸다가 바로
  useEffect(() => {
    setShowAll(false);
    if (!token || q.length < 1) {
      setCards([]);
      return;
    }
    let alive = true;
    setLoading(true);
    const timer = window.setTimeout(() => {
      searchTelecrmResponseCards(token, q, operatingCompanyId)
        .then((res) => {
          if (!alive) return;
          setCards(res.items ?? []);
          setError(null);
        })
        .catch((e) => {
          if (!alive) return;
          setCards([]);
          setError(e instanceof Error ? e.message : '대응 카드를 찾지 못했어요.');
        })
        .finally(() => alive && setLoading(false));
    }, 220);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [token, q, operatingCompanyId]);

  // 2단계: AI 코치 — 입력이 멈추고 카드가 나온 뒤 한 번
  useEffect(() => {
    setCoach(null);
    setCoachError(null);
    setVoted(null);
    if (!token || q.length < 2 || loading) return;
    let alive = true;
    const timer = window.setTimeout(() => {
      setCoachBusy(true);
      coachTelecrmResponseCardsStream(
        token,
        { q, cardIds: cards.slice(0, 4).map((c) => c.id), customer: JSON.parse(customerKey) as TelecrmResponseCardCustomer },
        { operatingCompanyId },
      )
        .then((res) => alive && setCoach(res))
        .catch((e) => alive && setCoachError(e instanceof Error ? e.message : 'AI 코치가 답하지 못했어요.'))
        .finally(() => alive && setCoachBusy(false));
    }, 700);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [token, q, loading, cards, customerKey, operatingCompanyId]);

  const sendFeedback = (id: string, action: 'copy' | 'up' | 'down') => {
    if (!token) return;
    void feedbackTelecrmResponseCard(token, id, { action }).catch(() => undefined);
  };

  const copyCard = async (card: TelecrmResponseCardDto, idx: number, text: string) => {
    if (await copy(`${card.id}:${idx}`, text)) sendFeedback(card.id, 'copy');
  };

  const voteCoach = (action: 'up' | 'down') => {
    if (voted || !coach) return;
    setVoted(action);
    const ids = cards.filter((c) => coach.basedOn.includes(c.code)).map((c) => c.id);
    ids.forEach((id) => sendFeedback(id, action));
  };

  if (q.length < 1) return null;
  const visible = showAll ? cards : cards.slice(0, 3);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-fluid-xs font-semibold text-slate-700">
          대응 카드 {loading ? '찾는 중…' : `${cards.length}개`}
        </p>
        {cards.some((c) => c.wonInCall) ? (
          <span className="text-fluid-2xs text-slate-400">예약된 통화에서 쓴 카드 먼저</span>
        ) : null}
      </div>

      {error ? <p className="text-fluid-xs text-red-600">{error}</p> : null}
      {!loading && !error && cards.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-200 px-2 py-2 text-fluid-xs text-slate-500">
          「{q}」에 맞는 대응 카드가 아직 없어요. 아래 AI 코치 답과 내 대본을 참고하세요.
        </p>
      ) : null}

      {visible.map((card, cardIdx) => (
        <article
          key={card.id}
          className={`rounded-xl border bg-white px-2.5 py-2 ${
            cardIdx === 0 ? 'border-violet-300 shadow-[0_1px_0_#ede9fe]' : 'border-slate-200'
          }`}
        >
          <div className="mb-1 flex flex-wrap items-center gap-1">
            <span className="min-w-0 text-fluid-sm font-bold text-slate-900">
              <Highlight text={card.title} q={q} />
            </span>
            {card.wonInCall ? (
              <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10.5px] font-bold text-emerald-700">예약 성사에 쓰임</span>
            ) : null}
            {card.rule ? (
              <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[10.5px] font-bold text-amber-800">기준 있음</span>
            ) : null}
            <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10.5px] font-semibold text-slate-600">{card.category}</span>
          </div>
          {card.triggers.length ? (
            <p className="mb-1 text-fluid-2xs text-slate-500">
              고객이 이렇게 말하면:{' '}
              {card.triggers.slice(0, 3).map((t, i) => (
                <span key={t}>
                  {i ? ' · ' : ''}「<Highlight text={t} q={q} />」
                </span>
              ))}
            </p>
          ) : null}
          {card.responses.map(([style, text], i) => (
            <div key={`${style}-${i}`} className="flex items-start gap-2 border-t border-dashed border-slate-100 pt-1.5 mt-1.5 first-of-type:mt-0">
              <span className="w-14 shrink-0 pt-0.5 text-[10.5px] font-bold text-[#6d28d9]">{style}</span>
              <p className="min-w-0 flex-1 whitespace-pre-wrap text-slate-800" style={bodyStyle}>
                {text}
              </p>
              <CopyBtn active={copied === `${card.id}:${i}`} onClick={() => void copyCard(card, i, text)} />
            </div>
          ))}
          {card.avoid.length ? (
            <p className="mt-1.5 text-fluid-2xs text-red-700">✕ 피할 말: {card.avoid.join(' · ')}</p>
          ) : null}
          {card.rule ? <p className="mt-1 text-fluid-2xs text-amber-800">기준: {card.rule}</p> : null}
          {card.sources.length ? (
            <p className="mt-1 text-[10.5px] text-slate-400">근거 · {card.sources.join(', ')}</p>
          ) : null}
        </article>
      ))}
      {cards.length > 3 && !showAll ? (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="w-full rounded-lg border border-slate-200 bg-white py-1.5 text-fluid-2xs font-semibold text-slate-600 hover:bg-slate-50"
        >
          카드 {cards.length - 3}개 더 보기
        </button>
      ) : null}

      {q.length >= 2 ? (
        <section className="rounded-xl border border-violet-200 bg-[#faf9ff] px-2.5 py-2">
          <div className="mb-1.5 flex items-center gap-1.5">
            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-[#6d28d9] text-[11px] text-white">✦</span>
            <span className="text-fluid-xs font-bold text-slate-900">AI 코치 · 지금 이 고객에게</span>
            {coachBusy ? <span className="text-fluid-2xs text-violet-600">생각 중…</span> : null}
          </div>
          {coachError ? <p className="text-fluid-xs text-red-600">{coachError}</p> : null}
          {coachBusy && !coach ? (
            <div className="space-y-1.5" aria-hidden>
              <div className="h-3 w-4/5 animate-pulse rounded bg-violet-100" />
              <div className="h-3 w-3/5 animate-pulse rounded bg-violet-100" />
            </div>
          ) : null}
          {coach ? (
            <div className="space-y-1.5">
              {coach.suggestions.map((s, i) => (
                <div key={`${s.label}-${i}`} className="rounded-lg border border-violet-100 bg-white px-2 py-1.5">
                  <div className="mb-0.5 flex items-center justify-between gap-2">
                    <span className="text-[10.5px] font-bold text-[#6d28d9]">
                      추천 {i + 1} · {s.label}
                    </span>
                    <CopyBtn active={copied === `coach:${i}`} onClick={() => void copy(`coach:${i}`, s.text)} />
                  </div>
                  <p className="whitespace-pre-wrap text-slate-800" style={bodyStyle}>
                    {s.text}
                  </p>
                </div>
              ))}
              {coach.nextQuestion ? (
                <div className="rounded-lg bg-indigo-50 px-2 py-1.5 text-fluid-xs text-slate-800">
                  <b>다음에 물어볼 것</b>
                  <br />
                  {coach.nextQuestion}
                </div>
              ) : null}
              <div className="flex items-center gap-1.5 text-fluid-2xs text-slate-500">
                도움이 됐나요?
                <button
                  type="button"
                  disabled={Boolean(voted)}
                  onClick={() => voteCoach('up')}
                  className={`rounded-md border px-1.5 py-0.5 ${voted === 'up' ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-white'}`}
                  aria-label="도움이 됐어요"
                >
                  👍
                </button>
                <button
                  type="button"
                  disabled={Boolean(voted)}
                  onClick={() => voteCoach('down')}
                  className={`rounded-md border px-1.5 py-0.5 ${voted === 'down' ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white'}`}
                  aria-label="별로예요"
                >
                  👎
                </button>
                {coach.basedOn.length ? <span className="ml-auto text-slate-400">근거 {coach.basedOn.join(', ')}</span> : null}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
