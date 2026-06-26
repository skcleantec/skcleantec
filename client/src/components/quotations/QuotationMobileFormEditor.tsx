import type { ReactNode } from 'react';
import type {
  QuotationEditorOperatingCompanyDto,
  QuotationServiceItemDto,
} from '../../api/quotations';
import type { TenantCompanyRegistration } from '../../api/tenantCompanyProfile';
import type { QuotationVatMode } from '@shared/quotationVat';
import { computeLineAmounts, vatModeLabel } from '@shared/quotationVat';
import { formatQuotationDocumentTitle } from '@shared/quotationDocument';
import {
  catalogSelectValue,
  emptyQuotationLine,
  lineAmountFromEditable,
  type EditableQuotationLine,
} from './quotationLineUtils';
import { qUi } from './quotationUi';

type Props = {
  quoteNumber: string | null;
  createdAt: string | null;
  company: TenantCompanyRegistration | null;
  operatingCompanies: QuotationEditorOperatingCompanyDto[];
  operatingCompanyId: string;
  onOperatingCompanyChange: (id: string) => void;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  customerAddress: string;
  validUntil: string;
  onCustomerNameChange: (v: string) => void;
  onCustomerPhoneChange: (v: string) => void;
  onCustomerEmailChange: (v: string) => void;
  onCustomerAddressChange: (v: string) => void;
  onValidUntilChange: (v: string) => void;
  lines: EditableQuotationLine[];
  catalog: QuotationServiceItemDto[];
  onLinesChange: (lines: EditableQuotationLine[]) => void;
  discountAmount: string;
  onDiscountAmountChange: (v: string) => void;
  subtotal: number;
  discountNum: number;
  supplyTotal: number;
  vatMode: QuotationVatMode;
  onVatModeChange: (mode: QuotationVatMode) => void;
  vatAmount: number;
  grandTotal: number;
  memo: string;
  onMemoChange: (v: string) => void;
  footerNotice: string | null;
};

function formatDocDate(iso: string | null | undefined): string {
  const d = iso ? new Date(iso) : new Date();
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' });
}

function resolveQuotationTitle(
  companies: QuotationEditorOperatingCompanyDto[],
  operatingCompanyId: string,
  company: TenantCompanyRegistration | null,
): string {
  const brand = companies.find((c) => c.id === operatingCompanyId);
  if (brand) return formatQuotationDocumentTitle(brand.displayName || brand.name);
  return formatQuotationDocumentTitle(company?.companyName ?? '');
}

function isCustomLineCell(
  li: EditableQuotationLine,
  catalog: QuotationServiceItemDto[],
): boolean {
  if (catalog.length === 0) return true;
  if (li.catalogItemId) return false;
  return catalogSelectValue(li) === '__custom__';
}

function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section className={`${qUi.cardBody} space-y-3`}>
      <div>
        <h2 className={qUi.sectionTitle}>{title}</h2>
        {subtitle ? <p className={`${qUi.sectionSubtitle} mt-0.5`}>{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}

export function QuotationMobileFormEditor({
  quoteNumber,
  createdAt,
  company,
  operatingCompanies,
  operatingCompanyId,
  onOperatingCompanyChange,
  customerName,
  customerPhone,
  customerEmail,
  customerAddress,
  validUntil,
  onCustomerNameChange,
  onCustomerPhoneChange,
  onCustomerEmailChange,
  onCustomerAddressChange,
  onValidUntilChange,
  lines,
  catalog,
  onLinesChange,
  discountAmount,
  onDiscountAmountChange,
  subtotal,
  discountNum,
  supplyTotal,
  vatMode,
  onVatModeChange,
  vatAmount,
  grandTotal,
  memo,
  onMemoChange,
  footerNotice,
}: Props) {
  const documentTitle = resolveQuotationTitle(operatingCompanies, operatingCompanyId, company);
  const showBrandSelector = operatingCompanies.length > 1;

  function addRow() {
    onLinesChange([...lines, emptyQuotationLine()]);
  }

  function updateLineAt(index: number, patch: Partial<EditableQuotationLine>) {
    onLinesChange(lines.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function removeLineAt(index: number) {
    if (lines.length <= 1) return;
    onLinesChange(lines.filter((_, i) => i !== index));
  }

  function handleCatalogSelectAt(index: number, value: string) {
    if (value === '__custom__') {
      updateLineAt(index, { catalogItemId: null });
      return;
    }
    if (!value) {
      updateLineAt(index, { catalogItemId: null, label: '', unitPrice: '' });
      return;
    }
    const item = catalog.find((c) => c.id === value);
    if (!item) return;
    updateLineAt(index, {
      catalogItemId: item.id,
      label: item.name,
      unitPrice: String(item.unitPrice),
      quantity: lines[index]?.quantity?.trim() ? lines[index].quantity : '1',
    });
  }

  return (
    <div className="min-w-0 space-y-4 lg:hidden">
      <p className="text-fluid-xs text-slate-500 px-0.5">
        모바일 입력 화면입니다. PC(1024px 이상)에서는 A4 견적서 양식으로 편집할 수 있습니다.
      </p>

      <SectionCard title={documentTitle} subtitle={quoteNumber ? `No. ${quoteNumber}` : undefined}>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-fluid-xs text-slate-600">
          <span>
            작성일:{' '}
            <span className="font-medium text-slate-800 tabular-nums">{formatDocDate(createdAt)}</span>
          </span>
        </div>
        {showBrandSelector && (
          <label className="block">
            <span className={qUi.label}>영업 브랜드</span>
            <select
              className={qUi.select}
              value={operatingCompanyId}
              onChange={(e) => onOperatingCompanyChange(e.target.value)}
            >
              {operatingCompanies.map((oc) => (
                <option key={oc.id} value={oc.id}>
                  {oc.displayName || oc.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {company?.companyName?.trim() ? (
          <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5 text-fluid-xs text-slate-700 space-y-0.5">
            <p className="font-semibold text-slate-800">공급자</p>
            <p>{company.companyName.trim()}</p>
            {company.representativeName?.trim() ? (
              <p>대표 {company.representativeName.trim()}</p>
            ) : null}
            {company.phone?.trim() ? <p>Tel {company.phone.trim()}</p> : null}
          </div>
        ) : null}
      </SectionCard>

      <SectionCard title="고객 정보" subtitle="견적서에 표시될 공급받는자">
        <label className="block">
          <span className={qUi.label}>
            이름 <span className="text-rose-600">*</span>
          </span>
          <input
            className={qUi.input}
            placeholder="고객명"
            value={customerName}
            onChange={(e) => onCustomerNameChange(e.target.value)}
            autoComplete="name"
          />
        </label>
        <label className="block">
          <span className={qUi.label}>연락처</span>
          <input
            className={qUi.input}
            placeholder="010-0000-0000"
            value={customerPhone}
            onChange={(e) => onCustomerPhoneChange(e.target.value)}
            inputMode="tel"
            autoComplete="tel"
          />
        </label>
        <label className="block">
          <span className={qUi.label}>이메일</span>
          <input
            type="email"
            className={qUi.input}
            placeholder="email@example.com"
            value={customerEmail}
            onChange={(e) => onCustomerEmailChange(e.target.value)}
            autoComplete="email"
          />
        </label>
        <label className="block">
          <span className={qUi.label}>주소</span>
          <input
            className={qUi.input}
            placeholder="주소"
            value={customerAddress}
            onChange={(e) => onCustomerAddressChange(e.target.value)}
          />
        </label>
        <label className="block">
          <span className={qUi.label}>유효기간</span>
          <input
            type="date"
            className={qUi.input}
            value={validUntil}
            onChange={(e) => onValidUntilChange(e.target.value)}
          />
        </label>
      </SectionCard>

      <SectionCard title="견적 품목" subtitle="품목을 추가하고 수량·단가를 입력하세요">
        {catalog.length === 0 && (
          <p className="text-fluid-xs text-amber-800">
            견적 설정에 서비스 항목을 등록하면 빠르게 선택할 수 있습니다.
          </p>
        )}
        <ul className="space-y-3">
          {lines.map((li, idx) => {
            const supply = lineAmountFromEditable(li);
            const lineCalc =
              supply != null
                ? computeLineAmounts(supply, vatMode)
                : { supply: 0, vatAmount: 0, grandAmount: 0 };

            return (
              <li key={li.key} className={qUi.mobileCard}>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <span className="text-fluid-xs font-semibold text-slate-500 tabular-nums">
                    품목 {idx + 1}
                  </span>
                  {lines.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => removeLineAt(idx)}
                      className="text-fluid-xs font-medium text-rose-600 hover:text-rose-800 py-1 px-2 -mr-2 touch-manipulation"
                    >
                      삭제
                    </button>
                  ) : null}
                </div>

                {catalog.length > 0 && (
                  <label className="block mb-3">
                    <span className={qUi.label}>카탈로그</span>
                    <select
                      className={qUi.select}
                      value={catalogSelectValue(li)}
                      onChange={(e) => handleCatalogSelectAt(idx, e.target.value)}
                    >
                      <option value="">품목 선택…</option>
                      {catalog.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.unitPrice.toLocaleString('ko-KR')}원)
                        </option>
                      ))}
                      <option value="__custom__">직접 입력</option>
                    </select>
                  </label>
                )}

                {(catalog.length === 0 || isCustomLineCell(li, catalog)) && (
                  <label className="block mb-3">
                    <span className={qUi.label}>품목명</span>
                    <input
                      className={qUi.input}
                      placeholder="품목명"
                      value={li.label}
                      onChange={(e) =>
                        updateLineAt(idx, { catalogItemId: null, label: e.target.value })
                      }
                    />
                  </label>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className={qUi.label}>수량</span>
                    <input
                      className={`${qUi.input} text-center tabular-nums`}
                      inputMode="numeric"
                      placeholder="1"
                      value={li.quantity}
                      onChange={(e) => updateLineAt(idx, { quantity: e.target.value })}
                    />
                  </label>
                  <label className="block">
                    <span className={qUi.label}>단가(원)</span>
                    <input
                      className={`${qUi.input} text-right tabular-nums`}
                      inputMode="numeric"
                      placeholder="0"
                      value={li.unitPrice}
                      onChange={(e) => updateLineAt(idx, { unitPrice: e.target.value })}
                    />
                  </label>
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-fluid-sm">
                  <span className="text-slate-500">금액</span>
                  <span className="font-semibold tabular-nums text-slate-900">
                    {supply != null
                      ? `${lineCalc.grandAmount.toLocaleString('ko-KR')}원`
                      : '—'}
                  </span>
                </div>
                {vatMode === 'VAT_SEPARATE' && supply != null ? (
                  <p className="mt-1 text-fluid-2xs text-slate-500 text-right tabular-nums">
                    (부가세 {lineCalc.vatAmount.toLocaleString('ko-KR')}원 포함)
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
        <button
          type="button"
          onClick={addRow}
          className={`${qUi.btnSecondary} w-full touch-manipulation py-3`}
        >
          + 품목 추가
        </button>
      </SectionCard>

      <SectionCard title="비고">
        <textarea
          className={qUi.textarea}
          rows={3}
          placeholder="견적서 본문에 표시할 내용"
          value={memo}
          onChange={(e) => onMemoChange(e.target.value)}
        />
      </SectionCard>

      <SectionCard title="합계">
        <div className="space-y-2 text-fluid-sm tabular-nums">
          <div className="flex justify-between text-slate-600">
            <span>소계</span>
            <span>{subtotal.toLocaleString('ko-KR')}원</span>
          </div>
          <label className="flex justify-between items-center gap-3 text-slate-600">
            <span className="shrink-0">할인</span>
            <input
              className={`${qUi.input} max-w-[9rem] text-right`}
              inputMode="numeric"
              placeholder="0"
              value={discountAmount}
              onChange={(e) => onDiscountAmountChange(e.target.value)}
            />
          </label>
          {discountNum > 0 ? (
            <div className="flex justify-between text-slate-500">
              <span />
              <span>-{discountNum.toLocaleString('ko-KR')}원</span>
            </div>
          ) : null}
        </div>

        <fieldset className="pt-2">
          <legend className={qUi.label}>과세 구분</legend>
          <div className={`${qUi.segmentWrap} w-full flex`}>
            <button
              type="button"
              className={`${qUi.segmentBtn(vatMode === 'TAX_FREE', false)} flex-1 py-2.5 touch-manipulation`}
              onClick={() => onVatModeChange('TAX_FREE')}
            >
              면세
            </button>
            <button
              type="button"
              className={`${qUi.segmentBtn(vatMode === 'VAT_SEPARATE', true)} flex-1 py-2.5 touch-manipulation`}
              onClick={() => onVatModeChange('VAT_SEPARATE')}
            >
              부가세 별도
            </button>
          </div>
        </fieldset>

        <div className="grid grid-cols-3 gap-2 pt-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-2 py-3 text-center">
            <p className="text-fluid-2xs font-medium text-slate-500 mb-1">공급가액</p>
            <p className="text-fluid-sm font-semibold tabular-nums text-slate-900">
              {supplyTotal.toLocaleString('ko-KR')}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-2 py-3 text-center">
            <p className="text-fluid-2xs font-medium text-slate-500 mb-1">부가세</p>
            <p className="text-fluid-sm font-semibold tabular-nums text-slate-900">
              {vatAmount.toLocaleString('ko-KR')}
            </p>
          </div>
          <div className="rounded-xl border border-slate-300 bg-slate-100 px-2 py-3 text-center">
            <p className="text-fluid-2xs font-semibold text-slate-600 mb-1">합계</p>
            <p className="text-fluid-base font-bold tabular-nums text-slate-900">
              {grandTotal.toLocaleString('ko-KR')}
            </p>
          </div>
        </div>
        <p className="text-fluid-2xs text-slate-500 text-center">({vatModeLabel(vatMode)})</p>
        {footerNotice?.trim() ? (
          <p className="text-fluid-xs text-slate-500 whitespace-pre-wrap border-t border-slate-100 pt-3">
            {footerNotice.trim()}
          </p>
        ) : null}
      </SectionCard>
    </div>
  );
}
