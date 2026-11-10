import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { CASHBILL_COST_KRW, CASHBILL_UNIT_PRICE_KRW } from '@shared/barobillPolicy';
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
import { LineMdIcon } from '../ui/LineMdIcon';
import { SegmentedControl } from '../ui/SegmentedControl';
import TaxInvoiceBuyerPicker from '../taxinvoice/TaxInvoiceBuyerPicker';
import { CashbillIssuePreview } from './CashbillIssuePreview';

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

function initialOf(name: string): string {
  const t = name.trim();
  return t ? t.slice(0, 1) : '?';
}

const INPUT =
  'h-[38px] w-full rounded-[10px] border-0 bg-[#F4F6FA] px-3 text-[14px] text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300';
const TEXTAREA =
  'w-full resize-none rounded-[10px] border-0 bg-[#F4F6FA] px-3 py-2 text-[14px] text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300';
const ROW = 'grid grid-cols-1 items-start gap-2 sm:grid-cols-[72px_1fr] sm:gap-x-3 sm:gap-y-0 lg:grid-cols-[88px_1fr]';
const LABEL = 'pt-0 text-[13px] font-medium text-[#64748B] sm:pt-[9px]';
const DIVIDER = 'my-4 border-0 border-t border-[#F1F5F9]';

function FieldRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={ROW}>
      <span className={LABEL}>{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
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

export function CashbillIssueForm({
  brands,
  onClose,
  onDone,
  seed,
  embedded = false,
  seedInquiryId = '',
  adapter,
  platformTenantId,
  pcAsideExtra,
  pageLayout = false,
  onDirtyChange,
}: {
  brands: CashbillBrand[];
  onClose: () => void;
  onDone: (issueId: string) => void;
  seed?: CashbillIssueSeed | null;
  embedded?: boolean;
  seedInquiryId?: string;
  adapter?: CashbillIssuerAdapter;
  platformTenantId?: string;
  /** PC(lg+) 미리보기 아래 — 요약 카드 등 */
  pcAsideExtra?: ReactNode;
  /** 페이지 레이아웃: 왼쪽 흰 카드 + 오른쪽 프리뷰 (lg+) */
  pageLayout?: boolean;
  /** 사용자가 편집하면 호출 (마운트 초기화 완료 후만) */
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const { summary, openCharge, reload } = useReceiptWallet();
  const allowInquiry = !adapter || adapter.allowInquiry;
  const useWallet = !adapter || adapter.useWallet;
  const buyerApi = adapter?.buyerApi ?? tenantTaxInvoiceBuyerApi;
  const isPlatform = adapter?.mode === 'platform';
  const initializedRef = useRef(false);

  function markDirty() {
    if (initializedRef.current && onDirtyChange) onDirtyChange(true);
  }

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
        if (values.memo) setMemo(values.memo);
      } else if (seed.taxKind == null) {
        setTaxKind(values.taxKind);
      }
      setDefaultsReady(true);
      initializedRef.current = true;
    };
    void load().catch(() => {
      if (!stop) { setDefaultsReady(true); initializedRef.current = true; }
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

  const taxDiffers = defaultsReady && activeKind !== defaults.taxKind;
  const issueLabel = busy
    ? '발행 중…'
    : taxDiffers
      ? `${cashbillTaxKindLabel(activeKind)}로 발행`
      : '발행하기';

  const customerMode = unmatched ? 'manual' : 'search';
  const selectedName = selected ? (selected.displayName || selected.customerName) : '';
  const cleanDay = selected?.createdAt?.slice(0, 10) ?? '';
  const previewCustomer =
    unmatched
      ? (customerName.trim() || '직접 입력')
      : selected
        ? selectedName
        : '고객 미선택';
  const issueDisabled = busy || (!selected && !unmatched) || linkedBrands.length === 0;

  const preview = (
    <CashbillIssuePreview
      customerLabel={previewCustomer}
      itemName={itemName}
      tradeDate={tradeDate}
      taxKind={activeKind}
      usage={usage}
      supply={supply}
      vat={vat}
      total={total}
      defaultsReady={defaultsReady}
      defaults={defaults}
      issueLabel={issueLabel}
      busy={busy}
      disabled={issueDisabled}
      short={Boolean(short)}
      useWallet={useWallet}
      balanceKrw={summary?.balanceKrw ?? null}
      onIssue={askIssue}
      onCharge={() => openCharge()}
      pageLayout={pageLayout}
    />
  );

  const footerJSX = (
    <div className="border-t border-[#F1F5F9] pt-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className={`text-[12px] ${short ? 'font-medium text-red-700' : 'text-[#64748B]'}`}>
          {useWallet
            ? (short
              ? '잔액이 부족합니다'
              : `발행 비용 ${won(CASHBILL_UNIT_PRICE_KRW)} · 지갑 ${summary ? won(summary.balanceKrw) : '…'}`)
            : `원가 ${won(CASHBILL_COST_KRW)}`}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {!embedded && !pageLayout ? (
            <button
              type="button"
              className="h-[38px] rounded-[10px] px-3 text-[13px] text-[#64748B] hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
              onClick={onClose}
            >
              취소
            </button>
          ) : null}
          {useWallet && short ? (
            <button
              type="button"
              className="h-[46px] min-w-[160px] rounded-[12px] bg-[#1e3a5f] px-5 text-[14px] font-semibold text-white hover:bg-[#152a45] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
              onClick={() => openCharge()}
            >
              충전하기
            </button>
          ) : (
            <button
              type="button"
              className="h-[46px] min-w-[160px] rounded-[12px] bg-[#1e3a5f] px-5 text-[14px] font-semibold text-white hover:bg-[#152a45] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 disabled:pointer-events-none disabled:opacity-50"
              disabled={issueDisabled}
              onClick={askIssue}
            >
              {issueLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className={pageLayout ? 'lg:flex lg:w-[1040px] lg:items-start lg:gap-6' : embedded ? 'lg:flex lg:items-start lg:gap-4' : undefined}>
    <div className={pageLayout ? 'min-w-0 lg:w-[640px] lg:shrink-0' : embedded ? 'min-w-0 lg:w-[700px] lg:shrink-0' : undefined}>
    <IssueModalFrame
      inline={embedded || pageLayout}
      softCard
      pageCard={pageLayout}
      hideHeader
      hideFooterOnLg={embedded || pageLayout}
      title="현금영수증 발행"
      onClose={onClose}
      footer={footerJSX}
    >
      {confirmOpen ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-xl">
            <p className="text-[14px] font-semibold text-slate-900">발행을 진행할까요?</p>
            {diffs.length > 0 ? (
              <p className="mt-2 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-[12px] text-orange-950">
                기본설정과 다름: {diffs.join(' · ')}
              </p>
            ) : null}
            {over > 0 ? (
              <p className="mt-2 text-[12px] text-slate-700">
                한도 {won(selected?.remainingWon ?? 0)} + 추가 {won(over)} = {won(total)}
              </p>
            ) : null}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="h-[38px] rounded-[10px] px-3 text-[13px] text-[#64748B] hover:bg-slate-50" onClick={() => setConfirmOpen(false)}>취소</button>
              <button
                type="button"
                className="h-[38px] rounded-[10px] bg-[#1e3a5f] px-4 text-[13px] font-semibold text-white disabled:opacity-50"
                disabled={busy}
                onClick={() => { setConfirmOpen(false); void submit(); }}
              >
                발행
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* 1) 제목 + 브랜드 */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[16px] font-bold text-slate-900">현금영수증 발행</h2>
        {linkedBrands.length > 1 ? (
          <select
            value={brandId}
            aria-label="브랜드"
            onChange={(e) => {
              const next = e.target.value;
              setBrandId(next);
              if (brands.find((brand) => brand.id === next)?.taxType === '4') setTaxKind('exempt');
            }}
            className="h-[30px] max-w-[160px] truncate rounded-full border-0 bg-[#EEF1F6] px-3 text-[12px] font-medium text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
          >
            {linkedBrands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
          </select>
        ) : linkedBrands[0] ? (
          <span className="inline-flex h-[30px] items-center rounded-full bg-[#EEF1F6] px-3 text-[12px] font-medium text-slate-700">
            {linkedBrands[0].name}
          </span>
        ) : null}
      </div>

      <div className={pageLayout ? 'space-y-4' : undefined}>
      {error ? <p className="rounded-[10px] bg-red-50 px-3 py-2 text-[12px] text-red-800">{error}</p> : null}

      {/* 2) 고객 */}
      {allowInquiry ? (
        <FieldRow label="고객">
          <div className="space-y-2">
            {/* 모바일: 세그먼트 유지 */}
            <div className="lg:hidden">
              <SegmentedControl
                ariaLabel="고객 입력 방식"
                value={customerMode}
                onChange={(next) => {
                  if (next === 'manual') clearMatch();
                  else {
                    setUnmatched(false);
                    setPhoneHits([]);
                    if (selected) chooseOtherCustomer();
                  }
                }}
                options={[
                  { value: 'search', label: '접수에서 찾기' },
                  { value: 'manual', label: '직접 입력' },
                ]}
              />
            </div>
            {unmatched ? (
              <div className="space-y-2">
                <input
                  autoFocus
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  maxLength={64}
                  placeholder="고객명 (선택)"
                  className={INPUT}
                />
                <button
                  type="button"
                  className="hidden text-[12px] font-medium text-[#475569] hover:text-slate-900 lg:inline"
                  onClick={() => {
                    setUnmatched(false);
                    setPhoneHits([]);
                    setCustomerName('');
                  }}
                >
                  접수로 찾기
                </button>
              </div>
            ) : selected ? (
              <div className="flex items-center gap-3 rounded-[14px] bg-[#F8FAFC] px-3 py-2.5">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#E0E7FF] text-[14px] font-semibold text-[#3730A3]">
                  {initialOf(selectedName)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold text-slate-900">{selectedName}</p>
                  <p className="truncate text-[12px] text-[#64748B]">
                    {[selected.customerPhone || '번호 없음', selected.inquiryNumber || '접수', cleanDay].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <button type="button" className="shrink-0 text-[12px] font-medium text-[#64748B] hover:text-slate-900" onClick={chooseOtherCustomer}>
                  다른 고객
                </button>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative min-w-0 flex-1">
                    <LineMdIcon name="search" className="pointer-events-none absolute left-3 top-1/2 hidden size-4 -translate-y-1/2 text-[#94A3B8] lg:block" />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="고객명 또는 전화번호"
                      className={`${INPUT} lg:pl-9`}
                      aria-label="고객 검색"
                    />
                  </div>
                  <button
                    type="button"
                    className="hidden shrink-0 text-[12px] font-medium text-[#475569] hover:text-slate-900 lg:inline"
                    onClick={() => clearMatch()}
                  >
                    접수 없이 직접 입력
                  </button>
                </div>
                {!selected && query.trim().length >= 2 && searched === query.trim() && hits.length === 0 ? (
                  <p className="text-[12px] text-[#64748B]">찾는 접수가 없어요. 「직접 입력」으로 발행할 수 있어요.</p>
                ) : null}
                {hits.length > 0 ? (
                  <ul className="max-h-40 space-y-1 overflow-y-auto">
                    {hits.map((hit) => (
                      <li key={hit.id}>
                        <button
                          type="button"
                          className="w-full rounded-[10px] bg-[#F4F6FA] px-3 py-2 text-left text-[13px] text-slate-800 hover:bg-[#EEF1F6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
                          onClick={() => pick(hit)}
                        >
                          <span className="font-semibold">{hit.displayName || hit.customerName}</span>
                          <span className="text-[#64748B]"> · {hit.customerPhone || '번호 없음'} · {hit.createdAt?.slice(0, 10) ?? ''} · 가능 {won(hit.remainingWon)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </>
            )}
          </div>
        </FieldRow>
      ) : (
        <FieldRow label="고객">
          <input
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            maxLength={64}
            placeholder="고객명 (선택)"
            className={INPUT}
          />
        </FieldRow>
      )}

      {pageLayout ? null : <hr className={DIVIDER} />}

      {/* 3) 금액 */}
      <FieldRow label="금액">
        <div className="space-y-1.5">
          {pageLayout ? (
            <div className="flex flex-wrap items-baseline gap-1.5">
              <input
                inputMode="numeric"
                value={amount ? Number(amount).toLocaleString('ko-KR') : ''}
                onChange={(e) => { setAmount(e.target.value.replace(/\D/g, '')); markDirty(); }}
                aria-label="금액"
                className="h-[38px] w-[160px] rounded-[10px] border-0 bg-[#F4F6FA] px-3 text-[16px] font-bold tabular-nums text-slate-900 placeholder:font-normal placeholder:text-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
                placeholder="0"
              />
              <span className="shrink-0 text-[14px] text-[#64748B]">원</span>
              {selected && !unmatched ? (
                <span className="text-[12px] text-[#64748B]">발행 가능 한도 {won(selected.remainingWon)}</span>
              ) : null}
            </div>
          ) : (
            <div className="flex items-baseline gap-1 border-b border-slate-200 pb-1">
              <input
                inputMode="numeric"
                value={amount ? Number(amount).toLocaleString('ko-KR') : ''}
                onChange={(e) => { setAmount(e.target.value.replace(/\D/g, '')); markDirty(); }}
                aria-label="금액"
                className="w-full border-0 bg-transparent text-[22px] font-bold tabular-nums text-slate-900 placeholder:font-normal placeholder:text-slate-300 focus-visible:outline-none"
                placeholder="0"
              />
              <span className="shrink-0 text-[14px] text-[#64748B]">원</span>
            </div>
          )}
          <p className="text-[12px] text-[#64748B]">
            {activeKind === 'exempt'
              ? '면세 · 부가세 없음'
              : total > 0
                ? `공급가액 ${won(supply)} · 부가세 ${won(vat)}`
                : '공급가액 · 부가세'}
            {!pageLayout && selected && !unmatched ? ` · 발행 가능 한도 ${won(selected.remainingWon)}` : null}
          </p>
          {allowInquiry ? (
            <div className="[&_input]:h-[38px] [&_input]:rounded-[10px] [&_input]:border-0 [&_input]:bg-[#F4F6FA] [&_input]:px-3 [&_input]:text-[14px] [&_input]:focus-visible:outline-none [&_input]:focus-visible:ring-2 [&_input]:focus-visible:ring-slate-300">
              <ReceiptOverAmountFields overWon={over} reason={extraReason} onReason={setExtraReason} />
            </div>
          ) : null}
        </div>
      </FieldRow>

      {pageLayout ? null : <hr className={DIVIDER} />}

      {/* 4) 거래유형 */}
      <FieldRow label="거래유형">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <SegmentedControl
              ariaLabel="과세 구분"
              value={activeKind}
              onChange={(next) => setTaxKind(next)}
              options={[
                {
                  value: 'taxable',
                  label: (
                    <span className="inline-flex items-center justify-center gap-1.5">
                      <span className="size-1.5 rounded-full bg-[#3B82F6]" aria-hidden />
                      과세
                    </span>
                  ),
                  disabled: exemptLocked,
                },
                {
                  value: 'exempt',
                  label: (
                    <span className="inline-flex items-center justify-center gap-1.5">
                      <span className="size-1.5 rounded-full bg-[#10B981]" aria-hidden />
                      면세
                    </span>
                  ),
                },
              ]}
            />
            {defaultsReady && !taxDiffers ? (
              <span className="text-[12px] text-[#64748B]">기본값</span>
            ) : null}
            {defaultsReady && taxDiffers ? (
              <span className="inline-flex items-center gap-1 text-[12px] font-medium text-orange-700">
                <span aria-hidden>⚠</span>
                기본은 {cashbillTaxKindLabel(defaults.taxKind)}예요
              </span>
            ) : null}
          </div>
          {exemptLocked ? <p className="text-[11px] text-[#64748B]">면세사업자는 면세로 고정됩니다.</p> : null}
        </div>
      </FieldRow>

      {pageLayout ? null : <hr className={DIVIDER} />}

      {/* 5) 용도 */}
      <FieldRow label="용도">
        <div className="space-y-2">
          {usage === 'voluntary' ? (
            <div className="space-y-1.5">
              <p className="text-[13px] text-slate-700">자진발급 010-000-1234</p>
              <button type="button" className="text-[12px] font-medium text-[#64748B] no-underline" onClick={() => setUsage('phone')}>
                소득공제·지출증빙으로 바꾸기
              </button>
            </div>
          ) : (
            <>
              {/* 모바일: 기존 세로 배치 */}
              <div className="space-y-2 lg:hidden">
                <SegmentedControl
                  ariaLabel="용도"
                  value={usage === 'biz' ? 'biz' : 'phone'}
                  onChange={(next) => setUsage(next)}
                  options={[
                    { value: 'phone', label: '소득공제' },
                    { value: 'biz', label: '지출증빙' },
                  ]}
                />
                <button type="button" className="text-[12px] text-[#64748B] no-underline" onClick={() => setUsage('voluntary')}>
                  자진발급
                </button>
                {usage === 'phone' ? (
                  <input
                    value={identity}
                    onChange={(e) => setIdentity(e.target.value)}
                    placeholder="휴대폰"
                    maxLength={13}
                    aria-label="휴대폰 번호"
                    className={INPUT}
                  />
                ) : null}
                {usage === 'biz' ? (
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        value={identity}
                        onChange={(e) => setIdentity(e.target.value)}
                        placeholder="사업자번호"
                        maxLength={12}
                        aria-label="사업자번호"
                        className={`${INPUT} min-w-0 flex-1`}
                      />
                      <TaxInvoiceBuyerPicker
                        api={buyerApi}
                        title="거래처에서 고르기"
                        onPick={(row) => {
                          setIdentity(row.bizNumber);
                          if (row.corpName.trim()) setCustomerName(row.corpName);
                        }}
                      />
                    </div>
                  </div>
                ) : null}
              </div>
              {/* PC: 한 줄 */}
              <div className="hidden flex-wrap items-center gap-2 lg:flex">
                <SegmentedControl
                  ariaLabel="용도"
                  value={usage === 'biz' ? 'biz' : 'phone'}
                  onChange={(next) => setUsage(next)}
                  options={[
                    { value: 'phone', label: '소득공제' },
                    { value: 'biz', label: '지출증빙' },
                  ]}
                />
                {usage === 'phone' ? (
                  <input
                    value={identity}
                    onChange={(e) => setIdentity(e.target.value)}
                    placeholder="휴대폰"
                    maxLength={13}
                    aria-label="휴대폰 번호"
                    className={`${INPUT} w-[180px]`}
                  />
                ) : null}
                {usage === 'biz' ? (
                  <>
                    <input
                      value={identity}
                      onChange={(e) => setIdentity(e.target.value)}
                      placeholder="사업자번호"
                      maxLength={12}
                      aria-label="사업자번호"
                      className={`${INPUT} w-[220px]`}
                    />
                    <TaxInvoiceBuyerPicker
                      api={buyerApi}
                      title="거래처에서 고르기"
                      onPick={(row) => {
                        setIdentity(row.bizNumber);
                        if (row.corpName.trim()) setCustomerName(row.corpName);
                      }}
                    />
                  </>
                ) : null}
                <button type="button" className="shrink-0 text-[12px] text-[#64748B] no-underline" onClick={() => setUsage('voluntary')}>
                  자진발급
                </button>
              </div>
            </>
          )}
          {identityHint ? <p className="text-[12px] text-amber-800">{identityHint}</p> : null}
          {usage === 'biz' ? (
            <label className="inline-flex items-center gap-2 text-[12px] text-slate-700">
              <input
                type="checkbox"
                checked={saveBuyer}
                onChange={(e) => setSaveBuyer(e.target.checked)}
                className="size-3.5 rounded border-slate-300 text-[#1e3a5f] accent-[#1e3a5f]"
              />
              이 거래처 저장
            </label>
          ) : null}
          {allowInquiry && phoneHits.length > 0 ? (
            <div className="space-y-1 rounded-[10px] bg-[#F3F7FF] px-2.5 py-2">
              <p className="text-[11px] font-medium text-[#1f4fb8]">이 번호로 받은 접수가 있어요. 연결하면 고객명과 발행 가능 금액이 함께 들어갑니다.</p>
              {phoneHits.map((hit) => (
                <div key={hit.id} className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-[12px] text-slate-800">
                    <b className="font-semibold">{hit.displayName || hit.customerName}</b> · {hit.inquiryNumber ?? '접수'} · 가능 {won(hit.remainingWon)}
                  </span>
                  <Button size="sm" variant="primary" onClick={() => pick(hit)}>연결</Button>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </FieldRow>

      {pageLayout ? null : <hr className={DIVIDER} />}

      {/* 6) 이메일 · 품목 · 거래일 */}
      <FieldRow label="이메일">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="선택 · 넣으면 영수증 메일이 가요"
          className={`${INPUT} lg:w-[360px]`}
        />
      </FieldRow>
      {/* 모바일: 품목·거래일 분리 */}
      <div className={`${pageLayout ? '' : 'mt-4 '}space-y-4 lg:hidden`}>
        <FieldRow label="품목">
          <input value={itemName} onChange={(e) => setItemName(e.target.value)} className={INPUT} />
        </FieldRow>
        <FieldRow label="거래일">
          <SegmentedControl
            ariaLabel="거래일"
            value={tradeDate === yesterday ? 'yesterday' : 'today'}
            onChange={(next) => setTradeDate(next === 'yesterday' ? yesterday : today)}
            options={[
              { value: 'today', label: '오늘' },
              { value: 'yesterday', label: '어제' },
            ]}
          />
        </FieldRow>
      </div>
      {/* PC: 품목 · 거래일 한 줄 */}
      <div className={`${pageLayout ? '' : 'mt-4 '}hidden lg:block`}>
        <FieldRow label="품목 · 거래일">
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              className={`${INPUT} w-[220px]`}
              aria-label="품목"
            />
            <SegmentedControl
              ariaLabel="거래일"
              value={tradeDate === yesterday ? 'yesterday' : 'today'}
              onChange={(next) => setTradeDate(next === 'yesterday' ? yesterday : today)}
              options={[
                { value: 'today', label: '오늘' },
                { value: 'yesterday', label: '어제' },
              ]}
            />
          </div>
        </FieldRow>
      </div>

      {pageLayout ? null : <hr className={DIVIDER} />}

      {/* 7) 메모 — 항상 표시 */}
      <FieldRow label="메모">
        <div className="space-y-1">
          <textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            rows={2}
            placeholder="예) 잔금 현금 입금분, 고객 요청으로 발행"
            className={TEXTAREA}
          />
          <p className="text-[11px] text-[#64748B]">우리끼리 보는 메모예요. 고객 영수증에는 안 나가요.</p>
        </div>
      </FieldRow>
      </div>
    </IssueModalFrame>
    </div>
    {(embedded || pageLayout) ? (
      <aside className={
        pageLayout
          ? 'mt-4 hidden lg:sticky lg:top-4 lg:mt-0 lg:block lg:w-[376px] lg:shrink-0'
          : 'mt-4 hidden min-w-0 flex-1 space-y-3 lg:sticky lg:top-4 lg:mt-0 lg:block'
      }>
        {preview}
        {!pageLayout ? pcAsideExtra : null}
      </aside>
    ) : null}
    </div>
  );
}
