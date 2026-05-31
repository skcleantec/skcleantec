import type { OrderFormFieldFillMode, OrderFormFieldInputType } from '../../api/orderFormTemplates';

export interface TemplatePreviewField {
  label: string;
  helpText: string | null;
  inputType: OrderFormFieldInputType;
  required: boolean;
  fillMode: OrderFormFieldFillMode;
  systemField: string | null;
  optionsText: string;
}

export interface TemplatePreviewMeta {
  title: string;
  icon: string;
  description: string;
}

const CONTROL_CLS = 'w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-fluid-sm text-gray-400';

function parseOptions(optionsText: string): string[] {
  return optionsText
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** 시스템 필드는 실제 발주서에서 표준 입력 화면으로 렌더되므로, 미리보기도 그 모양을 보여 준다. */
function SystemFieldControl({ systemField }: { systemField: string }) {
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
  if (field.systemField === 'address' || field.systemField === 'areaPyeong') {
    return <SystemFieldControl systemField={field.systemField} />;
  }
  const options = parseOptions(field.optionsText);
  switch (field.inputType) {
    case 'TEXTAREA':
      return <textarea disabled rows={3} className={CONTROL_CLS} placeholder="고객 입력란" />;
    case 'SELECT':
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
}: {
  meta: TemplatePreviewMeta;
  fields: TemplatePreviewField[];
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <div className="border-b border-gray-100 bg-gray-50 px-3 py-2 text-fluid-2xs font-medium uppercase tracking-wide text-gray-400">
        고객 화면 미리보기 (실시간)
      </div>
      <p className="border-b border-gray-100 bg-blue-50/60 px-3 py-1.5 text-fluid-2xs leading-relaxed text-blue-900">
        「시스템」으로 표시된 항목(주소·평수·전화 등)은 실제 발주서에서 <b>표준 입력 화면</b>(카카오 주소검색·공급/전용 평수 등)으로 나타나며, 접수목록·스케줄에 동일하게 들어갑니다.
      </p>
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

        {fields.length === 0 ? (
          <div className="rounded-md border border-dashed border-gray-300 p-6 text-center text-fluid-sm text-gray-400">
            항목을 추가하면 여기에 실제 모양으로 표시됩니다.
          </div>
        ) : (
          <div className="space-y-3.5">
            {fields.map((f, i) => (
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
                <PreviewControl field={f} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default OrderFormTemplatePreview;
