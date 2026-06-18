import type {
  QuotationEditorOperatingCompanyDto,
  QuotationServiceItemDto,
} from '../../api/quotations';
import type { TenantCompanyRegistration } from '../../api/tenantCompanyProfile';
import { resolveQuotationSealDisplayWidth } from '@shared/quotationSeal';
import type { QuotationVatMode } from '@shared/quotationVat';
import { computeLineAmounts, vatModeLabel } from '@shared/quotationVat';
import { formatQuotationDocumentTitle } from '@shared/quotationDocument';
import {
  catalogSelectValue,
  emptyQuotationLine,
  lineAmountFromEditable,
  linesForTemplateDisplay,
  QUOTATION_TEMPLATE_MIN_ROWS,
  type EditableQuotationLine,
} from './quotationLineUtils';
import { A4ScaledSheet } from './A4ScaledSheet';

/** A4 (210×297mm) — PDFKit margin 48pt와 동일한 화면 여백 */
const A4_WIDTH = '210mm';
const A4_MIN_HEIGHT = '297mm';
const DOC_MARGIN = '48px';

const docInput =
  'w-full min-w-0 bg-transparent border-0 border-b border-dashed border-slate-300/90 px-0 py-0.5 text-[13px] leading-snug text-slate-900 placeholder:text-slate-400 focus:border-slate-700 focus:outline-none focus:ring-0';

const docCellInput =
  'w-full min-w-0 bg-white/90 border border-slate-200/80 rounded-sm px-1.5 py-1 text-[12px] text-slate-900 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-200';

/** 품목표 서식 격자 */
const gridCell = 'border border-slate-300';
const gridHeadCell = 'border border-slate-500/60';

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

function formatValidUntil(ymd: string): string {
  if (!ymd.trim()) return '';
  const d = new Date(ymd + 'T12:00:00');
  if (Number.isNaN(d.getTime())) return ymd;
  return d.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' });
}

function RepresentativeWithSeal({
  repName,
  sealUrl,
  sealWidth,
  className = 'text-[12px] text-slate-800',
}: {
  repName: string;
  sealUrl: string | null;
  sealWidth: number;
  className?: string;
}) {
  return (
    <p className={`leading-snug ${className}`}>
      <span className="whitespace-nowrap">
        대표 {repName}
        {sealUrl ? (
          <img
            src={sealUrl}
            alt=""
            width={sealWidth}
            className="inline-block align-middle ml-0.5 object-contain"
            style={{ width: sealWidth, height: 'auto', maxHeight: sealWidth, verticalAlign: 'middle' }}
          />
        ) : null}
      </span>
    </p>
  );
}

function companyLines(c: TenantCompanyRegistration | null): string[] {
  if (!c) return ['—'];
  return [
    c.companyName?.trim() || '—',
    c.businessRegistrationNo?.trim() ? `사업자 ${c.businessRegistrationNo.trim()}` : null,
    c.addressLine?.trim() ?? null,
    c.phone?.trim() ? `Tel ${c.phone.trim()}` : null,
    c.contactEmail?.trim() ?? null,
  ].filter(Boolean) as string[];
}

function resolveSelectedBrand(
  companies: QuotationEditorOperatingCompanyDto[],
  operatingCompanyId: string,
): QuotationEditorOperatingCompanyDto | null {
  return companies.find((c) => c.id === operatingCompanyId) ?? null;
}

function resolveQuotationTitle(
  companies: QuotationEditorOperatingCompanyDto[],
  operatingCompanyId: string,
  company: TenantCompanyRegistration | null,
): string {
  const brand = resolveSelectedBrand(companies, operatingCompanyId);
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

const docCellSelect = `${docCellInput} bg-white cursor-pointer appearance-auto`;

export function QuotationDocumentEditor({
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
  function addRow() {
    onLinesChange([...lines, emptyQuotationLine()]);
  }

  function updateLineAt(index: number, patch: Partial<EditableQuotationLine>) {
    if (index < lines.length) {
      onLinesChange(lines.map((row, i) => (i === index ? { ...row, ...patch } : row)));
      return;
    }
    const next = [...lines];
    while (next.length <= index) next.push(emptyQuotationLine());
    next[index] = { ...next[index], ...patch };
    onLinesChange(next);
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
    });
  }

  function renderItemCell(li: EditableQuotationLine, idx: number) {
    if (isCustomLineCell(li, catalog)) {
      return (
        <input
          className={docCellInput}
          placeholder="품목명 입력"
          value={li.label}
          onChange={(e) =>
            updateLineAt(idx, {
              catalogItemId: null,
              label: e.target.value,
            })
          }
          onBlur={(e) => {
            if (!e.target.value.trim()) {
              updateLineAt(idx, { catalogItemId: null, label: '', unitPrice: '' });
            }
          }}
        />
      );
    }

    return (
      <select
        className={docCellSelect}
        value={catalogSelectValue(li)}
        onChange={(e) => handleCatalogSelectAt(idx, e.target.value)}
      >
        <option value="">품목 선택…</option>
        {catalog.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
        <option value="__custom__">직접 입력</option>
      </select>
    );
  }

  function removeLineAt(index: number) {
    if (lines.length <= QUOTATION_TEMPLATE_MIN_ROWS) return;
    onLinesChange(lines.filter((_, i) => i !== index));
  }

  const templateLines = linesForTemplateDisplay(lines);

  const supplierLines = companyLines(company);
  const sealWidth = resolveQuotationSealDisplayWidth(company?.sealDisplayWidthPx);
  const sealUrl = company?.sealSecureUrl?.trim() || null;
  const repName = company?.representativeName?.trim() || null;
  const documentTitle = resolveQuotationTitle(operatingCompanies, operatingCompanyId, company);
  const showBrandSelector = operatingCompanies.length > 1;

  return (
    <div className="min-w-0 space-y-3">
      <p className="text-center text-fluid-2xs text-slate-500 px-2">
        A4 공문 양식(210×297mm)에 직접 입력합니다. 좁은 화면에서는 전체가 비율에 맞게 축소되어
        표시됩니다.
      </p>
      {catalog.length === 0 && (
        <p className="text-center text-fluid-2xs text-amber-800 px-2">
          견적 설정에 서비스 항목을 등록하면 품목명이 자동으로 맞춰집니다.
        </p>
      )}

      {/* A4 용지 — 모바일에서 전체 축소, PC에서는 실제 크기 */}
      <div className="bg-slate-100/90 rounded-xl py-3 px-2 sm:py-4 sm:px-4">
        <A4ScaledSheet
          sheetClassName="shrink-0 bg-white text-slate-900 shadow-lg shadow-slate-400/20 border border-slate-300 flex flex-col box-border"
          sheetStyle={{
            width: A4_WIDTH,
            minHeight: A4_MIN_HEIGHT,
            paddingTop: DOC_MARGIN,
            paddingBottom: DOC_MARGIN,
            paddingLeft: DOC_MARGIN,
            paddingRight: DOC_MARGIN,
          }}
          aria-label="견적서 A4 양식"
        >
            {/* ── 상단(머리말) 고정 구역 ── */}
            <header className="shrink-0 text-center border-b border-slate-200 pb-5 mb-5">
              {showBrandSelector && (
                <div className="mb-3 flex justify-center">
                  <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-1.5 text-[11px] text-slate-600 shadow-sm">
                    <span className="font-medium whitespace-nowrap">영업 브랜드</span>
                    <select
                      className="min-w-[140px] max-w-[220px] rounded-md border border-slate-200 bg-white px-2 py-1 text-[12px] text-slate-800 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-200"
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
                </div>
              )}
              <h2 className="text-[20px] font-bold tracking-wide text-slate-900">
                {documentTitle}
              </h2>
              {quoteNumber && (
                <p className="mt-2 text-[11px] text-slate-500 font-mono tabular-nums tracking-wide">
                  No. {quoteNumber}
                </p>
              )}
            </header>

            {/* ── 본문(가변) ── */}
            <div className="flex-1 flex flex-col min-h-0 text-[13px] leading-relaxed">
              {/* 공급자 / 공급받는자 */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="border border-slate-300 bg-[#f9fafb] p-3 min-h-[100px]">
                  <p className="text-[10px] font-bold text-slate-500 mb-2 tracking-wide">공급자</p>
                  <div className="space-y-0.5 text-[12px] text-slate-800">
                    {supplierLines[0] && supplierLines[0] !== '—' ? (
                      <p>{supplierLines[0]}</p>
                    ) : supplierLines[0] === '—' ? (
                      <p>—</p>
                    ) : null}
                    {repName ? (
                      <RepresentativeWithSeal
                        repName={repName}
                        sealUrl={sealUrl}
                        sealWidth={sealWidth}
                      />
                    ) : null}
                    {supplierLines.slice(1).map((line) => (
                      <p key={line}>{line}</p>
                    ))}
                  </div>
                </div>

                <div className="border border-slate-300 bg-[#f9fafb] p-3 min-h-[100px]">
                  <p className="text-[10px] font-bold text-slate-500 mb-2 tracking-wide">
                    공급받는자
                  </p>
                  <div className="space-y-1.5">
                    <label className="block">
                      <span className="sr-only">이름</span>
                      <input
                        className={docInput}
                        placeholder="이름 *"
                        value={customerName}
                        onChange={(e) => onCustomerNameChange(e.target.value)}
                      />
                    </label>
                    <label className="block">
                      <span className="sr-only">연락처</span>
                      <input
                        className={docInput}
                        placeholder="Tel"
                        value={customerPhone}
                        onChange={(e) => onCustomerPhoneChange(e.target.value)}
                      />
                    </label>
                    <label className="block">
                      <span className="sr-only">이메일</span>
                      <input
                        type="email"
                        className={docInput}
                        placeholder="이메일"
                        value={customerEmail}
                        onChange={(e) => onCustomerEmailChange(e.target.value)}
                      />
                    </label>
                    <label className="block">
                      <span className="sr-only">주소</span>
                      <input
                        className={docInput}
                        placeholder="주소"
                        value={customerAddress}
                        onChange={(e) => onCustomerAddressChange(e.target.value)}
                      />
                    </label>
                  </div>
                </div>
              </div>

              {/* 작성일 · 유효기간 */}
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[12px] text-slate-600 mb-4">
                <p>
                  작성일:{' '}
                  <span className="text-slate-800 tabular-nums">{formatDocDate(createdAt)}</span>
                </p>
                <label className="inline-flex flex-wrap items-center gap-1.5">
                  <span>유효기간:</span>
                  <input
                    type="date"
                    className="rounded-sm border border-slate-200 bg-white px-1.5 py-0.5 text-[12px] text-slate-800 focus:border-slate-500 focus:outline-none"
                    value={validUntil}
                    onChange={(e) => onValidUntilChange(e.target.value)}
                  />
                  {validUntil.trim() && (
                    <span className="text-slate-500">({formatValidUntil(validUntil)} 까지)</span>
                  )}
                </label>
              </div>

              {/* 품목 표 — 고정 행 서식 */}
              <div className="overflow-x-auto -mx-0.5 mb-4 rounded-md overflow-hidden border-2 border-slate-400 shadow-sm">
                <table className="w-full border-collapse text-[12px]">
                  <thead>
                    <tr className="bg-gradient-to-r from-slate-800 to-slate-700 text-white">
                      <th
                        className={`w-9 ${gridHeadCell} px-1 py-2 text-center text-[10px] font-bold tracking-wide`}
                      >
                        No
                      </th>
                      <th
                        className={`${gridHeadCell} px-2 py-2 text-left text-[10px] font-bold tracking-wide`}
                      >
                        품목
                      </th>
                      <th
                        className={`w-12 ${gridHeadCell} px-1 py-2 text-center text-[10px] font-bold tracking-wide`}
                      >
                        수량
                      </th>
                      <th
                        className={`w-[68px] ${gridHeadCell} px-1 py-2 text-center text-[10px] font-bold tracking-wide`}
                      >
                        단가
                      </th>
                      <th
                        className={`w-[68px] ${gridHeadCell} px-1 py-2 text-center text-[10px] font-bold tracking-wide`}
                      >
                        부가세
                      </th>
                      <th
                        className={`w-[76px] ${gridHeadCell} px-1 py-2 text-center text-[10px] font-bold tracking-wide`}
                      >
                        금액
                      </th>
                      <th className={`w-7 ${gridHeadCell} px-0.5 py-2`} aria-label="삭제" />
                    </tr>
                  </thead>
                  <tbody>
                    {templateLines.map((li, idx) => {
                      const supply = lineAmountFromEditable(li);
                      const lineCalc =
                        supply != null
                          ? computeLineAmounts(supply, vatMode)
                          : { supply: 0, vatAmount: 0, grandAmount: 0 };
                      const isBlankRow = supply == null && !li.label.trim();
                      const canDelete = lines.length > QUOTATION_TEMPLATE_MIN_ROWS && idx < lines.length;

                      return (
                        <tr
                          key={li.key}
                          className={`${
                            idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/90'
                          } ${isBlankRow ? 'bg-slate-50/40' : ''} hover:bg-sky-50/30 transition-colors`}
                        >
                          <td
                            className={`${gridCell} px-1 py-1.5 text-center text-[11px] font-medium text-slate-500 tabular-nums align-middle`}
                          >
                            {idx + 1}
                          </td>
                          <td className={`${gridCell} px-1 py-1 align-middle`}>
                            {renderItemCell(li, idx)}
                          </td>
                          <td className={`${gridCell} px-1 py-1 align-middle`}>
                            <input
                              className={`${docCellInput} text-center tabular-nums bg-white`}
                              inputMode="numeric"
                              placeholder="—"
                              value={li.quantity}
                              onChange={(e) =>
                                updateLineAt(idx, { quantity: e.target.value })
                              }
                            />
                          </td>
                          <td className={`${gridCell} px-1 py-1 align-middle`}>
                            <input
                              className={`${docCellInput} text-right tabular-nums bg-white`}
                              inputMode="numeric"
                              placeholder="—"
                              value={li.unitPrice}
                              onChange={(e) =>
                                updateLineAt(idx, { unitPrice: e.target.value })
                              }
                            />
                          </td>
                          <td
                            className={`${gridCell} px-1.5 py-1.5 text-right text-[11px] tabular-nums align-middle text-indigo-700/90 font-medium`}
                          >
                            {supply != null
                              ? `${lineCalc.vatAmount.toLocaleString('ko-KR')}원`
                              : '—'}
                          </td>
                          <td
                            className={`${gridCell} px-1.5 py-1.5 text-right text-[11px] tabular-nums align-middle font-semibold text-slate-900`}
                          >
                            {supply != null
                              ? `${lineCalc.grandAmount.toLocaleString('ko-KR')}원`
                              : '—'}
                          </td>
                          <td className={`${gridCell} px-0.5 py-1 text-center align-middle`}>
                            {canDelete ? (
                              <button
                                type="button"
                                onClick={() => removeLineAt(idx)}
                                className="text-[10px] text-rose-600 hover:text-rose-800 leading-none"
                                aria-label="행 삭제"
                              >
                                ✕
                              </button>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="border-t-2 border-slate-400 bg-gradient-to-b from-slate-50 to-slate-100/80 px-2 py-2 flex justify-center">
                  <button
                    type="button"
                    onClick={addRow}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 bg-white text-lg font-light leading-none text-slate-600 shadow-sm transition-colors hover:border-sky-400 hover:bg-sky-50 hover:text-sky-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60"
                    aria-label="품목 행 추가"
                    title="품목 행 추가"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* 비고 */}
              <div className="mb-2">
                <p className="text-[12px] font-bold text-slate-700 underline underline-offset-2 mb-1">
                  비고
                </p>
                <textarea
                  className="w-full min-h-[3.5rem] resize-y bg-transparent border border-dashed border-slate-300 rounded-sm px-2 py-1 text-[12px] text-slate-800 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none"
                  rows={2}
                  placeholder="견적서 본문에 표시할 내용"
                  value={memo}
                  onChange={(e) => onMemoChange(e.target.value)}
                />
              </div>

              {/* ── 하단 합계·과세 (공문 하단 고정) ── */}
              <footer className="shrink-0 mt-auto pt-4 border-t border-slate-200">
                <div className="mb-3 space-y-1 text-[11px] text-slate-600 tabular-nums text-right">
                  <div className="flex justify-end gap-8">
                    <span>소계</span>
                    <span className="w-24">{subtotal.toLocaleString('ko-KR')}원</span>
                  </div>
                  <label className="flex justify-end items-center gap-8">
                    <span>할인</span>
                    <input
                      className="w-24 rounded-sm border border-slate-200 bg-white px-1.5 py-0.5 text-right text-[11px] tabular-nums focus:border-slate-500 focus:outline-none"
                      inputMode="numeric"
                      placeholder="0"
                      value={discountAmount}
                      onChange={(e) => onDiscountAmountChange(e.target.value)}
                    />
                  </label>
                  {discountNum > 0 && (
                    <div className="flex justify-end gap-8 text-slate-500">
                      <span />
                      <span className="w-24">-{discountNum.toLocaleString('ko-KR')}원</span>
                    </div>
                  )}
                </div>

                <fieldset className="mb-3">
                  <legend className="text-[11px] font-semibold text-slate-600 mb-1.5">과세 구분</legend>
                  <div className="flex flex-wrap gap-4 text-[12px] text-slate-800">
                    <label className="inline-flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="quotation-vat-mode"
                        checked={vatMode === 'TAX_FREE'}
                        onChange={() => onVatModeChange('TAX_FREE')}
                        className="border-slate-300 text-slate-900"
                      />
                      면세
                    </label>
                    <label className="inline-flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="quotation-vat-mode"
                        checked={vatMode === 'VAT_SEPARATE'}
                        onChange={() => onVatModeChange('VAT_SEPARATE')}
                        className="border-slate-300 text-slate-900"
                      />
                      부가세 별도 (10%)
                    </label>
                  </div>
                </fieldset>

                <div className="grid grid-cols-3 border border-slate-300 text-center text-[12px] mb-2">
                  <div className="border-r border-slate-300 bg-[#f3f4f6] py-2">
                    <p className="text-[10px] font-bold text-slate-500 mb-1">공급가액</p>
                    <p className="font-semibold tabular-nums text-slate-900">
                      {supplyTotal.toLocaleString('ko-KR')}원
                    </p>
                  </div>
                  <div className="border-r border-slate-300 bg-[#f3f4f6] py-2">
                    <p className="text-[10px] font-bold text-slate-500 mb-1">부가세</p>
                    <p className="font-semibold tabular-nums text-slate-900">
                      {vatAmount.toLocaleString('ko-KR')}원
                    </p>
                  </div>
                  <div className="bg-[#e5e7eb] py-2">
                    <p className="text-[10px] font-bold text-slate-600 mb-1">합계금액</p>
                    <p className="text-[14px] font-bold tabular-nums text-slate-900">
                      {grandTotal.toLocaleString('ko-KR')}원
                    </p>
                  </div>
                </div>
                <p className="text-right text-[10px] text-slate-500 mb-4">({vatModeLabel(vatMode)})</p>

                <p className="text-center text-[13px] text-slate-800 font-medium tracking-wide">
                  위와 같이 견적합니다.
                </p>
                {footerNotice?.trim() && (
                  <p className="mt-3 text-[11px] text-slate-500 leading-relaxed whitespace-pre-wrap text-center">
                    {footerNotice.trim()}
                  </p>
                )}
              </footer>
            </div>
        </A4ScaledSheet>
      </div>
    </div>
  );
}
