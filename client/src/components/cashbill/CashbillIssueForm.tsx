import { useEffect, useState } from 'react';
import { CASHBILL_UNIT_PRICE_KRW } from '@shared/barobillPolicy';
import { issueCashbill, searchCashbillInquiries, type CashbillSearchHit, type CashbillUsage } from '../../api/cashbillIssues';
import { useReceiptWallet } from '../wallet/ReceiptWalletProvider';
import { IssueModalFrame } from '../receipts/IssueModalFrame';

const BTN =
  'min-h-11 rounded-lg bg-slate-900 px-3 py-2 text-fluid-xs font-medium text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none';
const BTN_GHOST =
  'min-h-11 rounded-lg border border-slate-300 bg-white px-3 py-2 text-fluid-xs font-medium text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none';

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

export type CashbillIssueSeed = {
  brandId: string;
  amount: string;
  usage: CashbillUsage;
  itemName: string;
  memo: string;
  askIdentity: boolean;
};

export function CashbillIssueForm({
  brands,
  onClose,
  onDone,
  seed,
}: {
  brands: Brand[];
  onClose: () => void;
  onDone: (issueId: string) => void;
  seed?: CashbillIssueSeed | null;
}) {
  const { summary, openCharge, reload } = useReceiptWallet();
  const linkedBrands = brands.filter((brand) => brand.linked);
  const today = kstToday();
  const yesterday = previousYmd(today);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<CashbillSearchHit[]>([]);
  const [selected, setSelected] = useState<CashbillSearchHit | null>(null);
  const [unmatched, setUnmatched] = useState(false);
  const [brandId, setBrandId] = useState(seed?.brandId || linkedBrands[0]?.id || '');
  const [amount, setAmount] = useState(seed?.amount ?? '');
  const [usage, setUsage] = useState<CashbillUsage>(seed?.usage ?? 'phone');
  const [identity, setIdentity] = useState('');
  const identityHint = seed?.askIdentity ? '번호를 다시 입력해 주세요' : null;
  const [itemName, setItemName] = useState(seed?.itemName ?? '청소 서비스');
  const [tradeDate, setTradeDate] = useState(today);
  const [email, setEmail] = useState('');
  const [memoOpen, setMemoOpen] = useState(Boolean(seed?.memo));
  const [memo, setMemo] = useState(seed?.memo ?? '');
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
      const issued = await issueCashbill({
        inquiryId: unmatched ? null : selected?.id,
        operatingCompanyId: unmatched ? brandId : selected?.brandId,
        amount: Math.round(Number(amount.replace(/,/g, ''))),
        usage,
        identity: usage === 'voluntary' ? undefined : identity.trim(),
        itemName,
        tradeDate,
        email: email.trim() || undefined,
        internalMemo: memo.trim() || undefined,
        requestId: crypto.randomUUID(),
      });
      setQuery('');
      setHits([]);
      setSelected(null);
      setAmount('');
      setIdentity('');
      await reload();
      onDone(issued.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : '현금영수증 발급에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  }

  const total = Math.round(Number(amount) || 0);
  const supply = Math.round(total / 1.1);
  const vat = Math.max(0, total - supply);
  const short = summary != null && summary.balanceKrw < CASHBILL_UNIT_PRICE_KRW;
  const after = summary ? summary.balanceKrw - CASHBILL_UNIT_PRICE_KRW : 0;

  return (
    <IssueModalFrame
      title="현금영수증 발행"
      onClose={onClose}
      footer={(
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className={`text-fluid-xs ${short ? 'text-red-700' : 'text-slate-600'}`}>
            {short ? '잔액이 부족합니다' : `발행 비용 ${won(CASHBILL_UNIT_PRICE_KRW)} · 지갑 ${summary ? won(summary.balanceKrw) : '…'} → ${won(after)}`}
          </p>
          <div className="flex gap-2">
            <button type="button" className={BTN_GHOST} onClick={onClose}>취소</button>
            {short ? (
              <button type="button" className={BTN} onClick={openCharge}>충전하기</button>
            ) : (
              <button type="button" className={BTN} disabled={busy || (!selected && !unmatched) || linkedBrands.length === 0} onClick={() => void submit()}>
                {busy ? '발행 중…' : '발행하기'}
              </button>
            )}
          </div>
        </div>
      )}
    >
      {error ? <p className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-fluid-xs text-red-800">{error}</p> : null}
      {linkedBrands.length > 1 ? (
        <label className="block space-y-1 text-fluid-xs text-slate-700">
          <span>브랜드</span>
          <select value={brandId} onChange={(e) => setBrandId(e.target.value)} className="min-h-9 w-full rounded-lg border border-slate-300 px-2">
            {linkedBrands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
          </select>
        </label>
      ) : null}
      <div className="flex items-end gap-2">
        <label className="min-w-0 flex-1 space-y-1 text-fluid-xs text-slate-700">
          <span>① 고객</span>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="고객명 또는 전화번호" className="min-h-9 w-full rounded-lg border border-slate-300 px-2" />
        </label>
        <button type="button" className={BTN_GHOST} onClick={clearMatch}>직접 입력</button>
      </div>
      {hits.length > 0 ? (
        <ul className="space-y-1">
          {hits.map((hit) => (
            <li key={hit.id}>
              <button type="button" className={`${BTN_GHOST} w-full text-left`} onClick={() => pick(hit)}>
                {hit.customerName} · {hit.customerPhone || '번호 없음'} · {hit.createdAt?.slice(0, 10) ?? ''} · 총액 {won(hit.totalWon ?? hit.remainingWon)} · 발행 가능 {won(hit.remainingWon)}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {selected && !unmatched ? (
        <p className="text-fluid-xs text-slate-700">접수 {selected.customerName} · {selected.brandName} · 가능 {won(selected.remainingWon)}</p>
      ) : null}
      <label className="block space-y-1 text-fluid-xs text-slate-700">
        <span>② 금액</span>
        <span className="flex items-center gap-2">
          <input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))} className="min-h-9 w-36 rounded-lg border border-slate-300 px-2 text-right tabular-nums" />
          <span>원</span>
        </span>
        {selected && !unmatched ? <span className="text-fluid-2xs text-slate-500">발행 가능 한도 {won(selected.remainingWon)}</span> : null}
        {total > 0 ? <span className="text-fluid-2xs text-slate-600">공급가액 {won(supply)} · 부가세 {won(vat)}</span> : null}
      </label>
      <div className="space-y-1">
        <p className="text-fluid-xs text-slate-700">③ 용도</p>
        <div className="flex flex-wrap gap-1">
          {([
            ['phone', '소득공제(휴대폰)'],
            ['biz', '지출증빙(사업자)'],
            ['voluntary', '자진발급'],
          ] as const).map(([id, label]) => (
            <button key={id} type="button" className={`min-h-9 rounded-lg border px-2 text-fluid-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 ${usage === id ? 'border-slate-900 bg-slate-900 text-white hover:bg-slate-800' : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50'}`} onClick={() => setUsage(id)}>
              {label}
            </button>
          ))}
        </div>
      </div>
      {identityHint ? <p className="text-fluid-xs text-amber-800">{identityHint}</p> : null}
      {usage === 'voluntary' ? (
        <p className="text-fluid-xs text-slate-600">자진발급 010-000-1234</p>
      ) : (
        <input
          value={identity}
          onChange={(e) => setIdentity(e.target.value)}
          placeholder={usage === 'phone' ? '휴대폰 11자리' : '사업자번호 10자리'}
          maxLength={usage === 'phone' ? 13 : 12}
          aria-label={usage === 'phone' ? '휴대폰 번호' : '사업자번호'}
          className="min-h-9 w-full rounded-lg border border-slate-300 px-2 text-fluid-xs"
        />
      )}
      <label className="block space-y-1 text-fluid-xs text-slate-700">
        <span>④ 고객 이메일 (선택)</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="min-h-9 w-full rounded-lg border border-slate-300 px-2"
        />
        <span className="text-fluid-2xs text-slate-500">입력하면 바로빌이 공식 영수증 메일을 보냅니다</span>
      </label>
      <div className="flex flex-wrap items-end gap-2">
        <label className="space-y-1 text-fluid-xs text-slate-700">
          <span>⑤ 품목명</span>
          <input value={itemName} onChange={(e) => setItemName(e.target.value)} className="min-h-9 rounded-lg border border-slate-300 px-2" />
        </label>
        <label className="space-y-1 text-fluid-xs text-slate-700">
          <span>거래일</span>
          <select value={tradeDate} onChange={(e) => setTradeDate(e.target.value)} className="min-h-9 rounded-lg border border-slate-300 px-2">
            <option value={today}>오늘</option>
            <option value={yesterday}>어제</option>
          </select>
        </label>
      </div>
      <button type="button" className="text-fluid-xs text-slate-600 underline hover:text-slate-900" onClick={() => setMemoOpen((open) => !open)}>
        + 내부 메모 추가 (고객에게 안 보임)
      </button>
      {memoOpen ? (
        <textarea value={memo} onChange={(e) => setMemo(e.target.value)} className="min-h-16 w-full rounded-lg border border-slate-300 px-2 py-1 text-fluid-xs" placeholder="내부 메모" />
      ) : null}
    </IssueModalFrame>
  );
}
