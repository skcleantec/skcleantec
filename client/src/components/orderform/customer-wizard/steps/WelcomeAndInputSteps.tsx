import { isStdFieldOn } from '../../../../pages/order/orderFormFieldVisibility';
import { OrderFormEmailSplitField } from '../../OrderFormEmailSplitField';
import { WIZARD_CTA_CLS, WIZARD_INPUT_CLS, WizardQuestion } from '../wizardUi';
import type { CustomerStepBodyProps } from '../customerStepTypes';

export function WelcomeStep({
  title,
  hint,
  brandName,
  onStart,
}: {
  title: string;
  hint?: string;
  brandName?: string | null;
  onStart: () => void;
}) {
  return (
    <WizardQuestion title={title} hint={hint}>
      {brandName ? (
        <p className="rounded-2xl border border-slate-100 bg-white px-4 py-3 text-fluid-sm text-slate-600 shadow-sm">
          <span className="font-semibold text-slate-900">{brandName}</span>에서 예약 내용을 확인합니다.
        </p>
      ) : null}
      <button type="button" className={WIZARD_CTA_CLS} onClick={onStart}>
        시작하기
      </button>
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
        disabled={lockKey('customerName')}
        onChange={(e) => setForm((f) => ({ ...f, customerName: e.target.value }))}
        placeholder="홍길동"
      />
    </WizardQuestion>
  );
}

export function PhonesStep({ form, setForm, lockKey, step, order }: CustomerStepBodyProps) {
  const showSecondary = isStdFieldOn(order, 'customerPhone2');
  const showPrimary = isStdFieldOn(order, 'customerPhone');
  return (
    <WizardQuestion title={step.title} hint={step.hint}>
      <div className="space-y-3">
        {showPrimary ? (
        <div>
          <label className="mb-1.5 block text-fluid-xs font-medium text-slate-600" htmlFor="order-wizard-phone">
            대표 전화
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
        {showSecondary ? (
          <div>
            <label className="mb-1.5 block text-fluid-xs font-medium text-slate-600" htmlFor="order-wizard-phone2">
              보조 전화
            </label>
            <input
              id="order-wizard-phone2"
              type="tel"
              inputMode="tel"
              className={WIZARD_INPUT_CLS}
              value={form.customerPhoneSecondary}
              disabled={lockKey('customerPhone2')}
              onChange={(e) => setForm((f) => ({ ...f, customerPhoneSecondary: e.target.value }))}
              placeholder="없으면 비워 두세요"
            />
          </div>
        ) : null}
      </div>
    </WizardQuestion>
  );
}

export function EmailStep({ form, setForm, lockKey, step }: CustomerStepBodyProps) {
  return (
    <WizardQuestion title={step.title} hint={step.hint}>
      <OrderFormEmailSplitField
        value={form.customerEmail}
        disabled={lockKey('customerEmail')}
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
