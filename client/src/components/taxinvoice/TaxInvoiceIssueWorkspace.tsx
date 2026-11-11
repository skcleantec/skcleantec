import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { TAXINVOICE_UNIT_PRICE_KRW } from '@shared/barobillPolicy';
import { isValidKoreanBizNumberChecksum } from '@shared/authSignup';
import { isBlankSupplierField, supplierIncompleteMessage } from '@shared/supplierFieldText';
import {
  taxNtsIssueNotice,
  type TaxInvoiceBrand,
  type TaxInvoiceSearchHit,
  type TaxInvoiceSupplier,
} from '../../api/taxInvoices';
import type { PlatformBuyerTenant } from '../../api/platformReceipts';
import { useModalScrollKeyboardAvoidance } from '../../hooks/useMobileInputVisibility';
import { useReceiptWallet } from '../wallet/ReceiptWalletProvider';
import { SupplierInfoModal } from './SupplierInfoModal';
import { clearTaxInvoiceDraft, readTaxInvoiceDraft, writeTaxInvoiceDraft, type TaxInvoiceDraft } from './taxInvoiceDraft';
import { ReceiptOverAmountFields } from '../receipts/ReceiptOverAmountFields';
import { Button } from '../ui/Button';
import { SegmentedControl } from '../ui/SegmentedControl';
import { TaxInvoiceMobileCards, TaxInvoicePaper, type TaxFormProps } from './TaxInvoiceFormViews';
import TaxInvoiceBuyerPicker, { type TaxInvoiceBuyerRow } from './TaxInvoiceBuyerPicker';
import {
  tenantTaxInvoiceAdapter,
  type TaxInvoiceIssuerAdapter,
} from './taxInvoiceIssueAdapter';
import {
  emptyLine,
  emptyParty,
  formatBizInput,
  kstToday,
  lineSupply,
  lineTax,
  shownUnitPrice,
  patchLine,
  won,
  writeDateOptions,
  type TaxFormLine,
  type TaxKind,
  type TaxParty,
} from './taxInvoiceFormModel';
import {
  TAXINVOICE_DEFAULT_FALLBACK,
  taxInvoiceTaxKindLabel,
  fetchPlatformIssueSettings,
  fetchTaxInvoiceIssueSettings,
  type TaxInvoiceIssueDefaults,
} from '../../api/receiptIssueSettings';
import './taxinvoice-issue.css';

const TAX_KIND_LABEL: Record<TaxKind, string> = { taxable: '과세', zero: '영세', exempt: '면세' };
const TAX_KIND_DOT: Record<TaxKind, string> = {
  taxable: 'bg-[#3B82F6]',
  zero: 'bg-[#8B5CF6]',
  exempt: 'bg-[#10B981]',
};

const TAX_KIND_TONE: Record<TaxKind, string> = {
  taxable: 'bg-[#EFF6FF] text-[#1D4ED8]',
  zero: 'bg-[#F5F3FF] text-[#6D28D9]',
  exempt: 'bg-[#ECFDF5] text-[#047857]',
};

function TaxKindSwitch({ kind, locked, disabled, onChange, defaultKind }: {
  kind: TaxKind;
  locked: boolean;
  disabled: boolean;
  mobile?: boolean;
  onChange: (kind: TaxKind) => void;
  defaultKind?: TaxKind;
}) {
  const differs = Boolean(defaultKind && kind !== defaultKind);
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <SegmentedControl
        ariaLabel="과세 구분"
        className="max-w-md"
        value={kind}
        onChange={onChange}
        options={(['taxable', 'zero', 'exempt'] as TaxKind[]).map((item) => ({
          value: item,
          disabled: disabled || (locked && item !== 'exempt'),
          label: (
            <span className="inline-flex items-center justify-center gap-1.5">
              <span className={`size-1.5 rounded-full ${TAX_KIND_DOT[item]}`} aria-hidden />
              {TAX_KIND_LABEL[item]}
            </span>
          ),
        }))}
      />
      {defaultKind && !differs ? (
        <span className="text-fluid-2xs text-slate-500">기본값</span>
      ) : null}
      {defaultKind && differs ? (
        <span className="inline-flex items-center gap-1 text-fluid-2xs font-medium text-orange-700">
          <span aria-hidden>⚠</span>
          기본은 {TAX_KIND_LABEL[defaultKind]}예요
        </span>
      ) : null}
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

export function TaxInvoiceIssueWorkspace({ embedded = false, pageLayout = false, onDone, onDirtyChange, adapter: adapterProp = tenantTaxInvoiceAdapter }: { embedded?: boolean; /** 발행 전용 페이지: 바깥 머리줄이 뒤로가기·제목을 맡는다 */ pageLayout?: boolean; onDone?: (issueId: string) => void; onDirtyChange?: (dirty: boolean) => void; adapter?: TaxInvoiceIssuerAdapter } = {}) {
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
  const [extraReason, setExtraReason] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draftOffer, setDraftOffer] = useState<TaxInvoiceDraft | null>(null);
  const [supplierOpen, setSupplierOpen] = useState(false);
  const [buyerTenantId, setBuyerTenantId] = useState('');
  const [tenantBuyers, setTenantBuyers] = useState<PlatformBuyerTenant[]>([]);
  const [defaults, setDefaults] = useState<TaxInvoiceIssueDefaults>(TAXINVOICE_DEFAULT_FALLBACK);
  const defaultsRef = useRef(defaults);
  defaultsRef.current = defaults;
  const [defaultsReady, setDefaultsReady] = useState(false);

  // ── 거래처 자동채움 상태 ──
  const [buyerSuggestRows, setBuyerSuggestRows] = useState<TaxInvoiceBuyerRow[]>([]);
  const [buyerSavedBadge, setBuyerSavedBadge] = useState(false);
  const [undoBuyer, setUndoBuyer] = useState<TaxParty | null>(null);
  const buyerRef = useRef(buyer);
  const autofillTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const { onFieldFocus } = useModalScrollKeyboardAvoidance(scrollRef, true, 96);

  // stable adapter ref — prevents dependency churn on callback/effect deps
  const adapterRef = useRef(adapterProp);
  adapterRef.current = adapterProp;
  // buyer ref — always latest value for autofill closure
  buyerRef.current = buyer;

  useEffect(() => {
    let stop = false;
    const load = async () => {
      const data =
        adapterRef.current.mode === 'platform'
          ? await fetchPlatformIssueSettings('TAXINVOICE')
          : await fetchTaxInvoiceIssueSettings(brandId || null);
      if (stop) return;
      const values = data.values as TaxInvoiceIssueDefaults;
      setDefaults(values);
      if (!fromId && !inquiryId) {
        setTaxKind(values.taxKind);
        setPurpose(values.purposeType === 2 ? 2 : 1);
        setRemark(values.remark || '');
        if (values.buyerEmail) {
          setBuyer((prev) => ({ ...prev, email: prev.email || values.buyerEmail }));
        }
        if (values.itemName.trim()) {
          setLines((prev) => {
            const next = prev.length ? [...prev] : [emptyLine(dates[0] ?? kstToday())];
            next[0] = { ...next[0], name: values.itemName };
            return next;
          });
        }
      }
      setDefaultsReady(true);
    };
    void load().catch(() => {
      if (!stop) setDefaultsReady(true);
    });
    return () => { stop = true; };
  }, [brandId, fromId, inquiryId, dates]);

  // load tenants for platform buyer picker
  useEffect(() => {
    const loadTenants = adapterRef.current.loadTenantBuyers;
    if (!loadTenants) return;
    void loadTenants().then(setTenantBuyers).catch(() => undefined);
  }, []); // only on mount

  const reloadBrands = useCallback((announce: boolean) => {
    adapterRef.current.loadBrands()
      .then((loadedBrands) => {
        setBrands(loadedBrands);
        setBrandId((prev) => prev || loadedBrands.find((brand) => brand.linked)?.id || loadedBrands[0]?.id || '');
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
    if (!inquiryId || !adapterRef.current.allowInquiry || !adapterRef.current.searchInquiries) return;
    let stop = false;
    adapterRef.current.searchInquiries('', inquiryId)
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
  const supplierBlocked = adapterProp.supplierLocked ? false : supplierGap != null;
  const supplierAttention = !adapterProp.supplierLocked && (isBlankSupplierField(supplier.corpName) || isBlankSupplierField(supplier.ceoName) || isBlankSupplierField(supplier.addr));

  const blocked = brand?.simplified
    ? '간이과세자는 세금계산서를 발행할 수 없습니다'
    : brand && !brand.certValid
      ? (adapterProp.supplierLocked
          ? '관리자가 공동인증서를 등록해야 해요'
          : '공동인증서가 없거나 만료되었습니다. 계산서 연결에서 공동인증서 등록을 해 주세요.')
      : null;

  const digits = buyer.corpNum.replace(/\D/g, '');
  const corpState = digits.length < 10 ? 'empty' : isValidKoreanBizNumberChecksum(digits) ? 'ok' : 'bad';
  const activeKind: TaxKind = exemptLocked ? 'exempt' : taxKind;

  useEffect(() => {
    if (!fromId || !adapterRef.current.loadSource) return;
    let stop = false;
    adapterRef.current.loadSource(fromId)
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
    setDraftOffer(readTaxInvoiceDraft(brandId, adapterRef.current.draftScope));
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
      }, adapterRef.current.draftScope);
    }, 1000);
    return () => window.clearTimeout(handle);
  }, [brandId, draftOffer, buyer, lines, activeKind, purpose, remark, cash, chkBill, note, credit, writeDate]);

  const dirtyRef = useRef(onDirtyChange);
  dirtyRef.current = onDirtyChange;
  useEffect(() => {
    const dirty = Boolean(buyer.corpNum || buyer.corpName || buyer.ceoName) || lines.some((line) => Boolean(line.unitPrice || line.supply));
    dirtyRef.current?.(dirty);
  }, [buyer, lines]);

  const supplySum = lines.reduce((sum, line) => sum + lineSupply(line), 0);
  const taxSum = lines.reduce((sum, line) => sum + lineTax(line, activeKind), 0);
  const short = adapterProp.useWallet ? (summary != null && summary.balanceKrw < TAXINVOICE_UNIT_PRICE_KRW) : false;
  const taxDiffers = defaultsReady && activeKind !== defaults.taxKind;
  function issueButtonLabel(mode: 'desktop' | 'mobile'): string {
    if (saving) return '발행 중…';
    if (preview) {
      return taxDiffers ? `${taxInvoiceTaxKindLabel(activeKind)}로 발행` : '이대로 발행';
    }
    if (taxDiffers) return `${taxInvoiceTaxKindLabel(activeKind)}로 미리보고 발행`;
    if (mode === 'mobile') return `${won(supplySum + taxSum)}원 미리보고 발행`;
    return '미리보고 발행';
  }

  function applyHit(hit: TaxInvoiceSearchHit) {
    setPicked(hit);
    setUnmatched(false);
    setHits([]);
    setBrandId(hit.brandId);
    if (hit.buyer) {
      setBuyer((prev) => ({
        ...prev,
        corpName: hit.buyer?.corpName ?? '',
        email: hit.buyer?.email || defaultsRef.current.buyerEmail || prev.email,
        addr: hit.buyer?.addr ?? '',
      }));
    } else if (defaultsRef.current.buyerEmail) {
      setBuyer((prev) => ({ ...prev, email: prev.email || defaultsRef.current.buyerEmail }));
    }
    if (defaultsRef.current.writeDateBasis === 'preferredDate' && hit.preferredDate) {
      changeWriteDate(hit.preferredDate);
    }
  }

  const settingDiffs = useMemo(() => {
    if (!defaultsReady) return [] as string[];
    const out: string[] = [];
    if (activeKind !== defaults.taxKind) out.push(taxInvoiceTaxKindLabel(activeKind));
    if (purpose !== defaults.purposeType) out.push(purpose === 2 ? '청구' : '영수');
    const lineName = (lines[0]?.name ?? '').trim();
    const defName = defaults.itemName.trim();
    if (defName && lineName && lineName !== defName) out.push(`품목 ${lineName}`);
    return out;
  }, [activeKind, purpose, lines, defaults, defaultsReady]);

  function chooseOtherCustomer() {
    setPicked(null);
    setUnmatched(false);
    setQuery('');
    setHits([]);
  }

  function changeWriteDate(next: string) {
    setWriteDate(next);
    setLines((prev) => prev.map((line) => line.dateEdited ? line : { ...line, month: next.slice(5, 7), day: next.slice(8, 10) }));
  }

  async function search() {
    if (!adapterRef.current.searchInquiries) return;
    setError(null);
    try {
      setHits(await adapterRef.current.searchInquiries(query));
    } catch (err) {
      setError(err instanceof Error ? err.message : '접수를 찾지 못했습니다.');
    }
  }

  async function submit() {
    if (!adapterRef.current.supplierLocked && supplierGap) {
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
      const remainNow = picked && !unmatched && typeof picked.remainingWon === 'number' ? picked.remainingWon : null;
      const extraNow = remainNow != null ? Math.max(0, supplySum + taxSum - remainNow) : 0;
      const issued = await adapterRef.current.issue({
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
        buyerTenantId: buyerTenantId || undefined,
        extraReason: extraNow > 0 ? extraReason.trim() : undefined,
        lines: lines.map((line) => ({
          name: line.name,
          month: line.month,
          day: line.day,
          spec: line.spec,
          qty: line.qty,
          unitPrice: shownUnitPrice(line),
          supply: lineSupply(line),
          tax: lineTax(line, activeKind),
          remark: line.remark,
        })),
      });

      if (adapterRef.current.useWallet) await reload();

      const draftBrandId = unmatched || !picked ? brandId : picked.brandId;
      clearTaxInvoiceDraft(draftBrandId, adapterRef.current.draftScope);

      if (onDone) {
        onDone(issued.id);
      } else if (adapterRef.current.mode !== 'platform') {
        navigate('/admin/inquiries/receipts/taxinvoice', { state: { taxIssuedId: issued.id } });
      }
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
  const form: TaxFormProps = {
    readOnly: preview,
    supplier,
    buyer,
    onBuyer: (patch) => {
      if (patch.corpNum != null) {
        handleBuyerCorpNumChange(patch.corpNum);
      } else {
        setBuyer((prev) => ({ ...prev, ...patch }));
      }
    },
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
    onEditSupplier: (brand && !adapterProp.supplierLocked) ? () => setSupplierOpen(true) : undefined,
    supplierAttention,
    buyerSavedBadge,
    onUndoBuyerAutofill: undoBuyer ? () => {
      setBuyer(undoBuyer);
      setBuyerSavedBadge(false);
      setUndoBuyer(null);
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    } : null,
    buyerSuggestions: buyerSuggestRows.map((r) => ({ id: r.id, bizNumber: r.bizNumber, corpName: r.corpName, ceoName: r.ceoName })),
    onPickBuyerSuggestion: (id: string) => {
      const row = buyerSuggestRows.find((r) => r.id === id);
      if (!row) return;
      const snapshot = { ...buyerRef.current };
      setBuyer((prev) => ({
        ...prev,
        corpNum: formatBizInput(row.bizNumber),
        corpName: row.corpName,
        ceoName: row.ceoName,
        addr: row.addr,
        bizType: row.bizType,
        bizClass: row.bizClass,
        email: row.email,
      }));
      setBuyerSavedBadge(true);
      setBuyerSuggestRows([]);
      setUndoBuyer(snapshot);
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
      undoTimerRef.current = setTimeout(() => setUndoBuyer(null), 5000);
    },
  };

  const invoiceTotal = supplySum + taxSum;
  const remainWon = picked && !unmatched && typeof picked.remainingWon === 'number' ? picked.remainingWon : null;
  const over = remainWon != null ? Math.max(0, invoiceTotal - remainWon) : 0;

  function issue() {
    if (preview) {
      if (over > 0 && !extraReason.trim()) {
        setError('추가 금액 사유를 입력해 주세요.');
        return;
      }
      if (over > 0 || settingDiffs.length > 0) {
        setConfirmOpen(true);
        return;
      }
      void submit();
      return;
    }
    setPreview(true);
  }

  const walletLine = adapterProp.useWallet
    ? (short
        ? '잔액이 부족합니다'
        : `발행 비용 ${TAXINVOICE_UNIT_PRICE_KRW.toLocaleString('ko-KR')}원 · 지갑 ${summary ? `${won(summary.balanceKrw)}원 → ${won(summary.balanceKrw - TAXINVOICE_UNIT_PRICE_KRW)}원` : '…'}`)
    : `발행 원가 ${adapterProp.unitPriceKrw.toLocaleString('ko-KR')}원`;

  // ── 거래처 corpNum 타이핑 → 자동채움 ──────────────────────────────────────
  function handleBuyerCorpNumChange(rawCorpNum: string) {
    const formatted = formatBizInput(rawCorpNum);
    const d = formatted.replace(/\D/g, '');
    setBuyer((prev) => ({ ...prev, corpNum: formatted }));
    setBuyerSavedBadge(false);

    if (autofillTimerRef.current) clearTimeout(autofillTimerRef.current);
    if (d.length < 3) {
      setBuyerSuggestRows([]);
      return;
    }

    autofillTimerRef.current = setTimeout(async () => {
      try {
        const rows = await adapterRef.current.buyerApi.list(d);
        setBuyerSuggestRows(rows.slice(0, 8));
        if (d.length === 10) {
          const exact = rows.find((r) => r.bizNumber.replace(/\D/g, '') === d);
          if (exact) {
            const snapshot = { ...buyerRef.current };
            setUndoBuyer(snapshot);
            setBuyer((prev) => ({
              ...prev,
              corpName: exact.corpName,
              ceoName: exact.ceoName ?? '',
              addr: exact.addr ?? '',
              bizType: exact.bizType ?? '',
              bizClass: exact.bizClass ?? '',
              email: exact.email ?? '',
            }));
            setBuyerSavedBadge(true);
            setBuyerSuggestRows([]);
            if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
            undoTimerRef.current = setTimeout(() => setUndoBuyer(null), 5000);
          } else {
            setBuyerSavedBadge(false);
          }
        }
      } catch {
        setBuyerSuggestRows([]);
      }
    }, 200);
  }

  // ── 거래처 picker / tenant 선택 ───────────────────────────────────────────
  function applyBuyerRow(b: TaxInvoiceBuyerRow) {
    setBuyer({
      corpNum: formatBizInput(b.bizNumber),
      taxRegId: '',
      corpName: b.corpName,
      ceoName: b.ceoName,
      addr: b.addr,
      bizType: b.bizType,
      bizClass: b.bizClass,
      email: b.email,
    });
    setBuyerSavedBadge(true);
    setBuyerSuggestRows([]);
  }

  function applyTenantBuyer(tid: string) {
    setBuyerTenantId(tid);
    const t = tenantBuyers.find((b) => b.id === tid);
    if (t) {
      setBuyer((prev) => ({
        ...prev,
        corpNum: formatBizInput(t.corpNum ?? ''),
        corpName: t.corpName ?? t.name,
        ceoName: t.ceoName ?? '',
        addr: t.addr ?? '',
        bizType: t.bizType ?? '',
        bizClass: t.bizClass ?? '',
        email: t.email ?? '',
      }));
      setBuyerSavedBadge(true);
      setBuyerSuggestRows([]);
    }
  }

  const buyerPickerRow = (
    <div className="flex flex-wrap items-center gap-2">
      <TaxInvoiceBuyerPicker
        api={adapterProp.buyerApi}
        onPick={applyBuyerRow}
        tenantBuyers={adapterProp.mode === 'platform' ? tenantBuyers : undefined}
        onPickTenant={adapterProp.mode === 'platform' ? applyTenantBuyer : undefined}
      />
      <span className="text-fluid-2xs text-slate-500">발행하면 거래처가 자동 저장돼요</span>
    </div>
  );

  return (
    <div
      ref={scrollRef}
      className={pageLayout
        ? `taxinvoice-issue ${preview ? '' : 'tt-editing'} flex min-w-0 flex-col gap-3`
        : `taxinvoice-issue ${preview ? '' : 'tt-editing'} modal-form-scroll-surface -mx-4 flex max-h-[calc(100dvh-3.5rem)] min-h-0 flex-col gap-5 overflow-y-auto bg-[#eef0f3] px-4 py-6`}
      onFocusCapture={onFieldFocus}
    >
      {supplierBlocked ? (
        <p className="flex flex-wrap items-center gap-2 rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-950 ring-1 ring-amber-200">
          {supplierGap}
          <button type="button" className="rounded-md bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-950 ring-1 ring-amber-300 hover:bg-amber-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2" onClick={() => setSupplierOpen(true)}>계산서 연결에서 입력</button>
        </p>
      ) : null}
      {blocked ? (
        <p className="rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-950 ring-1 ring-amber-200">
          {blocked}{' '}
          {!brand?.simplified && !adapterProp.supplierLocked ? <Link className="font-medium underline" to="/admin/team-leaders/cashbill">공동인증서 등록</Link> : null}
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
              clearTaxInvoiceDraft(brandId, adapterRef.current.draftScope);
              setDraftOffer(null);
            }}
          >
            새로 쓰기
          </button>
        </div>
      ) : null}
      {error ? <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-800 ring-1 ring-red-200">{error}</p> : null}

      {/* ── Desktop ── */}
      <section className="hidden flex-col gap-3 lg:flex">
        <div className="flex flex-wrap items-center gap-2.5 rounded-xl bg-white py-2 pl-3.5 pr-2.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          {(!picked || unmatched) && !adapterProp.supplierLocked && linkedBrands.length > 1 ? (
            <>
              <select className="h-[30px] rounded-lg border-0 bg-[#F4F6FA] px-2 text-fluid-2xs text-slate-800" aria-label="브랜드" value={brandId} onChange={(event) => setBrandId(event.target.value)}>
                {linkedBrands.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
              <span className="h-[18px] w-px bg-slate-200" aria-hidden />
            </>
          ) : null}
          <span className="text-fluid-2xs text-slate-500">공급받는자</span>
          <TaxInvoiceBuyerPicker
            api={adapterProp.buyerApi}
            onPick={applyBuyerRow}
            tenantBuyers={adapterProp.mode === 'platform' ? tenantBuyers : undefined}
            onPickTenant={adapterProp.mode === 'platform' ? applyTenantBuyer : undefined}
          />
          {adapterProp.allowInquiry ? (
            picked && !unmatched ? (
              <span className="inline-flex h-[30px] items-center gap-1.5 rounded-lg bg-[#F4F6FA] pl-2.5 pr-1 text-fluid-2xs text-slate-800">
                접수 {picked.displayName || picked.customerName}
                <button type="button" className="h-6 rounded-lg px-1.5 text-fluid-2xs text-slate-600 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400" onClick={chooseOtherCustomer}>다른 고객</button>
              </span>
            ) : (
              <form className="relative" onSubmit={(event) => { event.preventDefault(); void search(); }}>
                <input
                  className="h-[30px] w-[200px] rounded-lg border-0 bg-[#F4F6FA] px-2.5 text-fluid-2xs text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
                  placeholder="접수 연결 · 고객명·전화"
                  aria-label="접수 연결"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </form>
            )
          ) : null}
          <span className="h-[18px] w-px bg-slate-200" aria-hidden />
          <span className="text-fluid-2xs text-slate-500">과세 구분</span>
          <TaxKindSwitch kind={activeKind} locked={exemptLocked} disabled={preview} onChange={setTaxKind} defaultKind={defaultsReady ? defaults.taxKind : undefined} />
          <span className="ml-auto text-fluid-2xs text-slate-500">발행하면 거래처가 자동 저장돼요</span>
        </div>
        {adapterProp.allowInquiry && hits.length > 0 && !picked ? (
          <ul className="max-w-[640px] overflow-hidden rounded-xl bg-white shadow-[0_4px_24px_rgba(17,24,39,.08)]">
            {hits.map((hit) => (
              <li key={hit.id}>
                <button type="button" className="w-full px-4 py-2 text-left text-fluid-xs hover:bg-slate-50" onClick={() => { applyHit(hit); setHits([]); }}>{hit.displayName || hit.customerName} · {hit.inquiryNumber} · {hit.brandName}{hit.buyer ? ' · 견적서 있음' : ''}</button>
              </li>
            ))}
          </ul>
        ) : null}
        <ReceiptOverAmountFields overWon={over} reason={extraReason} onReason={setExtraReason} />
        <TaxInvoicePaper {...form} />
        <div className="sticky bottom-4 z-10 flex flex-wrap items-center gap-4 rounded-xl bg-white py-2.5 pl-5 pr-3 shadow-[0_-1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.12)]">
          <span className={`rounded-lg px-2 py-0.5 text-fluid-2xs font-semibold ${TAX_KIND_TONE[activeKind]}`}>
            {TAX_KIND_LABEL[activeKind]} · {purpose === 2 ? '청구' : '영수'}
          </span>
          <div className="min-w-0">
            <p className="truncate text-fluid-xs text-slate-700">{buyer.corpName.trim() || '공급받는자 미입력'} · 품목 {lines.length}줄</p>
            <p className="truncate text-fluid-2xs text-slate-500">{taxNtsIssueNotice(brand)}</p>
          </div>
          <span className={`ml-auto text-fluid-2xs ${short ? 'font-medium text-red-700' : 'text-slate-500'}`}>
            {adapterProp.useWallet
              ? (short ? '잔액이 부족합니다' : `발행 비용 ${TAXINVOICE_UNIT_PRICE_KRW.toLocaleString('ko-KR')}원`)
              : walletLine}
          </span>
          <span className="text-fluid-xs text-slate-600">합계 <b className="num text-fluid-base text-slate-900">{won(supplySum + taxSum)}원</b></span>
          {taxDiffers ? <span className="text-fluid-2xs font-medium text-orange-700">기본과 다름</span> : null}
          {preview ? (
            <button type="button" className="h-[42px] rounded-xl px-4 text-fluid-xs font-medium text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400" onClick={() => setPreview(false)}>다시 수정</button>
          ) : null}
          {adapterProp.useWallet && short ? (
            <button type="button" className="h-[42px] min-w-[150px] rounded-xl bg-slate-900 px-5 text-fluid-sm font-semibold text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2" onClick={() => openCharge()}>충전하기</button>
          ) : (
            <button type="button" className="h-[42px] min-w-[150px] rounded-xl bg-slate-900 px-5 text-fluid-sm font-semibold text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50" disabled={saving || Boolean(blocked) || supplierBlocked} onClick={issue}>
              {issueButtonLabel('desktop')}
            </button>
          )}
        </div>
      </section>

      {/* ── Mobile ── */}
      <section className="flex flex-col lg:hidden">
        <header className={pageLayout ? 'hidden' : 'flex items-center gap-3 bg-white px-4 py-3 ring-1 ring-slate-200'}>
          {embedded ? null : <Link to="/admin/inquiries/receipts/taxinvoice" className="flex h-9 w-9 items-center justify-center rounded-full text-lg" aria-label="뒤로">‹</Link>}
          <h2 className="flex-1 text-fluid-sm font-bold">세금계산서 발행</h2>
          {brand?.certValid ? <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-fluid-2xs font-medium text-emerald-800">인증서 ✓</span> : null}
        </header>
        <div className="bg-white px-3 pb-2.5">
          <TaxKindSwitch kind={activeKind} locked={exemptLocked} disabled={preview} mobile onChange={setTaxKind} defaultKind={defaultsReady ? defaults.taxKind : undefined} />
          <p className="mt-1.5 text-fluid-2xs text-slate-500">면세를 고르면 「전자계산서」로 바뀌고 세액 칸이 사라집니다.</p>
        </div>
        <div className="space-y-3 px-3 py-3 pb-28">
          {adapterProp.allowInquiry ? (
            <div className="rounded-xl bg-white px-3 py-2.5 ring-1 ring-slate-200">
              <p className="text-fluid-2xs text-slate-500">접수 연결</p>
              <form className="mt-1 flex gap-2" onSubmit={(event) => { event.preventDefault(); if (!(picked && !unmatched)) void search(); }}>
                <input className="h-11 min-w-0 flex-1 rounded-lg bg-slate-50 px-3 text-sm ring-1 ring-slate-200" placeholder="고객명·전화번호" aria-label="고객 검색" readOnly={Boolean(picked && !unmatched)} value={picked && !unmatched ? (picked.displayName || picked.customerName) : query} onChange={(event) => { if (!(picked && !unmatched)) setQuery(event.target.value); }} />
                {picked && !unmatched ? (
                  <Button size="sm" variant="secondary" onClick={chooseOtherCustomer}>다른 고객</Button>
                ) : null}
              </form>
              {hits.length > 0 && !picked ? (
                <ul className="mt-2">
                  {hits.map((hit) => (
                    <li key={hit.id}><button type="button" className="w-full py-2 text-left text-sm" onClick={() => { applyHit(hit); setHits([]); }}>{hit.displayName || hit.customerName} · {hit.inquiryNumber}</button></li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
          <ReceiptOverAmountFields overWon={over} reason={extraReason} onReason={setExtraReason} />
          {(!picked || unmatched) && !adapterProp.supplierLocked ? (
            <label className="block text-fluid-2xs text-slate-500">
              브랜드
              <select className="mt-1 h-11 w-full rounded-lg bg-white px-3 text-sm ring-1 ring-slate-200" aria-label="브랜드" value={brandId} onChange={(event) => setBrandId(event.target.value)}>
                {linkedBrands.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
          ) : null}
          {/* buyer picker row (mobile) */}
          <div className="rounded-xl bg-white px-3 py-2.5 ring-1 ring-slate-200">
            {buyerPickerRow}
          </div>
          <TaxInvoiceMobileCards {...form} />
          <button type="button" className="w-full rounded-xl bg-white py-3 text-fluid-xs font-medium text-slate-700 ring-1 ring-slate-200" onClick={() => setPaperOpen((open) => !open)}>
            {paperOpen ? '실제 양식 접기' : '실제 양식으로 보기'}
          </button>
          {paperOpen ? <TaxInvoicePaper {...form} readOnly idPrefix="sheet" /> : null}
        </div>
        <footer className="fixed inset-x-0 bottom-0 z-[80] border-t border-slate-200 bg-white px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2.5 lg:hidden">
          <p className="mb-1 text-center text-fluid-2xs font-medium text-slate-800">{taxNtsIssueNotice(brand)}</p>
          {adapterProp.useWallet ? (
            <p className={`num mb-2 text-center text-fluid-2xs ${short ? 'text-red-700' : 'text-slate-500'}`}>
              {short ? '잔액이 부족합니다' : `발행 비용 150원 · 잔액 ${summary ? `${won(summary.balanceKrw)}원 → ${won(summary.balanceKrw - TAXINVOICE_UNIT_PRICE_KRW)}원` : '…'}`}
            </p>
          ) : (
            <p className="num mb-2 text-center text-fluid-2xs text-slate-500">{walletLine}</p>
          )}
          {preview && !short ? (
            <button type="button" className="mb-2 h-11 w-full rounded-xl text-sm font-medium text-slate-700 ring-1 ring-slate-300" onClick={() => setPreview(false)}>다시 수정</button>
          ) : null}
          {adapterProp.useWallet && short ? (
            <button type="button" className="h-12 w-full rounded-xl bg-slate-900 text-fluid-sm font-semibold text-white" onClick={() => openCharge()}>충전하기</button>
          ) : (
            <button type="button" className="h-12 w-full rounded-xl bg-slate-900 text-fluid-sm font-semibold text-white hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50" disabled={saving || Boolean(blocked) || supplierBlocked} onClick={issue}>
              {issueButtonLabel('mobile')}
            </button>
          )}
        </footer>
      </section>

      {supplierOpen && brand && !adapterProp.supplierLocked ? (
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
      {confirmOpen ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-xl" role="dialog" aria-modal="true">
            <p className="text-sm font-semibold text-slate-900">발행을 진행할까요?</p>
            {settingDiffs.length > 0 ? (
              <p className="mt-2 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs text-orange-950">
                기본설정과 다름: {settingDiffs.join(' · ')}
              </p>
            ) : null}
            {over > 0 ? (
              <p className="mt-2 text-sm text-slate-800">
                접수 금액 {won(remainWon ?? 0)}원 + 추가 {won(over)}원 = {won(invoiceTotal)}원
              </p>
            ) : null}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="h-10 rounded-lg border border-slate-300 px-3 text-sm" onClick={() => setConfirmOpen(false)} disabled={saving}>취소</button>
              <button type="button" className="h-10 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white disabled:opacity-50" disabled={saving} onClick={() => { setConfirmOpen(false); void submit(); }}>발행</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
