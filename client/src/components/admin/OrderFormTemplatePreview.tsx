import { useEffect, useMemo, useState } from 'react';
import { getFormConfig, type OrderFormConfigPublic } from '../../api/orderform';
import { OrderFormAcUnitsField } from '../orderform/OrderFormAcUnitsField';
import {
  ORDER_FORM_AC_LEGACY_COUNT_FIELD_KEYS,
  ORDER_FORM_AC_UNITS_FIELD_KEY,
} from '@shared/orderFormAcUnits';
import {
  ORDER_FORM_CONFIG_DEFAULTS,
  orderFormConfigLine,
} from '../../constants/orderFormConfigDefaults';
import { ORDER_FORM_PROFESSIONAL_OPTIONS_SECTION_LABEL } from '../../constants/orderFormProfessionalOptions';
import type {
  OrderFormFieldFillMode,
  OrderFormFieldInputType,
  OrderFormFieldOptionStyle,
} from '../../api/orderFormTemplates';

export interface TemplatePreviewField {
  fieldKey?: string;
  label: string;
  helpText: string | null;
  inputType: OrderFormFieldInputType;
  required: boolean;
  fillMode: OrderFormFieldFillMode;
  systemField: string | null;
  options: string[];
  placeholder?: string | null;
  optionStyle?: OrderFormFieldOptionStyle | null;
}

export interface TemplatePreviewMeta {
  title: string;
  icon: string;
  description: string;
}

const CONTROL_CLS = 'w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-fluid-sm text-gray-400';

/** 발주서설정 미리보기·실제 발급 건과 동일한 샘플 금액 */
const PREVIEW_SAMPLE_TOTAL = 240_000;
const PREVIEW_SAMPLE_DEPOSIT = 20_000;
const PREVIEW_SAMPLE_BALANCE = 220_000;

const SECTION_TOGGLE_SYSTEM_FIELDS = new Set(['professionalOptions', 'photos', 'totalAmount']);
const LEGACY_AC_FIELD_KEYS = new Set(ORDER_FORM_AC_LEGACY_COUNT_FIELD_KEYS);

function previewReviewEventText(raw: string | null | undefined): string | null {
  if (raw == null) return ORDER_FORM_CONFIG_DEFAULTS.reviewEventText;
  const t = String(raw).trim();
  return t || null;
}

function estimateCardTitle(title: string): string {
  const base = title.replace(/\s*발주서\s*$/u, '').trim();
  return base ? `${base} 견적` : '서비스 견적';
}

function cleanOptions(options: string[]): string[] {
  return options.map((s) => s.trim()).filter(Boolean);
}

function OrderFormPreviewAmountCard({
  meta,
  formConfig,
}: {
  meta: TemplatePreviewMeta;
  formConfig: OrderFormConfigPublic | null;
}) {
  const priceLabel = orderFormConfigLine(
    formConfig?.priceLabel,
    ORDER_FORM_CONFIG_DEFAULTS.priceLabel,
  );
  const reviewText = previewReviewEventText(formConfig?.reviewEventText);

  return (
    <div className="mb-4 rounded border border-gray-200 bg-white p-4 text-fluid-sm">
      <p className="font-medium text-gray-900">
        {estimateCardTitle(meta.title.trim() || '발주서')}{' '}
        {PREVIEW_SAMPLE_TOTAL.toLocaleString()}원{' '}
        <span className="whitespace-pre-line align-top">{priceLabel}</span>
      </p>
      <p className="mt-1 text-gray-600">
        잔금 {PREVIEW_SAMPLE_BALANCE.toLocaleString()}원, 예약금{' '}
        {PREVIEW_SAMPLE_DEPOSIT.toLocaleString()}원
      </p>
      {reviewText ? (
        <p className="mt-1 whitespace-pre-line text-fluid-xs text-gray-600">{reviewText}</p>
      ) : null}
      <p className="mt-2 text-fluid-2xs text-gray-400">
        샘플 금액입니다. 실제 발급 시 담당자가 입력한 금액이 표시됩니다.
      </p>
    </div>
  );
}

/** 시스템 필드는 실제 발주서에서 표준 입력 화면으로 렌더되므로, 미리보기도 그 모양을 보여 준다. */
function SystemFieldControl({ systemField }: { systemField: string }) {
  if (systemField === 'customerPhone') {
    return (
      <div className="space-y-1.5">
        <div>
          <p className="mb-0.5 text-fluid-2xs text-gray-400">대표 연락처 *</p>
          <div className={CONTROL_CLS}>010-0000-0000</div>
        </div>
        <div>
          <p className="mb-0.5 text-fluid-2xs text-gray-400">보조 연락처 (필수) *</p>
          <div className={CONTROL_CLS}>예: 배우자·가족 연락처</div>
        </div>
        <p className="text-fluid-2xs text-gray-400">보조 전화번호는 전화번호 섹션에 함께 고정됩니다.</p>
      </div>
    );
  }
  if (systemField === 'address') {
    return (
      <div className="space-y-2">
        <div className="flex gap-2">
          <div className={`${CONTROL_CLS} flex-1`}>도로명·지번 주소</div>
          <span className="shrink-0 rounded-md bg-gray-800 px-3 py-2 text-fluid-xs font-medium text-white">주소 검색</span>
        </div>
        <div className={CONTROL_CLS}>상세주소 (동, 호수 등)</div>
        <p className="text-fluid-2xs text-gray-400">카카오/다음 우편번호 검색으로 입력됩니다.</p>
      </div>
    );
  }
  if (systemField === 'areaPyeong') {
    return (
      <div className="space-y-1.5">
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-md border border-gray-300 px-3 py-2 text-center text-fluid-2xs text-gray-500">
            공급면적<br />(분양평수)
          </div>
          <div className="rounded-md border border-gray-300 px-3 py-2 text-center text-fluid-2xs text-gray-500">
            전용면적<br />(실거주)
          </div>
        </div>
        <div className={CONTROL_CLS}>평수 (평 단위)</div>
        <p className="text-fluid-2xs text-gray-400">공급/전용을 선택한 뒤 평 단위로 입력합니다.</p>
      </div>
    );
  }
  return null;
}

function PreviewControl({ field }: { field: TemplatePreviewField }) {
  if (field.systemField === 'customerPhone' || field.systemField === 'address' || field.systemField === 'areaPyeong') {
    return <SystemFieldControl systemField={field.systemField} />;
  }
  const options = cleanOptions(field.options);
  if (field.systemField === 'propertyType') {
    return (
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {(options.length ? options : ['아파트', '오피스텔', '빌라(연립)', '상가', '기타']).map((o, i) => (
          <label key={i} className="flex items-center gap-1.5 text-fluid-sm text-gray-400">
            <input type="radio" disabled className="h-4 w-4 border-gray-300" />
            {o}
          </label>
        ))}
      </div>
    );
  }
  switch (field.inputType) {
    case 'TEXTAREA':
      return (
        <textarea
          disabled
          rows={3}
          className={CONTROL_CLS}
          placeholder={field.placeholder && field.placeholder.trim() ? field.placeholder : '고객 입력란'}
        />
      );
    case 'SELECT':
      if (field.optionStyle === 'RADIO') {
        return (
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {(options.length ? options : ['선택지 1', '선택지 2']).map((o, i) => (
              <label key={i} className="flex items-center gap-1.5 text-fluid-sm text-gray-400">
                <input type="radio" disabled className="h-4 w-4 border-gray-300" />
                {o}
              </label>
            ))}
          </div>
        );
      }
      return (
        <select disabled className={CONTROL_CLS}>
          {(options.length ? options : ['선택해 주세요']).map((o, i) => (
            <option key={i}>{o}</option>
          ))}
        </select>
      );
    case 'MULTISELECT':
    case 'CHECKBOX':
      return (
        <div className="space-y-1.5">
          {(options.length ? options : ['선택지 1', '선택지 2']).map((o, i) => (
            <label key={i} className="flex items-center gap-2 text-fluid-sm text-gray-400">
              <input type="checkbox" disabled className="h-4 w-4 rounded border-gray-300" />
              {o}
            </label>
          ))}
        </div>
      );
    case 'PHOTO':
      return <div className={`${CONTROL_CLS} text-center`}>📷 사진 첨부</div>;
    case 'DATE':
      return <input disabled className={CONTROL_CLS} placeholder="YYYY-MM-DD" />;
    case 'TIME':
      return <input disabled className={CONTROL_CLS} placeholder="시간 선택" />;
    case 'MONEY':
      return <input disabled className={CONTROL_CLS} placeholder="0 원" />;
    case 'NUMBER':
      return <input disabled className={CONTROL_CLS} placeholder="0" />;
    case 'PHONE':
      return <input disabled className={CONTROL_CLS} placeholder="010-0000-0000" />;
    case 'ADDRESS':
      return <input disabled className={CONTROL_CLS} placeholder="주소를 입력해 주세요" />;
    default:
      return <input disabled className={CONTROL_CLS} placeholder="고객 입력란" />;
  }
}

function fillModeBadge(mode: OrderFormFieldFillMode) {
  if (mode === 'ADMIN_LOCKED')
    return <span className="rounded bg-gray-200 px-1.5 py-0.5 text-fluid-2xs text-gray-600">관리자 고정</span>;
  if (mode === 'ADMIN_PREFILL')
    return <span className="rounded bg-blue-100 px-1.5 py-0.5 text-fluid-2xs text-blue-700">관리자 선입력</span>;
  return null;
}

/** 빌더 편집 내용을 실제 고객 발주서와 유사한 모양으로 즉시 렌더(읽기 전용). */
export function OrderFormTemplatePreview({
  meta,
  fields,
  authToken,
}: {
  meta: TemplatePreviewMeta;
  fields: TemplatePreviewField[];
  /** 있으면 발주서설정 문구(특가·리뷰 이벤트)를 불러와 상단 견적 카드에 반영 */
  authToken?: string | null;
}) {
  const [formConfig, setFormConfig] = useState<OrderFormConfigPublic | null>(null);

  useEffect(() => {
    if (!authToken) {
      setFormConfig(null);
      return;
    }
    let cancelled = false;
    getFormConfig(authToken)
      .then((cfg) => {
        if (!cancelled) setFormConfig(cfg);
      })
      .catch(() => {
        if (!cancelled) setFormConfig(null);
      });
    return () => {
      cancelled = true;
    };
  }, [authToken]);

  const { visibleFields, showProfSection, showPhotosSection } = useMemo(() => {
    let prof = false;
    let photos = false;
    const visible: TemplatePreviewField[] = [];
    for (const f of fields) {
      const sys = f.systemField?.trim();
      const key = f.fieldKey?.trim();
      if (sys === 'professionalOptions') {
        prof = true;
        continue;
      }
      if (sys === 'photos') {
        photos = true;
        continue;
      }
      if (sys && SECTION_TOGGLE_SYSTEM_FIELDS.has(sys)) continue;
      if (key && LEGACY_AC_FIELD_KEYS.has(key)) continue;
      if (key === 'totalAmount' || sys === 'totalAmount') continue;
      visible.push(f);
    }
    return { visibleFields: visible, showProfSection: prof, showPhotosSection: photos };
  }, [fields]);

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <div className="border-b border-gray-100 bg-gray-50 px-3 py-2 text-fluid-2xs font-medium uppercase tracking-wide text-gray-400">
        고객 화면 미리보기 (실시간)
      </div>
      <div className="max-h-[70vh] overflow-y-auto overscroll-y-contain p-4">
        <div className="mb-4 text-center">
          <h3 className="text-fluid-base font-semibold text-gray-900">
            {meta.icon ? `${meta.icon} ` : ''}
            {meta.title.trim() || '발주서 제목'}
          </h3>
          {meta.description.trim() ? (
            <p className="mt-1 whitespace-pre-line text-fluid-xs text-gray-500">{meta.description}</p>
          ) : null}
        </div>

        <OrderFormPreviewAmountCard meta={meta} formConfig={formConfig} />

        {visibleFields.length === 0 ? (
          <div className="rounded-md border border-dashed border-gray-300 p-6 text-center text-fluid-sm text-gray-400">
            항목을 추가하면 여기에 실제 모양으로 표시됩니다.
          </div>
        ) : (
          <div className="space-y-3.5">
            {visibleFields.map((f, i) => (
              <div key={i}>
                <div className="mb-1 flex flex-wrap items-center gap-1.5">
                  <span className="text-fluid-sm font-medium text-gray-800">
                    {f.label.trim() || '(이름 없음)'}
                    {f.required ? <span className="ml-0.5 text-red-500">*</span> : null}
                  </span>
                  {f.systemField ? (
                    <span className="rounded bg-green-50 px-1.5 py-0.5 text-fluid-2xs text-green-700">시스템</span>
                  ) : null}
                  {fillModeBadge(f.fillMode)}
                </div>
                {f.helpText && f.helpText.trim() ? (
                  <p className="mb-1 text-fluid-2xs text-gray-400">{f.helpText}</p>
                ) : null}
                {f.fieldKey === ORDER_FORM_AC_UNITS_FIELD_KEY ? (
                  <OrderFormAcUnitsField
                    value={[]}
                    onChange={() => {}}
                    options={cleanOptions(f.options)}
                    disabled
                    inputCls={CONTROL_CLS}
                  />
                ) : (
                  <PreviewControl field={f} />
                )}
              </div>
            ))}
          </div>
        )}

        {showPhotosSection ? (
          <div className="mt-4 rounded-md border border-gray-200 bg-gray-50/80 p-3">
            <p className="mb-2 text-fluid-sm font-medium text-gray-700">현장 사진 첨부</p>
            <div className={`${CONTROL_CLS} text-center`}>📷 사진 업로드 (최대 10장)</div>
          </div>
        ) : null}

        {showProfSection ? (
          <div className="mt-4 rounded-md border border-gray-200 bg-gray-50/80 p-3">
            <p className="mb-2 text-fluid-sm font-medium text-gray-700">
              {ORDER_FORM_PROFESSIONAL_OPTIONS_SECTION_LABEL}
            </p>
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-fluid-sm text-gray-400">
                <input type="checkbox" disabled className="h-4 w-4 rounded border-gray-300" />
                전문 시공 옵션 (발주서설정에서 관리)
              </label>
            </div>
          </div>
        ) : null}

        <div className="mt-4 rounded-xl border border-gray-200 bg-gradient-to-b from-gray-50/95 to-white px-4 py-4 text-center">
          <div className="w-full rounded-lg border border-gray-800 bg-white px-4 py-2.5 text-fluid-sm font-semibold text-gray-900">
            안내사항 보기 및 동의하기
          </div>
          <p className="mt-1.5 text-fluid-2xs text-gray-400">제출 전 안내사항 전체 확인 및 동의가 필요합니다.</p>
        </div>
      </div>
    </div>
  );
}

export default OrderFormTemplatePreview;
