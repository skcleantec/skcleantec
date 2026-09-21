import type { OrderFormConsentKind, OrderFormSubmissionConsents } from '@shared/orderFormConsents';
import { orderFormConsentStampLabel } from '@shared/orderFormConsents';
export function OrderFormConsentStamp(props: {
  kind: OrderFormConsentKind;
  agreedAt: string;
  className?: string;
  signatureUrl?: string | null;
}) {
  const { kind, agreedAt, className = '', signatureUrl } = props;
  const url = signatureUrl?.trim() || '';
  return (
    <div
      className={`rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2.5 text-fluid-xs font-semibold leading-snug text-emerald-900 ${className}`.trim()}
      role="status"
    >
      <p>{orderFormConsentStampLabel(kind, agreedAt)}</p>
      {kind === 'guideTerms' && url ? (
        <img
          src={url}
          alt="고객 서명"
          className="mt-2 max-h-20 w-full rounded-md border border-emerald-200 bg-white object-contain"
        />
      ) : null}
    </div>
  );
}

export function OrderFormConsentsSummary(props: {
  consents: OrderFormSubmissionConsents | null | undefined;
  className?: string;
}) {
  const { consents, className = '' } = props;
  if (!consents) return null;
  const items: { kind: OrderFormConsentKind; at: string; signatureUrl?: string | null }[] = [];
  if (consents.serviceDate?.agreedAt) {
    items.push({ kind: 'serviceDate', at: consents.serviceDate.agreedAt });
  }
  if (consents.timeSlot?.agreedAt) {
    items.push({ kind: 'timeSlot', at: consents.timeSlot.agreedAt });
  }
  if (consents.guideTerms?.agreedAt) {
    items.push({
      kind: 'guideTerms',
      at: consents.guideTerms.agreedAt,
      signatureUrl: consents.guideTerms.signatureUrl,
    });
  }
  if (items.length === 0) return null;
  return (
    <section className={className}>
      <h3 className="mb-2 text-fluid-sm font-semibold text-gray-900">동의 확인</h3>
      <div className="space-y-2">
        {items.map((item) => (
          <OrderFormConsentStamp
            key={item.kind}
            kind={item.kind}
            agreedAt={item.at}
            signatureUrl={item.signatureUrl}
          />
        ))}
      </div>
    </section>
  );
}

export function OrderFormSnapshotAckBlock(props: {
  consentKind?: OrderFormConsentKind;
  agreedAt?: string | null;
}) {
  const { consentKind, agreedAt } = props;
  if (!consentKind || !agreedAt) return null;
  return (
    <div className="mt-1.5">
      <OrderFormConsentStamp kind={consentKind} agreedAt={agreedAt} className="text-fluid-2xs" />
    </div>
  );
}
