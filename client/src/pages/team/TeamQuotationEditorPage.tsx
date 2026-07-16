import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { getTeamInquiry } from '../../api/team';
import {
  createTeamQuotation,
  fetchTeamQuotationEditorDefaults,
  getTeamQuotation,
  updateTeamQuotation,
  type QuotationEditorOperatingCompanyDto,
  type QuotationLineItemDto,
  type QuotationServiceItemDto,
  type QuotationVatMode,
} from '../../api/teamQuotations';
import type { TenantCompanyRegistration, TenantSmtpSettingsPublic } from '../../api/tenantCompanyProfile';
import { QuotationDocumentEditor } from '../../components/quotations/QuotationDocumentEditor';
import { QuotationMobileFormEditor } from '../../components/quotations/QuotationMobileFormEditor';
import { QuotationEmailPanel } from '../../components/quotations/QuotationEmailPanel';
import { QuotationPdfActions } from '../../components/quotations/QuotationPdfActions';
import { QuotationPreconditionBanner } from '../../components/quotations/QuotationPreconditionBanner';
import {
  buildInquiryQuotationPrefill,
  inquiryLabelFromRow,
} from '../../components/quotations/inquiryQuotationPrefill';
import {
  emptyQuotationLine,
  linesFromCatalog,
  parsePriceInt,
  parseQty,
  syncLinesWithCatalog,
  type EditableQuotationLine,
} from '../../components/quotations/quotationLineUtils';
import {
  pickQuotationOperatingCompanyId,
  resolveQuotationSupplierRegistration,
} from '../../components/quotations/quotationBrandResolve';
import { QuotationStatusBadge, qUi } from '../../components/quotations/quotationUi';
import { computeQuotationVatAmounts } from '@shared/quotationVat';
import type { QuotationDocumentType } from '@shared/quotationDocument';
import { resolveDocumentFooterNotice } from '@shared/quotationDocument';
import { getTeamToken, subscribeTeamAuth } from '../../stores/teamAuth';

function pickDefaultOperatingCompanyId(
  companies: QuotationEditorOperatingCompanyDto[],
  preferredId?: string | null,
): string {
  return pickQuotationOperatingCompanyId(companies, preferredId);
}

function companyForOperatingCompany(
  companies: QuotationEditorOperatingCompanyDto[],
  operatingCompanyId: string,
  tenantFallback: TenantCompanyRegistration,
): TenantCompanyRegistration {
  return resolveQuotationSupplierRegistration(companies, operatingCompanyId, tenantFallback);
}

function computeSmtpReadyForBrand(
  operatingCompanyId: string,
  companies: QuotationEditorOperatingCompanyDto[],
  tenantSmtp: TenantSmtpSettingsPublic,
  globalFallback: boolean,
): boolean {
  const brand = companies.find((c) => c.id === operatingCompanyId);
  if (brand) return brand.smtpEffectiveConfigured;
  return tenantSmtp.configured || globalFallback;
}

export function TeamQuotationEditorPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const seedInquiryId = searchParams.get('inquiryId')?.trim() || null;
  const returnTo = searchParams.get('returnTo')?.trim() || '/team/assignments';
  const isNew = id === 'new' || !id;
  const navigate = useNavigate();
  const token = useSyncExternalStore(subscribeTeamAuth, getTeamToken, () => null);

  const [catalog, setCatalog] = useState<QuotationServiceItemDto[]>([]);
  const [operatingCompanies, setOperatingCompanies] = useState<QuotationEditorOperatingCompanyDto[]>(
    [],
  );
  const [operatingCompanyId, setOperatingCompanyId] = useState('');
  const [seedOperatingCompanyId, setSeedOperatingCompanyId] = useState<string | null>(null);
  const [footerNotice, setFooterNotice] = useState<string | null>(null);
  const [receiptFooterNotice, setReceiptFooterNotice] = useState<string | null>(null);
  const [documentType, setDocumentType] = useState<QuotationDocumentType>('QUOTATION');
  const [tenantCompanyRegistration, setTenantCompanyRegistration] =
    useState<TenantCompanyRegistration>({});
  const [quoteNumber, setQuoteNumber] = useState<string | null>(null);
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('DRAFT');
  const [linkedInquiryId, setLinkedInquiryId] = useState<string | null>(null);
  const [linkedInquiryLabel, setLinkedInquiryLabel] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [memo, setMemo] = useState('');
  const [discountAmount, setDiscountAmount] = useState('');
  const [vatMode, setVatMode] = useState<QuotationVatMode>('VAT_SEPARATE');
  const [validUntil, setValidUntil] = useState('');
  const [lines, setLines] = useState<EditableQuotationLine[]>([emptyQuotationLine()]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [sentAt, setSentAt] = useState<string | null>(null);
  const [lastEmailedAt, setLastEmailedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [companyNameMissing, setCompanyNameMissing] = useState(false);
  const [tenantSmtp, setTenantSmtp] = useState<TenantSmtpSettingsPublic>({
    host: '',
    port: 587,
    secure: false,
    user: '',
    from: '',
    passwordConfigured: false,
    configured: false,
  });
  const [smtpReady, setSmtpReady] = useState(false);
  const [globalSmtpFallback, setGlobalSmtpFallback] = useState(false);
  const defaultsRequestRef = useRef(0);

  const returnQs = returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : '';

  const applyEditorDefaults = useCallback(
    (
      defaults: Awaited<ReturnType<typeof fetchTeamQuotationEditorDefaults>>,
      preferredOperatingCompanyId?: string | null,
    ) => {
      setCatalog(defaults.catalog);
      setOperatingCompanies(defaults.operatingCompanies);
      setTenantCompanyRegistration(defaults.tenantCompanyRegistration);
      const nextOperatingCompanyId = pickDefaultOperatingCompanyId(
        defaults.operatingCompanies,
        preferredOperatingCompanyId ?? seedOperatingCompanyId,
      );
      setOperatingCompanyId(nextOperatingCompanyId);
      const resolvedCompany = companyForOperatingCompany(
        defaults.operatingCompanies,
        nextOperatingCompanyId,
        defaults.tenantCompanyRegistration,
      );
      setCompanyNameMissing(!resolvedCompany.companyName?.trim());
      setFooterNotice(defaults.config.footerNotice);
      setReceiptFooterNotice(defaults.config.receiptFooterNotice ?? null);
      setTenantSmtp(defaults.smtp);
      setGlobalSmtpFallback(defaults.globalSmtpFallbackAvailable);
      setSmtpReady(
        computeSmtpReadyForBrand(
          nextOperatingCompanyId,
          defaults.operatingCompanies,
          defaults.smtp,
          defaults.globalSmtpFallbackAvailable,
        ),
      );
      if (isNew) {
        if (defaults.validUntilDefault) setValidUntil(defaults.validUntilDefault);
        if (defaults.catalog.length > 0) {
          setLines(linesFromCatalog(defaults.catalog));
        }
      }
    },
    [isNew, seedOperatingCompanyId],
  );

  const loadNewDefaults = useCallback(async () => {
    if (!token || !isNew) return;
    const requestId = ++defaultsRequestRef.current;
    try {
      const defaults = await fetchTeamQuotationEditorDefaults(token);
      if (requestId !== defaultsRequestRef.current) return;
      applyEditorDefaults(defaults);
    } catch (e) {
      if (requestId !== defaultsRequestRef.current) return;
      setError(e instanceof Error ? e.message : '견적 설정을 불러올 수 없습니다.');
    }
  }, [token, isNew, applyEditorDefaults]);

  const loadInquirySeed = useCallback(async () => {
    if (!token || !isNew || !seedInquiryId) return;
    try {
      const row = (await getTeamInquiry(token, seedInquiryId)) as Record<string, unknown>;
      const prefill = buildInquiryQuotationPrefill(row);
      if (prefill.customerName) setCustomerName(prefill.customerName);
      if (prefill.customerPhone) setCustomerPhone(prefill.customerPhone);
      if (prefill.customerAddress) setCustomerAddress(prefill.customerAddress);
      if (prefill.memo) setMemo(prefill.memo);
      const inquiryOcId =
        typeof row.operatingCompanyId === 'string' && row.operatingCompanyId.trim()
          ? row.operatingCompanyId.trim()
          : null;
      if (inquiryOcId) setSeedOperatingCompanyId(inquiryOcId);
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
        getTeamQuotation(token, id),
        fetchTeamQuotationEditorDefaults(token),
      ]);
      applyEditorDefaults(defaults, row.operatingCompanyId);
      setQuoteNumber(row.quoteNumber);
      setDocumentType(row.documentType ?? 'QUOTATION');
      setCreatedAt(row.createdAt);
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
      setVatMode(row.vatMode ?? 'VAT_SEPARATE');
      setValidUntil(row.validUntil ?? '');
      const mapped =
        row.lineItems.length > 0
          ? row.lineItems.map((li) => ({
              key: li.id ?? `line-${li.label}`,
              catalogItemId: li.catalogItemId ?? null,
              label: li.label,
              unitPrice: String(li.unitPrice),
              quantity: String(li.quantity),
            }))
          : linesFromCatalog(defaults.catalog);
      setLines(syncLinesWithCatalog(mapped, defaults.catalog));
    } catch (e) {
      setError(e instanceof Error ? e.message : '견적서를 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  }, [token, isNew, id, applyEditorDefaults]);

  useEffect(() => {
    void loadNewDefaults();
  }, [loadNewDefaults]);

  useEffect(() => {
    void loadInquirySeed();
  }, [loadInquirySeed]);

  useEffect(() => {
    void loadQuotation();
  }, [loadQuotation]);

  useEffect(() => {
    if (isNew && !seedInquiryId) {
      setError('배정 접수 상세에서 견적서 만들기를 이용해 주세요.');
    }
  }, [isNew, seedInquiryId]);

  useEffect(() => {
    if (operatingCompanies.length === 0) return;

    const currentValid =
      operatingCompanyId && operatingCompanies.some((c) => c.id === operatingCompanyId)
        ? operatingCompanyId
        : null;
    const preferred =
      currentValid ??
      (seedOperatingCompanyId &&
      operatingCompanies.some((c) => c.id === seedOperatingCompanyId)
        ? seedOperatingCompanyId
        : pickQuotationOperatingCompanyId(operatingCompanies, seedOperatingCompanyId));

    if (!preferred) return;

    if (preferred !== operatingCompanyId) {
      setOperatingCompanyId(preferred);
    }

    const resolved = resolveQuotationSupplierRegistration(
      operatingCompanies,
      preferred,
      tenantCompanyRegistration,
    );
    setCompanyNameMissing(!resolved.companyName?.trim());
    setSmtpReady(
      computeSmtpReadyForBrand(
        preferred,
        operatingCompanies,
        tenantSmtp,
        globalSmtpFallback,
      ),
    );
  }, [
    operatingCompanies,
    seedOperatingCompanyId,
    tenantCompanyRegistration,
    operatingCompanyId,
    tenantSmtp,
    globalSmtpFallback,
  ]);

  const handleOperatingCompanyChange = useCallback(
    (nextId: string) => {
      setOperatingCompanyId(nextId);
      const resolved = companyForOperatingCompany(
        operatingCompanies,
        nextId,
        tenantCompanyRegistration,
      );
      setCompanyNameMissing(!resolved.companyName?.trim());
      setSmtpReady(
        computeSmtpReadyForBrand(nextId, operatingCompanies, tenantSmtp, globalSmtpFallback),
      );
    },
    [operatingCompanies, tenantCompanyRegistration, tenantSmtp, globalSmtpFallback],
  );

  const resolvedFooterNotice = useMemo(
    () =>
      resolveDocumentFooterNotice(documentType, {
        footerNotice,
        receiptFooterNotice,
      }),
    [documentType, footerNotice, receiptFooterNotice],
  );

  const handleDocumentTypeChange = useCallback((next: QuotationDocumentType) => {
    setDocumentType(next);
    if (next === 'RECEIPT') setValidUntil('');
  }, []);

  const totals = useMemo(() => {
    let subtotal = 0;
    for (const li of lines) {
      const p = parsePriceInt(li.unitPrice);
      const q = parseQty(li.quantity);
      if (p != null && q != null) subtotal += p * q;
    }
    const discountNum = parsePriceInt(discountAmount) ?? 0;
    const supplyTotal = Math.max(0, subtotal - discountNum);
    const { vatAmount, grandTotal } = computeQuotationVatAmounts(supplyTotal, vatMode);
    return { subtotal, discountNum, supplyTotal, vatAmount, grandTotal };
  }, [lines, discountAmount, vatMode]);

  function buildLinePayload(fromLines: EditableQuotationLine[]): QuotationLineItemDto[] | null {
    const out: QuotationLineItemDto[] = [];
    for (const li of fromLines) {
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
    const inquiryId = linkedInquiryId ?? seedInquiryId;
    if (!inquiryId) {
      alert('연결된 접수가 없습니다. 배정 목록에서 다시 시도해 주세요.');
      return;
    }
    if (!customerName.trim()) {
      alert('공급받는자 이름을 입력해 주세요.');
      return;
    }
    const normalizedLines = syncLinesWithCatalog(lines, catalog);
    const lineItems = buildLinePayload(normalizedLines);
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
        validUntil: documentType === 'RECEIPT' ? null : validUntil.trim() || null,
        documentType,
        vatMode,
        operatingCompanyId: operatingCompanyId || null,
        lineItems,
        inquiryId,
        ...(finalize ? { status: 'FINALIZED' as const } : {}),
      };

      if (isNew) {
        const created = await createTeamQuotation(token, body);
        navigate(`/team/quotations/${created.id}${returnQs}`, { replace: true });
      } else if (id) {
        const updated = await updateTeamQuotation(token, id, body);
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
      <div className={qUi.pageRoot}>
        <p className={qUi.emptyState}>불러오는 중…</p>
      </div>
    );
  }

  const canEmail = smtpReady || globalSmtpFallback;

  return (
    <div className={`${qUi.pageRoot} ${qUi.stickyActionBarSpacer}`}>
      <div className="space-y-1">
        <p className={qUi.breadcrumb}>
          <Link to={returnTo} className={qUi.breadcrumbLink}>
            배정목록
          </Link>
          {' · '}
          {isNew ? '새 견적서' : '편집'}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className={qUi.pageTitle}>{isNew ? '새 견적서' : (quoteNumber ?? '견적서')}</h1>
          {!isNew && (status === 'SENT' || status === 'FINALIZED') && (
            <QuotationStatusBadge status={status} />
          )}
        </div>
        <p className={qUi.pageDesc}>
          담당 접수에 연결된 견적서입니다. 저장 후 PDF·이메일 발송이 가능합니다.
        </p>
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
        variant="team"
      />

      {error && (
        <p className={qUi.alertError} role="alert">
          {error}
        </p>
      )}

      <QuotationMobileFormEditor
        quoteNumber={quoteNumber}
        createdAt={createdAt}
        tenantCompanyRegistration={tenantCompanyRegistration}
        operatingCompanies={operatingCompanies}
        operatingCompanyId={operatingCompanyId}
        onOperatingCompanyChange={handleOperatingCompanyChange}
        documentType={documentType}
        onDocumentTypeChange={handleDocumentTypeChange}
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
        lines={lines}
        catalog={catalog}
        onLinesChange={setLines}
        discountAmount={discountAmount}
        onDiscountAmountChange={setDiscountAmount}
        subtotal={totals.subtotal}
        discountNum={totals.discountNum}
        supplyTotal={totals.supplyTotal}
        vatMode={vatMode}
        onVatModeChange={setVatMode}
        vatAmount={totals.vatAmount}
        grandTotal={totals.grandTotal}
        memo={memo}
        onMemoChange={setMemo}
        footerNotice={resolvedFooterNotice}
      />

      <div className="hidden lg:block">
        <QuotationDocumentEditor
          quoteNumber={quoteNumber}
          createdAt={createdAt}
          tenantCompanyRegistration={tenantCompanyRegistration}
          operatingCompanies={operatingCompanies}
          operatingCompanyId={operatingCompanyId}
          onOperatingCompanyChange={handleOperatingCompanyChange}
          documentType={documentType}
          onDocumentTypeChange={handleDocumentTypeChange}
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
          lines={lines}
          catalog={catalog}
          onLinesChange={setLines}
          discountAmount={discountAmount}
          onDiscountAmountChange={setDiscountAmount}
          subtotal={totals.subtotal}
          discountNum={totals.discountNum}
          supplyTotal={totals.supplyTotal}
          vatMode={vatMode}
          onVatModeChange={setVatMode}
          vatAmount={totals.vatAmount}
          grandTotal={totals.grandTotal}
          memo={memo}
          onMemoChange={setMemo}
          footerNotice={resolvedFooterNotice}
        />
      </div>

      {!isNew && id && token && (
        <QuotationEmailPanel
          token={token}
          quotationId={id}
          status={status}
          customerEmail={customerEmail}
          sentAt={sentAt}
          lastEmailedAt={lastEmailedAt}
          canEmail={canEmail}
          apiScope="team"
          onSent={(patch) => {
            setStatus(patch.status);
            setCustomerEmail(patch.customerEmail ?? '');
            setSentAt(patch.sentAt);
            setLastEmailedAt(patch.lastEmailedAt);
          }}
        />
      )}

      <div className={qUi.stickyActionBar}>
        <div className="mx-auto flex max-w-[794px] min-w-0 flex-col gap-2 lg:flex-row lg:flex-wrap lg:justify-start">
          <div className="grid grid-cols-2 gap-2 lg:flex lg:flex-wrap lg:gap-2">
            <button
              type="button"
              disabled={saving || (isNew && !seedInquiryId)}
              onClick={() => void handleSave(false)}
              className={`${qUi.btnPrimary} w-full py-3 lg:w-auto lg:py-2.5 touch-manipulation`}
            >
              {saving ? '저장 중…' : '저장'}
            </button>
            <button
              type="button"
              disabled={saving || (isNew && !seedInquiryId)}
              onClick={() => void handleSave(true)}
              className={`${qUi.btnSecondary} w-full py-3 lg:w-auto lg:py-1.5 touch-manipulation`}
            >
              확정 저장
            </button>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 lg:justify-start">
            {!isNew && id && (
              <QuotationPdfActions
                token={token ?? ''}
                quotationId={id}
                quoteNumber={quoteNumber}
                disabled={saving}
                apiScope="team"
              />
            )}
            <Link
              to={returnTo}
              className={`${qUi.btnGhost} py-2.5 touch-manipulation hidden sm:inline-flex lg:inline-flex`}
            >
              돌아가기
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
