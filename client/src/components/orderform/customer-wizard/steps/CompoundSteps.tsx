import { AddressSearch } from '../../../forms/AddressSearch';
import { MoveInTimingFieldGroup } from '../../MoveInTimingFieldGroup';
import { OrderFormPhotoSection } from '../../OrderFormPhotoSection';
import { OrderFormAcUnitsField } from '../../OrderFormAcUnitsField';
import { ProfOptionLeafControl } from '../../ProfOptionLeafControl';
import { ProfOptionSelectionSummary } from '../../ProfOptionSelectionSummary';
import { OrderFormConsentStamp } from '../../OrderFormConsentUi';
import {
  collectSubtreeOptionIds,
  computeProfSelectionSummary,
  isSelectableProfOption,
  listProfChildren,
  listProfRootNodes,
} from '../../../../constants/professionalSpecialtyOptions';
import { ORDER_FORM_AC_UNITS_FIELD_KEY } from '@shared/orderFormAcUnits';
import type { MoveInTiming } from '@shared/orderFormMoveInTiming';
import { kstTodayYmd } from '../../../../utils/dateFormat';
import { formatDateCompactWithWeekday } from '../../../../utils/dateFormat';
import { formatInquiryAreaKoLine } from '../../../../utils/inquiryAreaDisplay';
import { labelForTimeSlot } from '../../../../constants/orderFormSchedule';
import { WIZARD_CTA_CLS, WIZARD_INPUT_CLS, WIZARD_SECONDARY_CLS, WizardQuestion } from '../wizardUi';
import type { CustomerStepBodyProps } from '../customerStepTypes';
import type { OrderFormCustomerStepId } from '../orderFormCustomerSteps';

export function AddressStep({
  form,
  setForm,
  lockKey,
  step,
  addressConfirmedViaSearch,
  setAddressConfirmedViaSearch,
  addressFieldLocked,
}: CustomerStepBodyProps) {
  const detailDisabled = lockKey('addressDetail') || (!addressConfirmedViaSearch && !addressFieldLocked);
  return (
    <WizardQuestion title={step.title} hint={step.hint}>
      {addressFieldLocked ? (
        <p className="mb-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-fluid-sm text-slate-700">
          {form.address}
        </p>
      ) : (
        <AddressSearch
          value={form.address}
          onChange={(addr) => {
            setAddressConfirmedViaSearch(true);
            setForm((f) => ({ ...f, address: addr }));
          }}
          placeholder="주소 검색"
          className="mb-3"
          mobilePreferred
        />
      )}
      {!addressFieldLocked && form.address.trim() && !addressConfirmedViaSearch ? (
        <p className="mb-3 text-fluid-2xs text-amber-800">
          「주소 검색」 버튼으로 다시 선택해야 합니다.
        </p>
      ) : null}
      <label className="mb-1.5 block text-fluid-xs font-medium text-slate-600" htmlFor="order-field-addressDetail">
        상세주소
      </label>
      <input
        id="order-field-addressDetail"
        className={WIZARD_INPUT_CLS}
        value={form.addressDetail}
        disabled={detailDisabled}
        onChange={(e) => setForm((f) => ({ ...f, addressDetail: e.target.value }))}
        placeholder={detailDisabled ? '먼저 주소를 검색해 주세요' : '동·호수, 층, 상호 등'}
        autoComplete="address-line2"
      />
    </WizardQuestion>
  );
}

export function MoveInStep({ form, setForm, lockKey, step }: CustomerStepBodyProps) {
  return (
    <WizardQuestion title={step.title} hint={step.hint}>
      <MoveInTimingFieldGroup
        idPrefix="order-wizard-movein"
        moveInTiming={form.moveInTiming}
        moveInDate={form.moveInDate}
        moveInDateUndecided={form.moveInDateUndecided}
        minYmd={kstTodayYmd()}
        fieldsLocked={lockKey('moveInDate') || lockKey('moveInDateUndecided')}
        timingLocked={lockKey('moveInTiming')}
        dateInputClassName={WIZARD_INPUT_CLS}
        onTimingChange={(timing: MoveInTiming) =>
          setForm((f) => ({
            ...f,
            moveInTiming: timing,
            ...(timing === 'NOT_APPLICABLE'
              ? { moveInDate: '', moveInDateUndecided: false }
              : timing === 'SAME_DAY'
                ? { moveInDateUndecided: false }
                : {}),
          }))
        }
        onDateChange={(ymd) => setForm((f) => ({ ...f, moveInDate: ymd }))}
        onUndecidedChange={(checked) =>
          setForm((f) => ({ ...f, moveInDateUndecided: checked, moveInDate: checked ? '' : f.moveInDate }))
        }
      />
    </WizardQuestion>
  );
}

export function CustomFieldStep({ step, customAnswers, setCustomAnswers, lockKey }: CustomerStepBodyProps) {
  const cf = step.customField;
  if (!cf) return null;
  const opts = Array.isArray(cf.options) ? (cf.options as unknown[]).map((o) => String(o)) : [];
  const value = customAnswers[cf.fieldKey];
  const setVal = (v: unknown) => setCustomAnswers((prev) => ({ ...prev, [cf.fieldKey]: v }));
  const cfLocked = lockKey(cf.fieldKey);
  return (
    <WizardQuestion title={step.title} hint={step.hint}>
      {cf.fieldKey === ORDER_FORM_AC_UNITS_FIELD_KEY ? (
        <OrderFormAcUnitsField
          value={value}
          onChange={(rows) => setVal(rows)}
          options={opts}
          disabled={cfLocked}
          inputCls={WIZARD_INPUT_CLS}
          lockedInputCls="bg-slate-100 text-slate-500"
        />
      ) : cf.inputType === 'TEXTAREA' ? (
        <textarea
          className={`${WIZARD_INPUT_CLS} min-h-[120px]`}
          placeholder={cf.placeholder?.trim() || undefined}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => setVal(e.target.value)}
          disabled={cfLocked}
        />
      ) : cf.inputType === 'SELECT' || cf.inputType === 'MULTISELECT' || cf.inputType === 'CHECKBOX' ? (
        <div className="space-y-2">
          {opts.map((o) => {
            const multi = cf.inputType === 'MULTISELECT' || cf.inputType === 'CHECKBOX';
            const arr = Array.isArray(value) ? (value as string[]) : [];
            const checked = multi ? arr.includes(o) : value === o;
            return (
              <label
                key={o}
                className="flex min-h-[52px] items-center gap-3 rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-fluid-sm text-slate-900"
              >
                <input
                  type={multi ? 'checkbox' : 'radio'}
                  name={`wiz-cf-${cf.fieldKey}`}
                  className="h-5 w-5 border-slate-300"
                  checked={checked}
                  disabled={cfLocked}
                  onChange={() => {
                    if (multi) {
                      setVal(checked ? arr.filter((x) => x !== o) : [...arr, o]);
                    } else {
                      setVal(o);
                    }
                  }}
                />
                {o}
              </label>
            );
          })}
        </div>
      ) : (
        <input
          type={cf.inputType === 'DATE' ? 'date' : cf.inputType === 'NUMBER' || cf.inputType === 'MONEY' ? 'number' : cf.inputType === 'PHONE' ? 'tel' : 'text'}
          inputMode={cf.inputType === 'NUMBER' || cf.inputType === 'MONEY' ? 'numeric' : cf.inputType === 'PHONE' ? 'tel' : undefined}
          className={WIZARD_INPUT_CLS}
          value={typeof value === 'string' ? value : value == null ? '' : String(value)}
          onChange={(e) => setVal(e.target.value)}
          disabled={cfLocked}
        />
      )}
    </WizardQuestion>
  );
}

export function PhotosStep({ token, submitting, step }: CustomerStepBodyProps) {
  return (
    <WizardQuestion title={step.title} hint={step.hint}>
      {token ? <OrderFormPhotoSection token={token} disabled={submitting} /> : null}
    </WizardQuestion>
  );
}

export function ProfessionalStep({
  step,
  professionalOptions,
  profSelections,
  toggleProfOption,
  setProfQuantity,
  setProfUnitAmount,
  profCatOpen,
  setProfCatOpen,
  removeProfInSubtree,
}: CustomerStepBodyProps) {
  const roots = listProfRootNodes(professionalOptions);
  const summary = computeProfSelectionSummary(profSelections, professionalOptions);
  return (
    <WizardQuestion title={step.title} hint={step.hint}>
      <div className="space-y-2.5">
        {professionalOptions.length === 0 ? (
          <p className="text-fluid-sm text-slate-500">등록된 추가 작업이 없습니다.</p>
        ) : (
          roots.map((root) => {
            const kids = listProfChildren(professionalOptions, root.id).filter((c) => c.isActive);
            const showAsSection = root.isGroup || kids.length > 0;
            if (showAsSection) {
              if (!root.isActive || kids.length === 0) return null;
              const subtree = collectSubtreeOptionIds(professionalOptions, root.id);
              const catOpen = profCatOpen[root.id] ?? false;
              return (
                <div key={root.id} className="space-y-1.5 rounded-2xl border border-slate-100 bg-white p-3">
                  <label className="flex items-start gap-2.5 text-fluid-sm text-slate-800">
                    <input
                      type="checkbox"
                      checked={catOpen}
                      onChange={(e) => {
                        const on = e.target.checked;
                        setProfCatOpen((p) => ({ ...p, [root.id]: on }));
                        if (!on) removeProfInSubtree(subtree);
                      }}
                      className="mt-0.5 h-4 w-4"
                    />
                    <span>
                      {root.emoji ? <span className="mr-1">{root.emoji}</span> : null}
                      <span className="font-medium">{root.label}</span>
                    </span>
                  </label>
                  {catOpen
                    ? kids.map((o) => {
                        const sel = profSelections.find((s) => s.id === o.id);
                        if (!isSelectableProfOption(professionalOptions, o) || !o.isActive) return null;
                        return (
                          <ProfOptionLeafControl
                            key={o.id}
                            option={o}
                            checked={Boolean(sel)}
                            onToggle={() => toggleProfOption(o.id)}
                            selection={sel}
                            onQuantityChange={(q) => setProfQuantity(o.id, q)}
                            onUnitAmountChange={(raw) => setProfUnitAmount(o.id, raw)}
                            amountEditable={false}
                          />
                        );
                      })
                    : null}
                </div>
              );
            }
            if (!root.isActive || !isSelectableProfOption(professionalOptions, root)) return null;
            const sel = profSelections.find((s) => s.id === root.id);
            return (
              <ProfOptionLeafControl
                key={root.id}
                option={root}
                checked={Boolean(sel)}
                onToggle={() => toggleProfOption(root.id)}
                selection={sel}
                onQuantityChange={(q) => setProfQuantity(root.id, q)}
                onUnitAmountChange={(raw) => setProfUnitAmount(root.id, raw)}
                amountEditable={false}
              />
            );
          })
        )}
        {summary.rows.length > 0 ? (
          <div className="border-t border-slate-100 pt-3">
            <ProfOptionSelectionSummary rows={summary.rows} sum={summary.sum} className="text-fluid-sm text-slate-700" />
          </div>
        ) : null}
      </div>
    </WizardQuestion>
  );
}

function ReviewRow({
  label,
  value,
  onEdit,
}: {
  label: string;
  value: string;
  onEdit?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onEdit}
      disabled={!onEdit}
      className="flex w-full items-start justify-between gap-3 rounded-xl border border-slate-100 bg-white px-3 py-2.5 text-left hover:bg-slate-50 disabled:pointer-events-none"
    >
      <span className="shrink-0 text-fluid-2xs font-medium text-slate-500">{label}</span>
      <span className="min-w-0 text-right text-fluid-sm font-medium text-slate-900">{value || '—'}</span>
    </button>
  );
}

export function ReviewStep({
  step,
  form,
  order,
  customAnswers,
  visibleCustomFields,
  goTo,
  timeSlotLabels,
}: CustomerStepBodyProps) {
  const jump = (id: OrderFormCustomerStepId) => () => goTo(id);
  const areaLine =
    form.areaBasis && form.areaPyeong
      ? formatInquiryAreaKoLine({
          areaBasis: form.areaBasis,
          areaPyeong: Number(form.areaPyeong),
        })
      : '';
  return (
    <WizardQuestion title={step.title} hint={step.hint}>
      <div className="space-y-1.5">
        <ReviewRow label="성함" value={form.customerName} onEdit={jump('name')} />
        <ReviewRow
          label="주소"
          value={[form.address, form.addressDetail].filter(Boolean).join(' ')}
          onEdit={jump('address')}
        />
        <ReviewRow label="전화" value={form.customerPhone} onEdit={jump('phones')} />
        {form.customerEmail ? <ReviewRow label="이메일" value={form.customerEmail} onEdit={jump('email')} /> : null}
        <ReviewRow
          label="공간"
          value={form.isOneRoom ? '원룸' : form.propertyType}
          onEdit={jump('property')}
        />
        {areaLine ? <ReviewRow label="면적" value={areaLine} onEdit={jump('area')} /> : null}
        <ReviewRow
          label="희망일"
          value={form.preferredDate ? formatDateCompactWithWeekday(form.preferredDate) : ''}
          onEdit={jump('date')}
        />
        <ReviewRow
          label="시간"
          value={[labelForTimeSlot(form.preferredTime, timeSlotLabels), form.preferredTimeDetail]
            .filter(Boolean)
            .join(' · ')}
          onEdit={jump('time')}
        />
        <ReviewRow
          label="방·화장실·베란다·주방"
          value={[
            form.roomCount !== '' ? `방 ${form.roomCount}` : '',
            form.bathroomCount !== '' ? `화장실 ${form.bathroomCount}` : '',
            form.balconyCount !== '' ? `베란다 ${form.balconyCount}` : '',
            form.kitchenCount !== '' ? `주방 ${form.kitchenCount}` : '',
          ]
            .filter(Boolean)
            .join(' · ')}
          onEdit={jump('rooms')}
        />
        <ReviewRow label="건물" value={form.buildingType} onEdit={jump('building')} />
        <ReviewRow
          label="입주"
          value={
            form.moveInDateUndecided
              ? '미정'
              : [form.moveInTiming, form.moveInDate].filter(Boolean).join(' · ')
          }
          onEdit={jump('moveIn')}
        />
        {form.specialNotes ? <ReviewRow label="메모" value={form.specialNotes} onEdit={jump('notes')} /> : null}
        {visibleCustomFields.map((cf) => {
          const v = customAnswers[cf.fieldKey];
          const text = Array.isArray(v) ? v.join(', ') : v == null ? '' : String(v);
          return (
            <ReviewRow
              key={cf.fieldKey}
              label={cf.label}
              value={text}
              onEdit={jump(`custom:${cf.fieldKey}`)}
            />
          );
        })}
        {order?.totalAmount ? (
          <p className="pt-2 text-center text-fluid-xs text-slate-500">
            견적 금액은 상담 내용 기준으로 안내됩니다.
          </p>
        ) : null}
      </div>
    </WizardQuestion>
  );
}

export function GuideStep({
  step,
  guideTermsAt,
  setGuideAgreeModalOpen,
  agreeLinkLabel,
}: CustomerStepBodyProps) {
  return (
    <WizardQuestion title={step.title} hint={step.hint}>
      {guideTermsAt ? (
        <div className="space-y-3">
          <OrderFormConsentStamp kind="guideTerms" agreedAt={guideTermsAt} className="text-left" />
          <button type="button" className={WIZARD_SECONDARY_CLS} onClick={() => setGuideAgreeModalOpen(true)}>
            안내사항 다시 보기
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <p
            className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-fluid-xs font-medium leading-relaxed text-amber-950"
            role="status"
          >
            안내사항을 읽어주셔야 제출하기가 완료됩니다.
          </p>
          <button type="button" className={WIZARD_CTA_CLS} onClick={() => setGuideAgreeModalOpen(true)}>
            {agreeLinkLabel} (자세히 보기)
          </button>
        </div>
      )}
    </WizardQuestion>
  );
}
