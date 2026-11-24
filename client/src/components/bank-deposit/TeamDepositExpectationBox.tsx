import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  cancelDepositExpectation,
  fetchDepositExpectation,
  saveDepositExpectation,
  type TeamDepositExpectation,
  type TeamDepositGuideAccount,
} from '../../api/teamBankDeposits';
import { useHasTenantFeature } from '../../hooks/useTenantCapabilities';
import { useTeamBankDepositRealtime } from '../../hooks/useTeamBankDepositRealtime';
import { Button } from '../ui/Button';
import { won } from './bankDepositFormat';

type State = {
  loaded: boolean;
  expectation: TeamDepositExpectation | null;
  defaults: { depositorName: string; amountWon: number | null };
  account: TeamDepositGuideAccount | null;
};

/** 팀장 접수 상세의 「계좌입금」 — 상태를 읽고, 창을 열고 닫는 데 쓴다. */
export function useTeamDepositExpectation(token: string | null, inquiryId: string, enabled = true) {
  const featureOn = useHasTenantFeature('mod_bank_deposit');
  const on = enabled && featureOn && Boolean(token) && Boolean(inquiryId);
  const [state, setState] = useState<State>({ loaded: false, expectation: null, defaults: { depositorName: '', amountWon: null }, account: null });
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    if (!on || !token) return;
    try {
      const r = await fetchDepositExpectation(token, inquiryId);
      setState({ loaded: true, expectation: r.expectation, defaults: r.defaults, account: r.account ?? null });
    } catch {
      setState((prev) => ({ ...prev, loaded: false }));
    }
  }, [on, token, inquiryId]);

  useEffect(() => {
    setState((prev) => ({ ...prev, loaded: false }));
    setOpen(false);
    void load();
  }, [load]);

  useTeamBankDepositRealtime(
    token,
    (p) => {
      if ((p.event === 'expectation_matched' || p.event === 'balance_received') && p.inquiryId === inquiryId) {
        setOpen(false);
        void load();
      }
    },
    on,
  );

  return { available: on && state.loaded, state, open, setOpen, reload: load };
}

export type TeamDepositExpectationCtl = ReturnType<typeof useTeamDepositExpectation>;

/** 가운데 창 — 안내할 계좌, 입금받을 금액, 입금자명을 적고 기다린다. */
export function TeamDepositRequestDialog({
  token,
  inquiryId,
  ctl,
}: {
  token: string;
  inquiryId: string;
  ctl: TeamDepositExpectationCtl;
}) {
  const { expectation, defaults, account } = ctl.state;
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!ctl.open) return;
    setName(expectation?.status === 'WAITING' ? expectation.depositorName : defaults.depositorName ?? '');
    const a = expectation?.status === 'WAITING' ? expectation.amountWon : defaults.amountWon;
    setAmount(a != null && a > 0 ? a.toLocaleString('ko-KR') : '');
    setError(null);
    setCopied(false);
    // 창을 열 때만 채운다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctl.open]);

  if (!ctl.open) return null;

  const amountWon = Number(amount.replace(/[^\d]/g, ''));
  const ready = Boolean(name.trim()) && Number.isFinite(amountWon) && amountWon > 0;

  const save = async () => {
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    try {
      await saveDepositExpectation(token, inquiryId, { depositorName: name.trim(), amountWon });
      await ctl.reload();
      ctl.setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장하지 못했어요.');
    } finally {
      setBusy(false);
    }
  };

  const copyAccount = async () => {
    if (!account) return;
    const text = `${account.bankName} ${account.accountNumber} ${account.accountHolder}`.trim();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
      setError('복사하지 못했어요. 계좌번호를 길게 눌러 복사해 주세요.');
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[138] flex items-center justify-center bg-slate-900/55 p-4" role="dialog" aria-modal="true" aria-label="회사 계좌로 입금받기">
      <button type="button" aria-label="닫기" onClick={() => ctl.setOpen(false)} className="absolute inset-0 cursor-default" />
      <div className="relative flex max-h-[88dvh] w-full max-w-[400px] flex-col rounded-[20px] border border-slate-200 bg-white shadow-2xl">
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-5">
          <p className="text-fluid-base font-bold text-[#0F172A]">회사 계좌로 입금받기</p>

          <div className="mt-3 rounded-[16px] bg-[#F4F6FA] px-4 py-3">
            <p className="text-fluid-2xs text-slate-500">고객에게 안내할 계좌</p>
            {account ? (
              <>
                <p className="mt-0.5 select-all text-fluid-base font-extrabold tabular-nums text-slate-900">
                  {account.bankName} {account.accountNumber}
                </p>
                <div className="mt-0.5 flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-fluid-2xs text-slate-600">예금주 {account.accountHolder}</span>
                  <Button size="sm" onClick={() => void copyAccount()}>
                    {copied ? '복사했어요' : '계좌 복사'}
                  </Button>
                </div>
              </>
            ) : (
              <p className="mt-0.5 text-fluid-xs leading-relaxed text-slate-600">
                안내할 계좌가 아직 등록되지 않았어요. 사무실에 계좌를 물어봐 주세요.
              </p>
            )}
          </div>

          <label className="mt-3 grid gap-1 text-fluid-2xs font-semibold text-slate-600">
            입금받을 금액
            <span className="relative">
              <input
                value={amount}
                onChange={(e) => {
                  const digits = e.target.value.replace(/[^\d]/g, '');
                  setAmount(digits ? Number(digits).toLocaleString('ko-KR') : '');
                }}
                inputMode="numeric"
                className="h-12 w-full rounded-[12px] border border-slate-300 pl-3 pr-9 text-fluid-base font-bold tabular-nums text-slate-900"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-fluid-xs font-medium text-slate-500">원</span>
            </span>
          </label>

          <label className="mt-3 grid gap-1 text-fluid-2xs font-semibold text-slate-600">
            <span>
              입금자명 <span className="font-medium text-slate-500">고객이 보내는 이름 그대로</span>
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-12 rounded-[12px] border border-slate-300 px-3 text-fluid-base font-bold text-slate-900"
              autoComplete="off"
            />
          </label>
          <p className="mt-1.5 text-fluid-2xs leading-relaxed text-slate-500">
            가족 이름이나 회사 이름으로 보내면 그 이름으로 고쳐 주세요. 이름과 금액이 같은 입금이 오면 자동으로 확인됩니다.
          </p>
          {error ? <p className="mt-2 text-fluid-xs text-rose-700">{error}</p> : null}
        </div>
        <div className="grid gap-2 px-5 py-4">
          <Button variant="primary" size="lg" className="h-[52px] w-full rounded-[14px]" disabled={!ready || busy} onClick={() => void save()}>
            {busy ? '저장하는 중' : expectation?.status === 'WAITING' ? '고쳐서 계속 기다리기' : '입금 기다리기'}
          </Button>
          <Button variant="quiet" size="md" className="w-full" onClick={() => ctl.setOpen(false)} disabled={busy}>
            닫기
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** 접수 상세 안의 상태 상자 — 기다리는 중·확인됨일 때만 보인다. */
export function TeamDepositExpectationBox({ token, inquiryId, ctl }: { token: string | null; inquiryId: string; ctl: TeamDepositExpectationCtl }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const expectation = ctl.state.expectation;
  if (!ctl.available || !token || !expectation) return null;

  if (expectation.status === 'MATCHED') {
    return (
      <div className="rounded-xl border border-[#a9dfc1] bg-[#e3f6ec] px-3 py-2.5">
        <p className="text-fluid-xs font-bold text-[#126b3f]">✓ 회사 입금 확인됨 · {won(expectation.amountWon)}</p>
        <p className="mt-0.5 text-fluid-2xs text-[#126b3f]">입금자 {expectation.depositorName}</p>
      </div>
    );
  }
  if (expectation.status !== 'WAITING') return null;

  const cancel = async () => {
    setBusy(true);
    setError(null);
    try {
      await cancelDepositExpectation(token, inquiryId);
      await ctl.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : '취소하지 못했어요.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5">
      <div className="flex items-center gap-2">
        <span className="size-2 shrink-0 animate-pulse rounded-full bg-amber-500" aria-hidden />
        <p className="min-w-0 flex-1 text-fluid-xs font-bold text-amber-950">회사 입금 기다리는 중 · {won(expectation.amountWon)}</p>
      </div>
      <p className="mt-0.5 text-fluid-2xs text-amber-900">입금자 {expectation.depositorName} · 들어오면 바로 알려 드려요.</p>
      {error ? <p className="mt-1 text-fluid-2xs text-rose-700">{error}</p> : null}
      <div className="mt-2 flex gap-2">
        <Button size="sm" onClick={() => ctl.setOpen(true)} disabled={busy}>
          이름·금액 고치기
        </Button>
        <Button size="sm" variant="quiet" onClick={() => void cancel()} disabled={busy}>
          대기 취소
        </Button>
      </div>
    </div>
  );
}
