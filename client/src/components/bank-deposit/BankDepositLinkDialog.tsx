import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  fetchBankDepositCandidates,
  linkBankDeposit,
  searchBankDepositTargets,
  type BankDepositCandidate,
  type BankDepositItem,
  type BankDepositKind,
} from '../../api/bankDeposits';
import { ModalCloseButton } from '../admin/ModalCloseButton';
import { Button } from '../ui/Button';
import { Tag } from '../ui/StatusChip';
import {
  DEPOSIT_KIND_LABEL,
  DEPOSIT_KIND_ORDER,
  kstDayLabel,
  kstTime,
  targetStatusLabel,
  won,
} from './bankDepositFormat';

function candidateKey(c: BankDepositCandidate): string {
  return `${c.target}:${c.id}`;
}

/** 금액이 어느 칸과 같은지로 종류를 짐작한다. 서버가 정해 준 값이 먼저다. */
function guessKind(c: BankDepositCandidate, amountWon: number): BankDepositKind {
  if (c.kind) return c.kind;
  if (c.depositWon != null && c.depositWon === amountWon) return 'DEPOSIT';
  if (c.balanceWon != null && c.balanceWon === amountWon) return 'BALANCE';
  if (c.totalWon != null && c.totalWon === amountWon) return 'TOTAL';
  return c.target === 'followup' ? 'DEPOSIT' : 'OTHER';
}

function CandidateRow({
  c,
  amountWon,
  selected,
  onSelect,
}: {
  c: BankDepositCandidate;
  amountWon: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const name = c.customerName?.trim() || (c.target === 'inquiry' ? '접수 고객' : '부재·보류 고객');
  const status = targetStatusLabel(c.target, c.status);
  const amounts: Array<{ label: string; value: number | null | undefined }> = [
    { label: '계약금', value: c.depositWon },
    { label: '잔금', value: c.balanceWon },
    { label: '총액', value: c.totalWon },
  ];
  const hasAmounts = amounts.some((a) => a.value != null && a.value > 0);
  return (
    <label
      className={`flex cursor-pointer items-start gap-2.5 rounded-xl border px-3 py-2.5 ${
        selected ? 'border-violet-400 bg-violet-50/60' : 'border-slate-200 bg-white hover:bg-slate-50'
      }`}
    >
      <input type="radio" name="deposit-target" checked={selected} onChange={onSelect} className="mt-1 accent-violet-700" />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
          <span className="text-fluid-sm font-bold text-slate-900">{name}</span>
          {c.nickname && c.nickname.trim() && c.nickname.trim() !== name ? (
            <span className="text-fluid-2xs text-slate-500">{c.nickname.trim()}</span>
          ) : null}
          <Tag>{c.target === 'inquiry' ? '접수' : '부재·보류'}</Tag>
          {status && status !== '접수' ? <Tag>{status}</Tag> : null}
          {c.phoneTail ? <span className="text-fluid-2xs tabular-nums text-slate-500">끝번호 {c.phoneTail}</span> : null}
        </span>
        {c.preferredDate || c.addressShort ? (
          <span className="mt-0.5 block truncate text-fluid-2xs text-slate-600">
            {[c.preferredDate ? `청소 ${kstDayLabel(c.preferredDate)}` : '', c.addressShort ?? ''].filter(Boolean).join(' · ')}
          </span>
        ) : null}
        {hasAmounts ? (
          <span className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-fluid-2xs tabular-nums text-slate-600">
            {amounts.map((a) =>
              a.value != null && a.value > 0 ? (
                <span key={a.label} className={a.value === amountWon ? 'font-bold text-emerald-700' : ''}>
                  {a.label} {won(a.value)}
                </span>
              ) : null,
            )}
          </span>
        ) : null}
        {c.reasons.length > 0 ? (
          <span className="mt-1 block text-fluid-2xs leading-relaxed text-slate-500">{c.reasons.join(' · ')}</span>
        ) : null}
      </span>
    </label>
  );
}

/** 입금 한 건을 어느 고객 것인지 골라 잇는다. 화면 가운데 창. */
export function BankDepositLinkDialog({
  token,
  deposit,
  onClose,
  onLinked,
}: {
  token: string;
  deposit: BankDepositItem;
  onClose: () => void;
  onLinked: () => void;
}) {
  const [candidates, setCandidates] = useState<BankDepositCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [searched, setSearched] = useState<BankDepositCandidate[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [kind, setKind] = useState<BankDepositKind>('DEPOSIT');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchBankDepositCandidates(token, deposit.id)
      .then((r) => {
        if (cancelled) return;
        setCandidates(r.candidates);
        const first = r.candidates[0];
        if (first && r.candidates.length === 1) {
          setSelectedKey(candidateKey(first));
          setKind(guessKind(first, deposit.amountWon));
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : '후보를 불러오지 못했어요.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, deposit.id, deposit.amountWon]);

  const shown = searched ?? candidates;
  const selected = useMemo(() => shown.find((c) => candidateKey(c) === selectedKey) ?? null, [shown, selectedKey]);

  const runSearch = async () => {
    const q = query.trim();
    if (!q) {
      setSearched(null);
      return;
    }
    setSearching(true);
    setError(null);
    try {
      const r = await searchBankDepositTargets(token, deposit.id, q);
      setSearched(r.candidates);
      setSelectedKey(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : '찾지 못했어요.');
    } finally {
      setSearching(false);
    }
  };

  const save = async () => {
    if (!selected || saving) return;
    setSaving(true);
    setError(null);
    try {
      await linkBankDeposit(token, deposit.id, {
        ...(selected.target === 'inquiry' ? { inquiryId: selected.id } : { followupId: selected.id }),
        kind,
      });
      onLinked();
    } catch (e) {
      setError(e instanceof Error ? e.message : '연결하지 못했어요.');
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="입금 고객 찾기">
      <button type="button" aria-label="닫기" onClick={onClose} className="absolute inset-0 cursor-default bg-slate-900/40" />
      <div className="relative flex max-h-[86vh] w-[min(560px,100%)] flex-col rounded-2xl bg-white shadow-2xl">
        <div className="border-b border-slate-200 px-4 py-3 pr-14">
          <p className="text-fluid-sm font-bold text-slate-900">누구의 입금인가요?</p>
          <p className="mt-1 text-fluid-xs text-slate-700">
            <span className="font-bold tabular-nums text-slate-900">{won(deposit.amountWon)}</span>
            <span className="mx-1.5 text-slate-300">|</span>
            <span className="font-semibold">{deposit.depositorName || '입금자명 없음'}</span>
            <span className="mx-1.5 text-slate-300">|</span>
            <span className="tabular-nums text-slate-500">
              {kstDayLabel(new Date(deposit.depositedAt).toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10))}{' '}
              {kstTime(deposit.depositedAt)}
            </span>
          </p>
          <ModalCloseButton onClick={onClose} />
        </div>

        <form
          className="flex items-center gap-2 border-b border-slate-100 px-4 py-2"
          onSubmit={(e) => {
            e.preventDefault();
            void runSearch();
          }}
        >
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="고객 이름 또는 전화 끝 4자리로 직접 찾기"
            className="h-9 min-w-0 flex-1 rounded-lg border border-slate-300 px-2.5 text-fluid-xs text-slate-900 placeholder:text-slate-400 focus:border-violet-500 focus:outline-none"
          />
          <Button type="submit" size="md" disabled={searching}>
            {searching ? '찾는 중' : '찾기'}
          </Button>
          {searched ? (
            <Button
              size="md"
              variant="quiet"
              onClick={() => {
                setSearched(null);
                setQuery('');
                setSelectedKey(null);
              }}
            >
              후보로 돌아가기
            </Button>
          ) : null}
        </form>

        <div className="min-h-[120px] flex-1 space-y-2 overflow-y-auto px-4 py-3">
          {loading ? (
            <p className="py-6 text-center text-fluid-xs text-slate-500">후보를 찾는 중이에요.</p>
          ) : shown.length === 0 ? (
            <p className="py-6 text-center text-fluid-xs leading-relaxed text-slate-500">
              {searched
                ? '그 이름이나 번호로는 찾지 못했어요.'
                : '이름이나 금액이 같은 고객을 찾지 못했어요. 위에서 직접 찾아 보세요.'}
            </p>
          ) : (
            <>
              {!searched ? (
                <p className="text-fluid-2xs text-slate-500">이름이나 금액이 같은 고객이에요. 맞는 고객을 고르세요.</p>
              ) : null}
              {shown.map((c) => (
                <CandidateRow
                  key={candidateKey(c)}
                  c={c}
                  amountWon={deposit.amountWon}
                  selected={candidateKey(c) === selectedKey}
                  onSelect={() => {
                    setSelectedKey(candidateKey(c));
                    setKind(guessKind(c, deposit.amountWon));
                  }}
                />
              ))}
            </>
          )}
        </div>

        <div className="border-t border-slate-200 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-fluid-2xs font-semibold text-slate-600">이 돈은</span>
            <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="입금 종류">
              {DEPOSIT_KIND_ORDER.map((k) => (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={kind === k}
                  onClick={() => setKind(k)}
                  className={`h-7 rounded-full border px-2.5 text-fluid-2xs font-semibold ${
                    kind === k
                      ? 'border-violet-600 bg-violet-600 text-white'
                      : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {DEPOSIT_KIND_LABEL[k]}
                </button>
              ))}
            </div>
          </div>
          {error ? <p className="mt-2 text-fluid-2xs text-rose-700">{error}</p> : null}
          <div className="mt-3 flex items-center justify-between gap-2">
            <p className="min-w-0 text-fluid-2xs leading-relaxed text-slate-500">
              연결해도 접수 상태는 바뀌지 않아요. 입금 표시만 붙습니다.
            </p>
            <div className="flex shrink-0 gap-2">
              <Button variant="quiet" onClick={onClose}>
                닫기
              </Button>
              <Button variant="primary" disabled={!selected || saving} onClick={() => void save()}>
                {saving ? '연결하는 중' : '연결하기'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
