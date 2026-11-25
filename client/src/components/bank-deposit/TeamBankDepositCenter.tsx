import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  claimTeamBankDeposit,
  declineTeamBankDeposit,
  fetchMyBankDepositInquiries,
  fetchOpenTeamBankDeposits,
  type TeamBankDepositMine,
  type TeamBankDepositOpenItem,
  type TeamDepositMismatchReason,
} from '../../api/teamBankDeposits';
import { useTeamBankDepositRealtime } from '../../hooks/useTeamBankDepositRealtime';
import { Button } from '../ui/Button';
import { LineMdIcon } from '../ui/LineMdIcon';
import { kstDayLabel, kstTime, won } from './bankDepositFormat';

type Paid = { title: string; sub: string; customerName: string; amountWon: number; depositorName?: string; at?: string };

const REASONS: Array<{ id: TeamDepositMismatchReason; label: string }> = [
  { id: 'EXTRA_INCLUDED', label: '추가금이 포함됐어요' },
  { id: 'PARTIAL', label: '일부만 들어왔어요' },
  { id: 'OTHER', label: '다른 이유예요' },
];

/** 잠깐 내려놓기 — 3분 뒤 다시 뜨고, 한 입금에 5번까지. 앱을 껐다 켜도 남게 폰에 적어 둔다. */
const HOLD_MS = 3 * 60 * 1000;
const HOLD_MAX = 5;
const HOLD_KEY = 'cbiseo.teamDepositHold.v1';
type HoldMap = Record<string, { count: number; until: number }>;

function readHolds(): HoldMap {
  try {
    const raw = localStorage.getItem(HOLD_KEY);
    const parsed = raw ? (JSON.parse(raw) as HoldMap) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeHolds(map: HoldMap) {
  try {
    localStorage.setItem(HOLD_KEY, JSON.stringify(map));
  } catch {
    /* 저장이 막힌 폰에서는 화면을 닫을 때까지만 기억한다 */
  }
}

function mmss(ms: number): string {
  const sec = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}

function ymdKst(iso: string): string {
  return new Date(iso).toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10);
}

function Sheet({ children, label, onBackdrop }: { children: React.ReactNode; label: string; onBackdrop?: () => void }) {
  return createPortal(
    <div
      className="fixed inset-0 z-[139] flex items-center justify-center bg-slate-900/55 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={label}
    >
      {onBackdrop ? <button type="button" aria-label="닫기" onClick={onBackdrop} className="absolute inset-0 cursor-default" /> : null}
      <div className="relative flex max-h-[88dvh] w-full max-w-[400px] flex-col rounded-[20px] border border-slate-200 bg-white shadow-2xl">
        {children}
      </div>
    </div>,
    document.body,
  );
}

function DepositFacts({ item }: { item: TeamBankDepositOpenItem }) {
  return (
    <div className="rounded-[16px] bg-[#F4F6FA] px-4 py-3">
      <p className="tabular-nums text-[#0F172A]" style={{ fontSize: 28, fontWeight: 800, lineHeight: 1.2 }}>
        {won(item.amountWon)}
      </p>
      <p className="mt-1 text-fluid-sm font-semibold text-slate-900">입금자 {item.depositorName || '이름 없음'}</p>
      <p className="mt-0.5 text-fluid-2xs tabular-nums text-slate-500">
        {kstDayLabel(ymdKst(item.depositedAt))} {kstTime(item.depositedAt)}
        {item.operatingCompanyName ? ` · ${item.operatingCompanyName}` : ''}
      </p>
    </div>
  );
}

/** 주인 없는 입금 한 건 — 내 고객인지 확인하는 3단계. 내 배정 접수를 골라야만 확인된다. */
function ClaimFlow({
  token,
  item,
  position,
  onDone,
  onLater,
  holdsLeft,
  heldBefore,
  onHold,
}: {
  token: string;
  item: TeamBankDepositOpenItem;
  position: string;
  onDone: () => void;
  onLater: () => void;
  /** 잠깐 내려놓기를 더 쓸 수 있는 횟수 */
  holdsLeft: number;
  /** 한 번 이상 내려놨다가 다시 뜬 입금 */
  heldBefore: boolean;
  onHold: () => void;
}) {
  const [step, setStep] = useState<'ask' | 'decline' | 'pick' | 'confirm'>('ask');
  const [mine, setMine] = useState<TeamBankDepositMine[] | null>(null);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [reason, setReason] = useState<TeamDepositMismatchReason | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    setStep('ask');
    setMine(null);
    setPickedId(null);
    setReason(null);
    setError(null);
    setQuery('');
  }, [item.id]);

  /** 이름·주소·금액으로 내 접수 찾기. 금액이 같은 건을 위로. */
  const shownMine = useMemo(() => {
    if (!mine) return null;
    const q = query.trim().replace(/\s+/g, '');
    const digits = q.replace(/[^0-9]/g, '');
    const list = q
      ? mine.filter((m) => {
          const text = `${m.customerName}${m.addressShort ?? ''}`.replace(/\s+/g, '');
          if (text.includes(q)) return true;
          return digits.length >= 2 && m.balanceWon != null && String(m.balanceWon).includes(digits);
        })
      : mine;
    return [...list].sort((a, b) => Number(b.amountMatch) - Number(a.amountMatch));
  }, [mine, query]);

  const picked = useMemo(() => mine?.find((m) => m.inquiryId === pickedId) ?? null, [mine, pickedId]);
  const needsReason = Boolean(picked && !picked.amountMatch);
  const diff = picked && picked.balanceWon != null ? item.amountWon - picked.balanceWon : null;

  const openPick = async () => {
    setStep('pick');
    setError(null);
    try {
      const r = await fetchMyBankDepositInquiries(token, item.id);
      setMine(r.items);
      const exact = r.items.filter((m) => m.amountMatch);
      if (exact.length === 1) setPickedId(exact[0].inquiryId);
    } catch (e) {
      setMine([]);
      setError(e instanceof Error ? e.message : '내 접수를 불러오지 못했어요.');
    }
  };

  const decline = async () => {
    setBusy(true);
    setError(null);
    try {
      await declineTeamBankDeposit(token, item.id);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : '처리하지 못했어요.');
    } finally {
      setBusy(false);
    }
  };

  const claim = async () => {
    if (!picked) return;
    setBusy(true);
    setError(null);
    try {
      await claimTeamBankDeposit(token, item.id, {
        inquiryId: picked.inquiryId,
        kind: 'BALANCE',
        ...(needsReason && reason ? { mismatchReason: reason } : {}),
      });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : '연결하지 못했어요.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet label="누구 고객 입금인지 확인">
      <div className="flex items-center gap-2 px-5 pt-5">
        <p className="min-w-0 flex-1 text-fluid-base font-bold text-[#0F172A]">
          {step === 'pick'
            ? '어느 고객의 입금인가요?'
            : step === 'confirm'
              ? '이대로 연결할까요?'
              : heldBefore
                ? '아직 확인이 안 된 입금이 있어요'
                : '누구 고객 입금인지 확인해 주세요'}
        </p>
        {position ? <span className="shrink-0 text-fluid-2xs tabular-nums text-slate-500">{position}</span> : null}
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
        <DepositFacts item={item} />

        {step === 'ask' ? (
          <p className="text-fluid-xs leading-relaxed text-slate-600">
            회사 통장에 들어온 돈인데 어느 접수인지 찾지 못했어요. 팀장님 고객이 보낸 잔금이면 알려 주세요. 모든 팀장에게 같은 알림이 갑니다.
          </p>
        ) : null}

        {step === 'decline' ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-fluid-xs leading-relaxed text-amber-950">
            내 고객이 아니라고 하면 이 입금은 더 이상 알림이 오지 않아요. 입금자 이름과 금액을 한 번 더 봐 주세요.
          </p>
        ) : null}

        {step === 'pick' ? (
          mine == null ? (
            <p className="py-4 text-center text-fluid-xs text-slate-500">내 접수를 찾는 중이에요.</p>
          ) : mine.length === 0 ? (
            <p className="rounded-xl bg-slate-50 px-3 py-3 text-fluid-xs leading-relaxed text-slate-600">
              최근 일주일 안에 잔금을 받을 내 접수가 없어요. 내 고객 입금이 맞다면 사무실에 알려 주세요.
            </p>
          ) : (
            <>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="이름·주소·금액으로 찾기"
              aria-label="내 접수에서 찾기"
              className="h-11 w-full rounded-[12px] border border-slate-300 bg-white px-3 text-fluid-sm outline-none focus-visible:border-[#6d28d9] focus-visible:ring-2 focus-visible:ring-violet-200"
            />
            {shownMine && shownMine.length === 0 ? (
              <p className="rounded-xl bg-slate-50 px-3 py-3 text-fluid-xs leading-relaxed text-slate-600">
                「{query.trim()}」에 맞는 내 접수가 없어요. 다른 글자로 찾아보세요.
              </p>
            ) : null}
            <ul className="space-y-2">
              {(shownMine ?? []).map((m) => {
                const on = m.inquiryId === pickedId;
                return (
                  <li key={m.inquiryId}>
                    <button
                      type="button"
                      onClick={() => {
                        setPickedId(m.inquiryId);
                        setReason(null);
                      }}
                      aria-pressed={on}
                      className={`flex w-full items-start gap-3 rounded-[14px] border px-3 py-3 text-left ${
                        on ? 'border-[#111a2b] bg-slate-50 ring-1 ring-[#111a2b]' : 'border-slate-200 bg-white'
                      }`}
                    >
                      <span
                        className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border ${
                          on ? 'border-[#111a2b] bg-[#111a2b] text-white' : 'border-slate-300 bg-white text-transparent'
                        }`}
                        aria-hidden
                      >
                        <span className="text-[11px] font-black leading-none">✓</span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="text-fluid-sm font-bold text-slate-900">{m.customerName}</span>
                          {m.amountMatch ? (
                            <span className="rounded-full border border-[#a9dfc1] bg-[#e3f6ec] px-2 py-px text-[11px] font-bold text-[#126b3f]">금액 일치</span>
                          ) : null}
                          {m.hasExpectation ? (
                            <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-px text-[11px] font-semibold text-slate-600">입금 대기 중</span>
                          ) : null}
                        </span>
                        <span className="mt-0.5 block truncate text-fluid-2xs text-slate-600">
                          {[m.preferredDate ? `청소 ${kstDayLabel(m.preferredDate)}` : '', m.addressShort ?? ''].filter(Boolean).join(' · ')}
                        </span>
                        <span className="mt-0.5 block text-fluid-2xs tabular-nums text-slate-700">받을 잔금 {won(m.balanceWon)}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            </>
          )
        ) : null}

        {step === 'pick' && picked && needsReason ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-3">
            <p className="text-fluid-xs font-bold text-rose-900">
              금액이 달라요 · 입금 {won(item.amountWon)} / 받을 잔금 {won(picked.balanceWon)}
              {diff != null && diff !== 0 ? ` (${diff > 0 ? '+' : '−'}${won(Math.abs(diff))})` : ''}
            </p>
            <p className="mt-1 text-fluid-2xs text-rose-900">그래도 이 고객 입금이 맞다면 이유를 골라 주세요.</p>
            <div className="mt-2 flex flex-col gap-1.5">
              {REASONS.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  aria-pressed={reason === r.id}
                  onClick={() => setReason(r.id)}
                  className={`h-10 rounded-[10px] border px-3 text-left text-fluid-xs font-semibold ${
                    reason === r.id ? 'border-rose-700 bg-white text-rose-900 ring-1 ring-rose-700' : 'border-rose-200 bg-white text-slate-800'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {step === 'confirm' && picked ? (
          <dl className="grid grid-cols-[84px_1fr] gap-x-3 gap-y-2 rounded-[16px] border border-slate-200 px-4 py-3 text-fluid-xs">
            <dt className="text-slate-500">고객</dt>
            <dd className="text-right font-bold text-slate-900">{picked.customerName}</dd>
            <dt className="text-slate-500">청소일</dt>
            <dd className="text-right text-slate-900">{picked.preferredDate ? kstDayLabel(picked.preferredDate) : '—'}</dd>
            <dt className="text-slate-500">받을 잔금</dt>
            <dd className="text-right tabular-nums text-slate-900">{won(picked.balanceWon)}</dd>
            <dt className="text-slate-500">들어온 돈</dt>
            <dd className={`text-right font-bold tabular-nums ${needsReason ? 'text-rose-700' : 'text-[#126b3f]'}`}>{won(item.amountWon)}</dd>
            {needsReason && reason ? (
              <>
                <dt className="text-slate-500">다른 이유</dt>
                <dd className="text-right text-slate-900">{REASONS.find((r) => r.id === reason)?.label}</dd>
              </>
            ) : null}
          </dl>
        ) : null}
        {step === 'confirm' ? (
          <p className="text-fluid-2xs leading-relaxed text-slate-500">연결하면 사무실에 「팀장 확인」으로 표시되고, 다른 팀장의 알림은 사라집니다.</p>
        ) : null}

        {error ? <p className="text-fluid-xs text-rose-700">{error}</p> : null}
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-2 border-t border-slate-100 px-5 py-4">
        {step === 'ask' ? (
          <>
            <Button variant="primary" size="lg" className="h-[52px] w-full rounded-[14px]" onClick={() => void openPick()} disabled={busy}>
              내 고객 입금이에요
            </Button>
            <Button size="lg" className="h-[52px] w-full rounded-[14px]" onClick={() => setStep('decline')} disabled={busy}>
              내 건 아니에요
            </Button>
            {holdsLeft > 0 ? (
              <button
                type="button"
                onClick={onHold}
                disabled={busy}
                className="flex min-h-[46px] w-full min-w-0 flex-col items-center justify-center rounded-[12px] bg-slate-100 px-3 py-1.5 text-fluid-sm font-bold text-slate-800 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
              >
                <span>{heldBefore ? '조금 더 찾아볼게요' : '잠깐 내려놓고 찾아볼게요'}</span>
                <span className="text-fluid-2xs font-normal text-slate-500">3분 뒤 다시 떠요 · {holdsLeft}번 남음</span>
              </button>
            ) : (
              <p className="text-center text-fluid-2xs text-slate-500">내려놓기를 모두 썼어요. 둘 중 하나를 골라 주세요.</p>
            )}
            {error ? (
              <Button variant="quiet" size="md" className="w-full" onClick={onLater} disabled={busy}>
                잠시 뒤에 다시 볼게요
              </Button>
            ) : null}
          </>
        ) : null}
        {step === 'decline' ? (
          <>
            <Button variant="danger" size="lg" className="h-[52px] w-full rounded-[14px]" onClick={() => void decline()} disabled={busy}>
              {busy ? '처리하는 중' : '네, 내 고객이 아니에요'}
            </Button>
            <Button size="lg" className="h-[52px] w-full rounded-[14px]" onClick={() => setStep('ask')} disabled={busy}>
              다시 볼게요
            </Button>
          </>
        ) : null}
        {step === 'pick' ? (
          <>
            <Button
              variant="primary"
              size="lg"
              className="h-[52px] w-full rounded-[14px]"
              disabled={!picked || (needsReason && !reason)}
              onClick={() => setStep('confirm')}
            >
              다음
            </Button>
            <Button size="lg" className="h-[52px] w-full rounded-[14px]" onClick={() => setStep('ask')}>
              뒤로
            </Button>
          </>
        ) : null}
        {step === 'confirm' ? (
          <>
            <Button variant="primary" size="lg" className="h-[52px] w-full rounded-[14px]" onClick={() => void claim()} disabled={busy}>
              {busy ? '연결하는 중' : `${picked?.customerName ?? ''} 고객 잔금으로 연결`}
            </Button>
            <Button size="lg" className="h-[52px] w-full rounded-[14px]" onClick={() => setStep('pick')} disabled={busy}>
              뒤로
            </Button>
          </>
        ) : null}
      </div>
    </Sheet>
  );
}

/**
 * 팀장 화면 어디서나 떠 있는 입금 알림.
 * - 내 고객 잔금이 들어오면 가운데 팝업
 * - 주인 없는 입금이 있으면 위쪽 띠 + 확인 창
 */
export function TeamBankDepositCenter({ token, enabled }: { token: string | null; enabled: boolean }) {
  const [open, setOpen] = useState<TeamBankDepositOpenItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [paid, setPaid] = useState<Paid | null>(null);
  const [resolvedNote, setResolvedNote] = useState<string | null>(null);
  /** 오류로 잠깐 미룬 입금 — 다음 새로 고침(1분) 때 다시 뜬다 */
  const [snoozedId, setSnoozedId] = useState<string | null>(null);
  const [holds, setHolds] = useState<HoldMap>(() => readHolds());
  const [now, setNow] = useState(() => Date.now());
  const on = enabled && Boolean(token);

  const holdDeposit = useCallback((id: string) => {
    setHolds((prev) => {
      const next = { ...prev, [id]: { count: (prev[id]?.count ?? 0) + 1, until: Date.now() + HOLD_MS } };
      writeHolds(next);
      return next;
    });
    setNow(Date.now());
    setActiveId(null);
  }, []);

  const reopenDeposit = useCallback((id: string) => {
    setHolds((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev, [id]: { ...prev[id], until: 0 } };
      writeHolds(next);
      return next;
    });
    setActiveId(id);
  }, []);

  const load = useCallback(async () => {
    if (!on || !token) {
      setOpen([]);
      return;
    }
    try {
      const r = await fetchOpenTeamBankDeposits(token);
      setOpen(r.items);
      setSnoozedId(null);
      // 처리된 입금의 내려놓기 기록은 지운다.
      setHolds((prev) => {
        const ids = new Set(r.items.map((x) => x.id));
        const keep = Object.fromEntries(Object.entries(prev).filter(([id]) => ids.has(id)));
        if (Object.keys(keep).length === Object.keys(prev).length) return prev;
        writeHolds(keep);
        return keep;
      });
    } catch {
      /* 기능이 꺼졌거나 잠깐 실패 — 띠만 안 보인다 */
    }
  }, [on, token]);

  useEffect(() => {
    void load();
    if (!on) return;
    const t = setInterval(() => void load(), 60000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void load();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [load, on]);

  useTeamBankDepositRealtime(
    token,
    (p) => {
      if (p.event === 'balance_received') {
        setPaid({
          title: '잔금이 입금됐어요',
          sub: '회사 통장으로 들어온 것을 확인했어요.',
          customerName: p.customerName,
          amountWon: p.amountWon,
          depositorName: p.depositorName,
          at: p.depositedAt,
        });
        void load();
      } else if (p.event === 'expectation_matched') {
        setPaid({
          title: '입금 확인됐어요',
          sub: '기다리던 회사 입금이 들어왔어요.',
          customerName: p.customerName,
          amountWon: p.amountWon,
        });
        void load();
      } else if (p.event === 'open_new') {
        void load().then(() => setActiveId((cur) => cur ?? p.depositId));
      } else if (p.event === 'open_resolved') {
        setOpen((prev) => prev.filter((x) => x.id !== p.depositId));
        setActiveId((cur) => {
          if (cur === p.depositId) {
            setResolvedNote(`${p.resolvedByName || '다른 분'}이 확인했어요.`);
            return null;
          }
          return cur;
        });
      }
    },
    on,
  );

  useEffect(() => {
    if (!resolvedNote) return;
    const t = setTimeout(() => setResolvedNote(null), 5000);
    return () => clearTimeout(t);
  }, [resolvedNote]);

  const heldItems = open.filter((x) => (holds[x.id]?.until ?? 0) > now);
  const hasHeld = heldItems.length > 0;

  // 내려놓은 입금이 있는 동안만 1초마다 남은 시간을 고친다. 시간이 다 되면 다시 가운데로 뜬다.
  useEffect(() => {
    if (!hasHeld) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [hasHeld]);

  if (!on) return null;
  // 확인할 입금이 있으면 가운데 창이 항상 떠 있다. 고르거나, 잠깐 내려놓아야 닫힌다.
  const showable = (x: TeamBankDepositOpenItem) => x.id !== snoozedId && !((holds[x.id]?.until ?? 0) > now);
  const active = open.find((x) => x.id === activeId && showable(x)) ?? open.find(showable) ?? null;
  const held = heldItems[0] ?? null;
  const activeIndex = active ? open.findIndex((x) => x.id === active.id) : -1;

  return (
    <>
      {resolvedNote
        ? createPortal(
            <div role="status" className="fixed inset-x-4 bottom-24 z-[141] mx-auto max-w-[360px] rounded-xl bg-slate-900 px-4 py-3 text-center text-fluid-xs font-semibold text-white shadow-lg">
              {resolvedNote}
            </div>,
            document.body,
          )
        : null}

      {active && token && !paid ? (
        <ClaimFlow
          token={token}
          item={active}
          position={open.length > 1 ? `${activeIndex + 1} / ${open.length}` : ''}
          holdsLeft={Math.max(0, HOLD_MAX - (holds[active.id]?.count ?? 0))}
          heldBefore={(holds[active.id]?.count ?? 0) > 0}
          onHold={() => holdDeposit(active.id)}
          onLater={() => {
            setSnoozedId(active.id);
            setActiveId(null);
          }}
          onDone={() => {
            const rest = open.filter((x) => x.id !== active.id);
            setOpen(rest);
            setActiveId(rest[0]?.id ?? null);
            void load();
          }}
        />
      ) : null}

      {held && !paid
        ? createPortal(
            <div
              role="status"
              className="fixed inset-x-3 z-[138] mx-auto flex max-w-[420px] items-center gap-3 rounded-[16px] bg-[#1e1b4b] px-3.5 py-3 text-white shadow-2xl md:inset-x-auto md:right-5 md:mx-0 md:w-[380px]"
              style={{ bottom: 'calc(76px + env(safe-area-inset-bottom, 0px))' }}
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full border-[3px] border-violet-300 text-[11px] font-extrabold tabular-nums">
                {mmss((holds[held.id]?.until ?? 0) - now)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-fluid-sm font-bold tabular-nums">{won(held.amountWon)} 확인 대기</span>
                <span className="block truncate text-fluid-2xs text-violet-200">
                  입금자 {held.depositorName || '이름 없음'}
                  {heldItems.length > 1 ? ` · 외 ${heldItems.length - 1}건` : ''}
                </span>
              </span>
              <button
                type="button"
                onClick={() => reopenDeposit(held.id)}
                className="h-10 shrink-0 whitespace-nowrap rounded-[10px] bg-white px-3 text-fluid-xs font-extrabold text-[#4c1d95] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
              >
                다시 열기
              </button>
            </div>,
            document.body,
          )
        : null}

      {paid
        ? createPortal(
            <div className="fixed inset-0 z-[140] flex items-center justify-center bg-slate-900/55 p-4">
              <div
                className="w-full max-w-[390px] rounded-[20px] border border-slate-200 bg-white p-5 shadow-2xl"
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="team-deposit-paid-title"
              >
                <div className="flex flex-col items-center text-center">
                  <span className="flex size-14 items-center justify-center rounded-full bg-[#DCFCE7] text-[#15803D]">
                    <LineMdIcon name="confirm" className="size-7" />
                  </span>
                  <p id="team-deposit-paid-title" className="mt-3 text-fluid-lg font-bold text-[#0F172A]">
                    {paid.title}
                  </p>
                  <p className="mt-2 tabular-nums text-[#0F172A]" style={{ fontSize: 30, fontWeight: 800, lineHeight: 1.2 }}>
                    {won(paid.amountWon)}
                  </p>
                  <p className="mt-1 text-fluid-2xs text-slate-500">{paid.sub}</p>
                </div>
                <dl className="mt-5 grid grid-cols-[88px_1fr] gap-x-3 gap-y-2 rounded-[16px] bg-[#F4F6FA] px-3 py-3 text-fluid-xs">
                  <dt className="text-slate-500">고객</dt>
                  <dd className="text-right font-medium text-slate-900">{paid.customerName || '고객'}</dd>
                  {paid.depositorName ? (
                    <>
                      <dt className="text-slate-500">입금자</dt>
                      <dd className="text-right text-slate-900">{paid.depositorName}</dd>
                    </>
                  ) : null}
                  {paid.at ? (
                    <>
                      <dt className="text-slate-500">입금 시각</dt>
                      <dd className="text-right tabular-nums text-slate-900">
                        {kstDayLabel(ymdKst(paid.at))} {kstTime(paid.at)}
                      </dd>
                    </>
                  ) : null}
                </dl>
                <Button variant="primary" size="lg" className="mt-4 h-[54px] w-full rounded-[14px]" onClick={() => setPaid(null)}>
                  확인
                </Button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
