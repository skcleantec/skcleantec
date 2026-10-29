import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  TENANT_ALIMTALK_CHARGE_PRESETS_KRW,
  postTenantAlimtalkChargeRequest,
} from '../../api/alimtalk';
import type { ReceiptWalletSummary } from '../../api/receiptWallet';
import { getToken } from '../../stores/auth';
import { TenantWalletWindowButton } from '../admin/TenantWalletWindowButton';
import { bootstrapAuthMeFromLocal } from '../../api/authMeSnapshot';
import { useModalScrollKeyboardAvoidance } from '../../hooks/useMobileInputVisibility';

const BTN =
  'min-h-10 rounded-lg bg-slate-900 px-3 text-fluid-xs font-medium text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none';

export function ReceiptWalletChargeModal({
  summary,
  onClose,
  onDone,
}: {
  summary: ReceiptWalletSummary | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { onFieldFocus } = useModalScrollKeyboardAvoidance(scrollRef, true);
  const admin = bootstrapAuthMeFromLocal(getToken() ?? '')?.role === 'ADMIN';
  const [amount, setAmount] = useState<number>(TENANT_ALIMTALK_CHARGE_PRESETS_KRW[0]);
  const [memo, setMemo] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const pending = (summary?.pendingChargeKrw ?? 0) > 0;
  const bank = [summary?.bank.bankName, summary?.bank.accountNumber, summary?.bank.accountHolder].filter(Boolean).join(' ');

  async function submit() {
    const token = getToken();
    if (!token || !admin) return;
    setBusy(true);
    setError(null);
    try {
      await postTenantAlimtalkChargeRequest(token, { amountKrw: amount, memo: memo.trim() || undefined });
      setDone(`${amount.toLocaleString('ko-KR')}원 충전 신청을 접수했습니다. 입금 후 반영까지 시간이 걸릴 수 있습니다.`);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : '충전 신청에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  }

  return createPortal(
    <div className="modal-mobile-safe-overlay fixed inset-0 z-[80] flex items-end justify-center bg-slate-900/40 lg:items-center">
      <div className="modal-mobile-fullscreen-panel flex max-h-[100dvh] w-full flex-col bg-white lg:max-h-[90vh] lg:max-w-lg lg:rounded-2xl">
        <header className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 px-3 py-2">
          <h2 className="text-fluid-sm font-semibold text-slate-900">청소비서 지갑 충전</h2>
          <button type="button" className="min-h-10 rounded-lg px-3 text-fluid-xs text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2" onClick={onClose}>닫기</button>
        </header>
        <div ref={scrollRef} className="modal-form-scroll-surface min-h-0 flex-1 space-y-2 overflow-y-auto p-3" onFocusCapture={onFieldFocus}>
          {!admin ? <p className="text-fluid-xs text-slate-700">관리자만 충전 신청할 수 있습니다.</p> : null}
          {bank ? <p className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-fluid-2xs text-slate-700">입금 계좌: {bank}</p> : null}
          {summary?.bank.paymentGuideText ? <p className="text-fluid-2xs text-slate-600">{summary.bank.paymentGuideText}</p> : null}
          {pending ? <p className="text-fluid-xs text-amber-900">이미 처리 대기 중인 충전 신청이 있습니다.</p> : null}
          {done ? <p className="text-fluid-xs text-emerald-800">{done}</p> : null}
          {error ? <p className="text-fluid-xs text-red-700">{error}</p> : null}
          {admin && !done ? (
            <>
              <div className="flex flex-wrap gap-2">
                {TENANT_ALIMTALK_CHARGE_PRESETS_KRW.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    disabled={busy || pending}
                    className={`min-h-10 rounded-lg border px-3 text-fluid-xs tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ${amount === preset ? 'border-slate-900 bg-slate-900 text-white hover:bg-slate-800' : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50'}`}
                    onClick={() => setAmount(preset)}
                  >
                    {preset.toLocaleString('ko-KR')}원
                  </button>
                ))}
              </div>
              <label className="block text-fluid-2xs text-slate-600">
                메모 (선택, 입금자명 등)
                <input className="mt-1 min-h-9 w-full rounded-lg border border-slate-300 px-2 text-fluid-xs" value={memo} disabled={busy || pending} onChange={(e) => setMemo(e.target.value)} />
              </label>
              <div className="flex flex-wrap items-start gap-2">
                <button type="button" className={BTN} disabled={busy || pending} onClick={() => void submit()}>
                  {busy ? '신청 중…' : `${amount.toLocaleString('ko-KR')}원 충전 신청`}
                </button>
                <TenantWalletWindowButton token={getToken() ?? ''} amountKrw={amount} className="min-h-10 text-fluid-xs" />
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}
