import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { getInquiry } from '../../api/inquiries';
import {
  createQuotation,
  fetchQuotationEditorDefaults,
  getQuotation,
  updateQuotation,
  type QuotationLineItemDto,
  type QuotationServiceItemDto,
} from '../../api/quotations';
import { fetchTenantCompanyProfile } from '../../api/tenantCompanyProfile';
import { QuotationCustomerFields } from '../../components/quotations/QuotationCustomerFields';
import { QuotationEmailPanel } from '../../components/quotations/QuotationEmailPanel';
import { QuotationLineItemsEditor } from '../../components/quotations/QuotationLineItemsEditor';
import { QuotationPdfActions } from '../../components/quotations/QuotationPdfActions';
import { QuotationPreconditionBanner } from '../../components/quotations/QuotationPreconditionBanner';
import {
  buildInquiryQuotationPrefill,
  inquiryLabelFromRow,
} from '../../components/quotations/inquiryQuotationPrefill';
import {
  emptyQuotationLine,
  parsePriceInt,
  parseQty,
  type EditableQuotationLine,
} from '../../components/quotations/quotationLineUtils';
import { QuotationStatusBadge, qUi } from '../../components/quotations/quotationUi';
import { getToken } from '../../stores/auth';

export function AdminQuotationEditorPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const seedInquiryId = searchParams.get('inquiryId')?.trim() || null;
  const isNew = id === 'new' || !id;
  const navigate = useNavigate();
  const token = getToken();

  const [catalog, setCatalog] = useState<QuotationServiceItemDto[]>([]);
  const [quoteNumber, setQuoteNumber] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('DRAFT');
  const [linkedInquiryId, setLinkedInquiryId] = useState<string | null>(null);
  const [linkedInquiryLabel, setLinkedInquiryLabel] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [memo, setMemo] = useState('');
  const [discountAmount, setDiscountAmount] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [lines, setLines] = useState<EditableQuotationLine[]>([emptyQuotationLine()]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [sentAt, setSentAt] = useState<string | null>(null);
  const [lastEmailedAt, setLastEmailedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [companyNameMissing, setCompanyNameMissing] = useState(false);
  const [smtpReady, setSmtpReady] = useState(false);
  const [globalSmtpFallback, setGlobalSmtpFallback] = useState(false);

  const loadPreconditions = useCallback(async () => {
    if (!token) return;
    try {
      const profile = await fetchTenantCompanyProfile(token);
      setCompanyNameMissing(!profile.companyRegistration.companyName?.trim());
      setSmtpReady(profile.smtp.configured);
      setGlobalSmtpFallback(profile.globalSmtpFallbackAvailable);
    } catch {
      /* optional */
    }
  }, [token]);

  const loadNewDefaults = useCallback(async () => {
    if (!token || !isNew) return;
    try {
      const defaults = await fetchQuotationEditorDefaults(token);
      setCatalog(defaults.catalog);
      if (defaults.validUntilDefault) setValidUntil(defaults.validUntilDefault);
    } catch {
      /* optional */
    }
  }, [token, isNew]);

  const loadInquirySeed = useCallback(async () => {
    if (!token || !isNew || !seedInquiryId) return;
    try {
      const row = await getInquiry(token, seedInquiryId);
      const prefill = buildInquiryQuotationPrefill(row);
      if (prefill.customerName) setCustomerName(prefill.customerName);
      if (prefill.customerPhone) setCustomerPhone(prefill.customerPhone);
      if (prefill.customerAddress) setCustomerAddress(prefill.customerAddress);
      if (prefill.memo) setMemo(prefill.memo);
      setLinkedInquiryId(seedInquiryId);
      setLinkedInquiryLabel(inquiryLabelFromRow(row));
    } catch (e) {
      setError(e instanceof Error ? e.message : '접수 정보를 불러올 수 없습니다.');
    }
  }, [token, isNew, seedInquiryId]);

  const loadQuotation = useCallback(async () => {
    if (!token || isNew || !id) return;
    setLoading(true);
    setError(null);
    try {
      const [row, defaults] = await Promise.all([
        getQuotation(token, id),
        fetchQuotationEditorDefaults(token),
      ]);
      setCatalog(defaults.catalog);
      setQuoteNumber(row.quoteNumber);
      setStatus(row.status);
      setCustomerName(row.customerName);
      setCustomerPhone(row.customerPhone ?? '');
      setCustomerEmail(row.customerEmail ?? '');
      setCustomerAddress(row.customerAddress ?? '');
      setMemo(row.memo ?? '');
      setSentAt(row.sentAt);
      setLastEmailedAt(row.lastEmailedAt);
      setLinkedInquiryId(row.inquiryId);
      setLinkedInquiryLabel(
        row.inquiry
          ? row.inquiry.inquiryNumber
            ? `${row.inquiry.inquiryNumber} · ${row.inquiry.customerName}`
            : row.inquiry.customerName
          : null,
      );
      setDiscountAmount(row.discountAmount > 0 ? String(row.discountAmount) : '');
      setValidUntil(row.validUntil ?? '');
      setLines(
        row.lineItems.length > 0
          ? row.lineItems.map((li) => ({
              key: li.id ?? `line-${li.label}`,
              catalogItemId: li.catalogItemId ?? null,
              label: li.label,
              unitPrice: String(li.unitPrice),
              quantity: String(li.quantity),
            }))
          : [emptyQuotationLine()],
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : '견적서를 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  }, [token, isNew, id]);

  useEffect(() => {
    void loadPreconditions();
  }, [loadPreconditions]);

  useEffect(() => {
    void loadNewDefaults();
  }, [loadNewDefaults]);

  useEffect(() => {
    void loadInquirySeed();
  }, [loadInquirySeed]);

  useEffect(() => {
    void loadQuotation();
  }, [loadQuotation]);

  const totals = useMemo(() => {
    let subtotal = 0;
    for (const li of lines) {
      const p = parsePriceInt(li.unitPrice);
      const q = parseQty(li.quantity);
      if (p != null && q != null) subtotal += p * q;
    }
    const disc = parsePriceInt(discountAmount) ?? 0;
    return { subtotal, total: Math.max(0, subtotal - disc) };
  }, [lines, discountAmount]);

  function buildLinePayload(): QuotationLineItemDto[] | null {
    const out: QuotationLineItemDto[] = [];
    for (const li of lines) {
      if (!li.label.trim()) continue;
      const unitPrice = parsePriceInt(li.unitPrice);
      const quantity = parseQty(li.quantity);
      if (unitPrice == null || quantity == null) return null;
      out.push({
        catalogItemId: li.catalogItemId,
        label: li.label.trim(),
        unitPrice,
        quantity,
      });
    }
    return out;
  }

  async function handleSave(finalize = false) {
    if (!token) return;
    if (!customerName.trim()) {
      alert('상대 이름을 입력해 주세요.');
      return;
    }
    const lineItems = buildLinePayload();
    if (lineItems == null) {
      alert('단가·수량을 올바르게 입력해 주세요.');
      return;
    }
    if (lineItems.length === 0) {
      alert('견적 항목을 1개 이상 추가해 주세요.');
      return;
    }

    const disc = parsePriceInt(discountAmount) ?? 0;
    setSaving(true);
    try {
      const body = {
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim() || null,
        customerEmail: customerEmail.trim() || null,
        customerAddress: customerAddress.trim() || null,
        memo: memo.trim() || null,
        discountAmount: disc,
        validUntil: validUntil.trim() || null,
        lineItems,
        ...(linkedInquiryId ? { inquiryId: linkedInquiryId } : {}),
        ...(finalize ? { status: 'FINALIZED' as const } : {}),
      };

      if (isNew) {
        const created = await createQuotation(token, body);
        navigate(`/admin/inquiries/quotations/${created.id}`, { replace: true });
      } else if (id) {
        const updated = await updateQuotation(token, id, body);
        setQuoteNumber(updated.quoteNumber);
        setStatus(updated.status);
        alert('저장되었습니다.');
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className={qUi.pageRootNarrow}>
        <p className={qUi.emptyState}>불러오는 중…</p>
      </div>
    );
  }

  const canEmail = smtpReady || globalSmtpFallback;

  return (
    <div className={`${qUi.pageRootNarrow} pb-24`}>
      <div className="space-y-1">
        <p className={qUi.breadcrumb}>
          <Link to="/admin/inquiries/quotations" className={qUi.breadcrumbLink}>
            견적 목록
          </Link>
          {' · '}
          {isNew ? '새 견적서' : '편집'}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className={qUi.pageTitle}>
            {isNew ? '새 견적서' : quoteNumber ?? '견적서'}
          </h1>
          {!isNew && (status === 'SENT' || status === 'FINALIZED') && (
            <QuotationStatusBadge status={status} />
          )}
        </div>
        {!isNew && (
          <p className={qUi.pageDesc}>상대 정보·항목을 수정한 뒤 저장하거나 PDF·이메일로 발송합니다.</p>
        )}
      </div>

      {linkedInquiryLabel && (
        <p className={qUi.alertInfo}>
          접수 연동: <span className="font-semibold">{linkedInquiryLabel}</span>
        </p>
      )}

      <QuotationPreconditionBanner
        companyNameMissing={companyNameMissing}
        smtpReady={smtpReady}
        globalSmtpFallback={globalSmtpFallback}
      />

      {error && <p className={qUi.alertError} role="alert">{error}</p>}

      <div className="space-y-4">
        <QuotationCustomerFields
          customerName={customerName}
          customerPhone={customerPhone}
          customerEmail={customerEmail}
          customerAddress={customerAddress}
          validUntil={validUntil}
          onCustomerNameChange={setCustomerName}
          onCustomerPhoneChange={setCustomerPhone}
          onCustomerEmailChange={setCustomerEmail}
          onCustomerAddressChange={setCustomerAddress}
          onValidUntilChange={setValidUntil}
        />

        <QuotationLineItemsEditor lines={lines} catalog={catalog} onChange={setLines} />

        <section className={`${qUi.cardBody} space-y-3`}>
          <h2 className={qUi.sectionTitle}>합계</h2>
          <div className="flex justify-between text-fluid-sm text-slate-600">
            <span>소계</span>
            <span className="tabular-nums font-medium text-slate-800">
              {totals.subtotal.toLocaleString('ko-KR')}원
            </span>
          </div>
          <label className="flex justify-between items-center gap-3 text-fluid-sm">
            <span className="text-slate-600 shrink-0">할인</span>
            <input
              className={`${qUi.input} w-32 text-right tabular-nums`}
              inputMode="numeric"
              value={discountAmount}
              onChange={(e) => setDiscountAmount(e.target.value)}
            />
          </label>
          <div className="flex justify-between items-center pt-3 border-t border-slate-100">
            <span className="font-semibold text-slate-900">합계 (VAT 별도)</span>
            <span className="text-lg font-bold tabular-nums text-slate-900">
              {totals.total.toLocaleString('ko-KR')}원
            </span>
          </div>
        </section>

        <section className={`${qUi.cardBody}`}>
          <label className="block">
            <span className={qUi.label}>비고 (견적서 본문)</span>
            <textarea
              className={qUi.textarea}
              rows={3}
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
            />
          </label>
        </section>

        {!isNew && id && token && (
          <QuotationEmailPanel
            token={token}
            quotationId={id}
            status={status}
            customerEmail={customerEmail}
            sentAt={sentAt}
            lastEmailedAt={lastEmailedAt}
            canEmail={canEmail}
            onSent={(patch) => {
              setStatus(patch.status);
              setCustomerEmail(patch.customerEmail ?? '');
              setSentAt(patch.sentAt);
              setLastEmailedAt(patch.lastEmailedAt);
            }}
          />
        )}
      </div>

      <div className={qUi.stickyActionBar}>
        <div className="mx-auto flex max-w-4xl flex-wrap gap-2 justify-center sm:justify-start">
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSave(false)}
            className={qUi.btnPrimary}
          >
            {saving ? '저장 중…' : '저장'}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSave(true)}
            className={qUi.btnSecondary}
          >
            확정 저장
          </button>
          {!isNew && id && (
            <QuotationPdfActions
              token={token ?? ''}
              quotationId={id}
              quoteNumber={quoteNumber}
              disabled={saving}
            />
          )}
        </div>
      </div>
    </div>
  );
}
