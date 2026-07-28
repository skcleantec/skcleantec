import { useMemo, useState } from 'react';
import { TenantSmtpSetupGuideModal } from '../admin/TenantSmtpSetupGuideModal';
import { OutboundEmailSetupWizard } from '../admin/outbound-email/OutboundEmailSetupWizard';
import {
  buildSmtpFrom,
  parseSmtpFrom,
  validateOutboundEmailForm,
  firstOutboundEmailValidationMessage,
} from '../../utils/outboundEmailFormHelpers';
import {
  applyOutboundEmailProviderPreset,
  inferOutboundEmailProvider,
  type OutboundEmailProviderId,
} from '../../utils/outboundEmailProviders';
import { OUTBOUND_EMAIL_COPY } from '../../utils/outboundEmailCopy';
import type { PlatformSmtpSettingsPublic } from '../../api/platformBilling';

export type PlatformSmtpFormState = {
  smtpHost: string;
  smtpPort: string;
  smtpSecure: boolean;
  smtpUser: string;
  smtpFrom: string;
  smtpPassword: string;
  smtpPasswordConfigured: boolean;
};

const EMPTY_SMTP_PUBLIC: PlatformSmtpSettingsPublic = {
  host: '',
  port: 587,
  secure: false,
  user: '',
  from: '',
  passwordConfigured: false,
  configured: false,
  envFallbackAvailable: false,
  effectiveConfigured: false,
};

export function smtpFormFromSettings(smtp: PlatformSmtpSettingsPublic | null | undefined): PlatformSmtpFormState {
  const s = smtp ?? EMPTY_SMTP_PUBLIC;
  return {
    smtpHost: s.host ?? '',
    smtpPort: String(s.port || 587),
    smtpSecure: s.secure,
    smtpUser: s.user ?? '',
    smtpFrom: s.from ?? '',
    smtpPassword: '',
    smtpPasswordConfigured: s.passwordConfigured,
  };
}

export function smtpPatchFromForm(form: PlatformSmtpFormState) {
  return {
    host: form.smtpHost.trim(),
    port: Number(form.smtpPort) || 587,
    secure: form.smtpSecure,
    user: form.smtpUser.trim(),
    from: form.smtpFrom.trim(),
    ...(form.smtpPassword.trim() ? { password: form.smtpPassword } : {}),
  };
}

type Props = {
  smtp: PlatformSmtpFormState;
  onChange: (patch: Partial<PlatformSmtpFormState>) => void;
  effectiveConfigured?: boolean;
  envFallbackAvailable?: boolean;
  onTest?: (to: string) => Promise<void>;
  testing?: boolean;
};

export function PlatformSmtpSettingsSection({
  smtp,
  onChange,
  effectiveConfigured,
  envFallbackAvailable,
  onTest,
  testing = false,
}: Props) {
  const [guideOpen, setGuideOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [compactGrid, setCompactGrid] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [testEmailTo, setTestEmailTo] = useState('');

  const parsedFrom = useMemo(() => parseSmtpFrom(smtp.smtpFrom), [smtp.smtpFrom]);
  const sendEmail = smtp.smtpUser || parsedFrom.email;
  const displayName = parsedFrom.displayName || '청소비서';
  const providerId = inferOutboundEmailProvider(smtp.smtpHost);

  const patchFromWizard = (patch: {
    providerId?: OutboundEmailProviderId;
    sendEmail?: string;
    displayName?: string;
    smtpPassword?: string;
    smtpHost?: string;
    smtpPort?: string;
    smtpSecure?: boolean;
  }) => {
    const nextSend = patch.sendEmail ?? sendEmail;
    const nextName = patch.displayName ?? displayName;
    const preset = patch.providerId ? applyOutboundEmailProviderPreset(patch.providerId) : null;
    onChange({
      ...(patch.smtpHost !== undefined ? { smtpHost: patch.smtpHost } : preset ? { smtpHost: preset.host } : {}),
      ...(patch.smtpPort !== undefined ? { smtpPort: patch.smtpPort } : preset ? { smtpPort: preset.port } : {}),
      ...(patch.smtpSecure !== undefined ? { smtpSecure: patch.smtpSecure } : preset ? { smtpSecure: preset.secure } : {}),
      ...(patch.sendEmail !== undefined ? { smtpUser: nextSend } : {}),
      ...(patch.displayName !== undefined || patch.sendEmail !== undefined
        ? { smtpFrom: buildSmtpFrom(nextName, nextSend) }
        : {}),
      ...(patch.smtpPassword !== undefined ? { smtpPassword: patch.smtpPassword } : {}),
    });
    setFieldErrors({});
  };

  const handleTest = async () => {
    if (!onTest) return;
    const errors = validateOutboundEmailForm({
      providerId,
      sendEmail,
      displayName,
      smtpHost: smtp.smtpHost,
      smtpPort: smtp.smtpPort,
      smtpPassword: smtp.smtpPassword,
      passwordConfigured: smtp.smtpPasswordConfigured,
      testEmailTo,
      requireTestEmail: true,
    });
    setFieldErrors(errors);
    if (firstOutboundEmailValidationMessage(errors)) return;
    await onTest(testEmailTo.trim());
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          {effectiveConfigured ? (
            <p className="text-xs font-medium text-emerald-700">{OUTBOUND_EMAIL_COPY.statusReady}</p>
          ) : (
            <p className="text-xs font-medium text-amber-700">{OUTBOUND_EMAIL_COPY.statusMissing}</p>
          )}
          {envFallbackAvailable && !smtp.smtpPasswordConfigured && !smtp.smtpHost.trim() ? (
            <p className="mt-1 text-xs text-sky-800">{OUTBOUND_EMAIL_COPY.fallbackPlatform}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setGuideOpen(true)}
            className="rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-900 hover:bg-indigo-100"
          >
            {OUTBOUND_EMAIL_COPY.guideButton}
          </button>
          <button
            type="button"
            onClick={() => setCompactGrid((v) => !v)}
            className="text-xs font-medium text-slate-600 underline underline-offset-2"
          >
            {compactGrid ? OUTBOUND_EMAIL_COPY.viewWizard : OUTBOUND_EMAIL_COPY.viewAllFields}
          </button>
        </div>
      </div>

      {guideOpen ? (
        <TenantSmtpSetupGuideModal
          onClose={() => setGuideOpen(false)}
          companyName="청소비서"
          title="플랫폼 알림 메일 — 설정 안내"
          intro="입금 확인·도움말 문의 등 플랫폼에서 보내는 알림 메일 연결 설정입니다."
        />
      ) : null}

      <OutboundEmailSetupWizard
        mode="platform"
        providerId={providerId}
        onProviderIdChange={(id) => patchFromWizard({ providerId: id })}
        sendEmail={sendEmail}
        onSendEmailChange={(v) => patchFromWizard({ sendEmail: v, displayName })}
        displayName={displayName}
        onDisplayNameChange={(v) => patchFromWizard({ displayName: v, sendEmail })}
        smtpPassword={smtp.smtpPassword}
        onSmtpPasswordChange={(v) => onChange({ smtpPassword: v })}
        passwordConfigured={smtp.smtpPasswordConfigured}
        smtpHost={smtp.smtpHost}
        onSmtpHostChange={(v) => onChange({ smtpHost: v })}
        smtpPort={smtp.smtpPort}
        onSmtpPortChange={(v) => onChange({ smtpPort: v })}
        smtpSecure={smtp.smtpSecure}
        onSmtpSecureChange={(v) => onChange({ smtpSecure: v })}
        testEmailTo={testEmailTo}
        onTestEmailToChange={setTestEmailTo}
        wizardStep={wizardStep}
        onWizardStepChange={setWizardStep}
        showAdvanced={showAdvanced}
        onShowAdvancedChange={setShowAdvanced}
        compactGrid={compactGrid}
        fieldErrors={fieldErrors}
        busy={testing}
        smtpReady={Boolean(effectiveConfigured && smtp.smtpHost.trim() && smtp.smtpFrom.trim())}
        onTestOnly={() => void handleTest()}
      />
    </div>
  );
}

/** 플랫폼 저장 전 검증 — PlatformSettingsSmtpTab에서 사용 */
export function validatePlatformSmtpForm(form: PlatformSmtpFormState): string | null {
  const parsed = parseSmtpFrom(form.smtpFrom);
  const errors = validateOutboundEmailForm({
    providerId: inferOutboundEmailProvider(form.smtpHost),
    sendEmail: form.smtpUser || parsed.email,
    displayName: parsed.displayName || '청소비서',
    smtpHost: form.smtpHost,
    smtpPort: form.smtpPort,
    smtpPassword: form.smtpPassword,
    passwordConfigured: form.smtpPasswordConfigured,
  });
  return firstOutboundEmailValidationMessage(errors);
}
