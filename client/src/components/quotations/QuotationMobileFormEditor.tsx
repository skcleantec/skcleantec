import { useMemo, useState, type FocusEvent, type ReactNode } from 'react';
import type {
  QuotationEditorOperatingCompanyDto,
  QuotationServiceItemDto,
} from '../../api/quotations';
import type { TenantCompanyRegistration } from '../../api/tenantCompanyProfile';
import type { QuotationVatMode } from '@shared/quotationVat';
import { computeLineAmounts, vatModeLabel } from '@shared/quotationVat';
import type { QuotationDocumentType } from '@shared/quotationDocument';
import {
  getDocumentClosingPhrase,
  QUOTATION_DOCUMENT_TYPE_OPTIONS,
  shouldShowQuotationValidUntil,
} from '@shared/quotationDocument';
import { LineMdIcon } from '../ui/LineMdIcon';
import {
  ensureInputVisibleAboveKeyboard,
  isMobileKeyboardScrollContext,
} from '../../hooks/useMobileInputVisibility';
import { getStaffAppScrollElement } from '../../utils/staffAppScrollRestore';
import {
  resolveQuotationBrandTitle,
  resolveQuotationSupplierRegistration,
} from './quotationBrandResolve';
import {
  catalogSelectValue,
  emptyQuotationLine,
  lineAmountFromEditable,
  type EditableQuotationLine,
} from './quotationLineUtils';
import { qUi } from './quotationUi';

type MobileStep = 'customer' | 'items' | 'review';

const STEPS: { id: MobileStep; label: string; icon: string }[] = [
  { id: 'customer', label: '손님', icon: 'account' },
  { id: 'items', label: '품목', icon: 'list-3' },
  { id: 'review', label: '확인', icon: 'check-list-3' },
];

type Props = {
  quoteNumber: string | null;
  createdAt: string | null;
  tenantCompanyRegistration: TenantCompanyRegistration;
  operatingCompanies: QuotationEditorOperatingCompanyDto[];
  operatingCompanyId: string;
  onOperatingCompanyChange: (id: string) => void;
  documentType: QuotationDocumentType;
  onDocumentTypeChange: (type: QuotationDocumentType) => void;
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
  /** 저장 후 「확인」 단계에서만 보이는 이메일 발송 칸 */
  afterReview?: ReactNode;
};

const fieldCls = `${qUi.input} min-h-11`;
const selectCls = `${qUi.select} min-h-11`;

function formatDocDate(iso: string | null | undefined): string {
  const d = iso ? new Date(iso) : new Date();
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' });
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
    <section className={`${qUi.cardBody} w-full min-w-0 max-w-full space-y-3 p-3 sm:p-4`}>
      <div>
        <h2 className="text-fluid-sm font-semibold text-slate-900">{title}</h2>
        {subtitle ? <p className={`${qUi.sectionSubtitle} mt-0.5`}>{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}

function bumpQty(raw: string, delta: number): string {
  const n = Number.parseInt(raw.replace(/[^\d-]/g, ''), 10);
  const next = (Number.isFinite(n) ? n : 0) + delta;
  return String(Math.max(1, next));
}

export function QuotationMobileFormEditor(props: Props) {
  const {
    quoteNumber,
    createdAt,
    tenantCompanyRegistration,
    operatingCompanies,
    operatingCompanyId,
    onOperatingCompanyChange,
    documentType,
    onDocumentTypeChange,
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
    afterReview,
  } = props;

  const [step, setStep] = useState<MobileStep>('customer');

  const supplierRegistration = useMemo(
    () =>
      resolveQuotationSupplierRegistration(
        operatingCompanies,
        operatingCompanyId,
        tenantCompanyRegistration,
      ),
    [operatingCompanies, operatingCompanyId, tenantCompanyRegistration],
  );
  const documentTitle = resolveQuotationBrandTitle(
    operatingCompanies,
    operatingCompanyId,
    tenantCompanyRegistration,
    documentType,
  );
  const closingPhrase = getDocumentClosingPhrase(documentType);
  const showValidUntil = shouldShowQuotationValidUntil(documentType);
  const showBrandSelector = operatingCompanies.length > 0;
  const stepIndex = STEPS.findIndex((s) => s.id === step);

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

  function addFromCatalog(itemId: string) {
    const item = catalog.find((c) => c.id === itemId);
    if (!item) return;
    const first = lines[0];
    const firstEmpty =
      lines.length === 1 && !first?.label.trim() && !first?.catalogItemId && !first?.unitPrice.trim();
    const next = emptyQuotationLine(item);
    onLinesChange(firstEmpty ? [next] : [...lines, next]);
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

  function onFieldFocus(e: FocusEvent<HTMLElement>) {
    if (!isMobileKeyboardScrollContext()) return;
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;
    if (!t.matches('input, textarea, select')) return;
    ensureInputVisibleAboveKeyboard(t, getStaffAppScrollElement(), 'smooth', 28);
  }

  function go(delta: number) {
    const next = stepIndex + delta;
    if (next < 0 || next >= STEPS.length) return;
    setStep(STEPS[next].id);
    const main = getStaffAppScrollElement();
    if (main) main.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <div className="w-full min-w-0 max-w-full space-y-3 lg:hidden" onFocusCapture={onFieldFocus}>
      <nav
        className="flex gap-0.5 rounded-xl bg-slate-100 p-0.5"
        aria-label="견적서 작성 단계"
      >
        {STEPS.map((s, i) => {
          const active = s.id === step;
          const done = i < stepIndex;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setStep(s.id)}
              className={[
                'flex min-h-10 min-w-0 flex-1 items-center justify-center gap-1 rounded-lg px-2 text-fluid-2xs font-semibold touch-manipulation',
                'hover:bg-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2',
                'disabled:pointer-events-none disabled:opacity-50',
                active
                  ? 'bg-slate-900 text-white shadow-sm'
                  : done
                    ? 'text-slate-700'
                    : 'text-slate-500',
              ].join(' ')}
            >
              <LineMdIcon name={s.icon} className="size-3.5 shrink-0" />
              <span className="truncate">
                {i + 1}. {s.label}
              </span>
            </button>
          );
        })}
      </nav>

      <p className="px-0.5 text-fluid-2xs text-slate-500">
        {documentTitle}
        {quoteNumber ? ` · ${quoteNumber}` : ''} · {formatDocDate(createdAt)}
      </p>

      {step === 'customer' ? (
        <SectionCard title="손님" subtitle="견적서에 찍히는 이름과 연락처">
          {showBrandSelector ? (
            <label className="block">
              <span className={qUi.label}>영업 브랜드</span>
              <select
                className={selectCls}
                value={operatingCompanyId}
                onChange={(e) => onOperatingCompanyChange(e.target.value)}
                disabled={operatingCompanies.length <= 1}
              >
                {operatingCompanies.map((oc) => (
                  <option key={oc.id} value={oc.id}>
                    {oc.displayName || oc.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <fieldset>
            <legend className={qUi.label}>문서 유형</legend>
            <div className={`${qUi.segmentWrap} flex w-full min-w-0 max-w-full`}>
              {QUOTATION_DOCUMENT_TYPE_OPTIONS.map((opt, i) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`${qUi.segmentBtn(documentType === opt.value, i > 0)} min-h-10 flex-1 touch-manipulation`}
                  onClick={() => onDocumentTypeChange(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </fieldset>

          <label className="block">
            <span className={qUi.label}>
              이름 <span className="text-rose-600">*</span>
            </span>
            <input
              className={fieldCls}
              placeholder="고객 성함"
              value={customerName}
              onChange={(e) => onCustomerNameChange(e.target.value)}
              autoComplete="name"
            />
          </label>
          <label className="block">
            <span className={qUi.label}>수신 이메일</span>
            <input
              type="email"
              className={fieldCls}
              placeholder="견적서 받을 이메일"
              value={customerEmail}
              onChange={(e) => onCustomerEmailChange(e.target.value)}
              autoComplete="email"
            />
            <span className="mt-1 block text-fluid-2xs text-slate-500">
              저장한 뒤 확인 단계에서 이 주소로 보냅니다.
            </span>
          </label>
          <label className="block">
            <span className={qUi.label}>연락처</span>
            <input
              className={fieldCls}
              placeholder="010-0000-0000"
              value={customerPhone}
              onChange={(e) => onCustomerPhoneChange(e.target.value)}
              inputMode="tel"
              autoComplete="tel"
            />
          </label>
          <label className="block">
            <span className={qUi.label}>주소</span>
            <input
              className={fieldCls}
              placeholder="현장 주소"
              value={customerAddress}
              onChange={(e) => onCustomerAddressChange(e.target.value)}
            />
          </label>

          {showValidUntil ? (
            <label className="block">
              <span className={qUi.label}>유효기간</span>
              <input
                type="date"
                className={fieldCls}
                value={validUntil}
                onChange={(e) => onValidUntilChange(e.target.value)}
              />
            </label>
          ) : null}
        </SectionCard>
      ) : null}

      {step === 'items' ? (
        <SectionCard title="품목" subtitle="할 일을 고르고 수량만 맞추면 됩니다">
          {catalog.length > 0 ? (
            <div className="space-y-1.5">
              <p className={qUi.label}>눌러서 넣기</p>
              <div className="flex max-h-36 flex-col gap-1.5 overflow-y-auto overscroll-y-contain">
                {catalog.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => addFromCatalog(c.id)}
                    className="flex min-h-11 w-full items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-left touch-manipulation hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
                  >
                    <span className="min-w-0 truncate text-fluid-sm font-medium text-slate-800">
                      {c.name}
                    </span>
                    <span className="shrink-0 text-fluid-xs tabular-nums text-slate-500">
                      {c.unitPrice.toLocaleString('ko-KR')}원
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-fluid-xs text-amber-800">
              견적 설정에 품목을 올려 두면 눌러서 넣을 수 있습니다.
            </p>
          )}

          <ul className="space-y-2">
            {lines.map((li, idx) => {
              const supply = lineAmountFromEditable(li);
              const lineCalc =
                supply != null
                  ? computeLineAmounts(supply, vatMode)
                  : { supply: 0, vatAmount: 0, grandAmount: 0 };
              const custom = catalog.length === 0 || isCustomLineCell(li, catalog);

              return (
                <li key={li.key} className="rounded-xl border border-slate-200 bg-white p-2.5">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-fluid-2xs font-semibold text-slate-500">품목 {idx + 1}</span>
                    {lines.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => removeLineAt(idx)}
                        className="min-h-8 px-2 text-fluid-xs font-medium text-rose-600 hover:text-rose-800 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 focus-visible:ring-offset-2"
                      >
                        빼기
                      </button>
                    ) : null}
                  </div>

                  {catalog.length > 0 && !custom ? (
                    <p className="mb-2 truncate text-fluid-sm font-semibold text-slate-900" title={li.label}>
                      {li.label || '품목'}
                    </p>
                  ) : (
                    <label className="mb-2 block">
                      <span className={qUi.label}>품목명</span>
                      <input
                        className={fieldCls}
                        placeholder="할 일 이름"
                        value={li.label}
                        onChange={(e) =>
                          updateLineAt(idx, { catalogItemId: null, label: e.target.value })
                        }
                      />
                    </label>
                  )}

                  {catalog.length > 0 && custom ? (
                    <label className="mb-2 block">
                      <span className={qUi.label}>목록에서 고르기</span>
                      <select
                        className={selectCls}
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
                  ) : null}

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className={qUi.label}>수량</span>
                      <div className="flex min-h-11 items-stretch overflow-hidden rounded-xl border border-slate-200">
                        <button
                          type="button"
                          aria-label="수량 줄이기"
                          onClick={() => updateLineAt(idx, { quantity: bumpQty(li.quantity, -1) })}
                          className="inline-flex w-10 items-center justify-center text-slate-600 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-400 disabled:opacity-50"
                        >
                          <LineMdIcon name="minus" className="size-4" />
                        </button>
                        <input
                          className="min-w-0 flex-1 border-0 bg-white text-center text-fluid-sm tabular-nums text-slate-900 focus:outline-none focus:ring-0"
                          inputMode="numeric"
                          value={li.quantity}
                          onChange={(e) => updateLineAt(idx, { quantity: e.target.value })}
                        />
                        <button
                          type="button"
                          aria-label="수량 늘리기"
                          onClick={() => updateLineAt(idx, { quantity: bumpQty(li.quantity, 1) })}
                          className="inline-flex w-10 items-center justify-center text-slate-600 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-400"
                        >
                          <LineMdIcon name="plus" className="size-4" />
                        </button>
                      </div>
                    </div>
                    <label className="block">
                      <span className={qUi.label}>단가(원)</span>
                      <input
                        className={`${fieldCls} text-right tabular-nums`}
                        inputMode="numeric"
                        placeholder="0"
                        value={li.unitPrice}
                        onChange={(e) => updateLineAt(idx, { unitPrice: e.target.value })}
                      />
                    </label>
                  </div>

                  <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2 text-fluid-sm">
                    <span className="text-slate-500">금액</span>
                    <span className="font-semibold tabular-nums text-slate-900">
                      {supply != null ? `${lineCalc.grandAmount.toLocaleString('ko-KR')}원` : '—'}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>

          <button
            type="button"
            onClick={addRow}
            className={`${qUi.btnSecondary} min-h-11 w-full touch-manipulation py-2.5`}
          >
            + 직접 입력
          </button>
        </SectionCard>
      ) : null}

      {step === 'review' ? (
        <SectionCard title="확인" subtitle="맞으면 아래 「저장」을 누르세요">
          <div className="rounded-xl bg-slate-50 px-3 py-2.5 text-fluid-xs text-slate-700">
            <p className="font-semibold text-slate-900">{customerName.trim() || '이름 없음'}</p>
            {customerEmail.trim() ? <p className="mt-0.5">{customerEmail.trim()}</p> : (
              <p className="mt-0.5 text-amber-800">수신 이메일이 없습니다. 손님 칸에서 적어 주세요.</p>
            )}
            {customerPhone.trim() ? <p className="mt-0.5">{customerPhone.trim()}</p> : null}
            {customerAddress.trim() ? <p className="mt-0.5 truncate">{customerAddress.trim()}</p> : null}
          </div>

          <ul className="space-y-1 text-fluid-xs">
            {lines
              .filter((li) => li.label.trim() || li.unitPrice.trim())
              .map((li) => {
                const supply = lineAmountFromEditable(li);
                return (
                  <li key={li.key} className="flex justify-between gap-2">
                    <span className="min-w-0 truncate text-slate-700">
                      {li.label || '품목'} × {li.quantity || '1'}
                    </span>
                    <span className="shrink-0 tabular-nums text-slate-900">
                      {supply != null ? `${supply.toLocaleString('ko-KR')}원` : '—'}
                    </span>
                  </li>
                );
              })}
          </ul>

          <div className="flex justify-between text-fluid-sm tabular-nums text-slate-600">
            <span>소계</span>
            <span>{subtotal.toLocaleString('ko-KR')}원</span>
          </div>
          <label className="flex items-center justify-between gap-3 text-fluid-sm text-slate-600">
            <span className="shrink-0">할인</span>
            <input
              className={`${fieldCls} max-w-[9rem] text-right tabular-nums`}
              inputMode="numeric"
              placeholder="0"
              value={discountAmount}
              onChange={(e) => onDiscountAmountChange(e.target.value)}
            />
          </label>
          {discountNum > 0 ? (
            <p className="text-right text-fluid-xs tabular-nums text-slate-500">
              -{discountNum.toLocaleString('ko-KR')}원
            </p>
          ) : null}

          <fieldset>
            <legend className={qUi.label}>과세 구분</legend>
            <div className={`${qUi.segmentWrap} flex w-full min-w-0 max-w-full`}>
              <button
                type="button"
                className={`${qUi.segmentBtn(vatMode === 'TAX_FREE', false)} min-h-10 flex-1 touch-manipulation`}
                onClick={() => onVatModeChange('TAX_FREE')}
              >
                면세
              </button>
              <button
                type="button"
                className={`${qUi.segmentBtn(vatMode === 'VAT_SEPARATE', true)} min-h-10 flex-1 touch-manipulation`}
                onClick={() => onVatModeChange('VAT_SEPARATE')}
              >
                부가세 별도
              </button>
            </div>
          </fieldset>

          <div className="grid grid-cols-3 gap-1.5">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-1.5 py-2 text-center">
              <p className="mb-0.5 text-fluid-2xs text-slate-500">공급가</p>
              <p className="text-fluid-xs font-semibold tabular-nums text-slate-900">
                {supplyTotal.toLocaleString('ko-KR')}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-1.5 py-2 text-center">
              <p className="mb-0.5 text-fluid-2xs text-slate-500">부가세</p>
              <p className="text-fluid-xs font-semibold tabular-nums text-slate-900">
                {vatAmount.toLocaleString('ko-KR')}
              </p>
            </div>
            <div className="rounded-xl border border-slate-300 bg-slate-100 px-1.5 py-2 text-center">
              <p className="mb-0.5 text-fluid-2xs font-semibold text-slate-600">합계</p>
              <p className="text-fluid-sm font-bold tabular-nums text-slate-900">
                {grandTotal.toLocaleString('ko-KR')}
              </p>
            </div>
          </div>
          <p className="text-center text-fluid-2xs text-slate-500">({vatModeLabel(vatMode)})</p>

          <label className="block">
            <span className={qUi.label}>비고</span>
            <textarea
              className={`${qUi.textarea} min-h-[5.5rem]`}
              rows={3}
              placeholder="견적서에 같이 넣을 말"
              value={memo}
              onChange={(e) => onMemoChange(e.target.value)}
            />
          </label>

          <p className="text-center text-fluid-sm font-medium text-slate-800">{closingPhrase}</p>
          {footerNotice?.trim() ? (
            <p className="whitespace-pre-wrap border-t border-slate-100 pt-2 text-fluid-2xs text-slate-500">
              {footerNotice.trim()}
            </p>
          ) : null}
          {supplierRegistration?.companyName?.trim() ? (
            <p className="text-center text-fluid-2xs text-slate-500">
              공급자 {supplierRegistration.companyName.trim()}
            </p>
          ) : null}
        </SectionCard>
      ) : null}

      {step === 'review' && afterReview ? afterReview : null}

      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={stepIndex === 0}
          onClick={() => go(-1)}
          className={`${qUi.btnSecondary} min-h-11 flex-1 touch-manipulation py-2.5 disabled:opacity-40`}
        >
          이전
        </button>
        {stepIndex < STEPS.length - 1 ? (
          <button
            type="button"
            onClick={() => go(1)}
            className={`${qUi.btnPrimary} min-h-11 flex-1 touch-manipulation py-2.5`}
          >
            다음
          </button>
        ) : (
          <p className="flex-1 text-center text-fluid-xs font-semibold tabular-nums text-slate-800">
            합계 {grandTotal.toLocaleString('ko-KR')}원
          </p>
        )}
      </div>
    </div>
  );
}
