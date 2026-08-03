import { OUTBOUND_EMAIL_COPY } from '../../../utils/outboundEmailCopy';

type Props = {
  smtpReady: boolean;
  effectiveConfigured: boolean;
  scopeLabel: string;
  onOpenGuide: () => void;
};

export function OutboundEmailStatusBanner({
  smtpReady,
  effectiveConfigured,
  scopeLabel,
  onOpenGuide,
}: Props) {
  const tone = smtpReady
    ? 'border-emerald-200 bg-emerald-50'
    : effectiveConfigured
      ? 'border-sky-200 bg-sky-50'
      : 'border-amber-200 bg-amber-50';

  const statusText = smtpReady
    ? OUTBOUND_EMAIL_COPY.statusReady
    : effectiveConfigured
      ? OUTBOUND_EMAIL_COPY.statusFallback
      : OUTBOUND_EMAIL_COPY.statusMissing;

  const statusClass = smtpReady
    ? 'text-emerald-800'
    : effectiveConfigured
      ? 'text-sky-800'
      : 'text-amber-900';

  return (
    <section className={`rounded-xl border p-4 sm:p-5 ${tone}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className={`text-sm font-semibold ${statusClass}`}>{statusText}</p>
          <p className="mt-1 text-xs text-slate-600 leading-relaxed">
            {OUTBOUND_EMAIL_COPY.pageIntro}
            {scopeLabel ? (
              <span className="mt-1 block text-slate-700">
                현재 설정: <span className="font-medium">{scopeLabel}</span>
              </span>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <button
            type="button"
            onClick={onOpenGuide}
            className="rounded-lg border border-indigo-200 bg-white px-3 py-2 text-xs font-semibold text-indigo-900 hover:bg-indigo-50"
          >
            {OUTBOUND_EMAIL_COPY.guideButton}
          </button>
        </div>
      </div>
    </section>
  );
}
