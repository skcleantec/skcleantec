import { useEffect, useState } from 'react';
import { CASHBILL_UNIT_PRICE_KRW } from '@shared/barobillPolicy';
import { issueCashbill, searchCashbillInquiries, type CashbillSearchHit, type CashbillUsage } from '../../api/cashbillIssues';
import { useReceiptWallet } from '../wallet/ReceiptWalletProvider';
import { ensureInputVisibleAboveKeyboard } from '../../hooks/useMobileInputVisibility';
import { getStaffAppScrollElement } from '../../utils/staffAppScrollRestore';

const BTN =
  'min-h-10 rounded-lg bg-slate-900 px-3 py-2 text-fluid-xs font-medium text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none';
const BTN_GHOST =
  'min-h-10 rounded-lg border border-slate-300 bg-white px-3 py-2 text-fluid-xs font-medium text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none';

function kstToday(): string {
  return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10);
}

function previousYmd(ymd: string): string {
  const [year, month, day] = ymd.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function won(n: number): string {
  return `${Number(n).toLocaleString('ko-KR')}원`;
}

type Brand = { id: string; name: string; linked: boolean };

export function CashbillIssueForm({ brands, onDone }: { brands: Brand[]; onDone: () => void }) {
  const { summary, openCharge, reload } = useReceiptWallet();
  const linkedBrands = brands.filter((brand) => brand.linked);
  const today = kstToday();
  const yesterday = previousYmd(today);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<CashbillSearchHit[]>([]);
  const [selected, setSelected] = useState<CashbillSearchHit | null>(null);
  const [unmatched, setUnmatched] = useState(false);
  const [brandId, setBrandId] = useState(linkedBrands[0]?.id ?? '');
  const [amount, setAmount] = useState('');
  const [usage, setUsage] = useState<CashbillUsage>('phone');
  const [identity, setIdentity] = useState('');
  const [itemName, setItemName] = useState('청소 서비스');
  const [tradeDate, setTradeDate] = useState(today);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setHits([]);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      searchCashbillInquiries(q)
        .then((items) => {
          if (!cancelled) setHits(items);
        })
        .catch((err: unknown) => {
          if (!cancelled) setError(err instanceof Error ? err.message : '접수를 검색하지 못했습니다.');
        });
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query]);

  function pick(hit: CashbillSearchHit) {
    setSelected(hit);
    setUnmatched(false);
    setBrandId(hit.brandId);
    setAmount(String(hit.remainingWon));
    if (usage === 'phone') setIdentity(hit.customerPhone ?? '');
    setError(hit.simplified ? '간이과세자 현금영수증은 바로빌 답변 전까지 발급할 수 없습니다.' : null);
  }

  function clearMatch() {
    setSelected(null);
    setUnmatched(true);
    setBrandId(linkedBrands[0]?.id ?? '');
    setAmount('');
    setIdentity('');
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await issueCashbill({
        inquiryId: unmatched ? null : selected?.id,
        operatingCompanyId: unmatched ? brandId : selected?.brandId,
        amount: Math.round(Number(amount.replace(/,/g, ''))),
        usage,
        identity: usage === 'voluntary' ? undefined : identity.trim(),
        itemName,
        tradeDate,
        requestId: crypto.randomUUID(),
      });
      setQuery('');
      setHits([]);
      setSelected(null);
      setAmount('');
      setIdentity('');
      await reload();
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : '현금영수증 발급에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="space-y-2 rounded-xl border border-slate-200 bg-white p-3"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      onFocusCapture={(e) => {
        const target = e.target;
        if (!(target instanceof HTMLElement) || !target.matches('input, textarea, select')) return;
        ensureInputVisibleAboveKeyboard(target, getStaffAppScrollElement(), 'smooth', 28);
      }}
    >
      <p className="text-fluid-sm font-medium text-slate-900">현금영수증 발행</p>
      {error ? <p className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-fluid-xs text-red-800">{error}</p> : null}
      <label className="block space-y-1 text-fluid-xs text-slate-700">
        <span>고객 검색</span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="고객명 또는 전화번호"
          className="min-h-9 w-full rounded-lg border border-slate-300 px-2"
        />
      </label>
      {hits.length > 0 ? (
        <ul className="space-y-1">
          {hits.map((hit) => (
            <li key={hit.id}>
              <button type="button" className={`${BTN_GHOST} w-full text-left`} onClick={() => pick(hit)}>
                {hit.customerName} · {hit.customerPhone || '연락처 없음'} · {hit.brandName} · 가능 {won(hit.remainingWon)}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <button type="button" className={BTN_GHOST} onClick={clearMatch}>
        매칭 없이 발행
      </button>
      {selected && !unmatched ? (
        <p className="text-fluid-xs text-slate-700">접수 {selected.customerName} · {selected.brandName} · 가능 {won(selected.remainingWon)}</p>
      ) : null}
      {unmatched ? (
        <label className="block space-y-1 text-fluid-xs text-slate-700">
          <span>브랜드</span>
          <select value={brandId} onChange={(e) => setBrandId(e.target.value)} className="min-h-9 w-full rounded-lg border border-slate-300 px-2">
            {linkedBrands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
          </select>
        </label>
      ) : null}
      <label className="block space-y-1 text-fluid-xs text-slate-700">
        <span>금액</span>
        <input
          inputMode="numeric"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))}
          className="min-h-9 w-full rounded-lg border border-slate-300 px-2 tabular-nums"
        />
      </label>
      <div className="flex flex-wrap gap-2 text-fluid-xs">
        {([
          ['phone', '소득공제(휴대폰)'],
          ['biz', '지출증빙(사업자번호)'],
          ['voluntary', '자진발급'],
        ] as const).map(([id, label]) => (
          <label key={id} className="inline-flex items-center gap-1">
            <input type="radio" name="cashbill-usage" checked={usage === id} onChange={() => setUsage(id)} />
            {label}
          </label>
        ))}
      </div>
      {usage === 'voluntary' ? (
        <p className="text-fluid-xs text-slate-600">자진발급 010-000-1234</p>
      ) : (
        <input
          value={identity}
          onChange={(e) => setIdentity(e.target.value)}
          placeholder={usage === 'phone' ? '휴대폰 번호' : '사업자번호 10자리'}
          className="min-h-9 w-full rounded-lg border border-slate-300 px-2 text-fluid-xs"
        />
      )}
      <label className="block space-y-1 text-fluid-xs text-slate-700">
        <span>품목명</span>
        <input value={itemName} onChange={(e) => setItemName(e.target.value)} className="min-h-9 w-full rounded-lg border border-slate-300 px-2" />
      </label>
      <label className="block space-y-1 text-fluid-xs text-slate-700">
        <span>거래일</span>
        <select value={tradeDate} onChange={(e) => setTradeDate(e.target.value)} className="min-h-9 rounded-lg border border-slate-300 px-2">
          <option value={today}>오늘 {today}</option>
          <option value={yesterday}>어제 {yesterday}</option>
        </select>
      </label>
      {summary != null && summary.balanceKrw < CASHBILL_UNIT_PRICE_KRW ? (
        <button type="button" className="min-h-10 rounded-lg bg-amber-700 px-3 py-2 text-fluid-xs font-medium text-white hover:bg-amber-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2" onClick={openCharge}>
          잔액이 부족합니다 · 충전하기
        </button>
      ) : (
        <button type="submit" className={BTN} disabled={busy || (!selected && !unmatched) || linkedBrands.length === 0}>
          발행
        </button>
      )}
    </form>
  );
}
