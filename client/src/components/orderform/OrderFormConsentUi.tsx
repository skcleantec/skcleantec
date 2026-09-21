import type { OrderFormConsentKind, OrderFormSubmissionConsents } from '@shared/orderFormConsents';
import { orderFormConsentStampLabel } from '@shared/orderFormConsents';

export function OrderFormConsentStamp(props: {
  kind: OrderFormConsentKind;
  agreedAt: string;
  className?: string;
  typedName?: string | null;
  signatureUrl?: string | null;
}) {
  const { kind, agreedAt, className = '', typedName, signatureUrl } = props;
  const url = signatureUrl?.trim() || '';
  const name = typedName?.trim() || '';
  return (
    <div
      className={`rounded-xl border border-slate-200 bg-white px-3 py-3 text-fluid-xs leading-snug text-slate-800 shadow-sm ${className}`.trim()}
      role="status"
    >
      <p className="font-semibold text-slate-900">{orderFormConsentStampLabel(kind, agreedAt, name)}</p>
      {name ? (
        <p className="mt-2 text-fluid-2xs text-slate-500">
          고객작성 성함 <span className="font-semibold text-slate-800">{name}</span>
        </p>
      ) : null}
      {kind === 'guideTerms' && url ? (
        <img
          src={url}
          alt={`${name || '고객'} 서명`}
          className="mt-2 max-h-20 w-full rounded-md border border-slate-200 bg-slate-50 object-contain"
        />
      ) : null}
    </div>
  );
}

export function OrderFormGuideSignProof(props: {
  typedName?: string | null;
  agreedAt?: string | null;
  signatureUrl?: string | null;
  signaturePng?: string | null;
  className?: string;
}) {
  const { typedName, agreedAt, signatureUrl, signaturePng, className = '' } = props;
  const name = typedName?.trim() || '';
  const url = signatureUrl?.trim() || signaturePng?.trim() || '';
  if (!agreedAt && !name && !url) return null;
  return (
    <section className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm ${className}`.trim()}>
      <p className="text-fluid-xs font-semibold tracking-tight text-slate-900">동의·서명</p>
      {agreedAt ? (
        <p className="mt-1.5 text-fluid-xs leading-relaxed text-slate-600">
          {orderFormConsentStampLabel('guideTerms', agreedAt, name)}
        </p>
      ) : null}
      {name ? (
        <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
          <p className="text-fluid-2xs text-slate-500">고객작성 성함</p>
          <p className="mt-0.5 text-fluid-sm font-semibold text-slate-900">{name}</p>
        </div>
      ) : null}
      {url ? (
        <div className="mt-3">
          <p className="text-fluid-2xs text-slate-500">서명</p>
          <img
            src={url}
            alt={`${name || '고객'} 서명`}
            className="mt-1.5 max-h-28 w-full rounded-lg border border-slate-200 bg-slate-50 object-contain"
          />
        </div>
      ) : null}
    </section>
  );
}

export function OrderFormConsentsSummary(props: {
  consents: OrderFormSubmissionConsents | null | undefined;
  className?: string;
}) {
  const { consents, className = '' } = props;
  if (!consents) return null;
  const guide = consents.guideTerms;
  if (!guide?.agreedAt && !guide?.typedName && !guide?.signatureUrl) return null;
  return (
    <section className={className}>
      <OrderFormGuideSignProof
        typedName={guide?.typedName}
        agreedAt={guide?.agreedAt}
        signatureUrl={guide?.signatureUrl}
      />
    </section>
  );
}
