import { ORDER_FORM_INQUIRY_LIST_PROMOTED_MAX } from '@shared/orderFormListSnapshot';
import { isOrderFormSectionToggleKey } from '@shared/orderFormSectionToggles';
import type { OrderFormFieldFillMode, OrderFormFieldInputType, OrderFormSystemFieldDef } from '../../../api/orderFormTemplates';
import { HelpTooltip } from '../../ui/HelpTooltip';
import { OrderFormDraftOptionsEditor } from './OrderFormDraftOptionsEditor';
import {
  FILL_MODE_OPTIONS,
  INPUT_TYPE_OPTIONS,
  OPTION_INPUT_TYPES,
  canPromoteDraftField,
  isLockedAlwaysOnDraft,
  isLockedRequiredDraft,
  type DraftField,
} from './orderFormTemplateDraft';

export function OrderFormTemplateFieldDraftList(props: {
  drafts: DraftField[];
  systemFields: OrderFormSystemFieldDef[];
  mappedSystemKeys: Set<string>;
  promotedSlotsLeft: number;
  onUpdate: (idx: number, patch: Partial<DraftField>) => void;
  onMove: (idx: number, dir: -1 | 1) => void;
  onRemove: (idx: number) => void;
  onAddMissingRequired: () => void;
}) {
  const { drafts, systemFields, mappedSystemKeys, promotedSlotsLeft, onUpdate, onMove, onRemove, onAddMissingRequired } =
    props;

  if (drafts.filter((d) => !isOrderFormSectionToggleKey(d.systemField)).length === 0) {
    return (
      <div className="space-y-3 p-6 text-center">
        <p className="text-fluid-sm text-gray-400">항목이 없습니다. 이름·전화·주소·서비스희망일부터 넣고 시작하세요.</p>
        <button
          type="button"
          onClick={onAddMissingRequired}
          className="rounded-md bg-slate-900 px-3.5 py-2 text-fluid-xs font-medium text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
        >
          + 이름·전화·주소·서비스희망일 채우기
        </button>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-gray-100">
      {drafts.map((d, idx) =>
        isOrderFormSectionToggleKey(d.systemField) ? null : (
          <li key={d.id ?? `new-${idx}`} className="p-3 sm:p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-fluid-2xs text-gray-400">#{idx + 1}</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onMove(idx, -1)}
                  disabled={!drafts.slice(0, idx).some((x) => !isOrderFormSectionToggleKey(x.systemField))}
                  className="rounded border border-gray-200 px-2 py-0.5 text-fluid-2xs text-gray-500 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => onMove(idx, 1)}
                  disabled={!drafts.slice(idx + 1).some((x) => !isOrderFormSectionToggleKey(x.systemField))}
                  className="rounded border border-gray-200 px-2 py-0.5 text-fluid-2xs text-gray-500 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 disabled:opacity-30"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => onRemove(idx)}
                  disabled={isLockedAlwaysOnDraft(d)}
                  className="rounded border border-red-200 px-2 py-0.5 text-fluid-2xs text-red-500 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 disabled:pointer-events-none disabled:opacity-30"
                >
                  삭제
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-fluid-2xs font-medium text-gray-500">항목 이름</span>
                <input
                  value={d.label}
                  onChange={(e) => onUpdate(idx, { label: e.target.value })}
                  maxLength={128}
                  className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-fluid-sm"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-fluid-2xs font-medium text-gray-500">입력 형식</span>
                <select
                  value={d.inputType}
                  onChange={(e) => onUpdate(idx, { inputType: e.target.value as OrderFormFieldInputType })}
                  className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-fluid-sm"
                >
                  {INPUT_TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-fluid-2xs font-medium text-gray-500">이미 있는 칸에 연결 (없으면 비움)</span>
                <select
                  value={d.systemField ?? ''}
                  disabled={isLockedAlwaysOnDraft(d)}
                  onChange={(e) => {
                    const systemField = e.target.value || null;
                    onUpdate(idx, { systemField, ...(systemField ? { showInInquiryList: false } : {}) });
                  }}
                  className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-fluid-sm disabled:bg-slate-50 disabled:text-slate-500"
                >
                  <option value="">연결 안 함 — 이 양식에만 생기는 새 칸</option>
                  {systemFields
                    .filter((sf) => !sf.sectionToggle)
                    .map((sf) => {
                      const usedElsewhere = sf.key !== d.systemField && mappedSystemKeys.has(sf.key);
                      return (
                        <option key={sf.key} value={sf.key} disabled={usedElsewhere || sf.autoGenerated}>
                          {sf.label}
                          {sf.templateRequired || sf.requiredCore ? ' *' : ''}
                          {sf.autoGenerated ? ' (자동)' : ''}
                          {usedElsewhere ? ' (사용중)' : ''}
                        </option>
                      );
                    })}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-fluid-2xs font-medium text-gray-500">입력 주체</span>
                <select
                  value={d.fillMode}
                  onChange={(e) => onUpdate(idx, { fillMode: e.target.value as OrderFormFieldFillMode })}
                  className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-fluid-sm"
                >
                  {FILL_MODE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              {canPromoteDraftField(d) ? (
                <label className="block sm:col-span-2">
                  <span className="mb-1 flex items-center gap-1 text-fluid-2xs font-medium text-gray-500">
                    접수 목록 표시
                    <HelpTooltip
                      text={`서비스접수 목록에 이 추가 항목 답변을 열로 표시합니다. 업체 전체에서 동일 fieldKey 기준 최대 ${ORDER_FORM_INQUIRY_LIST_PROMOTED_MAX}개까지 선택할 수 있습니다.`}
                    />
                  </span>
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={Boolean(d.showInInquiryList)}
                      disabled={!d.showInInquiryList && promotedSlotsLeft <= 0}
                      onChange={(e) => onUpdate(idx, { showInInquiryList: e.target.checked })}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <span className="text-fluid-xs text-gray-600">
                      목록에 노출
                      {!d.showInInquiryList && promotedSlotsLeft <= 0
                        ? ` (선택 한도 ${ORDER_FORM_INQUIRY_LIST_PROMOTED_MAX}개)`
                        : ''}
                    </span>
                  </label>
                </label>
              ) : null}
              <label className="block sm:col-span-2">
                <span className="mb-1 block text-fluid-2xs font-medium text-gray-500">도움말 (선택)</span>
                <input
                  value={d.helpText ?? ''}
                  onChange={(e) => onUpdate(idx, { helpText: e.target.value || null })}
                  className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-fluid-sm"
                />
              </label>
              {d.inputType === 'TEXTAREA' && (
                <div className="rounded-md border border-gray-200 bg-gray-50/60 p-2.5 sm:col-span-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={d.placeholder != null}
                      onChange={(e) => onUpdate(idx, { placeholder: e.target.checked ? '' : null })}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <span className="text-fluid-xs text-gray-600">입력란 안에 부연설명(흐린 안내문) 표시</span>
                  </label>
                  {d.placeholder != null && (
                    <input
                      value={d.placeholder}
                      onChange={(e) => onUpdate(idx, { placeholder: e.target.value })}
                      maxLength={300}
                      placeholder="예: 전화 상담 시 언급 내용"
                      className="mt-2 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-fluid-sm"
                    />
                  )}
                </div>
              )}
              {d.inputType === 'SELECT' && (
                <div className="sm:col-span-2">
                  <span className="mb-1 block text-fluid-2xs font-medium text-gray-500">표시 방식</span>
                  <div className="inline-flex overflow-hidden rounded-md border border-gray-300">
                    {([{ v: 'RADIO' as const, label: '라디오 버튼' }, { v: 'DROPDOWN' as const, label: '드롭다운' }]).map(
                      (o) => {
                        const active = (d.optionStyle ?? 'DROPDOWN') === o.v;
                        return (
                          <button
                            key={o.v}
                            type="button"
                            onClick={() =>
                              onUpdate(idx, {
                                optionStyle: o.v,
                                optionLayout: o.v === 'RADIO' ? d.optionLayout ?? 'VERTICAL' : null,
                              })
                            }
                            className={`px-3 py-1.5 text-fluid-xs hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 ${
                              active ? 'bg-slate-800 text-white hover:bg-slate-800' : 'bg-white text-gray-600'
                            }`}
                          >
                            {o.label}
                          </button>
                        );
                      },
                    )}
                  </div>
                </div>
              )}
              {(d.inputType === 'MULTISELECT' ||
                d.inputType === 'CHECKBOX' ||
                (d.inputType === 'SELECT' && (d.optionStyle ?? 'DROPDOWN') === 'RADIO')) && (
                <div className="sm:col-span-2">
                  <span className="mb-1 block text-fluid-2xs font-medium text-gray-500">선택지 배치</span>
                  <div className="inline-flex overflow-hidden rounded-md border border-gray-300">
                    {(
                      [
                        { v: 'VERTICAL' as const, label: '세로' },
                        { v: 'HORIZONTAL' as const, label: '가로' },
                        { v: 'COLS_2' as const, label: '두 칸' },
                      ] as const
                    ).map((o) => {
                      const active = (d.optionLayout ?? 'VERTICAL') === o.v;
                      return (
                        <button
                          key={o.v}
                          type="button"
                          onClick={() => onUpdate(idx, { optionLayout: o.v })}
                          className={`px-3 py-1.5 text-fluid-xs hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 ${
                            active ? 'bg-slate-800 text-white hover:bg-slate-800' : 'bg-white text-gray-600'
                          }`}
                        >
                          {o.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              {OPTION_INPUT_TYPES.has(d.inputType) && (
                <OrderFormDraftOptionsEditor
                  className="block sm:col-span-2"
                  title={d.systemField === 'preferredTime' ? '시간대 하위 항목' : undefined}
                  hint={
                    d.systemField === 'preferredTime'
                      ? '이 발주서 손님·발급 화면에만 보이는 시간대입니다. 다른 발주서와 따로입니다.'
                      : undefined
                  }
                  options={d.options}
                  onChange={(options) => onUpdate(idx, { options })}
                />
              )}
              <label className="flex items-center gap-2 sm:col-span-2">
                <input
                  type="checkbox"
                  checked={isLockedRequiredDraft(d) ? true : d.required}
                  disabled={isLockedRequiredDraft(d)}
                  onChange={(e) => onUpdate(idx, { required: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300 disabled:opacity-50"
                />
                <span className="text-fluid-xs text-gray-600">필수 입력</span>
                {isLockedRequiredDraft(d) ? (
                  <span className="ml-2 text-fluid-2xs text-slate-500">이름·전화·주소·서비스희망일은 항상 필수입니다</span>
                ) : (
                  <span className="ml-2 text-fluid-2xs text-gray-400">
                    {FILL_MODE_OPTIONS.find((o) => o.value === d.fillMode)?.hint}
                  </span>
                )}
              </label>
            </div>
          </li>
        ),
      )}
    </ul>
  );
}
