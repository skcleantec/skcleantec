import { useEffect, useMemo, useRef, useState } from 'react';
import { CASHBILL_UNIT_PRICE_KRW } from '@shared/barobillPolicy';
import {
  issueCashbill,
  searchCashbillInquiries,
  type CashbillBrand,
  type CashbillSearchHit,
  type CashbillTaxKind,
  type CashbillUsage,
} from '../../api/cashbillIssues';
import {
  CASHBILL_DEFAULT_FALLBACK,
  cashbillTaxKindLabel,
  cashbillUsageLabel,
  fetchCashbillIssueSettings,
  fetchPlatformIssueSettings,
  type CashbillIssueDefaults,
} from '../../api/receiptIssueSettings';
import { tenantTaxInvoiceBuyerApi } from '../../api/taxInvoiceBuyers';
import type { CashbillIssuerAdapter } from './cashbillIssueAdapter';
import { useReceiptWallet } from '../wallet/ReceiptWalletProvider';
import { IssueModalFrame } from '../receipts/IssueModalFrame';
import { ReceiptOverAmountFields } from '../receipts/ReceiptOverAmountFields';
import { Button } from '../ui/Button';
import TaxInvoiceBuyerPicker from '../taxinvoice/TaxInvoiceBuyerPicker';

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

function DefaultChip({ text }: { text: string }) {
  return (
    <span className="ml-1 inline-flex rounded-md border border-orange-300 bg-orange-50 px-1.5 py-0.5 text-fluid-2xs font-semibold text-orange-800">
      기본: {text}
    </span>
  );
}

export type CashbillIssueSeed = {
  brandId: string;
  amount: string;
  usage: CashbillUsage;
  itemName: string;
  memo: string;
  askIdentity: boolean;
  customerName?: string;
  taxKind?: CashbillTaxKind;
};

const KIND_BTN =
  'min-h-9 rounded-lg border px-2 text-fluid-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none';
const KIND_ON = 'border-slate-900 bg-slate-900 text-white hover:bg-slate-800';
const KIND_OFF = 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50';

export function CashbillIssueForm({
  brands,
  onClose,
  onDone,
  seed,
  embedded = false,
  seedInquiryId = '',
  adapter,
  platformTenantId,
}: {
  brands: CashbillBrand[];
  onClose: () => void;
  onDone: (issueId: string) => void;
  seed?: CashbillIssueSeed | null;
  embedded?: boolean;
  seedInquiryId?: string;
  adapter?: CashbillIssuerAdapter;
  platformTenantId?: string;
}) {
  const { summary, openCharge, reload } = useReceiptWallet();
  const allowInquiry = !adapter || adapter.allowInquiry;
  const useWallet = !adapter || adapter.useWallet;
  const buyerApi = adapter?.buyerApi ?? tenantTaxInvoiceBuyerApi;
  const isPlatform = adapter?.mode === 'platform';

  const linkedBrands = brands.filter((brand) => brand.linked);
  const today = kstToday();
  const yesterday = previousYmd(today);
  const [defaults, setDefaults] = useState<CashbillIssueDefaults>(CASHBILL_DEFAULT_FALLBACK);
  const defaultsRef = useRef(defaults);
  defaultsRef.current = defaults;
  const [defaultsReady, setDefaultsReady] = useState(false);

  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<CashbillSearchHit[]>([]);
  const [searched, setSearched] = useState('');
  const [selected, setSelected] = useState<CashbillSearchHit | null>(null);
  const [unmatched, setUnmatched] = useState(!allowInquiry);
  const [brandId, setBrandId] = useState(seed?.brandId || linkedBrands[0]?.id || '');
  const [amount, setAmount] = useState(seed?.amount ?? '');
  const [taxKind, setTaxKind] = useState<CashbillTaxKind>(seed?.taxKind ?? 'taxable');
  const [usage, setUsage] = useState<CashbillUsage>(seed?.usage ?? 'phone');
  const [identity, setIdentity] = useState('');
  const identityHint = seed?.askIdentity ? '번호를 다시 입력해 주세요' : null;
  const [itemName, setItemName] = useState(seed?.itemName ?? '청소 서비스');
  const [tradeDate, setTradeDate] = useState(today);
  const [email, setEmail] = useState('');
  const [customerName, setCustomerName] = useState(seed?.customerName ?? '');
  const [phoneHits, setPhoneHits] = useState<CashbillSearchHit[]>([]);
  const [memoOpen, setMemoOpen] = useState(Boolean(seed?.memo));
  const [memo, setMemo] = useState(seed?.memo ?? '');
  const [extraReason, setExtraReason] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveBuyer, setSaveBuyer] = useState(true);

  const activeBrand = brands.find((brand) => brand.id === brandId) ?? linkedBrands[0];
  const brandTaxType = selected && !unmatched ? selected.taxType : activeBrand?.taxType;
  const exemptLocked = brandTaxType === '4';
  const activeKind: CashbillTaxKind = exemptLocked ? 'exempt' : taxKind;

  useEffect(() => {
    let stop = false;
    const load = async () => {
      const data = isPlatform
        ? await fetchPlatformIssueSettings('CASHBILL')
        : await fetchCashbillIssueSettings(brandId || null);
      if (stop) return;
      const values = data.values as CashbillIssueDefaults;
      setDefaults(values);
      if (!seed) {
        setTaxKind(values.taxKind);
        setUsage(values.usage);
        setItemName(values.itemName || '청소 서비스');
        if (values.memo) {
          setMemo(values.memo);
          setMemoOpen(true);
        }
      } else if (seed.taxKind == null) {
        setTaxKind(values.taxKind);
      }
      setDefaultsReady(true);
    };
    void load().catch(() => {
      if (!stop) setDefaultsReady(true);
    });
    return () => { stop = true; };
  }, [brandId, isPlatform, seed]);

  useEffect(() => {
    if (!seedInquiryId) return;
    let stop = false;
    searchCashbillInquiries('', seedInquiryId)
      .then((items) => {
        if (!stop && items[0]) pick(items[0]);
      })
      .catch(() => undefined);
    return () => { stop = true; };
  }, [seedInquiryId]);

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
          if (!cancelled) {
            setHits(items);
            setSearched(q);
          }
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

  const identityDigits = identity.replace(/\D/g, '');
  useEffect(() => {
    if (!unmatched || usage !== 'phone' || identityDigits.length < 10) {
      setPhoneHits([]);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      searchCashbillInquiries(identityDigits)
        .then((items) => {
          if (!cancelled) setPhoneHits(items.filter((hit) => (hit.customerPhone ?? '').replace(/\D/g, '') === identityDigits).slice(0, 3));
        })
        .catch(() => {
          if (!cancelled) setPhoneHits([]);
        });
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [unmatched, usage, identityDigits]);

  function pick(hit: CashbillSearchHit) {
    const basis = defaultsRef.current.amountBasis;
    setSelected(hit);
    setUnmatched(false);
    setPhoneHits([]);
    setCustomerName(hit.customerName ?? '');
    setBrandId(hit.brandId);
    setAmount(String(basis === 'total' ? (hit.totalWon ?? hit.remainingWon) : hit.remainingWon));
    if (hit.taxType === '4') setTaxKind('exempt');
    if (usage === 'phone') setIdentity(hit.customerPhone ?? '');
    setError(hit.simplified ? '간이과세자 현금영수증은 바로빌 답변 전까지 발급할 수 없습니다.' : null);
  }

  function clearMatch() {
    if (selected) setCustomerName('');
    setQuery('');
    setHits([]);
    setSelected(null);
    setUnmatched(true);
    setBrandId(linkedBrands[0]?.id ?? '');
    setAmount('');
    setIdentity('');
  }

  function chooseOtherCustomer() {
    setQuery('');
    setHits([]);
    setSelected(null);
    setUnmatched(false);
    setAmount('');
    setIdentity('');
  }

  const diffs = useMemo(() => {
    if (!defaultsReady) return [] as string[];
    const out: string[] = [];
    if (activeKind !== defaults.taxKind) out.push(cashbillTaxKindLabel(activeKind));
    if (usage !== defaults.usage) out.push(cashbillUsageLabel(usage));
    if ((itemName.trim() || '청소 서비스') !== (defaults.itemName.trim() || '청소 서비스')) out.push(`품목 ${itemName.trim() || '—'}`);
    return out;
  }, [activeKind, usage, itemName, defaults, defaultsReady]);

  async function submit() {
    const issuedTotal = Math.round(Number(amount) || 0);
    const overWon = selected && !unmatched ? Math.max(0, issuedTotal - selected.remainingWon) : 0;
    setBusy(true);
    setError(null);
    try {
      let issueId: string;
      if (adapter) {
        const issued = await adapter.issue({
          amount: Math.round(Number(amount.replace(/,/g, ''))),
          usage,
          identity: usage === 'voluntary' ? undefined : identity.trim(),
          taxKind: activeKind,
          itemName,
          tradeDate,
          email: email.trim() || undefined,
          customerName: (unmatched ? customerName : selected?.customerName ?? '').trim() || undefined,
          internalMemo: memo.trim() || undefined,
          tenantId: platformTenantId || undefined,
        });
        issueId = issued.id;
      } else {
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
          customerName: (unmatched ? customerName : selected?.customerName ?? '').trim() || undefined,
          extraAmountWon: overWon > 0 ? overWon : undefined,
          extraReason: overWon > 0 ? extraReason.trim() : undefined,
          taxKind: activeKind,
          requestId: crypto.randomUUID(),
        });
        issueId = issued.id;
      }

      if (saveBuyer && usage === 'biz') {
        const biz = identity.replace(/\D/g, '');
        if (biz.length >= 10) {
          try {
            await buyerApi.upsert({
              bizNumber: biz,
              corpName: (customerName || selected?.customerName || '').trim() || biz,
            });
          } catch {
            /* 발행은 성공 — 거래처 저장 실패는 무시 */
          }
        }
      }

      setQuery('');
      setHits([]);
      setSelected(null);
      setAmount('');
      setIdentity('');
      setCustomerName('');
      if (useWallet) await reload();
      onDone(issueId);
    } catch (err) {
      setError(err instanceof Error ? err.message : '현금영수증 발급에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  }

  const total = Math.round(Number(amount) || 0);
  const over = selected && !unmatched ? Math.max(0, total - selected.remainingWon) : 0;
  function askIssue() {
    if (!adapter && over > 0 && !extraReason.trim()) {
      setError('추가 금액 사유를 입력해 주세요.');
      return;
    }
    setError(null);
    if ((!adapter && over > 0) || diffs.length > 0) setConfirmOpen(true);
    else void submit();
  }
  const supply = activeKind === 'exempt' ? total : Math.round(total / 1.1);
  const vat = activeKind === 'exempt' ? 0 : Math.max(0, total - supply);
  const short = useWallet && summary != null && summary.balanceKrw < CASHBILL_UNIT_PRICE_KRW;
  const after = summary ? summary.balanceKrw - CASHBILL_UNIT_PRICE_KRW : 0;

  return (
    <IssueModalFrame
      inline={embedded}
      title="현금영수증 발행"
      onClose={onClose}
      footer={(
        <div className="flex flex-wrap items-center justify-between gap-2">
          {useWallet ? (
            <p className={`text-fluid-xs ${short ? 'text-red-700' : 'text-slate-600'}`}>
              {short ? '잔액이 부족합니다' : `발행 비용 ${won(CASHBILL_UNIT_PRICE_KRW)} · 지갑 ${summary ? won(summary.balanceKrw) : '…'} → ${won(after)}`}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            {usage === 'biz' ? (
              <label className="inline-flex items-center gap-1.5 text-fluid-xs text-slate-700">
                <input type="checkbox" checked={saveBuyer} onChange={(e) => setSaveBuyer(e.target.checked)} className="rounded" />
                이 거래처 저장
              </label>
            ) : null}
            <button type="button" className={BTN_GHOST} onClick={onClose}>취소</button>
            {useWallet && short ? (
              <button type="button" className={BTN} onClick={() => openCharge()}>충전하기</button>
            ) : (
              <button type="button" className={BTN} disabled={busy || (!selected && !unmatched) || linkedBrands.length === 0} onClick={askIssue}>
                {busy ? '발행 중…' : '발행하기'}
              </button>
            )}
          </div>
        </div>
      )}
    >
      {confirmOpen ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-xl">
            <p className="text-fluid-sm font-semibold text-slate-900">발행을 진행할까요?</p>
            {diffs.length > 0 ? (
              <p className="mt-2 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-fluid-xs text-orange-950">
                기본설정과 다름: {diffs.join(' · ')}
              </p>
            ) : null}
            {over > 0 ? (
              <p className="mt-2 text-fluid-xs text-slate-700">
                한도 {won(selected?.remainingWon ?? 0)} + 추가 {won(over)} = {won(total)}
              </p>
            ) : null}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className={BTN_GHOST} onClick={() => setConfirmOpen(false)}>취소</button>
              <button type="button" className={BTN} disabled={busy} onClick={() => { setConfirmOpen(false); void submit(); }}>발행</button>
            </div>
          </div>
        </div>
      ) : null}
      {error ? <p className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-fluid-xs text-red-800">{error}</p> : null}

      <div className="space-y-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-fluid-sm font-semibold text-slate-800">과세 / 면세</p>
          {defaultsReady && activeKind !== defaults.taxKind ? <DefaultChip text={cashbillTaxKindLabel(defaults.taxKind)} /> : null}
        </div>
        <div role="radiogroup" aria-label="과세 구분" className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={exemptLocked}
            aria-checked={activeKind === 'taxable'}
            className={`min-h-12 rounded-xl border-2 text-fluid-sm font-bold disabled:opacity-50 ${activeKind === 'taxable' ? 'border-sky-500 bg-sky-100 text-sky-950' : 'border-slate-200 bg-white text-slate-600'}`}
            onClick={() => setTaxKind('taxable')}
          >
            과세
          </button>
          <button
            type="button"
            aria-checked={activeKind === 'exempt'}
            className={`min-h-12 rounded-xl border-2 text-fluid-sm font-bold ${activeKind === 'exempt' ? 'border-emerald-500 bg-emerald-100 text-emerald-950' : 'border-slate-200 bg-white text-slate-600'}`}
            onClick={() => setTaxKind('exempt')}
          >
            면세
          </button>
        </div>
        {exemptLocked ? <span className="text-fluid-2xs text-slate-500">면세사업자는 면세로 고정됩니다.</span> : null}
      </div>

      {linkedBrands.length > 1 ? (
        <label className="block space-y-1 text-fluid-xs text-slate-700">
          <span>브랜드</span>
          <select
            value={brandId}
            onChange={(e) => {
              const next = e.target.value;
              setBrandId(next);
              if (brands.find((brand) => brand.id === next)?.taxType === '4') setTaxKind('exempt');
            }}
            className="min-h-9 w-full rounded-lg border border-slate-300 px-2"
          >
            {linkedBrands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
          </select>
        </label>
      ) : null}
      {allowInquiry ? (
        <>
          {unmatched ? (
            <div className="space-y-1">
              <div className="flex items-end gap-2">
                <label className="min-w-0 flex-1 space-y-1 text-fluid-xs text-slate-700">
                  <span>① 고객명 (선택)</span>
                  <input
                    autoFocus
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    maxLength={64}
                    placeholder="예: 홍길동"
                    className="min-h-9 w-full rounded-lg border border-slate-300 px-2"
                  />
                </label>
                <button type="button" className={BTN_GHOST} onClick={() => { setUnmatched(false); setPhoneHits([]); }}>접수에서 찾기</button>
              </div>
              <p className="text-fluid-2xs text-slate-500">접수 없이 발행합니다. 이름을 적어 두면 목록에서 누구 건인지 보이고, 비우면 「연계 없음」으로 보입니다.</p>
            </div>
          ) : (
            <div className="flex items-end gap-2">
              <label className="min-w-0 flex-1 space-y-1 text-fluid-xs text-slate-700">
                <span>① 고객</span>
                <input
                  readOnly={Boolean(selected)}
                  value={selected ? (selected.displayName || selected.customerName) : query}
                  onChange={(e) => { if (!selected) setQuery(e.target.value); }}
                  placeholder="고객명 또는 전화번호로 접수 찾기"
                  className="min-h-9 w-full rounded-lg border border-slate-300 px-2"
                />
              </label>
              <button type="button" className={BTN_GHOST} onClick={selected ? chooseOtherCustomer : clearMatch}>{selected ? '다른 고객' : '직접 입력'}</button>
            </div>
          )}
          {!unmatched && !selected && query.trim().length >= 2 && searched === query.trim() && hits.length === 0 ? (
            <p className="text-fluid-2xs text-slate-500">찾는 접수가 없어요. 접수 없이 발행하려면 「직접 입력」을 누르세요.</p>
          ) : null}
          {!unmatched && !selected && hits.length > 0 ? (
            <ul className="space-y-1">
              {hits.map((hit) => (
                <li key={hit.id}>
                  <button type="button" className={`${BTN_GHOST} w-full text-left`} onClick={() => pick(hit)}>
                    {hit.displayName || hit.customerName} · {hit.customerPhone || '번호 없음'} · {hit.createdAt?.slice(0, 10) ?? ''} · 총액 {won(hit.totalWon ?? hit.remainingWon)} · 발행 가능 {won(hit.remainingWon)}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {selected && !unmatched ? (
            <p className="text-fluid-xs text-slate-700">접수 {selected.displayName || selected.customerName} · {selected.brandName} · 가능 {won(selected.remainingWon)}</p>
          ) : null}
        </>
      ) : (
        <label className="block space-y-1 text-fluid-xs text-slate-700">
          <span>① 고객명 (선택)</span>
          <input
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            maxLength={64}
            placeholder="예: 홍길동"
            className="min-h-9 w-full rounded-lg border border-slate-300 px-2"
          />
        </label>
      )}
      <label className="block space-y-1 text-fluid-xs text-slate-700">
        <span>② 금액</span>
        <span className="flex items-center gap-2">
          <input inputMode="numeric" value={amount ? Number(amount).toLocaleString('ko-KR') : ''} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))} className="min-h-9 w-36 rounded-lg border border-slate-300 px-2 text-right tabular-nums" aria-label="금액" />
          <span>원</span>
        </span>
        {selected && !unmatched ? <span className="text-fluid-2xs text-slate-500">발행 가능 한도 {won(selected.remainingWon)}</span> : null}
        {allowInquiry ? <ReceiptOverAmountFields overWon={over} reason={extraReason} onReason={setExtraReason} /> : null}
        {total > 0 ? <span className="text-fluid-2xs text-slate-600">공급가액 {won(supply)} · 부가세 {won(vat)}</span> : null}
      </label>
      <div className="space-y-1">
        <p className="text-fluid-xs text-slate-700">
          ③ 용도
          {defaultsReady && usage !== defaults.usage ? <DefaultChip text={cashbillUsageLabel(defaults.usage)} /> : null}
        </p>
        <div className="flex flex-wrap gap-1">
          {([
            ['phone', '소득공제(휴대폰)'],
            ['biz', '지출증빙(사업자)'],
            ['voluntary', '자진발급'],
          ] as const).map(([id, label]) => (
            <button key={id} type="button" className={`${KIND_BTN} ${usage === id ? KIND_ON : KIND_OFF}`} onClick={() => setUsage(id)}>
              {label}
            </button>
          ))}
        </div>
      </div>
      {identityHint ? <p className="text-fluid-xs text-amber-800">{identityHint}</p> : null}
      {usage === 'biz' ? (
        <div className="space-y-2">
          <TaxInvoiceBuyerPicker
            api={buyerApi}
            title="거래처에서 고르기"
            onPick={(row) => {
              setIdentity(row.bizNumber);
              if (row.corpName.trim()) setCustomerName(row.corpName);
            }}
          />
          <input
            value={identity}
            onChange={(e) => setIdentity(e.target.value)}
            placeholder="사업자번호 10자리"
            maxLength={12}
            aria-label="사업자번호"
            className="min-h-9 w-full rounded-lg border border-slate-300 px-2 text-fluid-xs"
          />
        </div>
      ) : usage === 'voluntary' ? (
        <p className="text-fluid-xs text-slate-600">자진발급 010-000-1234</p>
      ) : (
        <input
          value={identity}
          onChange={(e) => setIdentity(e.target.value)}
          placeholder="휴대폰 11자리"
          maxLength={13}
          aria-label="휴대폰 번호"
          className="min-h-9 w-full rounded-lg border border-slate-300 px-2 text-fluid-xs"
        />
      )}
      {allowInquiry && phoneHits.length > 0 ? (
        <div className="space-y-1 rounded-lg border border-[#b9cdf7] bg-[#f3f7ff] px-2.5 py-2">
          <p className="text-fluid-2xs font-medium text-[#1f4fb8]">이 번호로 받은 접수가 있어요. 연결하면 고객명과 발행 가능 금액이 함께 들어갑니다.</p>
          {phoneHits.map((hit) => (
            <div key={hit.id} className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate text-fluid-xs text-slate-800">
                <b className="font-semibold">{hit.displayName || hit.customerName}</b> · {hit.inquiryNumber ?? '접수'} · {hit.createdAt?.slice(5, 10).replace('-', '.') ?? ''} · 가능 {won(hit.remainingWon)}
              </span>
              <Button size="sm" variant="primary" onClick={() => pick(hit)}>연결</Button>
            </div>
          ))}
        </div>
      ) : null}
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
          <span>
            ⑤ 품목명
            {defaultsReady && (itemName.trim() || '청소 서비스') !== (defaults.itemName.trim() || '청소 서비스') ? (
              <DefaultChip text={defaults.itemName || '청소 서비스'} />
            ) : null}
          </span>
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
