import { useMemo } from 'react';
import { TenantSmtpFieldLabel } from '../TenantSmtpFieldLabel';
import { OutboundEmailAdvancedSettings } from './OutboundEmailAdvancedSettings';
import { OUTBOUND_EMAIL_COPY } from '../../../utils/outboundEmailCopy';
import {
  isGmailAppPassword,
  normalizeSmtpPasswordInput,
} from '../../../utils/outboundEmailFormHelpers';
import {
  OUTBOUND_EMAIL_PROVIDERS,
  findOutboundEmailProvider,
  type OutboundEmailProviderId,
} from '../../../utils/outboundEmailProviders';

const GOOGLE_APP_PASSWORDS_URL = 'https://myaccount.google.com/apppasswords';
const NAVER_SECURITY_URL = 'https://nid.naver.com/user2/help/myInfoV2?m=viewSecurity';

function sendEmailPlaceholderForProvider(providerId: OutboundEmailProviderId): string {
  if (providerId === 'naver') return 'your@naver.com';
  if (providerId === 'daum') return 'your@daum.net';
  return 'your@gmail.com';
}

const WIZARD_STEPS = [
  { id: 1, label: OUTBOUND_EMAIL_COPY.stepProvider },
  { id: 2, label: OUTBOUND_EMAIL_COPY.stepEmail },
  { id: 3, label: OUTBOUND_EMAIL_COPY.stepName },
  { id: 4, label: OUTBOUND_EMAIL_COPY.stepPassword },
] as const;

export type OutboundEmailSetupWizardProps = {
  providerId: OutboundEmailProviderId;
  onProviderIdChange: (id: OutboundEmailProviderId) => void;
  sendEmail: string;
  onSendEmailChange: (v: string) => void;
  displayName: string;
  onDisplayNameChange: (v: string) => void;
  smtpPassword: string;
  onSmtpPasswordChange: (v: string) => void;
  onClearSmtpPassword?: () => void;
  passwordConfigured: boolean;
  smtpHost: string;
  onSmtpHostChange: (v: string) => void;
  smtpPort: string;
  onSmtpPortChange: (v: string) => void;
  smtpSecure: boolean;
  onSmtpSecureChange: (v: boolean) => void;
  testEmailTo: string;
  onTestEmailToChange: (v: string) => void;
  testEmailPlaceholder?: string;
  /** false면 연습 수신 칸을 숨김(페이지 상단 등에서 따로 둘 때) */
  showTestEmail?: boolean;
  wizardStep: number;
  onWizardStepChange: (step: number) => void;
  showAdvanced: boolean;
  onShowAdvancedChange: (open: boolean) => void;
  compactGrid?: boolean;
  fieldErrors: Record<string, string>;
  busy?: boolean;
  onSave?: () => void;
  onSaveAndTest?: () => void;
  onTestOnly?: () => void;
  smtpReady?: boolean;
  /** tenant: 저장+연습 / platform: 저장은 부모, 연습만 */
  mode?: 'tenant' | 'platform';
};

export function OutboundEmailSetupWizard({
  providerId,
  onProviderIdChange,
  sendEmail,
  onSendEmailChange,
  displayName,
  onDisplayNameChange,
  smtpPassword,
  onSmtpPasswordChange,
  onClearSmtpPassword,
  passwordConfigured,
  smtpHost,
  onSmtpHostChange,
  smtpPort,
  onSmtpPortChange,
  smtpSecure,
  onSmtpSecureChange,
  testEmailTo,
  onTestEmailToChange,
  testEmailPlaceholder,
  showTestEmail = true,
  wizardStep,
  onWizardStepChange,
  showAdvanced,
  onShowAdvancedChange,
  compactGrid = false,
  fieldErrors,
  busy = false,
  onSave,
  onSaveAndTest,
  onTestOnly,
  smtpReady = false,
  mode = 'tenant',
}: OutboundEmailSetupWizardProps) {
  const provider = useMemo(() => findOutboundEmailProvider(providerId), [providerId]);
  const maxStep = 4;

  const goNext = () => onWizardStepChange(Math.min(maxStep, wizardStep + 1));
  const goPrev = () => onWizardStepChange(Math.max(1, wizardStep - 1));

  if (compactGrid) {
    return (
      <div className="space-y-4">
        <ProviderPicker providerId={providerId} onSelect={onProviderIdChange} />
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <TenantSmtpFieldLabel title={OUTBOUND_EMAIL_COPY.stepEmail} hint={OUTBOUND_EMAIL_COPY.sendEmailHint} />
            <input
              type="email"
              value={sendEmail}
              onChange={(e) => onSendEmailChange(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              placeholder={sendEmailPlaceholderForProvider(providerId)}
              autoComplete="off"
            />
            {fieldErrors.sendEmail ? <p className="mt-1 text-xs text-rose-700">{fieldErrors.sendEmail}</p> : null}
          </label>
          <label className="block sm:col-span-2">
            <TenantSmtpFieldLabel title={OUTBOUND_EMAIL_COPY.stepName} hint={OUTBOUND_EMAIL_COPY.displayNameHint} />
            <input
              type="text"
              value={displayName}
              onChange={(e) => onDisplayNameChange(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
            {fieldErrors.displayName ? (
              <p className="mt-1 text-xs text-rose-700">{fieldErrors.displayName}</p>
            ) : null}
          </label>
          <SmtpPasswordField
            providerId={providerId}
            smtpPassword={smtpPassword}
            onSmtpPasswordChange={onSmtpPasswordChange}
            onClearSmtpPassword={onClearSmtpPassword}
            passwordConfigured={passwordConfigured}
            fieldError={fieldErrors.smtpPassword}
            className="sm:col-span-2"
          />
        </div>
        <OutboundEmailAdvancedSettings
          open={showAdvanced}
          onToggle={() => onShowAdvancedChange(!showAdvanced)}
          smtpHost={smtpHost}
          onSmtpHostChange={onSmtpHostChange}
          smtpPort={smtpPort}
          onSmtpPortChange={onSmtpPortChange}
          smtpSecure={smtpSecure}
          onSmtpSecureChange={onSmtpSecureChange}
          fieldErrors={fieldErrors}
        />
        {showTestEmail ? (
          <TestEmailRow
            testEmailTo={testEmailTo}
            onTestEmailToChange={onTestEmailToChange}
            testEmailPlaceholder={testEmailPlaceholder}
            fieldErrors={fieldErrors}
          />
        ) : null}
        <ActionRow
          mode={mode}
          busy={busy}
          smtpReady={smtpReady}
          onSave={onSave}
          onSaveAndTest={onSaveAndTest}
          onTestOnly={onTestOnly}
          showSaveOnly
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <nav aria-label="설정 단계" className="flex flex-wrap gap-1.5">
        {WIZARD_STEPS.map((step) => {
          const active = wizardStep === step.id;
          const done = wizardStep > step.id;
          return (
            <button
              key={step.id}
              type="button"
              onClick={() => onWizardStepChange(step.id)}
              className={`rounded-full px-2.5 py-1 text-[11px] font-medium border transition-colors ${
                active
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : done
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                    : 'border-gray-200 bg-white text-gray-500'
              }`}
            >
              {step.id}. {step.label}
            </button>
          );
        })}
      </nav>

      {wizardStep === 1 ? (
        <div className="space-y-3">
          <p className="text-sm font-medium text-gray-900">{OUTBOUND_EMAIL_COPY.stepProvider}</p>
          <ProviderPicker providerId={providerId} onSelect={onProviderIdChange} />
          {providerId === 'custom' ? (
            <OutboundEmailAdvancedSettings
              open={showAdvanced}
              onToggle={() => onShowAdvancedChange(!showAdvanced)}
              smtpHost={smtpHost}
              onSmtpHostChange={onSmtpHostChange}
              smtpPort={smtpPort}
              onSmtpPortChange={onSmtpPortChange}
              smtpSecure={smtpSecure}
              onSmtpSecureChange={onSmtpSecureChange}
              fieldErrors={fieldErrors}
            />
          ) : null}
        </div>
      ) : null}

      {wizardStep === 2 ? (
        <label className="block">
          <TenantSmtpFieldLabel title={OUTBOUND_EMAIL_COPY.stepEmail} hint={OUTBOUND_EMAIL_COPY.sendEmailHint} />
          <input
            type="email"
            value={sendEmail}
            onChange={(e) => onSendEmailChange(e.target.value)}
            className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2.5 text-sm"
            placeholder={sendEmailPlaceholderForProvider(providerId)}
            autoComplete="off"
          />
          {fieldErrors.sendEmail ? <p className="mt-1 text-xs text-rose-700">{fieldErrors.sendEmail}</p> : null}
        </label>
      ) : null}

      {wizardStep === 3 ? (
        <label className="block">
          <TenantSmtpFieldLabel title={OUTBOUND_EMAIL_COPY.stepName} hint={OUTBOUND_EMAIL_COPY.displayNameHint} />
          <input
            type="text"
            value={displayName}
            onChange={(e) => onDisplayNameChange(e.target.value)}
            className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2.5 text-sm"
          />
          {fieldErrors.displayName ? (
            <p className="mt-1 text-xs text-rose-700">{fieldErrors.displayName}</p>
          ) : null}
        </label>
      ) : null}

      {wizardStep === 4 ? (
        <div className="space-y-4">
          <div className="rounded-lg border border-violet-100 bg-violet-50/60 p-3 text-xs text-violet-950 leading-relaxed">
            <p className="font-semibold">{provider.name} — {provider.passwordHint}</p>
            <ol className="mt-2 list-decimal space-y-1 pl-4">
              {provider.passwordSteps.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ol>
            {providerId === 'gmail' ? (
              <a
                href={GOOGLE_APP_PASSWORDS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex rounded-md border border-indigo-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-indigo-900 hover:bg-indigo-50"
              >
                Google 앱 비밀번호 발급 →
              </a>
            ) : null}
            {providerId === 'naver' ? (
              <a
                href={NAVER_SECURITY_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex rounded-md border border-emerald-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-emerald-900 hover:bg-emerald-50"
              >
                네이버 보안설정(앱 비밀번호) →
              </a>
            ) : null}
          </div>
          <SmtpPasswordField
            providerId={providerId}
            smtpPassword={smtpPassword}
            onSmtpPasswordChange={onSmtpPasswordChange}
            onClearSmtpPassword={onClearSmtpPassword}
            passwordConfigured={passwordConfigured}
            fieldError={fieldErrors.smtpPassword}
          />
          <OutboundEmailAdvancedSettings
            open={showAdvanced}
            onToggle={() => onShowAdvancedChange(!showAdvanced)}
            smtpHost={smtpHost}
            onSmtpHostChange={onSmtpHostChange}
            smtpPort={smtpPort}
            onSmtpPortChange={onSmtpPortChange}
            smtpSecure={smtpSecure}
            onSmtpSecureChange={onSmtpSecureChange}
            fieldErrors={fieldErrors}
          />
          {showTestEmail ? (
            <TestEmailRow
              testEmailTo={testEmailTo}
              onTestEmailToChange={onTestEmailToChange}
              testEmailPlaceholder={testEmailPlaceholder}
              fieldErrors={fieldErrors}
            />
          ) : null}
          <ActionRow
            mode={mode}
            busy={busy}
            smtpReady={smtpReady}
            onSave={onSave}
            onSaveAndTest={onSaveAndTest}
            onTestOnly={onTestOnly}
          />
        </div>
      ) : null}

      {wizardStep < 4 ? (
        <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-4">
          {wizardStep > 1 ? (
            <button
              type="button"
              onClick={goPrev}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              {OUTBOUND_EMAIL_COPY.prev}
            </button>
          ) : null}
          <button
            type="button"
            onClick={goNext}
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
          >
            {OUTBOUND_EMAIL_COPY.next}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function SmtpPasswordField({
  providerId,
  smtpPassword,
  onSmtpPasswordChange,
  onClearSmtpPassword,
  passwordConfigured,
  fieldError,
  className = '',
}: {
  providerId: OutboundEmailProviderId;
  smtpPassword: string;
  onSmtpPasswordChange: (v: string) => void;
  onClearSmtpPassword?: () => void;
  passwordConfigured: boolean;
  fieldError?: string;
  className?: string;
}) {
  const normalized = normalizeSmtpPasswordInput(smtpPassword);
  const gmailHint =
    providerId === 'gmail' && normalized
      ? OUTBOUND_EMAIL_COPY.passwordGmailReady(normalized.length)
      : null;
  const gmailOk = providerId === 'gmail' && isGmailAppPassword(normalized);

  return (
    <div className={`block ${className}`.trim()}>
      <TenantSmtpFieldLabel title={OUTBOUND_EMAIL_COPY.stepPassword} hint={OUTBOUND_EMAIL_COPY.passwordHint} />
      {passwordConfigured ? (
        <p className="mt-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs text-emerald-900 leading-snug">
          {OUTBOUND_EMAIL_COPY.passwordSavedHint}
        </p>
      ) : null}
      <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          type="text"
          name="cbiseo-smtp-app-password"
          value={smtpPassword}
          onChange={(e) => onSmtpPasswordChange(e.target.value)}
          onFocus={(e) => e.currentTarget.removeAttribute('readOnly')}
          readOnly
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          className="w-full min-w-0 flex-1 rounded-md border border-gray-300 px-3 py-2.5 text-sm font-mono tracking-wide"
          placeholder={
            passwordConfigured
              ? OUTBOUND_EMAIL_COPY.passwordConfiguredPlaceholder
              : '예: abcd efgh ijkl mnop (띄어쓰기 포함 OK)'
          }
          autoComplete="off"
          data-1p-ignore
          data-lpignore="true"
          data-form-type="other"
        />
        {onClearSmtpPassword && (passwordConfigured || smtpPassword) ? (
          <button
            type="button"
            onClick={onClearSmtpPassword}
            className="shrink-0 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            {OUTBOUND_EMAIL_COPY.passwordClear}
          </button>
        ) : null}
      </div>
      {gmailHint ? (
        <p className={`mt-1 text-xs ${gmailOk ? 'text-emerald-700' : 'text-amber-800'}`}>{gmailHint}</p>
      ) : null}
      {fieldError ? <p className="mt-1 text-xs text-rose-700">{fieldError}</p> : null}
    </div>
  );
}

function ProviderPicker({
  providerId,
  onSelect,
}: {
  providerId: OutboundEmailProviderId;
  onSelect: (id: OutboundEmailProviderId) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {OUTBOUND_EMAIL_PROVIDERS.map((preset) => {
        const selected = providerId === preset.id;
        return (
          <button
            key={preset.id}
            type="button"
            onClick={() => onSelect(preset.id)}
            className={`rounded-xl border p-3 text-left transition-colors ${
              selected
                ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                : 'border-gray-200 bg-white text-gray-800 hover:border-gray-300 hover:bg-gray-50'
            }`}
          >
            <p className="text-sm font-semibold">{preset.name}</p>
            <p className={`mt-1 text-xs leading-relaxed ${selected ? 'text-slate-200' : 'text-gray-500'}`}>
              {preset.shortNote}
            </p>
          </button>
        );
      })}
    </div>
  );
}

export function OutboundEmailTestReceiveBox({
  testEmailTo,
  onTestEmailToChange,
  fieldError,
  id = 'outbound-email-test-receive',
}: {
  testEmailTo: string;
  onTestEmailToChange: (v: string) => void;
  fieldError?: string;
  id?: string;
}) {
  return (
    <section
      id={id}
      className="rounded-lg border border-sky-200 bg-sky-50/70 p-3 sm:p-4 space-y-2"
    >
      <div>
        <h2 className="text-sm font-semibold text-sky-950">{OUTBOUND_EMAIL_COPY.testEmailSectionTitle}</h2>
        <p className="mt-1 text-xs text-sky-900/80 leading-relaxed">{OUTBOUND_EMAIL_COPY.testEmailHint}</p>
      </div>
      <label className="block">
        <span className="text-xs font-medium text-sky-950">{OUTBOUND_EMAIL_COPY.testEmailLabel}</span>
        <input
          type="email"
          name="cbiseo-smtp-test-receive"
          value={testEmailTo}
          onChange={(e) => onTestEmailToChange(e.target.value)}
          autoComplete="off"
          data-1p-ignore
          data-lpignore="true"
          className="mt-1.5 w-full rounded-md border border-sky-200 bg-white px-3 py-2.5 text-sm"
          placeholder={OUTBOUND_EMAIL_COPY.testEmailPlaceholder}
        />
      </label>
      {fieldError ? <p className="text-xs text-rose-700">{fieldError}</p> : null}
    </section>
  );
}

function TestEmailRow({
  testEmailTo,
  onTestEmailToChange,
  testEmailPlaceholder,
  fieldErrors,
}: {
  testEmailTo: string;
  onTestEmailToChange: (v: string) => void;
  testEmailPlaceholder?: string;
  fieldErrors: Record<string, string>;
}) {
  return (
    <label className="block rounded-lg border border-dashed border-gray-300 bg-gray-50/80 p-3">
      <TenantSmtpFieldLabel
        title={OUTBOUND_EMAIL_COPY.testEmailLabel}
        hint={OUTBOUND_EMAIL_COPY.testEmailHint}
      />
      <input
        type="email"
        name="cbiseo-smtp-test-receive-inline"
        value={testEmailTo}
        onChange={(e) => onTestEmailToChange(e.target.value)}
        autoComplete="off"
        data-1p-ignore
        data-lpignore="true"
        className="mt-2 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
        placeholder={testEmailPlaceholder || OUTBOUND_EMAIL_COPY.testEmailPlaceholder}
      />
      {fieldErrors.testEmailTo ? (
        <p className="mt-1 text-xs text-rose-700">{fieldErrors.testEmailTo}</p>
      ) : null}
    </label>
  );
}

function ActionRow({
  mode,
  busy,
  smtpReady,
  onSave,
  onSaveAndTest,
  onTestOnly,
  showSaveOnly = false,
}: {
  mode: 'tenant' | 'platform';
  busy: boolean;
  smtpReady: boolean;
  onSave?: () => void;
  onSaveAndTest?: () => void;
  onTestOnly?: () => void;
  showSaveOnly?: boolean;
}) {
  if (mode === 'platform') {
    return onTestOnly ? (
      <button
        type="button"
        disabled={busy || !smtpReady}
        onClick={onTestOnly}
        className="w-full rounded-md border border-indigo-300 bg-indigo-50 px-4 py-2.5 text-sm font-medium text-indigo-900 hover:bg-indigo-100 disabled:opacity-50 sm:w-auto"
      >
        {busy ? OUTBOUND_EMAIL_COPY.testing : OUTBOUND_EMAIL_COPY.testOnly}
      </button>
    ) : null;
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
      {onSaveAndTest ? (
        <button
          type="button"
          disabled={busy}
          onClick={onSaveAndTest}
          className="min-h-10 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {busy ? OUTBOUND_EMAIL_COPY.saving : OUTBOUND_EMAIL_COPY.saveAndTest}
        </button>
      ) : null}
      {onSave && showSaveOnly ? (
        <button
          type="button"
          disabled={busy}
          onClick={onSave}
          className="min-h-10 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
        >
          {busy ? OUTBOUND_EMAIL_COPY.saving : OUTBOUND_EMAIL_COPY.save}
        </button>
      ) : null}
      {onTestOnly && smtpReady ? (
        <button
          type="button"
          disabled={busy}
          onClick={onTestOnly}
          className="min-h-10 rounded-md border border-indigo-300 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-900 hover:bg-indigo-100 disabled:opacity-50"
        >
          {busy ? OUTBOUND_EMAIL_COPY.testing : OUTBOUND_EMAIL_COPY.testOnly}
        </button>
      ) : null}
    </div>
  );
}
