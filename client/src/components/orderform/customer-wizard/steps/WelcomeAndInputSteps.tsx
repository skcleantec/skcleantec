import { isOrderFormEmailFieldLocked, isStdFieldOn } from '../../../../pages/order/orderFormFieldVisibility';
import { OrderFormEmailSplitField } from '../../OrderFormEmailSplitField';
import { OrderFormCleaningKindPicker } from '../../OrderFormCleaningKindPicker';
import { WIZARD_INPUT_CLS, WizardQuestion } from '../wizardUi';
import type { CustomerStepBodyProps } from '../customerStepTypes';

export function WelcomeStep({
  title,
  hint,
  brandName,
  form,
  setForm,
  lockKey,
  choices,
  lines,
}: {
  title: string;
  hint?: string;
  brandName?: string | null;
  form: CustomerStepBodyProps['form'];
  setForm: CustomerStepBodyProps['setForm'];
  lockKey: CustomerStepBodyProps['lockKey'];
  choices?: CustomerStepBodyProps['step']['choices'];
  lines?: CustomerStepBodyProps['step']['lines'];
}) {
  return (
    <WizardQuestion title={title} hint={hint}>
      {brandName ? (
        <p className="rounded-2xl border border-slate-100 bg-white px-4 py-3 text-fluid-sm text-slate-600 shadow-sm">
          <span className="font-semibold text-slate-900">{brandName}</span>에서 예약 내용을 확인합니다.
        </p>
      ) : null}
      <OrderFormCleaningKindPicker
        value={form.cleaningKind}
        options={choices}
        confirmLabel={lines?.find((line) => line.key === 'confirm')?.text.trim() || '확인'}
        disabled={lockKey('cleaningKind')}
        onChange={(cleaningKind) => setForm((f) => ({ ...f, cleaningKind }))}
      />
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
            {step.lines?.find((line) => line.key === 'phone2Label')?.text.trim() || '보조 연락처 (필수) *'}
          </label>
          <input
            id="order-wizard-phone2"
            type="tel"
            inputMode="tel"
            className={WIZARD_INPUT_CLS}
            value={form.customerPhoneSecondary}
            disabled={lockKey('customerPhone2')}
            onChange={(e) => setForm((f) => ({ ...f, customerPhoneSecondary: e.target.value }))}
            placeholder={step.lines?.find((line) => line.key === 'phone2Placeholder')?.text.trim() || '예: 배우자, 가족 연락처'}
            required
          />
        </div>
      </div>
    </WizardQuestion>
  );
}

export function EmailStep({ form, setForm, order, step }: CustomerStepBodyProps) {
  const emailLocked = isOrderFormEmailFieldLocked(false, order?.prefillAnswers);
  return (
    <WizardQuestion title={step.title} hint={step.hint}>
      <OrderFormEmailSplitField
        value={form.customerEmail}
        disabled={emailLocked || form.customerEmailUnused}
        onChange={(v) => setForm((f) => ({ ...f, customerEmail: v, customerEmailUnused: false }))}
        inputClassName={WIZARD_INPUT_CLS}
      />
      {emailLocked ? null : (
        <label className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-fluid-sm text-slate-800 hover:bg-slate-50 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-slate-400 has-[:focus-visible]:ring-offset-2">
          <input
            type="checkbox"
            className="size-4 shrink-0 accent-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
            checked={form.customerEmailUnused}
            onChange={(e) => {
              const unused = e.target.checked;
              setForm((f) => ({
                ...f,
                customerEmailUnused: unused,
                customerEmail: unused ? '' : f.customerEmail,
              }));
            }}
          />
          이메일 미사용
        </label>
      )}
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
