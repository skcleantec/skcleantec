import type { QuotationServiceItemDto } from '../../api/quotations';
import type { TenantCompanyRegistration } from '../../api/tenantCompanyProfile';
import {
  emptyQuotationLine,
  lineAmountFromEditable,
  type EditableQuotationLine,
} from './quotationLineUtils';

const docInput =
  'w-full min-w-0 bg-transparent border-0 border-b border-dashed border-slate-300/90 px-0 py-0.5 text-fluid-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-700 focus:outline-none focus:ring-0';

const docCellInput =
  'w-full min-w-0 bg-white/80 border border-slate-200/80 rounded px-1.5 py-1 text-fluid-xs sm:text-fluid-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-200';

type Props = {
  documentTitle: string;
  quoteNumber: string | null;
  createdAt: string | null;
  company: TenantCompanyRegistration | null;
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
  total: number;
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

function companyLines(c: TenantCompanyRegistration | null): string[] {
  if (!c) return ['—'];
  return [
    c.companyName?.trim() || '—',
    c.representativeName?.trim() ? `대표 ${c.representativeName.trim()}` : null,
    c.businessRegistrationNo?.trim() ? `사업자 ${c.businessRegistrationNo.trim()}` : null,
    c.addressLine?.trim() ?? null,
    c.phone?.trim() ? `Tel ${c.phone.trim()}` : null,
    c.contactEmail?.trim() ?? null,
  ].filter(Boolean) as string[];
}

export function QuotationDocumentEditor({
  documentTitle,
  quoteNumber,
  createdAt,
  company,
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
  total,
  memo,
  onMemoChange,
  footerNotice,
}: Props) {
  function addFromCatalog(itemId: string) {
    const item = catalog.find((c) => c.id === itemId);
    if (!item) return;
    onLinesChange([...lines, emptyQuotationLine(item)]);
  }

  function updateLine(key: string, patch: Partial<EditableQuotationLine>) {
    onLinesChange(lines.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function removeLine(key: string) {
    if (lines.length <= 1) return;
    onLinesChange(lines.filter((row) => row.key !== key));
  }

  const supplierLines = companyLines(company);
  const discountNum = parseInt(discountAmount.replace(/,/g, ''), 10) || 0;

  return (
    <div className="min-w-0 -mx-4 px-2 py-2 sm:mx-0 sm:px-0 sm:py-4 bg-slate-100/80 rounded-2xl">
      <p className="text-center text-fluid-2xs text-slate-500 mb-2 sm:mb-3 px-2">
        아래 견적서 양식에 직접 입력하세요. 저장 시 PDF와 동일한 서식으로 출력됩니다.
      </p>

      <article
        className="mx-auto w-full max-w-[794px] bg-white shadow-md shadow-slate-300/25 border border-slate-200 text-slate-900"
        aria-label="견적서 작성 양식"
      >
        <div className="px-4 py-6 sm:px-10 sm:py-10 min-w-0">
          {/* 제목 */}
          <header className="text-center mb-6 sm:mb-8">
            <h2 className="text-xl sm:text-2xl font-bold tracking-wide text-slate-900">
              {documentTitle.trim() || '견적서'}
            </h2>
            {quoteNumber && (
              <p className="mt-1 text-fluid-xs text-slate-500 font-mono tabular-nums">
                No. {quoteNumber}
              </p>
            )}
          </header>

          {/* 공급자 / 공급받는자 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-5 sm:mb-6">
            <div className="border border-slate-300 bg-slate-50/90 p-3 sm:p-3.5 min-h-[120px]">
              <p className="text-[10px] sm:text-fluid-2xs font-semibold text-slate-500 mb-2">
                공급자
              </p>
              <div className="space-y-0.5 text-fluid-xs sm:text-fluid-sm text-slate-800 leading-relaxed">
                {supplierLines.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
            </div>

            <div className="border border-slate-300 bg-slate-50/90 p-3 sm:p-3.5 min-h-[120px]">
              <p className="text-[10px] sm:text-fluid-2xs font-semibold text-slate-500 mb-2">
                공급받는자
              </p>
              <div className="space-y-2 text-fluid-xs sm:text-fluid-sm">
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
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-6 text-fluid-xs sm:text-fluid-sm text-slate-600 mb-4">
            <p>
              작성일:{' '}
              <span className="text-slate-800 tabular-nums">{formatDocDate(createdAt)}</span>
            </p>
            <label className="flex flex-wrap items-center gap-2">
              <span className="shrink-0">유효기간:</span>
              <input
                type="date"
                className="rounded border border-slate-200 bg-white px-2 py-1 text-fluid-xs text-slate-800 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-200"
                value={validUntil}
                onChange={(e) => onValidUntilChange(e.target.value)}
              />
              {validUntil.trim() && (
                <span className="text-slate-500">({formatValidUntil(validUntil)} 까지)</span>
              )}
            </label>
          </div>

          {/* 항목 추가 도구 */}
          <div className="flex flex-wrap items-center gap-2 mb-3 -mt-1">
            {catalog.length > 0 && (
              <select
                className="max-w-[200px] rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-fluid-2xs sm:text-fluid-xs text-slate-700"
                defaultValue=""
                onChange={(e) => {
                  if (e.target.value) {
                    addFromCatalog(e.target.value);
                    e.target.value = '';
                  }
                }}
              >
                <option value="">+ 카탈로그 항목</option>
                {catalog.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
            <button
              type="button"
              onClick={() => onLinesChange([...lines, emptyQuotationLine()])}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-fluid-2xs sm:text-fluid-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              + 빈 행
            </button>
          </div>

          {/* 품목 표 — PC */}
          <div className="hidden sm:block overflow-x-auto -mx-1">
            <table className="w-full min-w-[480px] border-collapse text-fluid-sm">
              <thead>
                <tr className="bg-slate-200/80 border border-slate-300">
                  <th className="w-10 border border-slate-300 px-1 py-1.5 text-center text-fluid-2xs font-semibold text-slate-700">
                    No
                  </th>
                  <th className="border border-slate-300 px-2 py-1.5 text-left text-fluid-2xs font-semibold text-slate-700">
                    품목
                  </th>
                  <th className="w-16 border border-slate-300 px-1 py-1.5 text-center text-fluid-2xs font-semibold text-slate-700">
                    수량
                  </th>
                  <th className="w-24 border border-slate-300 px-1 py-1.5 text-center text-fluid-2xs font-semibold text-slate-700">
                    단가
                  </th>
                  <th className="w-24 border border-slate-300 px-1 py-1.5 text-center text-fluid-2xs font-semibold text-slate-700">
                    금액
                  </th>
                  <th className="w-12 border border-slate-300 px-0.5 py-1.5" aria-label="삭제" />
                </tr>
              </thead>
              <tbody>
                {lines.map((li, idx) => {
                  const amount = lineAmountFromEditable(li);
                  return (
                    <tr key={li.key} className="border border-slate-300">
                      <td className="border border-slate-300 px-1 py-1 text-center text-fluid-xs text-slate-500 tabular-nums">
                        {idx + 1}
                      </td>
                      <td className="border border-slate-300 px-1 py-0.5">
                        <input
                          className={docCellInput}
                          placeholder="품목명"
                          value={li.label}
                          onChange={(e) => updateLine(li.key, { label: e.target.value })}
                        />
                      </td>
                      <td className="border border-slate-300 px-1 py-0.5">
                        <input
                          className={`${docCellInput} text-center tabular-nums`}
                          inputMode="numeric"
                          placeholder="1"
                          value={li.quantity}
                          onChange={(e) => updateLine(li.key, { quantity: e.target.value })}
                        />
                      </td>
                      <td className="border border-slate-300 px-1 py-0.5">
                        <input
                          className={`${docCellInput} text-right tabular-nums`}
                          inputMode="numeric"
                          placeholder="0"
                          value={li.unitPrice}
                          onChange={(e) => updateLine(li.key, { unitPrice: e.target.value })}
                        />
                      </td>
                      <td className="border border-slate-300 px-2 py-1 text-right text-fluid-xs tabular-nums text-slate-800">
                        {amount != null ? `${amount.toLocaleString('ko-KR')}원` : '—'}
                      </td>
                      <td className="border border-slate-300 px-0.5 py-0.5 text-center">
                        <button
                          type="button"
                          disabled={lines.length <= 1}
                          onClick={() => removeLine(li.key)}
                          className="text-fluid-2xs text-rose-600 hover:text-rose-800 disabled:opacity-30 px-1"
                          aria-label="행 삭제"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* 품목 — 모바일 카드형 (문서 안) */}
          <ul className="sm:hidden space-y-2 mb-1">
            {lines.map((li, idx) => {
              const amount = lineAmountFromEditable(li);
              return (
                <li
                  key={li.key}
                  className="border border-slate-300 bg-white p-2.5 space-y-2"
                >
                  <div className="flex items-start gap-2">
                    <span className="shrink-0 w-6 h-6 flex items-center justify-center bg-slate-100 text-fluid-2xs font-semibold text-slate-600">
                      {idx + 1}
                    </span>
                    <input
                      className={`${docCellInput} flex-1`}
                      placeholder="품목명"
                      value={li.label}
                      onChange={(e) => updateLine(li.key, { label: e.target.value })}
                    />
                    <button
                      type="button"
                      disabled={lines.length <= 1}
                      onClick={() => removeLine(li.key)}
                      className="shrink-0 text-fluid-2xs text-rose-600 px-1 disabled:opacity-30"
                      aria-label="행 삭제"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pl-8">
                    <label className="block">
                      <span className="text-[10px] text-slate-500">수량</span>
                      <input
                        className={`${docCellInput} text-center tabular-nums mt-0.5`}
                        inputMode="numeric"
                        value={li.quantity}
                        onChange={(e) => updateLine(li.key, { quantity: e.target.value })}
                      />
                    </label>
                    <label className="block">
                      <span className="text-[10px] text-slate-500">단가</span>
                      <input
                        className={`${docCellInput} text-right tabular-nums mt-0.5`}
                        inputMode="numeric"
                        value={li.unitPrice}
                        onChange={(e) => updateLine(li.key, { unitPrice: e.target.value })}
                      />
                    </label>
                  </div>
                  {amount != null && (
                    <p className="pl-8 text-fluid-xs text-slate-600 tabular-nums">
                      금액{' '}
                      <span className="font-semibold text-slate-900">
                        {amount.toLocaleString('ko-KR')}원
                      </span>
                    </p>
                  )}
                </li>
              );
            })}
          </ul>

          {/* 합계 */}
          <div className="mt-4 sm:mt-5 flex justify-end">
            <div className="w-full sm:w-56 space-y-1 text-fluid-sm">
              <div className="flex justify-between text-slate-600 tabular-nums">
                <span>소계</span>
                <span>{subtotal.toLocaleString('ko-KR')}원</span>
              </div>
              <label className="flex justify-between items-center gap-2 text-slate-600">
                <span className="shrink-0">할인</span>
                <input
                  className="w-24 rounded border border-slate-200 bg-white px-2 py-0.5 text-right text-fluid-xs tabular-nums focus:border-slate-500 focus:outline-none"
                  inputMode="numeric"
                  placeholder="0"
                  value={discountAmount}
                  onChange={(e) => onDiscountAmountChange(e.target.value)}
                />
              </label>
              {discountNum > 0 && (
                <div className="flex justify-between text-slate-600 tabular-nums text-fluid-xs">
                  <span />
                  <span>-{discountNum.toLocaleString('ko-KR')}원</span>
                </div>
              )}
              <div className="flex justify-between items-baseline pt-2 border-t border-slate-300 font-bold text-slate-900 tabular-nums">
                <span className="text-fluid-sm">합계</span>
                <span className="text-base sm:text-lg">{total.toLocaleString('ko-KR')}원</span>
              </div>
              <p className="text-right text-[10px] sm:text-fluid-2xs text-slate-500">(부가세 별도)</p>
            </div>
          </div>

          {/* 비고 */}
          <div className="mt-5 sm:mt-6">
            <p className="text-fluid-xs font-semibold text-slate-700 underline underline-offset-2 mb-1.5">
              비고
            </p>
            <textarea
              className="w-full min-h-[4rem] resize-y bg-transparent border border-dashed border-slate-300 rounded-sm px-2 py-1.5 text-fluid-xs sm:text-fluid-sm text-slate-800 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none"
              rows={3}
              placeholder="견적서 본문에 표시할 내용"
              value={memo}
              onChange={(e) => onMemoChange(e.target.value)}
            />
          </div>

          <p className="mt-6 sm:mt-8 text-center text-fluid-sm text-slate-800 font-medium">
            위와 같이 견적합니다.
          </p>

          {footerNotice?.trim() && (
            <p className="mt-4 text-fluid-2xs sm:text-fluid-xs text-slate-500 leading-relaxed whitespace-pre-wrap">
              {footerNotice.trim()}
            </p>
          )}
        </div>
      </article>
    </div>
  );
}
