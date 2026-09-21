import type { Dispatch, SetStateAction } from 'react';
import {
  DEFAULT_ORDER_TIME_SLOT_LABELS,
  ORDER_TIME_SLOT_VALUES,
  type OrderTimeSlotLabels,
} from '@shared/orderFormTimeSlotLabels';
import { ORDER_FORM_CONFIG_DEFAULTS } from '../../../constants/orderFormConfigDefaults';
import { OrderFormModalTextEditor } from '../../orderform/OrderFormModalTextEditor';
import { type FormMessagesState, withDefaultText } from '../../../utils/orderFormCustomerCopy';
import type { OrderFormConfigPublic } from '../../../api/orderform';
import type { EstimateOption } from '../../../api/estimate';

const MSG_TEXTAREA_CLS =
  'w-full resize-y rounded border border-gray-300 px-2 py-2 text-fluid-sm leading-relaxed';

const BTN_SAVE =
  'rounded-lg bg-slate-900 px-3 py-2 text-fluid-xs font-medium text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none';

const BTN_GHOST =
  'rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-fluid-xs font-medium text-gray-800 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none';

const DEMO_PYEONG = 32;

type SavePartial = (key: string, payload: Partial<OrderFormConfigPublic>) => void;

export function OrderFormSettingsCopyPanel(props: {
  msgConfig: FormMessagesState;
  setMsgConfig: Dispatch<SetStateAction<FormMessagesState>>;
  msgSavingKey: string | null;
  onSaveMsg: () => void;
  saveMsgPartial: SavePartial;
  timeSlotLabels: OrderTimeSlotLabels;
  setTimeSlotLabels: Dispatch<SetStateAction<OrderTimeSlotLabels>>;
}) {
  const { msgConfig, setMsgConfig, msgSavingKey, onSaveMsg, saveMsgPartial, timeSlotLabels, setTimeSlotLabels } =
    props;

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h4 className="text-fluid-xs font-semibold text-slate-800">기본 발주서 제목</h4>
        <p className="text-fluid-2xs text-slate-500">
          기본 입주청소 발주서 제목입니다. 다른 발주서는 위 「이름·사용」에서 정한 이름이 손님 화면에 나갑니다.
        </p>
        <textarea
          rows={3}
          className={`${MSG_TEXTAREA_CLS} min-h-[4.5rem]`}
          value={msgConfig.formTitle}
          onChange={(e) => setMsgConfig((c) => ({ ...c, formTitle: e.target.value }))}
        />
        <button type="button" onClick={onSaveMsg} disabled={msgSavingKey !== null} className={BTN_SAVE}>
          {msgSavingKey === 'all' ? '저장 중…' : '제목 저장'}
        </button>
      </section>

      <section className="space-y-2">
        <label className="block text-fluid-xs font-semibold text-slate-800">리뷰 이벤트 문구</label>
        <textarea
          rows={4}
          className={`${MSG_TEXTAREA_CLS} min-h-[5rem]`}
          value={msgConfig.reviewEventText ?? ''}
          onChange={(e) => setMsgConfig((c) => ({ ...c, reviewEventText: e.target.value }))}
          placeholder="비워 두고 저장하면 손님 화면에서 숨깁니다."
        />
        <button type="button" onClick={onSaveMsg} disabled={msgSavingKey !== null} className={BTN_SAVE}>
          {msgSavingKey === 'all' ? '저장 중…' : '리뷰 문구 저장'}
        </button>
      </section>

      <section className="space-y-2">
        <h4 className="text-fluid-xs font-semibold text-slate-800">하단 안내</h4>
        <p className="text-fluid-2xs text-slate-500">제출 완료 화면·안내 문자 아래입니다. 작성 중 본문에는 안 나갑니다.</p>
        <label className="block text-fluid-2xs text-slate-600">안내 문구 1</label>
        <textarea
          rows={3}
          className={`${MSG_TEXTAREA_CLS} min-h-[4.5rem]`}
          value={msgConfig.footerNotice1 ?? ''}
          onChange={(e) => setMsgConfig((c) => ({ ...c, footerNotice1: e.target.value }))}
        />
        <label className="block text-fluid-2xs text-slate-600">안내 문구 2</label>
        <textarea
          rows={3}
          className={`${MSG_TEXTAREA_CLS} min-h-[4.5rem]`}
          value={msgConfig.footerNotice2 ?? ''}
          onChange={(e) => setMsgConfig((c) => ({ ...c, footerNotice2: e.target.value }))}
        />
        <button type="button" onClick={onSaveMsg} disabled={msgSavingKey !== null} className={BTN_SAVE}>
          {msgSavingKey === 'all' ? '저장 중…' : '하단 안내 저장'}
        </button>
      </section>

      <section className="space-y-3">
        <h4 className="text-fluid-xs font-semibold text-slate-800">제출 완료</h4>
        <OrderFormModalTextEditor
          label="제출 완료 제목"
          minHeightClassName="min-h-[4rem]"
          value={withDefaultText(msgConfig.submitSuccessTitle, 'submitSuccessTitle')}
          onChange={(next) => setMsgConfig((c) => ({ ...c, submitSuccessTitle: next }))}
          onSave={(markup) =>
            saveMsgPartial('submitSuccessTitle', { submitSuccessTitle: markup || undefined })
          }
          saving={msgSavingKey === 'submitSuccessTitle'}
        />
        <OrderFormModalTextEditor
          label="제출 완료 안내"
          value={withDefaultText(msgConfig.submitSuccessBody, 'submitSuccessBody')}
          onChange={(next) => setMsgConfig((c) => ({ ...c, submitSuccessBody: next }))}
          onSave={(markup) => saveMsgPartial('submitSuccessBody', { submitSuccessBody: markup || undefined })}
          saving={msgSavingKey === 'submitSuccessBody'}
        />
      </section>

      <section className="space-y-3">
        <h4 className="text-fluid-xs font-semibold text-slate-800">시간대·날짜 확인 모달</h4>
        <p className="text-fluid-2xs text-slate-500">
          손님이 고르는 시간대 항목은 위 「입력 칸」에서 이 발주서마다 고칩니다. 아래는 기본 네 칸 이름을 그대로 쓸
          때의 표시 문구와, 확인 모달 본문입니다.
        </p>
        <details className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <summary className="cursor-pointer text-fluid-xs font-medium text-slate-800">
            기본 네 칸(오전·오후·사이청소·조율) 표시 문구
          </summary>
          <div className="mt-2 space-y-2">
            <div className="flex justify-end">
              <button
                type="button"
                className="rounded px-1 text-fluid-2xs text-slate-600 underline hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
                onClick={() => setTimeSlotLabels({ ...DEFAULT_ORDER_TIME_SLOT_LABELS })}
              >
                기본값으로 되돌리기
              </button>
            </div>
            {ORDER_TIME_SLOT_VALUES.map((value) => (
              <div key={value}>
                <label className="flex flex-wrap items-center gap-2 text-fluid-xs font-medium text-gray-700">
                  <span className="rounded bg-slate-200 px-1.5 py-0.5 font-mono text-fluid-2xs text-slate-700">
                    {value}
                  </span>
                  표시 문구
                </label>
                <input
                  type="text"
                  className="mt-1 w-full rounded border border-gray-300 px-2 py-2 text-fluid-sm"
                  value={timeSlotLabels[value]}
                  onChange={(e) => setTimeSlotLabels((prev) => ({ ...prev, [value]: e.target.value }))}
                  placeholder={DEFAULT_ORDER_TIME_SLOT_LABELS[value]}
                />
              </div>
            ))}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() =>
                  saveMsgPartial('timeSlotLabels', {
                    timeSlotLabelsJson: {
                      오전: timeSlotLabels.오전,
                      오후: timeSlotLabels.오후,
                      사이청소: timeSlotLabels.사이청소,
                      조율: timeSlotLabels.조율,
                    },
                  })
                }
                disabled={msgSavingKey !== null}
                className={BTN_SAVE}
              >
                {msgSavingKey === 'timeSlotLabels' ? '저장 중…' : '표시 문구 저장'}
              </button>
            </div>
          </div>
        </details>
        <p className="text-fluid-xs font-medium text-slate-800">시간대 확인 모달 — 본문</p>
        <OrderFormModalTextEditor
          label=""
          minHeightClassName="min-h-[140px]"
          value={withDefaultText(msgConfig.timeSlotAckBody, 'timeSlotAckBody')}
          onChange={(next) => setMsgConfig((c) => ({ ...c, timeSlotAckBody: next }))}
          onSave={(markup) => saveMsgPartial('timeSlotAckBody', { timeSlotAckBody: markup || undefined })}
          saving={msgSavingKey === 'timeSlotAckBody'}
        />
        <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50/60 p-3">
          <p className="text-fluid-xs font-semibold text-amber-950">청소날짜를 모두 고르면 뜨는 확인 모달</p>
          <OrderFormModalTextEditor
            label=""
            minHeightClassName="min-h-[120px]"
            value={withDefaultText(msgConfig.serviceDateAckBody, 'serviceDateAckBody')}
            onChange={(next) => setMsgConfig((c) => ({ ...c, serviceDateAckBody: next }))}
            onSave={(markup) =>
              saveMsgPartial('serviceDateAckBody', { serviceDateAckBody: markup || undefined })
            }
            saving={msgSavingKey === 'serviceDateAckBody'}
          />
        </div>
      </section>
    </div>
  );
}

export function OrderFormSettingsPricePanel(props: {
  configForm: { pricePerPyeong: string; minimumTotalAmount: string; depositAmount: string };
  setConfigForm: Dispatch<
    SetStateAction<{ pricePerPyeong: string; minimumTotalAmount: string; depositAmount: string }>
  >;
  configSaving: boolean;
  onSaveEstimate: () => void;
  msgConfig: FormMessagesState;
  setMsgConfig: Dispatch<SetStateAction<FormMessagesState>>;
  msgSavingKey: string | null;
  onSaveMsg: () => void;
  options: EstimateOption[];
  newOptionName: string;
  setNewOptionName: (v: string) => void;
  newOptionAmount: string;
  setNewOptionAmount: (v: string) => void;
  onAddOption: () => void;
  onToggleOption: (opt: EstimateOption) => void;
  onDeleteOption: (opt: EstimateOption) => void;
}) {
  const {
    configForm,
    setConfigForm,
    configSaving,
    onSaveEstimate,
    msgConfig,
    setMsgConfig,
    msgSavingKey,
    onSaveMsg,
    options,
    newOptionName,
    setNewOptionName,
    newOptionAmount,
    setNewOptionAmount,
    onAddOption,
    onToggleOption,
    onDeleteOption,
  } = props;

  return (
    <div className="space-y-5">
      <section>
        <h4 className="mb-2 text-fluid-xs font-semibold text-slate-800">견적 기본</h4>
        <p className="mb-2 text-fluid-2xs text-slate-500">
          왼쪽 금액은 {DEMO_PYEONG}평·추가 옵션·예약금으로 미리보기 발주서와 맞춥니다.
        </p>
        <div className="grid max-w-md grid-cols-2 gap-3">
          <div>
            <label className="block text-fluid-xs text-gray-600">평당 금액 (원)</label>
            <input
              type="number"
              className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-fluid-sm"
              value={configForm.pricePerPyeong}
              onChange={(e) => setConfigForm((f) => ({ ...f, pricePerPyeong: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-fluid-xs text-gray-600">최소 금액 (원)</label>
            <input
              type="number"
              min={0}
              className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-fluid-sm"
              value={configForm.minimumTotalAmount}
              onChange={(e) => setConfigForm((f) => ({ ...f, minimumTotalAmount: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-fluid-xs text-gray-600">예약금 (원)</label>
            <input
              type="number"
              className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-fluid-sm"
              value={configForm.depositAmount}
              onChange={(e) => setConfigForm((f) => ({ ...f, depositAmount: e.target.value }))}
            />
          </div>
        </div>
        <button type="button" onClick={onSaveEstimate} disabled={configSaving} className={`${BTN_SAVE} mt-3`}>
          {configSaving ? '저장 중…' : '견적 저장'}
        </button>
      </section>
      <section>
        <h4 className="mb-2 text-fluid-xs font-semibold text-slate-800">금액 옆 라벨</h4>
        <textarea
          rows={3}
          className={`max-w-md ${MSG_TEXTAREA_CLS} min-h-[4rem]`}
          value={msgConfig.priceLabel ?? ''}
          onChange={(e) => setMsgConfig((c) => ({ ...c, priceLabel: e.target.value }))}
          placeholder={ORDER_FORM_CONFIG_DEFAULTS.priceLabel}
        />
        <button type="button" onClick={onSaveMsg} disabled={msgSavingKey !== null} className={`${BTN_GHOST} mt-2`}>
          문구 저장
        </button>
      </section>
      <section>
        <h4 className="mb-2 text-fluid-xs font-semibold text-slate-800">추가 옵션 (금액에 합산)</h4>
        <div className="mb-2 flex flex-wrap gap-2">
          <input
            type="text"
            className="min-w-[8rem] flex-1 rounded border border-gray-300 px-2 py-1.5 text-fluid-xs"
            placeholder="옵션명"
            value={newOptionName}
            onChange={(e) => setNewOptionName(e.target.value)}
          />
          <input
            type="number"
            className="w-24 rounded border border-gray-300 px-2 py-1.5 text-fluid-xs"
            placeholder="추가금"
            value={newOptionAmount}
            onChange={(e) => setNewOptionAmount(e.target.value)}
          />
          <button
            type="button"
            onClick={onAddOption}
            className="rounded-lg bg-slate-700 px-2 py-1.5 text-fluid-xs text-white hover:bg-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
          >
            추가
          </button>
        </div>
        <ul className="max-w-lg space-y-1">
          {options.map((opt) => (
            <li
              key={opt.id}
              className="flex items-center justify-between gap-2 border-b border-gray-100 py-1.5 text-fluid-xs last:border-0"
            >
              <span className={opt.isActive ? '' : 'text-gray-400 line-through'}>
                {opt.name} {opt.extraAmount > 0 ? `+${opt.extraAmount.toLocaleString('ko-KR')}원` : ''}
              </span>
              <span className="flex shrink-0 gap-1">
                <button
                  type="button"
                  className="rounded px-1 text-slate-700 underline hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                  onClick={() => onToggleOption(opt)}
                >
                  {opt.isActive ? '끄기' : '켜기'}
                </button>
                <button
                  type="button"
                  className="rounded px-1 text-red-600 underline hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
                  onClick={() => onDeleteOption(opt)}
                >
                  삭제
                </button>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
