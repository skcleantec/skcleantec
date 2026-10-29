import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { TAXINVOICE_UNIT_PRICE_KRW } from '@shared/barobillPolicy';
import { isValidKoreanBizNumberChecksum } from '@shared/authSignup';
import {
  issueTaxInvoice,
  listTaxInvoices,
  searchTaxInvoiceInquiries,
  type TaxInvoiceBrand,
  type TaxInvoiceSearchHit,
  type TaxInvoiceSupplier,
} from '../../api/taxInvoices';
import { useModalScrollKeyboardAvoidance } from '../../hooks/useMobileInputVisibility';
import { useReceiptWallet } from '../wallet/ReceiptWalletProvider';
import { TaxInvoiceMobileCards, TaxInvoiceSheet, type TaxFormProps } from './TaxInvoiceFormViews';
import {
  emptyLine,
  emptyParty,
  formatBizInput,
  kstToday,
  moneyNumber,
  patchLine,
  won,
  writeDateOptions,
  type TaxFormLine,
  type TaxParty,
} from './taxInvoiceFormModel';

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
  const { summary, openCharge, reload } = useReceiptWallet();
  const dates = useMemo(() => writeDateOptions(), []);
  const [brands, setBrands] = useState<TaxInvoiceBrand[]>([]);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<TaxInvoiceSearchHit[]>([]);
  const [picked, setPicked] = useState<TaxInvoiceSearchHit | null>(null);
  const [unmatched, setUnmatched] = useState(false);
  const [brandId, setBrandId] = useState('');
  const [purpose, setPurpose] = useState<1 | 2>(1);
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
  const [supplierOpen, setSupplierOpen] = useState(false);
  const [extraOpen, setExtraOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { onFieldFocus } = useModalScrollKeyboardAvoidance(scrollRef, true, 96);

  useEffect(() => {
    let stop = false;
    listTaxInvoices(new URLSearchParams({ datePreset: 'today', limit: '1' }))
      .then((res) => {
        if (stop) return;
        setBrands(res.brands);
        setBrandId((prev) => prev || res.brands.find((brand) => brand.linked)?.id || res.brands[0]?.id || '');
      })
      .catch((err: unknown) => {
        if (!stop) setError(err instanceof Error ? err.message : '브랜드를 불러오지 못했습니다.');
      });
    return () => { stop = true; };
  }, []);

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
  const supplier = supplierParty(brand?.supplier);
  const blocked = brand?.simplified
    ? '간이과세자는 세금계산서를 발행할 수 없습니다'
    : brand && !brand.certValid
      ? '공동인증서가 없거나 만료되었습니다. 계산서 연결에서 공동인증서 등록을 해 주세요.'
      : null;
  const digits = buyer.corpNum.replace(/\D/g, '');
  const corpState = digits.length < 10 ? 'empty' : isValidKoreanBizNumberChecksum(digits) ? 'ok' : 'bad';
  const supplySum = lines.reduce((sum, line) => sum + moneyNumber(line.supply), 0);
  const taxSum = lines.reduce((sum, line) => sum + moneyNumber(line.tax), 0);
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
        lines: lines.map((line) => ({
          name: line.name,
          month: line.month,
          day: line.day,
          spec: line.spec,
          qty: line.qty,
          unitPrice: String(moneyNumber(line.unitPrice)),
          supply: moneyNumber(line.supply),
          tax: moneyNumber(line.tax),
          remark: line.remark,
        })),
      });
      await reload();
      navigate('/admin/inquiries/receipts/taxinvoice', { state: { taxIssuedId: issued.id } });
    } catch (err) {
      setError(err instanceof Error ? err.message : '세금계산서 발행에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  const form: TaxFormProps = {
    readOnly: preview,
    supplier,
    buyer,
    onBuyer: (patch) => setBuyer((prev) => ({ ...prev, ...patch, corpNum: patch.corpNum != null ? formatBizInput(patch.corpNum) : prev.corpNum })),
    corpState,
    writeDate,
    dates,
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
    supplierOpen,
    onSupplierOpen: setSupplierOpen,
    extraOpen,
    onExtraOpen: setExtraOpen,
  };

  const issueButton = short ? (
    <button type="button" className="min-h-11 rounded-lg bg-slate-900 px-3 text-fluid-xs font-medium text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2" onClick={openCharge}>충전하기</button>
  ) : (
    <button type="button" className="min-h-11 rounded-lg bg-slate-900 px-3 text-fluid-xs font-medium text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none" disabled={saving || Boolean(blocked)} onClick={() => void submit()}>
      {saving ? '발행 중…' : preview ? '이대로 발행' : '발행하기'}
    </button>
  );

  return (
    <div className="flex min-h-0 flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-fluid-sm font-semibold text-slate-900">전자세금계산서 발행</p>
          <Link to="/admin/inquiries/receipts/taxinvoice" className="text-fluid-2xs text-slate-600 underline hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400">목록으로</Link>
        </div>
      </div>
      <div ref={scrollRef} className="modal-form-scroll-surface min-h-0 space-y-2 overflow-y-auto pb-24 lg:pb-4" onFocusCapture={onFieldFocus}>
        <div className="flex flex-wrap gap-2">
          <input className="min-h-11 min-w-0 flex-1 rounded-lg border border-slate-300 px-3 text-fluid-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400" value={query} placeholder="고객명·전화번호" aria-label="고객 검색" onChange={(event) => setQuery(event.target.value)} />
          <button type="button" className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-fluid-xs hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2" onClick={() => void search()}>검색</button>
          <button type="button" className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-fluid-xs hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2" onClick={() => { setUnmatched(true); setPicked(null); }}>매칭 없이 발행</button>
        </div>
        {hits.length > 0 ? (
          <ul className="space-y-1">
            {hits.map((hit) => (
              <li key={hit.id}>
                <button type="button" className="min-h-11 w-full rounded-lg px-2 text-left text-fluid-xs hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400" onClick={() => applyHit(hit)}>
                  {hit.customerName} · {hit.inquiryNumber} · {hit.brandName}{hit.buyer ? ' · 견적서 있음' : ''}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <p className="text-fluid-2xs text-slate-600">{unmatched ? '매칭 없이 발행합니다.' : picked ? `${picked.customerName} · ${picked.inquiryNumber}` : '접수를 고르거나 매칭 없이 발행하세요.'}</p>
        {unmatched || !picked ? (
          <label className="block max-w-xs text-fluid-2xs text-slate-600">
            브랜드
            <select className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 px-2 text-fluid-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400" value={brandId} aria-label="브랜드" onChange={(event) => setBrandId(event.target.value)}>
              {brands.filter((item) => item.linked).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
        ) : null}
        {blocked ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-fluid-2xs text-amber-950">
            {blocked}{' '}
            {!brand?.simplified ? <Link className="underline" to="/admin/team-leaders/cashbill">공동인증서 등록</Link> : null}
          </p>
        ) : null}
        {error ? <p className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-fluid-xs text-red-800">{error}</p> : null}
        <div className="hidden lg:block">
          <TaxInvoiceSheet {...form} />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className={`text-fluid-xs ${short ? 'text-red-700' : 'text-slate-600'}`}>
              {short
                ? '잔액이 부족합니다'
                : `발행 비용 ${TAXINVOICE_UNIT_PRICE_KRW.toLocaleString('ko-KR')}원 · 지갑 ${summary ? won(summary.balanceKrw) : '…'}원 → ${summary ? won(summary.balanceKrw - TAXINVOICE_UNIT_PRICE_KRW) : '…'}원`}
            </p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-fluid-xs hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2" onClick={() => setPreview((open) => !open)}>{preview ? '다시 수정' : '임시 미리보기'}</button>
              <Link to="/admin/inquiries/receipts/taxinvoice" className="inline-flex min-h-11 items-center rounded-lg border border-slate-300 bg-white px-3 text-fluid-xs hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2">취소</Link>
              {issueButton}
            </div>
          </div>
        </div>
        <div className="lg:hidden">
          <TaxInvoiceMobileCards {...form} readOnly={false} />
          <button type="button" className="mt-2 min-h-11 text-fluid-xs text-slate-800 underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400" onClick={() => setPaperOpen((open) => !open)}>
            {paperOpen ? '실제 양식 접기' : '실제 양식으로 보기'}
          </button>
          {paperOpen ? (
            <div className="mt-2 overflow-x-auto rounded-lg border border-slate-200 bg-white p-2">
              <TaxInvoiceSheet {...form} readOnly />
            </div>
          ) : null}
        </div>
      </div>
      <div className="fixed inset-x-0 bottom-0 z-[80] flex items-center justify-between gap-2 border-t border-slate-200 bg-white px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] lg:hidden">
        <p className={`min-w-0 text-fluid-2xs ${short ? 'text-red-700' : 'text-slate-700'}`}>
          {short ? '잔액이 부족합니다' : `${TAXINVOICE_UNIT_PRICE_KRW.toLocaleString('ko-KR')}원 · 잔액 ${summary ? won(summary.balanceKrw - TAXINVOICE_UNIT_PRICE_KRW) : '…'}원 남음`}
        </p>
        {issueButton}
      </div>
    </div>
  );
}
