import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getToken } from '../../stores/auth';
import {
  createQuotation,
  downloadQuotationPdf,
  fetchQuotationEditorDefaults,
  getQuotation,
  sendQuotationEmail,
  updateQuotation,
  type QuotationLineItemDto,
  type QuotationServiceItemDto,
} from '../../api/quotations';
import { fetchTenantCompanyProfile } from '../../api/tenantCompanyProfile';
import { QuotationCustomerFields } from '../../components/quotations/QuotationCustomerFields';
import { QuotationLineItemsEditor } from '../../components/quotations/QuotationLineItemsEditor';
import { QuotationPreconditionBanner } from '../../components/quotations/QuotationPreconditionBanner';
import {
  emptyQuotationLine,
  parsePriceInt,
  parseQty,
  type EditableQuotationLine,
} from '../../components/quotations/quotationLineUtils';

export function AdminQuotationEditorPage() {
  const { id } = useParams<{ id: string }>();
  const isNew = id === 'new' || !id;
  const navigate = useNavigate();
  const token = getToken();

  const [catalog, setCatalog] = useState<QuotationServiceItemDto[]>([]);
  const [quoteNumber, setQuoteNumber] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('DRAFT');
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
  const [emailTo, setEmailTo] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
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
      setEmailTo(row.customerEmail ?? '');
      setCustomerAddress(row.customerAddress ?? '');
      setMemo(row.memo ?? '');
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

  async function handleDownloadPdf() {
    if (!token || isNew || !id) {
      alert('먼저 저장해 주세요.');
      return;
    }
    try {
      const blob = await downloadQuotationPdf(token, id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `견적서_${quoteNumber ?? id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'PDF 다운로드에 실패했습니다.');
    }
  }

  async function handleSendEmail() {
    if (!token || isNew || !id) {
      alert('먼저 저장해 주세요.');
      return;
    }
    if (!smtpReady && !globalSmtpFallback) {
      alert('SMTP가 설정되지 않았습니다. 업체등록정보에서 메일 설정을 확인해 주세요.');
      return;
    }
    const to = emailTo.trim() || customerEmail.trim();
    if (!to) {
      alert('수신 이메일을 입력해 주세요.');
      return;
    }
    setSendingEmail(true);
    try {
      const updated = await sendQuotationEmail(token, id, to);
      setStatus(updated.status);
      setCustomerEmail(updated.customerEmail ?? to);
      alert('이메일을 발송했습니다.');
    } catch (e) {
      alert(e instanceof Error ? e.message : '이메일 발송에 실패했습니다.');
    } finally {
      setSendingEmail(false);
    }
  }

  if (loading) {
    return <p className="p-4 text-sm text-gray-500">불러오는 중…</p>;
  }

  const canEmail = smtpReady || globalSmtpFallback;

  return (
    <div className="max-w-3xl mx-auto px-3 py-4 sm:px-4 pb-24">
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Link to="/admin/inquiries/quotations" className="text-sm text-blue-600 hover:underline">
          ← 목록
        </Link>
        <h1 className="text-lg font-semibold text-gray-900 ml-1">
          {isNew ? '새 견적서' : quoteNumber ?? '견적서'}
        </h1>
        {!isNew && status === 'SENT' && (
          <span className="text-xs px-2 py-0.5 bg-green-100 text-green-800 rounded">발송됨</span>
        )}
        {!isNew && status === 'FINALIZED' && (
          <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-800 rounded">확정</span>
        )}
      </div>

      <QuotationPreconditionBanner
        companyNameMissing={companyNameMissing}
        smtpReady={smtpReady}
        globalSmtpFallback={globalSmtpFallback}
      />

      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      <div className="space-y-6 mb-6">
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
      </div>

      <section className="border rounded-lg p-3 bg-gray-50 mb-6 text-sm space-y-1">
        <div className="flex justify-between">
          <span>소계</span>
          <span className="tabular-nums">{totals.subtotal.toLocaleString('ko-KR')}원</span>
        </div>
        <label className="flex justify-between items-center gap-2">
          <span>할인</span>
          <input
            className="w-28 border rounded px-2 py-1 text-right tabular-nums"
            inputMode="numeric"
            value={discountAmount}
            onChange={(e) => setDiscountAmount(e.target.value)}
          />
        </label>
        <div className="flex justify-between font-semibold text-base pt-1 border-t">
          <span>합계 (VAT 별도)</span>
          <span className="tabular-nums">{totals.total.toLocaleString('ko-KR')}원</span>
        </div>
      </section>

      <label className="block text-sm mb-6">
        <span className="text-gray-700">비고 (견적서 본문)</span>
        <textarea
          className="mt-1 w-full border rounded px-2 py-1.5"
          rows={3}
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
        />
      </label>

      {!isNew && (
        <section className="border rounded-lg p-3 mb-6">
          <h2 className="font-medium text-sm mb-2">이메일 발송</h2>
          <div className="flex flex-wrap gap-2">
            <input
              type="email"
              className="flex-1 min-w-[160px] border rounded px-2 py-1.5 text-sm"
              placeholder="수신 이메일"
              value={emailTo}
              onChange={(e) => setEmailTo(e.target.value)}
              disabled={!canEmail}
            />
            <button
              type="button"
              disabled={sendingEmail || !canEmail}
              onClick={() => void handleSendEmail()}
              className="px-3 py-1.5 text-sm bg-emerald-600 text-white rounded disabled:opacity-50"
              title={!canEmail ? 'SMTP 설정 필요' : undefined}
            >
              {sendingEmail ? '발송 중…' : 'PDF 첨부 발송'}
            </button>
          </div>
        </section>
      )}

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-3 flex flex-wrap gap-2 justify-center sm:static sm:border-0 sm:p-0 sm:justify-start">
        <button
          type="button"
          disabled={saving}
          onClick={() => void handleSave(false)}
          className="px-4 py-2 bg-blue-600 text-white rounded text-sm disabled:opacity-50"
        >
          {saving ? '저장 중…' : '저장'}
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => void handleSave(true)}
          className="px-4 py-2 border rounded text-sm disabled:opacity-50"
        >
          확정 저장
        </button>
        {!isNew && (
          <button
            type="button"
            onClick={() => void handleDownloadPdf()}
            className="px-4 py-2 border rounded text-sm"
          >
            PDF 다운로드
          </button>
        )}
      </div>
    </div>
  );
}
