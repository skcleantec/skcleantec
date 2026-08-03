import { useState } from 'react';
import { PageTitleWithFavorite } from '../../components/layout/NavFavoritePageTitle';
import { TenantSmtpSetupGuideModal } from '../../components/admin/TenantSmtpSetupGuideModal';
import { OutboundEmailStatusBanner } from '../../components/admin/outbound-email/OutboundEmailStatusBanner';
import { OutboundEmailSetupWizard } from '../../components/admin/outbound-email/OutboundEmailSetupWizard';
import { CompanyProfileSuccessModal } from './CompanyProfileSuccessModal';
import { useOutboundEmailSettingsForm } from './useOutboundEmailSettingsForm';
import { OUTBOUND_EMAIL_COPY } from '../../utils/outboundEmailCopy';

export function AdminTenantCompanyOutboundEmailPage() {
  const form = useOutboundEmailSettingsForm();
  const [guideOpen, setGuideOpen] = useState(false);

  if (form.loading) {
    return <div className="p-8 text-center text-gray-500 text-sm">불러오는 중…</div>;
  }

  const isBrandScope = Boolean(form.smtpScope);

  return (
    <div className="min-w-0 w-full max-w-3xl space-y-6 pb-8">
      <div>
        <PageTitleWithFavorite label={OUTBOUND_EMAIL_COPY.pageTitle}>
          <h1 className="text-xl font-semibold text-gray-800">{OUTBOUND_EMAIL_COPY.pageTitle}</h1>
        </PageTitleWithFavorite>
      </div>

      <OutboundEmailStatusBanner
        smtpReady={form.smtpReady}
        effectiveConfigured={form.effectiveConfigured}
        scopeLabel={form.scopeLabel}
        onOpenGuide={() => setGuideOpen(true)}
        canQuickTest={form.smtpReady}
        onQuickTest={() => {
          form.setWizardStep(4);
          form.setCompactGrid(false);
          document.getElementById('outbound-email-setup')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }}
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
          <button
            type="button"
            onClick={() => form.setCompactGrid((v) => !v)}
            className="shrink-0 text-xs font-medium text-slate-600 underline underline-offset-2 hover:text-slate-900"
          >
            {form.compactGrid ? OUTBOUND_EMAIL_COPY.viewWizard : OUTBOUND_EMAIL_COPY.viewAllFields}
          </button>
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
          passwordConfigured={form.passwordConfigured}
          smtpHost={form.smtpHost}
          onSmtpHostChange={form.setSmtpHost}
          smtpPort={form.smtpPort}
          onSmtpPortChange={form.setSmtpPort}
          smtpSecure={form.smtpSecure}
          onSmtpSecureChange={form.setSmtpSecure}
          testEmailTo={form.testEmailTo}
          onTestEmailToChange={form.setTestEmailTo}
          testEmailPlaceholder={form.contactEmail || undefined}
          wizardStep={form.wizardStep}
          onWizardStepChange={form.setWizardStep}
          showAdvanced={form.showAdvanced}
          onShowAdvancedChange={form.setShowAdvanced}
          compactGrid={form.compactGrid}
          fieldErrors={form.fieldErrors}
          busy={form.busy}
          smtpReady={form.smtpReady}
          onSave={() => void form.handleSaveSmtp()}
          onSaveAndTest={() => void form.handleSaveAndTest()}
          onTestOnly={() => void form.handleTestEmail()}
        />
      </section>

      {guideOpen ? (
        <TenantSmtpSetupGuideModal companyName={form.companyName} onClose={() => setGuideOpen(false)} />
      ) : null}

      <CompanyProfileSuccessModal message={form.successModal} onClose={() => form.setSuccessModal(null)} />
    </div>
  );
}
