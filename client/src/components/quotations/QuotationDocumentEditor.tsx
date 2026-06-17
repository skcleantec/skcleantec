import type { QuotationServiceItemDto } from '../../api/quotations';
import type { TenantCompanyRegistration } from '../../api/tenantCompanyProfile';
import {
  emptyQuotationLine,
  lineAmountFromEditable,
  type EditableQuotationLine,
} from './quotationLineUtils';

/** A4 (210×297mm) — PDFKit margin 48pt와 동일한 화면 여백 */
const A4_WIDTH = '210mm';
const A4_MIN_HEIGHT = '297mm';
const DOC_MARGIN = '48px';

const docInput =
  'w-full min-w-0 bg-transparent border-0 border-b border-dashed border-slate-300/90 px-0 py-0.5 text-[13px] leading-snug text-slate-900 placeholder:text-slate-400 focus:border-slate-700 focus:outline-none focus:ring-0';

const docCellInput =
  'w-full min-w-0 bg-white/90 border border-slate-200/80 rounded-sm px-1.5 py-1 text-[12px] text-slate-900 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-200';

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
    <div className="min-w-0 space-y-3">
      <p className="text-center text-fluid-2xs text-slate-500 px-2">
        A4 공문 양식(210×297mm)에 직접 입력합니다. 좁은 화면에서는 가로로 스크롤할 수 있습니다.
      </p>

      {/* 편집 도구 — 용지 바깥 */}
      <div className="flex flex-wrap items-center justify-center gap-2 px-2">
        {catalog.length > 0 && (
          <select
            className="max-w-[220px] rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-fluid-xs text-slate-700 shadow-sm"
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
          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-fluid-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
        >
          + 빈 행
        </button>
      </div>

      {/* A4 용지 — 가로 스크롤 허용, 크기 고정 */}
      <div className="overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 bg-slate-100/90 rounded-xl py-4">
        <div className="flex justify-center min-w-min">
          <article
            className="shrink-0 bg-white text-slate-900 shadow-lg shadow-slate-400/20 border border-slate-300 flex flex-col box-border"
            style={{
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
              <h2 className="text-[22px] font-bold tracking-[0.2em] text-slate-900">
                {documentTitle.trim() || '견 적 서'}
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
                    {supplierLines.map((line) => (
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

              {/* 품목 표 */}
              <div className="overflow-x-auto -mx-0.5 mb-4">
                <table className="w-full border-collapse text-[12px]">
                  <thead>
                    <tr className="bg-[#e5e7eb]">
                      <th className="w-9 border border-slate-300 px-1 py-1.5 text-center text-[10px] font-bold text-slate-700">
                        No
                      </th>
                      <th className="border border-slate-300 px-2 py-1.5 text-left text-[10px] font-bold text-slate-700">
                        품목
                      </th>
                      <th className="w-14 border border-slate-300 px-1 py-1.5 text-center text-[10px] font-bold text-slate-700">
                        수량
                      </th>
                      <th className="w-[72px] border border-slate-300 px-1 py-1.5 text-center text-[10px] font-bold text-slate-700">
                        단가
                      </th>
                      <th className="w-[76px] border border-slate-300 px-1 py-1.5 text-center text-[10px] font-bold text-slate-700">
                        금액
                      </th>
                      <th className="w-7 border border-slate-300" aria-label="삭제" />
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((li, idx) => {
                      const amount = lineAmountFromEditable(li);
                      return (
                        <tr key={li.key}>
                          <td className="border border-slate-300 px-1 py-1 text-center text-[11px] text-slate-500 tabular-nums align-middle">
                            {idx + 1}
                          </td>
                          <td className="border border-slate-300 px-0.5 py-0.5 align-middle">
                            <input
                              className={docCellInput}
                              placeholder="품목명"
                              value={li.label}
                              onChange={(e) => updateLine(li.key, { label: e.target.value })}
                            />
                          </td>
                          <td className="border border-slate-300 px-0.5 py-0.5 align-middle">
                            <input
                              className={`${docCellInput} text-center tabular-nums`}
                              inputMode="numeric"
                              placeholder="1"
                              value={li.quantity}
                              onChange={(e) => updateLine(li.key, { quantity: e.target.value })}
                            />
                          </td>
                          <td className="border border-slate-300 px-0.5 py-0.5 align-middle">
                            <input
                              className={`${docCellInput} text-right tabular-nums`}
                              inputMode="numeric"
                              placeholder="0"
                              value={li.unitPrice}
                              onChange={(e) => updateLine(li.key, { unitPrice: e.target.value })}
                            />
                          </td>
                          <td className="border border-slate-300 px-1.5 py-1 text-right text-[11px] tabular-nums text-slate-800 align-middle">
                            {amount != null ? `${amount.toLocaleString('ko-KR')}원` : '—'}
                          </td>
                          <td className="border border-slate-300 px-0.5 py-0.5 text-center align-middle">
                            <button
                              type="button"
                              disabled={lines.length <= 1}
                              onClick={() => removeLine(li.key)}
                              className="text-[10px] text-rose-600 hover:text-rose-800 disabled:opacity-30 leading-none"
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

              {/* 합계 */}
              <div className="flex justify-end mb-4">
                <div className="w-[200px] space-y-0.5 text-[12px]">
                  <div className="flex justify-between text-slate-600 tabular-nums">
                    <span>소계</span>
                    <span>{subtotal.toLocaleString('ko-KR')}원</span>
                  </div>
                  <label className="flex justify-between items-center gap-2 text-slate-600">
                    <span>할인</span>
                    <input
                      className="w-[72px] rounded-sm border border-slate-200 bg-white px-1.5 py-0.5 text-right text-[11px] tabular-nums focus:border-slate-500 focus:outline-none"
                      inputMode="numeric"
                      placeholder="0"
                      value={discountAmount}
                      onChange={(e) => onDiscountAmountChange(e.target.value)}
                    />
                  </label>
                  {discountNum > 0 && (
                    <div className="flex justify-between text-slate-600 tabular-nums text-[11px]">
                      <span />
                      <span>-{discountNum.toLocaleString('ko-KR')}원</span>
                    </div>
                  )}
                  <div className="flex justify-between items-baseline pt-1.5 border-t border-slate-400 font-bold text-slate-900 tabular-nums">
                    <span>합계</span>
                    <span className="text-[15px]">{total.toLocaleString('ko-KR')}원</span>
                  </div>
                  <p className="text-right text-[10px] text-slate-500">(부가세 별도)</p>
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

              {/* ── 하단(꼬리말) 고정 구역 — 짧은 내용일 때 용지 하단 정렬 ── */}
              <footer className="shrink-0 mt-auto pt-6 border-t border-slate-100">
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
          </article>
        </div>
      </div>
    </div>
  );
}
