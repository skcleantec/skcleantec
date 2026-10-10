import { useEffect } from 'react';
import { applyOneRoomToSpecialNotes } from '../../../../utils/orderFormOneRoom';
import {
  configuredTimeDetailsForOrder,
  getPreferredTimeDetailSelectOptions,
} from '../../../../constants/orderFormPreferredTimeDetail';
import { isOrderTimeSlotValue, resolvePreferredTimeSlotForDetail } from '@shared/orderFormTimeSlotLabels';
import { YmdSelect } from '../../../ui/DateQuerySelects';
import { kstTodayYmd } from '../../../../utils/dateFormat';
import { normalizeOrderFormYmd } from '@shared/orderFormMoveInTiming';
import { ORDER_FORM_SPACE_COUNT_FIELDS, ORDER_FORM_SPACE_COUNT_HINT } from '@shared/orderFormSpaceCounts';
import { isOrderFormSpaceCountLocked } from '../../../../pages/order/orderFormFieldVisibility';
import {
  AREA_BASIS_COST_WARNING,
  ORDER_FORM_PREFERRED_DATE_PENALTY_NOTICE,
} from '../../../../pages/order/orderFormModel.types';
import { WizardChipGrid, WizardChoiceChip, WizardQuestion, WIZARD_INPUT_CLS } from '../wizardUi';
import type { CustomerStepBodyProps } from '../customerStepTypes';

export function PropertyStep({
  form,
  setForm,
  lockKey,
  step,
  propertyTypeOptions,
  oneRoomLabel,
  goNext,
}: CustomerStepBodyProps) {
  const typeChosen =
    !form.isOneRoom && propertyTypeOptions.some((o) => o.value === form.propertyType);
  const typeLocked = lockKey('propertyType') && typeChosen;
  const oneLocked = lockKey('isOneRoom') && form.isOneRoom;
  const selectType = (value: string) => {
    if (typeLocked && value !== form.propertyType) return;
    setForm((f) => ({
      ...f,
      propertyType: value,
      isOneRoom: false,
      specialNotes: applyOneRoomToSpecialNotes(f.specialNotes, false),
    }));
    window.setTimeout(goNext, 220);
  };
  const selectOneRoom = () => {
    if (oneLocked && form.isOneRoom) {
      window.setTimeout(goNext, 220);
      return;
    }
    if (oneLocked) return;
    setForm((f) => ({
      ...f,
      isOneRoom: true,
      propertyType: '',
      specialNotes: applyOneRoomToSpecialNotes(f.specialNotes, true),
    }));
    window.setTimeout(goNext, 220);
  };
  return (
    <WizardQuestion title={step.title} hint={step.hint}>
      <WizardChipGrid>
        {propertyTypeOptions.map((o) => {
          const selected = form.propertyType === o.value && !form.isOneRoom;
          return (
            <WizardChoiceChip
              key={o.value}
              selected={selected}
              disabled={typeLocked && !selected}
              onSelect={() => selectType(o.value)}
            >
              {o.label}
            </WizardChoiceChip>
          );
        })}
        <WizardChoiceChip
          selected={form.isOneRoom}
          disabled={oneLocked && !form.isOneRoom}
          onSelect={selectOneRoom}
        >
          {oneRoomLabel}
        </WizardChoiceChip>
      </WizardChipGrid>
    </WizardQuestion>
  );
}

export function BuildingStep({ form, setForm, lockKey, step, buildingTypeOptions, goNext }: CustomerStepBodyProps) {
  return (
    <WizardQuestion title={step.title} hint={step.hint}>
      <WizardChipGrid>
        {buildingTypeOptions.map((o) => (
          <WizardChoiceChip
            key={o.value}
            selected={form.buildingType === o.value}
            disabled={lockKey('buildingType')}
            onSelect={() => {
              setForm((f) => ({ ...f, buildingType: o.value }));
              window.setTimeout(goNext, 220);
            }}
          >
            {o.label}
          </WizardChoiceChip>
        ))}
      </WizardChipGrid>
    </WizardQuestion>
  );
}

export function TimeStep({
  form,
  handleCustomerPreferredTimeChange,
  lockKey,
  order,
  step,
  timeSlotOptions,
  timeSlotLabels,
  goNext,
}: CustomerStepBodyProps) {
  const timeLocked =
    lockKey('preferredTime') ||
    Boolean(order?.preferredTime?.trim() && isOrderTimeSlotValue(order.preferredTime.trim()));
  const selectedSlot = resolvePreferredTimeSlotForDetail(form.preferredTime, timeSlotLabels);
  return (
    <WizardQuestion title={step.title} hint={step.hint}>
      <div className="order-wizard-chip-grid grid grid-cols-1 gap-2.5">
        {timeSlotOptions.map((o) => (
          <WizardChoiceChip
            key={o.value}
            selected={
              form.preferredTime === o.value ||
              (selectedSlot != null &&
                resolvePreferredTimeSlotForDetail(o.value, timeSlotLabels) === selectedSlot)
            }
            disabled={timeLocked}
            onSelect={() => {
              const already =
                form.preferredTime === o.value ||
                (selectedSlot != null &&
                  resolvePreferredTimeSlotForDetail(o.value, timeSlotLabels) === selectedSlot);
              handleCustomerPreferredTimeChange(o.value);
              if (already) window.setTimeout(goNext, 220);
            }}
          >
            {o.label}
          </WizardChoiceChip>
        ))}
      </div>
    </WizardQuestion>
  );
}

export function TimeDetailStep({ form, setForm, lockKey, step, goNext, order, timeSlotLabels }: CustomerStepBodyProps) {
  const configured = configuredTimeDetailsForOrder(order, form.preferredTime);
  const options = getPreferredTimeDetailSelectOptions(form.preferredTime, timeSlotLabels, configured);
  const slot = resolvePreferredTimeSlotForDetail(form.preferredTime, timeSlotLabels);
  return (
    <WizardQuestion title={step.title} hint={step.hint}>
      {options.length === 0 ? (
        <p className="text-sm text-gray-600 leading-relaxed">
          {slot === '조율'
            ? '조율은 구체적 시각을 고르지 않아도 됩니다.'
            : '먼저 시간대를 선택하면 시각이 나타납니다.'}
        </p>
      ) : null}
      <div className="order-wizard-chip-grid grid grid-cols-2 gap-2.5">
        {options.map((o) => (
          <WizardChoiceChip
            key={o.value}
            selected={form.preferredTimeDetail === o.value}
            disabled={lockKey('preferredTimeDetail')}
            onSelect={() => {
              setForm((f) => ({ ...f, preferredTimeDetail: o.value }));
              window.setTimeout(goNext, 220);
            }}
          >
            {o.label}
          </WizardChoiceChip>
        ))}
      </div>
    </WizardQuestion>
  );
}

export function DateStep({
  form,
  setForm,
  handleCustomerPreferredDateChange,
  lockKey,
  order,
  step,
}: CustomerStepBodyProps) {
  const todayYmd = kstTodayYmd();
  const prefillRaw = order?.prefillAnswers?.preferredDate;
  const counselorDate =
    normalizeOrderFormYmd(typeof prefillRaw === 'string' ? prefillRaw : '') ||
    normalizeOrderFormYmd(order?.preferredDate);
  const formDate = normalizeOrderFormYmd(form.preferredDate);
  const counselorLocked = lockKey('preferredDate') || Boolean(normalizeOrderFormYmd(order?.preferredDate));
  const dateIsUsable = Boolean(formDate) && formDate >= todayYmd;
  const dateLocked = counselorLocked && dateIsUsable;
  useEffect(() => {
    if (formDate || !counselorDate || counselorDate < todayYmd) return;
    setForm((f) => {
      if (normalizeOrderFormYmd(f.preferredDate)) return f;
      return { ...f, preferredDate: counselorDate };
    });
  }, [counselorDate, formDate, setForm, todayYmd]);
  useEffect(() => {
    if (dateLocked) return;
    const raw = normalizeOrderFormYmd(form.preferredDate);
    if (raw && raw < todayYmd) handleCustomerPreferredDateChange('');
  }, [dateLocked, form.preferredDate, handleCustomerPreferredDateChange, todayYmd]);
  const value = dateLocked ? formDate : formDate && formDate < todayYmd ? '' : formDate;
  return (
    <WizardQuestion title={step.title} hint={step.hint}>
      <YmdSelect
        idPrefix="order-wizard-preferredDate"
        value={value}
        onChange={handleCustomerPreferredDateChange}
        className="w-full"
        minYmd={todayYmd}
        allowEmpty
        emitOnCompleteOnly
        disabled={dateLocked}
      />
      <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-fluid-2xs font-medium leading-relaxed text-amber-950">
        {ORDER_FORM_PREFERRED_DATE_PENALTY_NOTICE}
      </p>
    </WizardQuestion>
  );
}

export function AreaStep({
  form,
  setForm,
  lockKey,
  step,
  requestAreaBasisSelection,
}: CustomerStepBodyProps) {
  return (
    <WizardQuestion title={step.title} hint={step.hint}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2.5">
          {(['공급', '전용'] as const).map((basis) => (
            <WizardChoiceChip
              key={basis}
              selected={form.areaBasis === basis}
              disabled={lockKey('areaBasis')}
              onSelect={() => requestAreaBasisSelection(basis)}
            >
              {basis === '공급' ? '공급면적' : '전용면적'}
            </WizardChoiceChip>
          ))}
        </div>
        <div>
          <label className="mb-1.5 block text-fluid-xs font-medium text-slate-600" htmlFor="order-wizard-area">
            평수
          </label>
          <input
            id="order-wizard-area"
            inputMode="decimal"
            className={WIZARD_INPUT_CLS}
            value={form.areaPyeong}
            disabled={lockKey('areaPyeong') || !form.areaBasis}
            onChange={(e) => setForm((f) => ({ ...f, areaPyeong: e.target.value }))}
            placeholder="예: 32"
          />
        </div>
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-fluid-2xs font-medium text-amber-950">
          {AREA_BASIS_COST_WARNING}
        </p>
      </div>
    </WizardQuestion>
  );
}

export function RoomsStep({ form, setForm, order, step }: CustomerStepBodyProps) {
  return (
    <WizardQuestion title={step.title} hint={step.hint ?? ORDER_FORM_SPACE_COUNT_HINT}>
      <div className="grid grid-cols-2 gap-3">
        {ORDER_FORM_SPACE_COUNT_FIELDS.map(({ key, label }) => {
          const locked = isOrderFormSpaceCountLocked(false, order?.prefillAnswers, key);
          return (
            <div key={key}>
              <label
                className="mb-1.5 block text-fluid-xs font-medium text-slate-600"
                htmlFor={`order-field-${key}`}
              >
                {label}
              </label>
              <input
                id={`order-field-${key}`}
                inputMode="numeric"
                className={WIZARD_INPUT_CLS}
                value={form[key]}
                disabled={locked}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                placeholder="0"
              />
            </div>
          );
        })}
      </div>
    </WizardQuestion>
  );
}
