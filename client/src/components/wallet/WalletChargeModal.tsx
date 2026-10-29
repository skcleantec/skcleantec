import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { TENANT_ALIMTALK_CHARGE_PRESETS_KRW, postTenantAlimtalkChargeRequest } from '../../api/alimtalk';
import { fetchReceiptWallet, type ReceiptWalletSummary } from '../../api/receiptWallet';
import { openTenantWalletWindow } from '../../api/tenantBilling';
import { useModalScrollKeyboardAvoidance } from '../../hooks/useMobileInputVisibility';
import { getToken } from '../../stores/auth';
import { bootstrapAuthMeFromLocal } from '../../api/authMeSnapshot';
import { LineMdIcon } from '../ui/LineMdIcon';

const TEST_AMOUNT = 1000;
const BTN =
  'min-h-11 w-full rounded-lg bg-slate-900 px-3 text-fluid-xs font-medium text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none sm:w-auto';
const GHOST =
  'min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-fluid-xs font-medium text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none';

function won(n: number): string {
  return `${n.toLocaleString('ko-KR')}원`;
}

function clock(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hour12: false });
}

export function WalletChargeModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { onFieldFocus } = useModalScrollKeyboardAvoidance(scrollRef, true);
  const admin = bootstrapAuthMeFromLocal(getToken() ?? '')?.role === 'ADMIN';
  const [summary, setSummary] = useState<ReceiptWalletSummary | null>(null);
  const [amount, setAmount] = useState<number>(TENANT_ALIMTALK_CHARGE_PRESETS_KRW[0]);
  const [method, setMethod] = useState<'card' | 'bank'>('card');
  const [depositor, setDepositor] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    fetchReceiptWallet()
      .then((next) => {
        if (cancelled) return;
        setSummary(next);
        setDepositor((prev) => prev || next.tenantName || '');
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : '지갑을 불러오지 못했습니다.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const pending = summary?.pendingCharge ?? null;
  const samePending = pending != null && pending.amountKrw === amount;
  const balance = summary?.balanceKrw ?? 0;
  const bank = [summary?.bank.bankName, summary?.bank.accountNumber, summary?.bank.accountHolder].filter(Boolean).join(' ');
  const choices = summary?.testAmountEnabled
    ? [...TENANT_ALIMTALK_CHARGE_PRESETS_KRW, TEST_AMOUNT]
    : TENANT_ALIMTALK_CHARGE_PRESETS_KRW;

  async function copyBank() {
    if (!bank) return;
    try {
      await navigator.clipboard.writeText(bank);
    } catch {
      setError('계좌를 복사하지 못했습니다.');
    }
  }

  async function payCard() {
    const token = getToken();
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      const result = await openTenantWalletWindow(token, amount);
      window.location.assign(result.redirectUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : '결제창을 열지 못했습니다.');
      setBusy(false);
    }
  }

  async function requestBank() {
    const token = getToken();
    if (!token || !admin) return;
    if (!depositor.trim()) {
      setError('입금자명을 입력해 주세요.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await postTenantAlimtalkChargeRequest(token, { amountKrw: amount, memo: depositor.trim() });
      setDone(`${won(amount)} 충전 신청을 접수했습니다. 확인되면 알림으로 알려드립니다.`);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : '충전 신청에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  }

  return createPortal(
    <div className="modal-mobile-safe-overlay fixed inset-0 z-[80] flex items-end justify-center bg-slate-900/40 lg:items-center" onMouseDown={onClose}>
      <div
        className="modal-mobile-fullscreen-panel flex max-h-[100dvh] w-full flex-col bg-white lg:max-h-[90vh] lg:max-w-[640px] lg:rounded-2xl"
        role="dialog"
        aria-modal="true"
        aria-label="청소비서 지갑 충전"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="flex shrink-0 items-center justify-between border-b border-slate-200 px-3 py-2">
          <h2 className="text-fluid-sm font-semibold text-slate-900">청소비서 지갑 충전</h2>
          <button type="button" className="inline-flex size-11 items-center justify-center rounded-lg hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2" aria-label="닫기" onClick={onClose}>
            <LineMdIcon name="close" className="size-5" />
          </button>
        </header>
        <div ref={scrollRef} className="modal-form-scroll-surface min-h-0 flex-1 space-y-3 overflow-y-auto p-3" onFocusCapture={onFieldFocus}>
          {pending ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-fluid-xs text-amber-950">
              {won(pending.amountKrw)} 입금 확인 중 · {clock(pending.createdAt)} 신청
            </p>
          ) : null}
          <p className="text-fluid-xs text-slate-600">
            현재 잔액 <span className="text-fluid-lg font-semibold tabular-nums text-slate-900">{summary ? won(balance) : '…'}</span>
          </p>
          <div>
            <p className="text-fluid-xs text-slate-700">충전 금액</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {choices.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  disabled={busy}
                  className={`min-h-10 rounded-lg border px-3 text-fluid-xs tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ${amount === preset ? 'border-slate-900 bg-slate-900 text-white hover:bg-slate-800' : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50'}`}
                  onClick={() => setAmount(preset)}
                >
                  {preset === TEST_AMOUNT ? '1,000 TEST' : won(preset)}
                </button>
              ))}
            </div>
            <p className="mt-1 text-fluid-xs text-slate-600">
              충전 후 잔액 <span className="font-semibold tabular-nums text-slate-900">{won(balance + amount)}</span>
            </p>
          </div>
          <div>
            <p className="text-fluid-xs text-slate-700">결제 방법</p>
            <div className="mt-1 grid grid-cols-2 gap-1 rounded-lg border border-slate-200 p-0.5">
              {([
                ['card', '카드 결제 · 즉시 반영'],
                ['bank', '무통장 입금 · 확인 후 반영'],
              ] as const).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={`min-h-10 rounded-md px-2 text-fluid-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 ${method === id ? 'bg-slate-900 text-white hover:bg-slate-800' : 'text-slate-700 hover:bg-slate-50'}`}
                  onClick={() => setMethod(id)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          {method === 'card' ? (
            <div className="space-y-2 rounded-lg border border-slate-200 p-2">
              <p className="text-fluid-xs text-slate-700">결제창에서 카드 정보를 입력합니다. 승인되면 바로 잔액에 들어갑니다.</p>
            </div>
          ) : (
            <div className="space-y-2 rounded-lg border border-slate-200 p-2">
              <p className="flex flex-wrap items-center gap-2 text-fluid-xs text-slate-800">
                <span>{bank || '입금 계좌가 아직 없습니다.'}</span>
                {bank ? (
                  <button type="button" className={GHOST} onClick={() => void copyBank()}>복사</button>
                ) : null}
              </p>
              <label className="block text-fluid-2xs text-slate-600">
                입금자명
                <input className="mt-1 min-h-9 w-full rounded-lg border border-slate-300 px-2 text-fluid-xs" value={depositor} disabled={busy || Boolean(pending)} onChange={(event) => setDepositor(event.target.value)} />
              </label>
              <p className="text-fluid-2xs text-slate-600">입금 후 아래 버튼을 눌러주세요. 확인되면 알림으로 알려드립니다.</p>
            </div>
          )}
          {!admin ? <p className="text-fluid-xs text-slate-700">관리자만 충전할 수 있습니다.</p> : null}
          {done ? <p className="text-fluid-xs text-emerald-800">{done}</p> : null}
          {error ? <p className="text-fluid-xs text-red-700">{error}</p> : null}
        </div>
        <footer className="shrink-0 border-t border-slate-200 px-3 py-2">
          {method === 'card' ? (
            <button type="button" className={BTN} disabled={busy || !admin} onClick={() => void payCard()}>
              {busy ? '결제창 여는 중' : `${won(amount)} 카드로 결제`}
            </button>
          ) : (
            <button type="button" className={BTN} disabled={busy || !admin || Boolean(pending) || samePending} onClick={() => void requestBank()}>
              {busy ? '신청 중…' : `입금했어요 · ${won(amount)} 충전 신청`}
            </button>
          )}
        </footer>
      </div>
    </div>,
    document.body,
  );
}
