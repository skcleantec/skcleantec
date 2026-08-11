import type { OrderFormConsentKind, OrderFormSubmissionConsents } from '@shared/orderFormConsents';
import { orderFormConsentStampLabel } from '@shared/orderFormConsents';
import { OrderFormModalFormattedText } from './OrderFormModalFormattedText';

export function OrderFormConsentStamp(props: {
  kind: OrderFormConsentKind;
  agreedAt: string;
  className?: string;
}) {
  const { kind, agreedAt, className = '' } = props;
  return (
    <div
      className={`rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2.5 text-fluid-xs font-semibold leading-snug text-emerald-900 ${className}`.trim()}
      role="status"
    >
      {orderFormConsentStampLabel(kind, agreedAt)}
    </div>
  );
}

/** 5·6번 섹션 하단 — 경고 본문 + (동의 후) 시각 배너 */
export function OrderFormSectionAckWarning(props: {
  body: string;
  consentKind?: OrderFormConsentKind;
  agreedAt?: string | null;
  className?: string;
}) {
  const { body, consentKind, agreedAt, className = '' } = props;
  if (!body.trim()) return null;
  return (
    <div className={`mt-2 space-y-2 ${className}`.trim()}>
      <div className="rounded-lg border-2 border-amber-300 bg-amber-50 px-3 py-3 text-fluid-xs leading-relaxed text-amber-950">
        <OrderFormModalFormattedText text={body} className="break-words whitespace-pre-line" />
      </div>
      {consentKind && agreedAt ? <OrderFormConsentStamp kind={consentKind} agreedAt={agreedAt} /> : null}
    </div>
  );
}

export function OrderFormConsentsSummary(props: {
  consents: OrderFormSubmissionConsents | null | undefined;
  className?: string;
}) {
  const { consents, className = '' } = props;
  if (!consents) return null;
  const items: { kind: OrderFormConsentKind; at: string }[] = [];
  if (consents.serviceDate?.agreedAt) {
    items.push({ kind: 'serviceDate', at: consents.serviceDate.agreedAt });
  }
  if (consents.timeSlot?.agreedAt) {
    items.push({ kind: 'timeSlot', at: consents.timeSlot.agreedAt });
  }
  if (consents.guideTerms?.agreedAt) {
    items.push({ kind: 'guideTerms', at: consents.guideTerms.agreedAt });
  }
  if (items.length === 0) return null;
  return (
    <section className={className}>
      <h3 className="mb-2 text-fluid-sm font-semibold text-gray-900">동의 확인</h3>
      <div className="space-y-2">
        {items.map((item) => (
          <OrderFormConsentStamp key={item.kind} kind={item.kind} agreedAt={item.at} />
        ))}
      </div>
    </section>
  );
}

export function OrderFormSnapshotAckBlock(props: {
  ackBody?: string | null;
  consentKind?: OrderFormConsentKind;
  agreedAt?: string | null;
}) {
  const { ackBody, consentKind, agreedAt } = props;
  if (!ackBody?.trim() && !(consentKind && agreedAt)) return null;
  return (
    <div className="mt-1.5 space-y-1.5">
      {ackBody?.trim() ? (
        <div className="rounded-md border border-amber-200 bg-amber-50/90 px-2.5 py-2 text-fluid-2xs leading-relaxed text-amber-950">
          <OrderFormModalFormattedText text={ackBody} className="break-words whitespace-pre-line" />
        </div>
      ) : null}
      {consentKind && agreedAt ? (
        <OrderFormConsentStamp kind={consentKind} agreedAt={agreedAt} className="text-fluid-2xs" />
      ) : null}
    </div>
  );
}
