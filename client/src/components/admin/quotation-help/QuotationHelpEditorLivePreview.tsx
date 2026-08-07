import { useMemo, useState } from 'react';
import { QuotationDocumentEditor } from '../../quotations/QuotationDocumentEditor';
import { linesFromCatalog } from '../../quotations/quotationLineUtils';
import { qUi } from '../../quotations/quotationUi';
import { computeQuotationVatAmounts } from '@shared/quotationVat';
import type { QuotationVatMode } from '@shared/quotationVat';
import type { QuotationDocumentType } from '@shared/quotationDocument';
import {
  QUOTATION_HELP_DEMO,
  QUOTATION_HELP_DEMO_CATALOG,
  QUOTATION_HELP_DEMO_OPERATING_COMPANY,
  QUOTATION_HELP_DEMO_TENANT_REG,
} from './quotationHelpDemoData';

/** 실제 QuotationDocumentEditor + 하단 바·이메일 패널 (읽기 전용) */
export function QuotationHelpEditorLivePreview({ enlarged = false }: { enlarged?: boolean }) {
  const [documentType] = useState<QuotationDocumentType>('QUOTATION');
  const [customerName] = useState(QUOTATION_HELP_DEMO.customerName);
  const [customerPhone] = useState(QUOTATION_HELP_DEMO.customerPhone);
  const [customerEmail] = useState(QUOTATION_HELP_DEMO.customerEmail);
  const [customerAddress] = useState(QUOTATION_HELP_DEMO.customerAddress);
  const [validUntil] = useState(QUOTATION_HELP_DEMO.validUntil);
  const [memo] = useState(QUOTATION_HELP_DEMO.memo);
  const [discountAmount] = useState(QUOTATION_HELP_DEMO.discountAmount);
  const [vatMode] = useState<QuotationVatMode>('VAT_SEPARATE');
  const [lines] = useState(() => linesFromCatalog(QUOTATION_HELP_DEMO_CATALOG));

  const noop = () => {};

  const totals = useMemo(() => {
    let subtotal = 0;
    for (const li of lines) {
      const p = parseInt(li.unitPrice.replace(/,/g, ''), 10);
      const q = parseInt(li.quantity, 10);
      if (Number.isFinite(p) && Number.isFinite(q) && q >= 1) subtotal += p * q;
    }
    const discountNum = 0;
    const supplyTotal = Math.max(0, subtotal - discountNum);
    const { vatAmount, grandTotal } = computeQuotationVatAmounts(supplyTotal, vatMode);
    return { subtotal, discountNum, supplyTotal, vatAmount, grandTotal };
  }, [lines, vatMode]);

  const rootPad = enlarged ? 'space-y-4' : 'space-y-3';

  return (
    <div className={`pointer-events-none select-none ${rootPad}`}>
      <QuotationDocumentEditor
        quoteNumber={QUOTATION_HELP_DEMO.quoteNumber}
        createdAt={QUOTATION_HELP_DEMO.createdAt}
        tenantCompanyRegistration={QUOTATION_HELP_DEMO_TENANT_REG}
        operatingCompanies={[QUOTATION_HELP_DEMO_OPERATING_COMPANY]}
        operatingCompanyId={QUOTATION_HELP_DEMO_OPERATING_COMPANY.id}
        onOperatingCompanyChange={noop}
        documentType={documentType}
        onDocumentTypeChange={noop}
        customerName={customerName}
        customerPhone={customerPhone}
        customerEmail={customerEmail}
        customerAddress={customerAddress}
        validUntil={validUntil}
        onCustomerNameChange={noop}
        onCustomerPhoneChange={noop}
        onCustomerEmailChange={noop}
        onCustomerAddressChange={noop}
        onValidUntilChange={noop}
        lines={lines}
        catalog={QUOTATION_HELP_DEMO_CATALOG}
        onLinesChange={noop}
        discountAmount={discountAmount}
        onDiscountAmountChange={noop}
        subtotal={totals.subtotal}
        discountNum={totals.discountNum}
        supplyTotal={totals.supplyTotal}
        vatMode={vatMode}
        onVatModeChange={noop}
        vatAmount={totals.vatAmount}
        grandTotal={totals.grandTotal}
        memo={memo}
        onMemoChange={noop}
        footerNotice={QUOTATION_HELP_DEMO.footerNotice}
      />

      <section className={`${qUi.cardBody} space-y-4`}>
        <h2 className={qUi.sectionTitle}>이메일 발송</h2>
        <label className="block">
          <span className={qUi.label}>수신 이메일</span>
          <input readOnly tabIndex={-1} className={qUi.input} value={customerEmail} aria-hidden />
        </label>
        <label className="block">
          <span className={qUi.label}>제목</span>
          <input
            readOnly
            tabIndex={-1}
            className={qUi.input}
            value={QUOTATION_HELP_DEMO.emailSubject}
            aria-hidden
          />
        </label>
        <label className="block">
          <span className={qUi.label}>본문</span>
          <textarea
            readOnly
            tabIndex={-1}
            rows={4}
            className={qUi.textarea}
            value={QUOTATION_HELP_DEMO.emailBody}
            aria-hidden
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <span className={qUi.btnSuccess}>PDF 첨부 발송</span>
          <span className={qUi.btnGhost}>기본값 불러오기</span>
        </div>
      </section>

      <div className="rounded-xl border border-slate-200 bg-white px-3 py-3 sm:px-4">
        <div className="mx-auto flex max-w-[794px] flex-wrap gap-2 justify-center sm:justify-start">
          <span className={qUi.btnPrimary}>저장</span>
          <span className={qUi.btnSecondary}>확정 저장</span>
          <span className={qUi.btnSecondary}>PDF 미리보기</span>
          <span className={qUi.btnSecondary}>PDF 다운로드</span>
        </div>
      </div>
    </div>
  );
}
