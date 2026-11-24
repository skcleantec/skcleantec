import { useCallback, useEffect, useState } from 'react';
import {
  cancelDepositExpectation,
  fetchDepositExpectation,
  saveDepositExpectation,
  type TeamDepositExpectation,
} from '../../api/teamBankDeposits';
import { useHasTenantFeature } from '../../hooks/useTenantCapabilities';
import { useTeamBankDepositRealtime } from '../../hooks/useTeamBankDepositRealtime';
import { Button } from '../ui/Button';
import { won } from './bankDepositFormat';

/**
 * 팀장 접수 상세 — 잔금을 회사 계좌로 받기로 했을 때 입금자명을 적어 두면,
 * 입금 문자가 오는 순간 이 접수에 자동으로 연결된다.
 */
export function TeamDepositExpectationBox({ token, inquiryId }: { token: string | null; inquiryId: string }) {
  const featureOn = useHasTenantFeature('mod_bank_deposit');
  const [loaded, setLoaded] = useState(false);
  const [expectation, setExpectation] = useState<TeamDepositExpectation | null>(null);
  const [defaults, setDefaults] = useState<{ depositorName: string; amountWon: number | null }>({ depositorName: '', amountWon: null });
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const on = featureOn && Boolean(token) && Boolean(inquiryId);

  const load = useCallback(async () => {
    if (!on || !token) return;
    try {
      const r = await fetchDepositExpectation(token, inquiryId);
      setExpectation(r.expectation);
      setDefaults(r.defaults);
      setLoaded(true);
    } catch {
      setLoaded(false);
    }
  }, [on, token, inquiryId]);

  useEffect(() => {
    setLoaded(false);
    setEditing(false);
    void load();
  }, [load]);

  useTeamBankDepositRealtime(
    token,
    (p) => {
      if ((p.event === 'expectation_matched' || p.event === 'balance_received') && p.inquiryId === inquiryId) void load();
    },
    on,
  );

  if (!on || !loaded) return null;

  const startEdit = () => {
    setName(expectation?.depositorName ?? defaults.depositorName ?? '');
    const a = expectation?.amountWon ?? defaults.amountWon;
    setAmount(a != null && a > 0 ? a.toLocaleString('ko-KR') : '');
    setError(null);
    setEditing(true);
  };

  const save = async () => {
    const amountWon = Number(amount.replace(/[^\d]/g, ''));
    if (!name.trim() || !Number.isFinite(amountWon) || amountWon <= 0) {
      setError('입금자명과 금액을 적어 주세요.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await saveDepositExpectation(token!, inquiryId, { depositorName: name.trim(), amountWon });
      setExpectation(r.expectation);
      setEditing(false);
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장하지 못했어요.');
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    setBusy(true);
    setError(null);
    try {
      await cancelDepositExpectation(token!, inquiryId);
      setExpectation(null);
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '취소하지 못했어요.');
    } finally {
      setBusy(false);
    }
  };

  if (expectation?.status === 'MATCHED') {
    return (
      <div className="rounded-xl border border-[#a9dfc1] bg-[#e3f6ec] px-3 py-2.5">
        <p className="text-fluid-xs font-bold text-[#126b3f]">✓ 회사 입금 확인됨 · {won(expectation.amountWon)}</p>
        <p className="mt-0.5 text-fluid-2xs text-[#126b3f]">입금자 {expectation.depositorName}</p>
      </div>
    );
  }

  if (editing) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
        <p className="text-fluid-xs font-bold text-slate-900">회사 계좌로 입금받기</p>
        <p className="mt-0.5 text-fluid-2xs leading-relaxed text-slate-600">
          고객이 보낼 때 쓰는 이름 그대로 적어 주세요. 이름과 금액이 같은 입금이 오면 자동으로 확인됩니다.
        </p>
        <div className="mt-2 grid gap-2">
          <label className="grid gap-1 text-fluid-2xs font-semibold text-slate-600">
            입금자명
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-11 rounded-[10px] border border-slate-300 px-3 text-fluid-sm font-medium text-slate-900"
              autoComplete="off"
            />
          </label>
          <label className="grid gap-1 text-fluid-2xs font-semibold text-slate-600">
            입금받을 금액
            <input
              value={amount}
              onChange={(e) => {
                const digits = e.target.value.replace(/[^\d]/g, '');
                setAmount(digits ? Number(digits).toLocaleString('ko-KR') : '');
              }}
              inputMode="numeric"
              className="h-11 rounded-[10px] border border-slate-300 px-3 text-fluid-sm font-medium tabular-nums text-slate-900"
            />
          </label>
        </div>
        {error ? <p className="mt-2 text-fluid-2xs text-rose-700">{error}</p> : null}
        <div className="mt-3 flex gap-2">
          <Button variant="primary" size="lg" className="flex-1" onClick={() => void save()} disabled={busy}>
            {busy ? '저장하는 중' : '입금 대기로 두기'}
          </Button>
          <Button size="lg" onClick={() => setEditing(false)} disabled={busy}>
            닫기
          </Button>
        </div>
      </div>
    );
  }

  if (expectation?.status === 'WAITING') {
    return (
      <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className="size-2 shrink-0 animate-pulse rounded-full bg-amber-500" aria-hidden />
          <p className="min-w-0 flex-1 text-fluid-xs font-bold text-amber-950">
            회사 입금 기다리는 중 · {won(expectation.amountWon)}
          </p>
        </div>
        <p className="mt-0.5 text-fluid-2xs text-amber-900">입금자 {expectation.depositorName} · 들어오면 바로 알려 드려요.</p>
        {error ? <p className="mt-1 text-fluid-2xs text-rose-700">{error}</p> : null}
        <div className="mt-2 flex gap-2">
          <Button size="sm" onClick={startEdit} disabled={busy}>
            이름·금액 고치기
          </Button>
          <Button size="sm" variant="quiet" onClick={() => void cancel()} disabled={busy}>
            대기 취소
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-xl border border-dashed border-slate-300 px-3 py-2.5">
      <p className="min-w-0 flex-1 text-fluid-2xs leading-relaxed text-slate-600">
        잔금을 회사 계좌로 받기로 했나요? 입금자명을 적어 두면 입금되는 순간 알려 드려요.
      </p>
      <Button size="sm" onClick={startEdit}>
        회사 계좌로 입금받기
      </Button>
    </div>
  );
}
