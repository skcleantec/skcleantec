import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getModuleVisibility } from '@shared/tenantModuleVisibility';
import { useTenantCapabilities } from '../../hooks/useTenantCapabilities';
import {
  cancelInquiryCashbill,
  cashbillStateLabel,
  CASHBILL_KIND_LABEL,
  copyInquiryCashbillMail,
  fetchInquiryCashbill,
  issueInquiryCashbill,
  type CashbillInquiryView,
  type CashbillKind,
} from '../../api/cashbillIssues';

const BTN =
  'min-h-10 rounded-lg bg-slate-900 px-3 py-2 text-fluid-xs font-medium text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none';
const BTN_GHOST =
  'min-h-10 rounded-lg border border-slate-300 bg-white px-3 py-2 text-fluid-xs font-medium text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none';

function won(n: number): string {
  return `${Number(n).toLocaleString('ko-KR')}원`;
}

export function CashbillInquiryPanel({ inquiryId }: { inquiryId: string }) {
  const { features, plan } = useTenantCapabilities();
  const [view, setView] = useState<CashbillInquiryView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [kind, setKind] = useState<'DEPOSIT' | 'BALANCE' | 'FULL'>('FULL');
  const [usage, setUsage] = useState<1 | 2>(1);
  const [identity, setIdentity] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setView(await fetchInquiryCashbill(inquiryId));
    } catch (err) {
      setError(err instanceof Error ? err.message : '불러오지 못했습니다.');
    }
  }, [inquiryId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (features === null) return <p className="text-fluid-xs text-slate-500">확인 중…</p>;
  const visibility = getModuleVisibility('mod_cashbill', plan, features);
  if (visibility.state === 'hidden') return null;
  if (visibility.state === 'locked') {
    return (
      <p className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-fluid-xs text-slate-700">
        🔒 {visibility.requiredPlanLabel ?? 'Standard'}부터
      </p>
    );
  }

  async function issue() {
    setBusy(true);
    setError(null);
    try {
      await issueInquiryCashbill(inquiryId, {
        kind,
        tradeUsage: usage,
        identity: identity.trim() || undefined,
        requestId: crypto.randomUUID(),
      });
      setIdentity('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : '발급에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  }

  async function cancel(issueId: string) {
    setBusy(true);
    setError(null);
    try {
      await cancelInquiryCashbill(inquiryId, issueId, crypto.randomUUID());
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : '취소에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  }

  async function copyMail(issueId: string) {
    setError(null);
    try {
      const url = await copyInquiryCashbillMail(inquiryId, issueId);
      await navigator.clipboard.writeText(url);
      setCopied(issueId);
    } catch (err) {
      setError(err instanceof Error ? err.message : '주소를 복사하지 못했습니다.');
    }
  }

  const amount = view ? view.caps[kind === 'DEPOSIT' ? 'deposit' : kind === 'BALANCE' ? 'balance' : 'full'] : 0;
  const walletShort = (error ?? '').includes('지갑');

  return (
    <div className="space-y-2 text-fluid-xs text-slate-800">
      {error ? <p className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-red-800">{error}</p> : null}
      {walletShort && view ? (
        <Link to={view.chargePath} className={`${BTN_GHOST} inline-flex items-center`}>
          청소비서 지갑 충전
        </Link>
      ) : null}
      {!view ? <p className="text-slate-500">현금영수증을 불러오는 중…</p> : null}
      {view && view.linkState !== 'ready' ? (
        <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-amber-950">
          <p>{view.linkMessage}</p>
          {view.linkState === 'unlinked' ? (
            <Link to={view.settingsPath} className={`${BTN} inline-flex items-center`}>
              계산서 연결로 가기
            </Link>
          ) : null}
        </div>
      ) : null}
      {view && view.linkState === 'ready' ? (
        <div className="space-y-2">
          <p className="text-slate-600">
            카드결제 {won(view.cardPaidWon)} 제외 · 발급 가능 {won(view.caps.cashCeiling)} · 1건 {won(view.unitPriceKrw)} · 지갑 {won(view.walletBalanceKrw)}
          </p>
          <div className="flex flex-wrap gap-1">
            {(['DEPOSIT', 'BALANCE', 'FULL'] as const).map((id) => (
              <button key={id} type="button" className={kind === id ? BTN : BTN_GHOST} onClick={() => setKind(id)}>
                {CASHBILL_KIND_LABEL[id]} {won(view.caps[id === 'DEPOSIT' ? 'deposit' : id === 'BALANCE' ? 'balance' : 'full'])}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <label className="inline-flex items-center gap-1">
              <input type="radio" name="cashbill-usage" checked={usage === 1} onChange={() => setUsage(1)} />
              소득공제
            </label>
            <label className="inline-flex items-center gap-1">
              <input type="radio" name="cashbill-usage" checked={usage === 2} onChange={() => setUsage(2)} />
              지출증빙
            </label>
          </div>
          <input
            value={identity}
            onChange={(e) => setIdentity(e.target.value)}
            placeholder={usage === 1 ? '휴대폰. 비우면 고객 연락처, 없으면 자진발급' : '사업자번호'}
            className="min-h-9 w-full rounded-lg border border-slate-300 px-2 text-fluid-xs"
          />
          <button type="button" className={BTN} disabled={busy || amount <= 0} onClick={() => void issue()}>
            {amount <= 0 ? '발급할 금액 없음' : `${won(amount)} 발급`}
          </button>
        </div>
      ) : null}
      {view && view.issues.length > 0 ? (
        <ul className="space-y-1.5">
          {view.issues.map((row) => (
            <li key={row.id} className="rounded-lg border border-slate-200 px-2 py-1.5">
              <p>
                {CASHBILL_KIND_LABEL[row.kind as CashbillKind]} {won(row.totalWon)} · {cashbillStateLabel(row.barobillState, row.lastError)}
                {row.ntsConfirmNum ? ` · 국세청 ${row.ntsConfirmNum}` : ''}
              </p>
              <p className="text-slate-500">{row.identityMasked}</p>
              {view.linkState === 'ready' && row.kind !== 'CANCEL' && ['2000', '2500', '3000'].includes(row.barobillState ?? '') ? (
                <div className="mt-1 flex flex-wrap gap-1">
                  <button type="button" className={BTN_GHOST} disabled={busy} onClick={() => void cancel(row.id)}>
                    전액 취소
                  </button>
                  <button type="button" className={BTN_GHOST} onClick={() => void copyMail(row.id)}>
                    {copied === row.id ? '주소 복사됨' : '확인 주소 복사'}
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
