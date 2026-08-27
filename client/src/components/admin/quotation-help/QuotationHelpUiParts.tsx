import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { QuotationStatusBadge, qUi } from '../../quotations/quotationUi';

function previewProps(disabled = true) {
  return {
    disabled,
    tabIndex: -1,
    'aria-hidden': true as const,
  };
}

function HelpUiShell({ block, children }: { block?: boolean; children: ReactNode }) {
  return (
    <span
      className={
        block
          ? 'my-1 flex flex-wrap items-center gap-1.5 pointer-events-none select-none'
          : 'inline-flex align-middle pointer-events-none select-none vertical-align-middle'
      }
      aria-hidden
    >
      {children}
    </span>
  );
}

export function QuotationHelpSaveButton(props: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>) {
  return (
    <HelpUiShell>
      <button type="button" className={`${qUi.btnPrimary} !px-3 !py-2 !text-fluid-xs`} {...previewProps()} {...props}>
        저장
      </button>
    </HelpUiShell>
  );
}

export function QuotationHelpFinalizeButton(props: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>) {
  return (
    <HelpUiShell>
      <button
        type="button"
        className={`${qUi.btnSecondary} !px-3 !py-1.5 !text-fluid-xs`}
        {...previewProps()}
        {...props}
      >
        확정 저장
      </button>
    </HelpUiShell>
  );
}

export function QuotationHelpNewQuotationLink({ children }: { children?: ReactNode }) {
  return (
    <HelpUiShell>
      <span className={`${qUi.btnPrimary} !px-3 !py-2 !text-fluid-xs`}>{children ?? '+ 새 견적서'}</span>
    </HelpUiShell>
  );
}

export function QuotationHelpInquiryCreateButton(props: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>) {
  return (
    <HelpUiShell>
      <button
        type="button"
        className={`${qUi.btnPrimary} !px-3 !py-1.5 !text-xs`}
        {...previewProps()}
        {...props}
      >
        + 견적서 만들기
      </button>
    </HelpUiShell>
  );
}

export function QuotationHelpAddLineButton(props: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>) {
  return (
    <HelpUiShell>
      <button
        type="button"
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 bg-white text-lg font-light leading-none text-slate-600 shadow-sm"
        {...previewProps()}
        {...props}
        aria-label="품목 행 추가"
      >
        +
      </button>
    </HelpUiShell>
  );
}

export function QuotationHelpDocumentTypeSelect({ value }: { value: 'QUOTATION' | 'RECEIPT' }) {
  const label = value === 'RECEIPT' ? '영수증' : '견적서';
  return (
    <HelpUiShell>
      <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-1.5 text-[12px] text-slate-600 shadow-sm">
        <span className="font-medium whitespace-nowrap">문서 유형</span>
        <select
          className="min-w-[100px] rounded-md border border-slate-200 bg-white px-2 py-1 text-[13px] text-slate-800"
          value={value}
          disabled
          aria-hidden
          tabIndex={-1}
        >
          <option>{label}</option>
        </select>
      </label>
    </HelpUiShell>
  );
}

export function QuotationHelpBrandSelect() {
  return (
    <HelpUiShell>
      <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-1.5 text-[12px] text-slate-600 shadow-sm">
        <span className="font-medium whitespace-nowrap">영업 브랜드</span>
        <select
          className="min-w-[140px] rounded-md border border-slate-200 bg-white px-2 py-1 text-[13px] text-slate-800"
          disabled
          aria-hidden
          tabIndex={-1}
        >
          <option>청소비서</option>
        </select>
      </label>
    </HelpUiShell>
  );
}

export function QuotationHelpFieldLabel({ children }: { children: ReactNode }) {
  return (
    <HelpUiShell>
      <span className={qUi.label}>{children}</span>
    </HelpUiShell>
  );
}

export function QuotationHelpInquiryLinkBanner() {
  return (
    <HelpUiShell block>
      <span className={`${qUi.alertInfo} !inline-block !py-2 !text-fluid-2xs`}>
        접수 연동: <span className="font-semibold">CB2608010001 · 이○○</span>
      </span>
    </HelpUiShell>
  );
}

export function QuotationHelpPdfPreviewButton(props: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>) {
  return (
    <HelpUiShell>
      <button
        type="button"
        className={`${qUi.btnSecondary} !px-3 !py-1.5 !text-fluid-xs`}
        {...previewProps()}
        {...props}
      >
        PDF 미리보기
      </button>
    </HelpUiShell>
  );
}

export function QuotationHelpPdfDownloadButton(props: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>) {
  return (
    <HelpUiShell>
      <button
        type="button"
        className={`${qUi.btnSecondary} !px-3 !py-1.5 !text-fluid-xs`}
        {...previewProps()}
        {...props}
      >
        PDF 다운로드
      </button>
    </HelpUiShell>
  );
}

export function QuotationHelpEmailSendButton(props: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>) {
  return (
    <HelpUiShell>
      <button type="button" className={`${qUi.btnSuccess} !px-3 !py-2 !text-fluid-xs`} {...previewProps()} {...props}>
        PDF 첨부 발송
      </button>
    </HelpUiShell>
  );
}

export function QuotationHelpEmailResendButton(props: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>) {
  return (
    <HelpUiShell>
      <button
        type="button"
        className={`${qUi.btnSecondary} !px-3 !py-1.5 !text-fluid-xs`}
        {...previewProps()}
        {...props}
      >
        재발송
      </button>
    </HelpUiShell>
  );
}

export function QuotationHelpStatusBadge({ status }: { status: 'DRAFT' | 'FINALIZED' | 'SENT' }) {
  return (
    <HelpUiShell>
      <QuotationStatusBadge status={status} />
    </HelpUiShell>
  );
}

export function QuotationHelpCustomerFieldMock({ label }: { label: string }) {
  return (
    <HelpUiShell block>
      <div className="w-full max-w-[12rem]">
        <span className="block text-[11px] font-medium text-slate-600 mb-0.5">{label}</span>
        <span className="block border-b border-dashed border-slate-300 text-[12px] text-slate-400 py-0.5">
          입력…
        </span>
      </div>
    </HelpUiShell>
  );
}
