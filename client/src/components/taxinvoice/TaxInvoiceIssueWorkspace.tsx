import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { TAXINVOICE_UNIT_PRICE_KRW } from '@shared/barobillPolicy';
import { isValidKoreanBizNumberChecksum } from '@shared/authSignup';
import { isBlankSupplierField, supplierIncompleteMessage } from '@shared/supplierFieldText';
import {
  fetchTaxInvoiceSource,
  issueTaxInvoice,
  listTaxInvoices,
  searchTaxInvoiceInquiries,
  type TaxInvoiceBrand,
  type TaxInvoiceSearchHit,
  type TaxInvoiceSupplier,
} from '../../api/taxInvoices';
import { useModalScrollKeyboardAvoidance } from '../../hooks/useMobileInputVisibility';
import { useReceiptWallet } from '../wallet/ReceiptWalletProvider';
import { SupplierInfoModal } from './SupplierInfoModal';
import { clearTaxInvoiceDraft, readTaxInvoiceDraft, writeTaxInvoiceDraft, type TaxInvoiceDraft } from './taxInvoiceDraft';
import { TaxInvoiceMobileCards, TaxInvoicePaper, type TaxFormProps } from './TaxInvoiceFormViews';
import {
  emptyLine,
  emptyParty,
  formatBizInput,
  kstToday,
  lineSupply,
  lineTax,
  moneyNumber,
  patchLine,
  TAX_KIND_HINT,
  won,
  writeDateOptions,
  type TaxFormLine,
  type TaxKind,
  type TaxParty,
} from './taxInvoiceFormModel';
import './taxinvoice-issue.css';

const TAX_KIND_LABEL: Record<TaxKind, string> = { taxable: '과세', zero: '영세', exempt: '면세' };

function TaxKindSwitch({ kind, locked, disabled, mobile, onChange }: {
  kind: TaxKind;
  locked: boolean;
  disabled: boolean;
  mobile?: boolean;
  onChange: (kind: TaxKind) => void;
}) {
  const items: TaxKind[] = ['taxable', 'zero', 'exempt'];
  if (mobile) {
    return (
      <div role="radiogroup" aria-label="과세 구분" className="grid grid-cols-3 rounded-lg bg-gray-100 p-0.5 text-[13px] font-semibold">
        {items.map((item) => {
          const on = kind === item;
          return (
            <button key={item} type="button" role="radio" aria-checked={on} disabled={disabled || (locked && item !== 'exempt')} className={on ? 'rounded-md bg-white py-2 text-center shadow-sm' : 'py-2 text-center text-gray-500'} onClick={() => onChange(item)}>{TAX_KIND_LABEL[item]}</button>
          );
        })}
      </div>
    );
  }
  return (
    <div role="radiogroup" aria-label="과세 구분" className="inline-flex rounded-lg bg-gray-100 p-0.5 text-sm">
      {items.map((item) => {
        const on = kind === item;
        return (
          <button key={item} type="button" role="radio" aria-checked={on} disabled={disabled || (locked && item !== 'exempt')} className={`tt rounded-md px-3 py-1.5 font-semibold ${on ? 'bg-white shadow-sm' : 'text-gray-500'}`} onClick={() => onChange(item)}>{TAX_KIND_LABEL[item]}</button>
        );
      })}
    </div>
  );
}

function supplierParty(supplier: TaxInvoiceSupplier | null | undefined): TaxParty {
  if (!supplier) return emptyParty();
  return {
    corpNum: formatBizInput(supplier.corpNum),
    taxRegId: '',
    corpName: supplier.corpName,
    ceoName: supplier.ceoName,
    addr: supplier.addr,
    bizType: supplier.bizType,
    bizClass: supplier.bizClass,
    email: supplier.email,
  };
}

export function TaxInvoiceIssueWorkspace() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inquiryId = searchParams.get('inquiryId') || '';
  const fromId = searchParams.get('from') || '';
  const { summary, openCharge, reload } = useReceiptWallet();
  const dates = useMemo(() => writeDateOptions(), []);
  const [brands, setBrands] = useState<TaxInvoiceBrand[]>([]);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<TaxInvoiceSearchHit[]>([]);
  const [picked, setPicked] = useState<TaxInvoiceSearchHit | null>(null);
  const [unmatched, setUnmatched] = useState(false);
  const [brandId, setBrandId] = useState('');
  const [purpose, setPurpose] = useState<1 | 2>(1);
  const [taxKind, setTaxKind] = useState<TaxKind>('taxable');
  const [writeDate, setWriteDate] = useState(dates[0] ?? kstToday());
  const [buyer, setBuyer] = useState<TaxParty>(emptyParty());
  const [lines, setLines] = useState<TaxFormLine[]>(() => [emptyLine(dates[0] ?? kstToday())]);
  const [remark, setRemark] = useState('');
  const [cash, setCash] = useState('');
  const [chkBill, setChkBill] = useState('');
  const [note, setNote] = useState('');
  const [credit, setCredit] = useState('');
  const [preview, setPreview] = useState(false);
  const [paperOpen, setPaperOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draftOffer, setDraftOffer] = useState<TaxInvoiceDraft | null>(null);
  const [supplierOpen, setSupplierOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { onFieldFocus } = useModalScrollKeyboardAvoidance(scrollRef, true, 96);

  const reloadBrands = useCallback((announce: boolean) => {
    listTaxInvoices(new URLSearchParams({ datePreset: 'today', limit: '1' }))
      .then((res) => {
        setBrands(res.brands);
        setBrandId((prev) => prev || res.brands.find((brand) => brand.linked)?.id || res.brands[0]?.id || '');
      })
      .catch((err: unknown) => {
        if (announce) setError(err instanceof Error ? err.message : '브랜드를 불러오지 못했습니다.');
      });
  }, []);

  useEffect(() => {
    reloadBrands(true);
  }, [reloadBrands]);

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === 'hidden') return;
      reloadBrands(false);
    };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [reloadBrands]);

  useEffect(() => {
    if (!inquiryId) return;
    let stop = false;
    searchTaxInvoiceInquiries('', inquiryId)
      .then((items) => {
        if (!stop && items[0]) applyHit(items[0]);
      })
      .catch(() => undefined);
    return () => { stop = true; };
  }, [inquiryId]);

  const brand = (picked && !unmatched ? brands.find((item) => item.id === picked.brandId) : brands.find((item) => item.id === brandId)) ?? null;
  const exemptLocked = brand?.memberTaxType === '4';
  const supplier = supplierParty(brand?.supplier);
  const supplierGap = supplierIncompleteMessage({
    corpName: supplier.corpName,
    ceoName: supplier.ceoName,
    addr: supplier.addr,
    email: supplier.email,
    contactName: brand?.supplier?.contactName,
  });
  const supplierBlocked = supplierGap != null;
  const supplierAttention = isBlankSupplierField(supplier.corpName) || isBlankSupplierField(supplier.ceoName) || isBlankSupplierField(supplier.addr);
  const blocked = brand?.simplified
    ? '간이과세자는 세금계산서를 발행할 수 없습니다'
    : brand && !brand.certValid
      ? '공동인증서가 없거나 만료되었습니다. 계산서 연결에서 공동인증서 등록을 해 주세요.'
      : null;
  const digits = buyer.corpNum.replace(/\D/g, '');
  const corpState = digits.length < 10 ? 'empty' : isValidKoreanBizNumberChecksum(digits) ? 'ok' : 'bad';
  const activeKind: TaxKind = exemptLocked ? 'exempt' : taxKind;

  useEffect(() => {
    if (!fromId) return;
    let stop = false;
    fetchTaxInvoiceSource(fromId)
      .then((src) => {
        if (stop) return;
        const today = kstToday();
        setBrandId(src.operatingCompanyId);
        setUnmatched(true);
        setPicked(null);
        setPurpose(src.purposeType === 2 ? 2 : 1);
        setTaxKind(src.taxKind);
        setWriteDate(today);
        setRemark(src.remark);
        setBuyer({
          corpNum: formatBizInput(src.buyer.corpNum),
          taxRegId: src.buyerTaxRegId,
          corpName: src.buyer.corpName,
          ceoName: src.buyer.ceoName,
          addr: src.buyer.addr,
          email: src.buyer.email,
          bizType: src.buyer.bizType,
          bizClass: src.buyer.bizClass,
        });
        const mapped = src.lines.map((line) => ({
          month: today.slice(5, 7),
          day: today.slice(8, 10),
          name: line.name,
          spec: line.spec,
          qty: line.qty,
          unitPrice: String(line.unitPrice ?? ''),
          supply: String(line.supply ?? ''),
          tax: String(line.tax ?? ''),
          remark: line.remark,
          supplyEdited: true,
          taxEdited: true,
          dateEdited: false,
        }));
        setLines(mapped.length ? mapped : [emptyLine(today)]);
        setPreview(false);
        setDraftOffer(null);
      })
      .catch((err: unknown) => {
        if (!stop) setError(err instanceof Error ? err.message : '다시 발행할 내용을 불러오지 못했습니다.');
      });
    return () => { stop = true; };
  }, [fromId]);

  useEffect(() => {
    if (!brandId || fromId) return;
    setDraftOffer(readTaxInvoiceDraft(brandId));
  }, [brandId, fromId]);

  useEffect(() => {
    if (!brandId || draftOffer) return;
    const empty = !buyer.corpNum && !buyer.corpName && !buyer.ceoName && !remark && lines.every((line) => !line.name);
    if (empty) return;
    const handle = window.setTimeout(() => {
      writeTaxInvoiceDraft({
        brandId,
        buyer,
        lines,
        taxKind: activeKind,
        purpose,
        remark,
        cash,
        chkBill,
        note,
        credit,
        writeDate,
      });
    }, 1000);
    return () => window.clearTimeout(handle);
  }, [brandId, draftOffer, buyer, lines, activeKind, purpose, remark, cash, chkBill, note, credit, writeDate]);
  const supplySum = lines.reduce((sum, line) => sum + lineSupply(line), 0);
  const taxSum = lines.reduce((sum, line) => sum + lineTax(line, activeKind), 0);
  const short = summary != null && summary.balanceKrw < TAXINVOICE_UNIT_PRICE_KRW;

  function applyHit(hit: TaxInvoiceSearchHit) {
    setPicked(hit);
    setUnmatched(false);
    setBrandId(hit.brandId);
    if (hit.buyer) {
      setBuyer((prev) => ({ ...prev, corpName: hit.buyer?.corpName ?? '', email: hit.buyer?.email ?? '', addr: hit.buyer?.addr ?? '' }));
    }
  }

  function changeWriteDate(next: string) {
    setWriteDate(next);
    setLines((prev) => prev.map((line) => line.dateEdited ? line : { ...line, month: next.slice(5, 7), day: next.slice(8, 10) }));
  }

  async function search() {
    setError(null);
    try {
      setHits(await searchTaxInvoiceInquiries(query));
    } catch (err) {
      setError(err instanceof Error ? err.message : '접수를 찾지 못했습니다.');
    }
  }

  async function submit() {
    if (supplierGap) {
      setError(supplierGap);
      return;
    }
    if (blocked) {
      setError(blocked);
      return;
    }
    if (corpState !== 'ok') {
      setError('공급받는자 사업자등록번호가 올바르지 않습니다.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const issued = await issueTaxInvoice({
        inquiryId: unmatched ? null : picked?.id ?? null,
        operatingCompanyId: unmatched || !picked ? brandId : picked.brandId,
        requestId: crypto.randomUUID(),
        purposeType: purpose,
        writeDate,
        buyer: {
          corpNum: buyer.corpNum,
          corpName: buyer.corpName,
          ceoName: buyer.ceoName,
          addr: buyer.addr,
          email: buyer.email,
          bizType: buyer.bizType,
          bizClass: buyer.bizClass,
        },
        buyerTaxRegId: buyer.taxRegId,
        remark,
        cash,
        chkBill,
        note,
        credit,
        taxKind: activeKind,
        lines: lines.map((line) => ({
          name: line.name,
          month: line.month,
          day: line.day,
          spec: line.spec,
          qty: line.qty,
          unitPrice: String(moneyNumber(line.unitPrice)),
          supply: lineSupply(line),
          tax: lineTax(line, activeKind),
          remark: line.remark,
        })),
      });
      await reload();
      clearTaxInvoiceDraft(unmatched || !picked ? brandId : picked.brandId);
      navigate('/admin/inquiries/receipts/taxinvoice', { state: { taxIssuedId: issued.id } });
    } catch (err) {
      setPreview(false);
      setError(err instanceof Error ? err.message : '세금계산서 발행에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  const dateMin = dates[dates.length - 1] ?? writeDate;
  const dateMax = dates[0] ?? writeDate;
  const linkedBrands = brands.filter((item) => item.linked);
  const chipName = picked?.buyer?.corpName || picked?.customerName || '';

  const form: TaxFormProps = {
    readOnly: preview,
    supplier,
    buyer,
    onBuyer: (patch) => setBuyer((prev) => ({ ...prev, ...patch, corpNum: patch.corpNum != null ? formatBizInput(patch.corpNum) : prev.corpNum })),
    corpState,
    writeDate,
    dateMin,
    dateMax,
    onWriteDate: changeWriteDate,
    purpose,
    onPurpose: setPurpose,
    remark,
    onRemark: setRemark,
    lines,
    onLine: (index, patch) => setLines((prev) => prev.map((line, i) => i === index ? patchLine(line, patch) : line)),
    onAddLine: () => setLines((prev) => prev.length >= 16 ? prev : [...prev, emptyLine(writeDate, '')]),
    onRemoveLine: (index) => setLines((prev) => prev.filter((_, i) => i !== index)),
    cash,
    chkBill,
    note,
    credit,
    onMoney: (key, value) => {
      if (key === 'cash') setCash(value);
      if (key === 'chkBill') setChkBill(value);
      if (key === 'note') setNote(value);
      if (key === 'credit') setCredit(value);
    },
    supplySum,
    taxSum,
    totalSum: supplySum + taxSum,
    taxKind: activeKind,
    onEditSupplier: brand ? () => setSupplierOpen(true) : undefined,
    supplierAttention,
  };

  function issue() {
    if (preview) {
      void submit();
      return;
    }
    setPreview(true);
  }

  const walletLine = short
    ? '잔액이 부족합니다'
    : `발행 비용 ${TAXINVOICE_UNIT_PRICE_KRW.toLocaleString('ko-KR')}원 · 지갑 ${summary ? `${won(summary.balanceKrw)}원 → ${won(summary.balanceKrw - TAXINVOICE_UNIT_PRICE_KRW)}원` : '…'}`;

  return (
    <div ref={scrollRef} className="taxinvoice-issue modal-form-scroll-surface -mx-4 flex max-h-[calc(100dvh-3.5rem)] min-h-0 flex-col gap-5 overflow-y-auto bg-[#eef0f3] px-4 py-6" onFocusCapture={onFieldFocus}>
      {supplierBlocked ? (
        <p className="flex flex-wrap items-center gap-2 rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-950 ring-1 ring-amber-200">
          {supplierGap}
          <button type="button" className="rounded-md bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-950 ring-1 ring-amber-300 hover:bg-amber-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2" onClick={() => setSupplierOpen(true)}>계산서 연결에서 입력</button>
        </p>
      ) : null}
      {blocked ? (
        <p className="rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-950 ring-1 ring-amber-200">
          {blocked}{' '}
          {!brand?.simplified ? <Link className="font-medium underline" to="/admin/team-leaders/cashbill">공동인증서 등록</Link> : null}
        </p>
      ) : null}
      {draftOffer ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-fluid-xs text-slate-800">
          <span className="min-w-0 flex-1">작성하던 세금계산서가 있어요</span>
          <button
            type="button"
            className="min-h-11 rounded-lg bg-slate-900 px-3 text-fluid-xs font-medium text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none"
            onClick={() => {
              const today = kstToday();
              setBrandId(draftOffer.brandId);
              setBuyer(draftOffer.buyer);
              setLines(draftOffer.lines.length ? draftOffer.lines : [emptyLine(today)]);
              setTaxKind(draftOffer.taxKind);
              setPurpose(draftOffer.purpose);
              setRemark(draftOffer.remark);
              setCash(draftOffer.cash);
              setChkBill(draftOffer.chkBill);
              setNote(draftOffer.note);
              setCredit(draftOffer.credit);
              setWriteDate(draftOffer.writeDate || today);
              setPreview(false);
              setDraftOffer(null);
            }}
          >
            이어서 쓰기
          </button>
          <button
            type="button"
            className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-fluid-xs font-medium text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none"
            onClick={() => {
              clearTaxInvoiceDraft(brandId);
              setDraftOffer(null);
            }}
          >
            새로 쓰기
          </button>
        </div>
      ) : null}
      {error ? <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-800 ring-1 ring-red-200">{error}</p> : null}

      <section className="hidden flex-col gap-4 lg:flex">
        <div className="flex flex-wrap items-center gap-3 rounded-xl bg-white px-4 py-3 ring-1 ring-gray-200">
          <Link to="/admin/inquiries/receipts/taxinvoice" className="text-sm text-gray-500 hover:text-gray-900">← 목록</Link>
          <span className="h-4 w-px bg-gray-200" />
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className="shrink-0 text-xs font-medium text-gray-500">접수 연결</span>
            <form className="flex min-w-0 flex-1 items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 ring-1 ring-gray-200" onSubmit={(event) => { event.preventDefault(); void search(); }}>
              <svg className="h-4 w-4 shrink-0 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
              <input className="min-w-0 flex-1 bg-transparent text-sm outline-none" placeholder="고객명·전화번호로 접수 찾기 (선택)" aria-label="고객 검색" value={query} onChange={(event) => setQuery(event.target.value)} />
            </form>
            {picked && !unmatched ? (
              <span className="hidden shrink-0 items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800 ring-1 ring-emerald-200 sm:inline-flex">
                연결됨 · {picked.inquiryNumber} {chipName}
                <button type="button" className="text-emerald-700" aria-label="연결 해제" onClick={() => { setPicked(null); setUnmatched(true); }}>✕</button>
              </span>
            ) : null}
          </div>
          <span className="h-4 w-px bg-gray-200" />
          <div className="flex shrink-0 items-center gap-2">
            <span className="text-xs font-medium text-gray-500">과세 구분</span>
            <TaxKindSwitch kind={activeKind} locked={exemptLocked} disabled={preview} onChange={setTaxKind} />
          </div>
          {brand?.certValid && brand.certExpireDate ? (
            <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800">● 인증서 {brand.certExpireDate.slice(0, 10)}</span>
          ) : null}
        </div>
        <p id="tt-hint" className="-mt-2 px-1 text-xs text-gray-500">{TAX_KIND_HINT[activeKind]}</p>
        {hits.length > 0 && !picked ? (
          <ul className="rounded-xl bg-white ring-1 ring-gray-200">
            {hits.map((hit) => (
              <li key={hit.id}>
                <button type="button" className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50" onClick={() => { applyHit(hit); setHits([]); }}>{hit.customerName} · {hit.inquiryNumber} · {hit.brandName}{hit.buyer ? ' · 견적서 있음' : ''}</button>
              </li>
            ))}
          </ul>
        ) : null}
        {!picked || unmatched ? (
          <label className="flex max-w-xs items-center gap-2 text-xs text-gray-500">
            브랜드
            <select className="h-9 flex-1 rounded-lg bg-white px-2 text-sm ring-1 ring-gray-200" aria-label="브랜드" value={brandId} onChange={(event) => setBrandId(event.target.value)}>
              {linkedBrands.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
        ) : null}
        <TaxInvoicePaper {...form} />
        <div className="sticky bottom-0 z-10 -mx-1 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white/95 px-5 py-3 shadow-[0_-4px_16px_rgba(17,24,39,.06)] ring-1 ring-gray-200 backdrop-blur">
          <div className="flex items-center gap-4 text-sm">
            <div><span className="text-gray-500">합계</span> <b className="num ml-1 text-lg">{won(supplySum + taxSum)}원</b></div>
            <span className="h-5 w-px bg-gray-200" />
            <div className={short ? 'text-red-700' : 'text-gray-500'}>{short ? walletLine : <>발행 비용 <b className="num text-gray-900">150원</b> · 지갑 <span className="num">{summary ? `${won(summary.balanceKrw)}원 → ${won(summary.balanceKrw - TAXINVOICE_UNIT_PRICE_KRW)}원` : '…'}</span></>}</div>
          </div>
          <div className="flex gap-2">
            {preview ? (
              <button type="button" className="h-11 rounded-lg px-4 text-sm font-medium text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50" onClick={() => setPreview(false)}>다시 수정</button>
            ) : null}
            {short ? (
              <button type="button" className="h-11 rounded-lg bg-gray-900 px-6 text-sm font-semibold text-white hover:bg-black" onClick={openCharge}>충전하기</button>
            ) : (
              <button type="button" className="h-11 rounded-lg bg-gray-900 px-6 text-sm font-semibold text-white hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50" disabled={saving || Boolean(blocked) || supplierBlocked} onClick={issue}>
                {saving ? '발행 중…' : preview ? '이대로 발행' : '미리보고 발행'}
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="flex flex-col lg:hidden">
        <header className="flex items-center gap-3 bg-white px-4 py-3 ring-1 ring-gray-200">
          <Link to="/admin/inquiries/receipts/taxinvoice" className="flex h-9 w-9 items-center justify-center rounded-full text-lg" aria-label="뒤로">‹</Link>
          <h2 className="flex-1 text-[15px] font-bold">세금계산서 발행</h2>
          {brand?.certValid ? <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800">인증서 ✓</span> : null}
        </header>
        <div className="bg-white px-3 pb-2.5">
          <TaxKindSwitch kind={activeKind} locked={exemptLocked} disabled={preview} mobile onChange={setTaxKind} />
          <p className="mt-1.5 text-[11px] text-gray-500">면세를 고르면 「전자계산서」로 바뀌고 세액 칸이 사라집니다.</p>
        </div>
        <div className="space-y-3 px-3 py-3 pb-28">
          <div className="rounded-xl bg-white px-3 py-2.5 ring-1 ring-gray-200">
            <p className="text-[11px] text-gray-500">접수 연결</p>
            {picked && !unmatched ? (
              <p className="font-medium">{picked.inquiryNumber} · {chipName} <button type="button" className="text-xs text-gray-400" onClick={() => { setPicked(null); setUnmatched(true); }}>변경</button></p>
            ) : (
              <form className="mt-1 flex gap-2" onSubmit={(event) => { event.preventDefault(); void search(); }}>
                <input className="h-11 min-w-0 flex-1 rounded-lg bg-gray-50 px-3 text-sm ring-1 ring-gray-200" placeholder="고객명·전화번호" aria-label="고객 검색" value={query} onChange={(event) => setQuery(event.target.value)} />
              </form>
            )}
            {hits.length > 0 && !picked ? (
              <ul className="mt-2">
                {hits.map((hit) => (
                  <li key={hit.id}><button type="button" className="w-full py-2 text-left text-sm" onClick={() => { applyHit(hit); setHits([]); }}>{hit.customerName} · {hit.inquiryNumber}</button></li>
                ))}
              </ul>
            ) : null}
          </div>
          {!picked || unmatched ? (
            <label className="block text-[11px] text-gray-500">
              브랜드
              <select className="mt-1 h-11 w-full rounded-lg bg-white px-3 text-sm ring-1 ring-gray-200" aria-label="브랜드" value={brandId} onChange={(event) => setBrandId(event.target.value)}>
                {linkedBrands.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
          ) : null}
          <TaxInvoiceMobileCards {...form} />
          <button type="button" className="w-full rounded-xl bg-white py-3 text-[13px] font-medium text-gray-700 ring-1 ring-gray-200" onClick={() => setPaperOpen((open) => !open)}>
            {paperOpen ? '실제 양식 접기' : '실제 양식으로 보기'}
          </button>
          {paperOpen ? <TaxInvoicePaper {...form} readOnly idPrefix="sheet" /> : null}
        </div>
        <footer className="fixed inset-x-0 bottom-0 z-[80] border-t border-gray-200 bg-white px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2.5 lg:hidden">
          <p className={`num mb-2 text-center text-[11px] ${short ? 'text-red-700' : 'text-gray-500'}`}>
            {short ? '잔액이 부족합니다' : `발행 비용 150원 · 잔액 ${summary ? `${won(summary.balanceKrw)}원 → ${won(summary.balanceKrw - TAXINVOICE_UNIT_PRICE_KRW)}원` : '…'}`}
          </p>
          {preview && !short ? (
            <button type="button" className="mb-2 h-11 w-full rounded-xl text-sm font-medium text-gray-700 ring-1 ring-gray-300" onClick={() => setPreview(false)}>다시 수정</button>
          ) : null}
          {short ? (
            <button type="button" className="h-12 w-full rounded-xl bg-gray-900 text-[15px] font-semibold text-white" onClick={openCharge}>충전하기</button>
          ) : (
            <button type="button" className="h-12 w-full rounded-xl bg-gray-900 text-[15px] font-semibold text-white hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50" disabled={saving || Boolean(blocked) || supplierBlocked} onClick={issue}>
              {saving ? '발행 중…' : preview ? '이대로 발행' : `${won(supplySum + taxSum)}원 미리보고 발행`}
            </button>
          )}
        </footer>
      </section>
      {supplierOpen && brand ? (
        <SupplierInfoModal
          operatingCompanyId={brand.id}
          corpNum={supplier.corpNum}
          initial={{
            corpName: supplier.corpName,
            ceoName: supplier.ceoName,
            addr: supplier.addr,
            bizType: supplier.bizType,
            bizClass: supplier.bizClass,
            email: supplier.email,
            tel: brand.supplier?.tel ?? '',
            contactName: brand.supplier?.contactName ?? '',
          }}
          onClose={() => setSupplierOpen(false)}
          onSaved={(saved) => {
            setBrands((prev) => prev.map((item) => item.id === brand.id ? { ...item, supplier: saved } : item));
            setSupplierOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}
