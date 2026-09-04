import { isOrderFormEmailFieldLocked, isStdFieldOn } from '../../../../pages/order/orderFormFieldVisibility';
import { OrderFormEmailSplitField } from '../../OrderFormEmailSplitField';
import { WIZARD_INPUT_CLS, WizardQuestion } from '../wizardUi';
import type { CustomerStepBodyProps } from '../customerStepTypes';

export function WelcomeStep({
  title,
  hint,
  brandName,
}: {
  title: string;
  hint?: string;
  brandName?: string | null;
}) {
  return (
    <WizardQuestion title={title} hint={hint}>
      {brandName ? (
        <p className="rounded-2xl border border-slate-100 bg-white px-4 py-3 text-fluid-sm text-slate-600 shadow-sm">
          <span className="font-semibold text-slate-900">{brandName}</span>에서 예약 내용을 확인합니다.
        </p>
      ) : null}
    </WizardQuestion>
  );
}

export function NameStep({ form, setForm, lockKey, step }: CustomerStepBodyProps) {
  return (
    <WizardQuestion title={step.title} hint={step.hint}>
      <label className="sr-only" htmlFor="order-wizard-customerName">
        성함
      </label>
      <input
        id="order-wizard-customerName"
        className={WIZARD_INPUT_CLS}
        autoComplete="name"
        value={form.customerName}
        disabled={lockKey('customerName') && Boolean(form.customerName.trim())}
        onChange={(e) => setForm((f) => ({ ...f, customerName: e.target.value }))}
        placeholder="홍길동"
      />
    </WizardQuestion>
  );
}

export function PhonesStep({ form, setForm, lockKey, step, order }: CustomerStepBodyProps) {
  const showPrimary = isStdFieldOn(order, 'customerPhone');
  return (
    <WizardQuestion title={step.title} hint={step.hint}>
      <div className="space-y-3">
        {showPrimary ? (
        <div>
          <label className="mb-1.5 block text-fluid-xs font-medium text-slate-600" htmlFor="order-wizard-phone">
            대표 전화 *
          </label>
          <input
            id="order-wizard-phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            className={WIZARD_INPUT_CLS}
            value={form.customerPhone}
            disabled={lockKey('customerPhone')}
            onChange={(e) => setForm((f) => ({ ...f, customerPhone: e.target.value }))}
            placeholder="010-0000-0000"
          />
        </div>
        ) : null}
        <div>
          <label className="mb-1.5 block text-fluid-xs font-medium text-slate-600" htmlFor="order-wizard-phone2">
            보조 연락처 (필수) *
          </label>
          <input
            id="order-wizard-phone2"
            type="tel"
            inputMode="tel"
            className={WIZARD_INPUT_CLS}
            value={form.customerPhoneSecondary}
            disabled={lockKey('customerPhone2')}
            onChange={(e) => setForm((f) => ({ ...f, customerPhoneSecondary: e.target.value }))}
            placeholder="예: 배우자, 가족 연락처"
            required
          />
        </div>
      </div>
    </WizardQuestion>
  );
}

export function EmailStep({ form, setForm, order, step }: CustomerStepBodyProps) {
  return (
    <WizardQuestion title={step.title} hint={step.hint}>
      <OrderFormEmailSplitField
        value={form.customerEmail}
        disabled={isOrderFormEmailFieldLocked(false, order?.prefillAnswers)}
        onChange={(v) => setForm((f) => ({ ...f, customerEmail: v }))}
        inputClassName={WIZARD_INPUT_CLS}
      />
    </WizardQuestion>
  );
}

export function NotesStep({ form, setForm, lockKey, step }: CustomerStepBodyProps) {
  return (
    <WizardQuestion title={step.title} hint={step.hint}>
      <textarea
        className={`${WIZARD_INPUT_CLS} min-h-[140px]`}
        value={form.specialNotes}
        disabled={lockKey('specialNotes')}
        onChange={(e) => setForm((f) => ({ ...f, specialNotes: e.target.value }))}
        placeholder="전화 상담 시 언급 내용, 층수·주택 형태 등"
      />
    </WizardQuestion>
  );
}
