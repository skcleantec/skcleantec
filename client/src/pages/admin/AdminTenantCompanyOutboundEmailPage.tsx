import { useState } from 'react';
import { createPortal } from 'react-dom';
import { PageTitleWithFavorite } from '../../components/layout/NavFavoritePageTitle';
import { TenantSmtpSetupGuideModal } from '../../components/admin/TenantSmtpSetupGuideModal';
import { OutboundEmailStatusBanner } from '../../components/admin/outbound-email/OutboundEmailStatusBanner';
import {
  OutboundEmailSetupWizard,
  OutboundEmailTestReceiveBox,
} from '../../components/admin/outbound-email/OutboundEmailSetupWizard';
import { CompanyProfileSuccessModal } from './CompanyProfileSuccessModal';
import { useOutboundEmailSettingsForm } from './useOutboundEmailSettingsForm';
import { OUTBOUND_EMAIL_COPY } from '../../utils/outboundEmailCopy';

type PasswordConfirmMode = 'clear' | 'reveal';

export function AdminTenantCompanyOutboundEmailPage() {
  const form = useOutboundEmailSettingsForm();
  const [guideOpen, setGuideOpen] = useState(false);
  const [passwordModal, setPasswordModal] = useState<PasswordConfirmMode | null>(null);
  const [actorPassword, setActorPassword] = useState('');
  const [passwordModalErr, setPasswordModalErr] = useState<string | null>(null);

  if (form.loading) {
    return <div className="p-8 text-center text-gray-500 text-sm">불러오는 중…</div>;
  }

  const isBrandScope = Boolean(form.smtpScope);
  const canClearSmtp = form.passwordConfigured || form.smtpReady;

  const openPasswordModal = (mode: PasswordConfirmMode) => {
    form.setErr(null);
    setPasswordModalErr(null);
    setActorPassword('');
    setPasswordModal(mode);
  };

  const closePasswordModal = () => {
    setPasswordModal(null);
    setActorPassword('');
    setPasswordModalErr(null);
  };

  const confirmPasswordModal = async () => {
    if (!passwordModal) return;
    setPasswordModalErr(null);
    const result =
      passwordModal === 'clear'
        ? await form.handleClearSmtp(actorPassword)
        : await form.handleRevealSmtpPassword(actorPassword);
    if (result.ok) closePasswordModal();
    else setPasswordModalErr(result.error);
  };

  return (
    <div className="min-w-0 w-full max-w-3xl space-y-6 pb-8">
      <div>
        <PageTitleWithFavorite label={OUTBOUND_EMAIL_COPY.pageTitle}>
          <h1 className="text-xl font-semibold text-gray-800">{OUTBOUND_EMAIL_COPY.pageTitle}</h1>
        </PageTitleWithFavorite>
      </div>

      <section className="rounded-xl border border-sky-200 bg-sky-50/90 px-4 py-3 text-fluid-xs text-sky-950 leading-relaxed">
        {OUTBOUND_EMAIL_COPY.platformCustomerMailNote}
      </section>

      <OutboundEmailTestReceiveBox
        testEmailTo={form.testEmailTo}
        onTestEmailToChange={form.setTestEmailTo}
        fieldError={form.fieldErrors.testEmailTo}
        busy={form.busy}
        canSend={form.smtpReady}
        onSendTest={() => void form.handleTestEmail()}
      />

      <OutboundEmailStatusBanner
        smtpReady={form.smtpReady}
        effectiveConfigured={form.effectiveConfigured}
        scopeLabel={form.scopeLabel}
        onOpenGuide={() => setGuideOpen(true)}
      />

      {form.hasOperatingCompanies ? (
        <section className="rounded-lg border border-gray-200 bg-white p-3 sm:p-4">
          <p className="text-xs font-medium text-gray-600 mb-2">{OUTBOUND_EMAIL_COPY.scopeTitle}</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => form.selectScope('')}
              className={`rounded-full px-3 py-1.5 text-xs font-medium border transition-colors ${
                !form.smtpScope
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              {OUTBOUND_EMAIL_COPY.scopeCommon}
            </button>
            {form.operatingCompanies.map((oc) => (
              <button
                key={oc.id}
                type="button"
                onClick={() => form.selectScope(oc.id)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium border transition-colors ${
                  form.smtpScope === oc.id
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                {oc.displayName}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-gray-500 leading-relaxed">
            {isBrandScope
              ? OUTBOUND_EMAIL_COPY.scopeBrandHint(form.scopeLabel)
              : OUTBOUND_EMAIL_COPY.scopeCommonHint}
          </p>
        </section>
      ) : null}

      {form.err ? (
        <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800" role="alert">
          {form.err}
        </p>
      ) : null}

      <section
        id="outbound-email-setup"
        className="rounded-lg border border-gray-200 bg-white p-4 sm:p-5 space-y-4"
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              {OUTBOUND_EMAIL_COPY.sectionTitle}
              {form.hasOperatingCompanies ? ` · ${form.scopeLabel}` : ''}
            </h2>
            {form.profile?.globalSmtpFallbackAvailable && !isBrandScope ? (
              <p className="mt-1 text-xs text-amber-800 leading-relaxed">{OUTBOUND_EMAIL_COPY.fallbackPlatform}</p>
            ) : null}
            {isBrandScope && !form.smtpReady ? (
              <p className="mt-1 text-xs text-amber-800 leading-relaxed">
                {OUTBOUND_EMAIL_COPY.fallbackBrandEffective(form.scopeLabel)}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {canClearSmtp ? (
              <button
                type="button"
                disabled={form.busy}
                onClick={() => openPasswordModal('clear')}
                className="rounded-md border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-800 hover:bg-rose-100 disabled:opacity-50"
              >
                {OUTBOUND_EMAIL_COPY.clearSmtp}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => form.setCompactGrid((v) => !v)}
              className="text-xs font-medium text-slate-600 underline underline-offset-2 hover:text-slate-900"
            >
              {form.compactGrid ? OUTBOUND_EMAIL_COPY.viewWizard : OUTBOUND_EMAIL_COPY.viewAllFields}
            </button>
          </div>
        </div>

        <OutboundEmailSetupWizard
          mode="tenant"
          providerId={form.providerId}
          onProviderIdChange={form.selectProvider}
          sendEmail={form.sendEmail}
          onSendEmailChange={form.setSendEmail}
          displayName={form.displayName}
          onDisplayNameChange={form.setDisplayName}
          smtpPassword={form.smtpPassword}
          onSmtpPasswordChange={form.setSmtpPassword}
          onClearSmtpPassword={form.clearSmtpPasswordField}
          onRevealSmtpPassword={
            form.passwordConfigured ? () => openPasswordModal('reveal') : undefined
          }
          passwordConfigured={form.passwordConfigured}
          smtpHost={form.smtpHost}
          onSmtpHostChange={form.setSmtpHost}
          smtpPort={form.smtpPort}
          onSmtpPortChange={form.setSmtpPort}
          smtpSecure={form.smtpSecure}
          onSmtpSecureChange={form.setSmtpSecure}
          testEmailTo={form.testEmailTo}
          onTestEmailToChange={form.setTestEmailTo}
          showTestEmail={false}
          wizardStep={form.wizardStep}
          onWizardStepChange={form.setWizardStep}
          showAdvanced={form.showAdvanced}
          onShowAdvancedChange={form.setShowAdvanced}
          compactGrid={form.compactGrid}
          fieldErrors={form.fieldErrors}
          busy={form.busy}
          smtpReady={form.smtpReady}
          onSave={() => void form.handleSaveSmtp()}
        />
      </section>

      {guideOpen ? (
        <TenantSmtpSetupGuideModal companyName={form.companyName} onClose={() => setGuideOpen(false)} />
      ) : null}

      <CompanyProfileSuccessModal message={form.successModal} onClose={() => form.setSuccessModal(null)} />

      {passwordModal
        ? createPortal(
            <div
              className="modal-mobile-safe-overlay fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
              role="dialog"
              aria-modal="true"
              aria-labelledby="smtp-password-confirm-title"
              onClick={closePasswordModal}
            >
              <div
                className="modal-mobile-fullscreen-panel w-full max-w-md rounded-t-2xl bg-white p-4 shadow-xl sm:rounded-2xl sm:p-5"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 id="smtp-password-confirm-title" className="text-base font-semibold text-gray-900">
                  {passwordModal === 'clear'
                    ? OUTBOUND_EMAIL_COPY.clearSmtpConfirmTitle
                    : OUTBOUND_EMAIL_COPY.passwordRevealTitle}
                </h3>
                <p className="mt-2 text-sm text-gray-600 leading-relaxed">
                  {passwordModal === 'clear'
                    ? OUTBOUND_EMAIL_COPY.clearSmtpConfirmBody(form.scopeLabel)
                    : OUTBOUND_EMAIL_COPY.passwordRevealBody}
                </p>
                <label className="mt-4 block">
                  <span className="text-xs font-medium text-gray-700">
                    {OUTBOUND_EMAIL_COPY.clearSmtpPasswordLabel}
                  </span>
                  <input
                    type="password"
                    value={actorPassword}
                    onChange={(e) => setActorPassword(e.target.value)}
                    autoComplete="current-password"
                    className="mt-1.5 w-full rounded-md border border-gray-300 px-3 py-2.5 text-sm"
                    placeholder="로그인할 때 쓰는 비밀번호"
                  />
                </label>
                {passwordModalErr ? (
                  <p className="mt-2 text-xs text-rose-700" role="alert">
                    {passwordModalErr}
                  </p>
                ) : null}
                <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    disabled={form.busy}
                    onClick={closePasswordModal}
                    className="min-h-10 rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    {passwordModal === 'clear'
                      ? OUTBOUND_EMAIL_COPY.clearSmtpCancel
                      : OUTBOUND_EMAIL_COPY.passwordRevealCancel}
                  </button>
                  <button
                    type="button"
                    disabled={form.busy || !actorPassword.trim()}
                    onClick={() => void confirmPasswordModal()}
                    className={`min-h-10 rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-50 ${
                      passwordModal === 'clear'
                        ? 'bg-rose-700 hover:bg-rose-800'
                        : 'bg-sky-800 hover:bg-sky-900'
                    }`}
                  >
                    {form.busy
                      ? passwordModal === 'clear'
                        ? '삭제 중…'
                        : '확인 중…'
                      : passwordModal === 'clear'
                        ? OUTBOUND_EMAIL_COPY.clearSmtpSubmit
                        : OUTBOUND_EMAIL_COPY.passwordRevealSubmit}
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
