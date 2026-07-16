import { ORDER_FORM_PARTNER_CONSENT_SECTION } from '@shared/orderFormPartnerConsent';

/** 업체 안내사항 편집과 무관 — 청소비서→파트너사 전달 고지 (발주서·/info 공통) */
export function OrderFormPartnerConsentBlock() {
  const { title, items } = ORDER_FORM_PARTNER_CONSENT_SECTION;
  return (
    <section className="rounded-lg border border-gray-200 bg-gray-50/70 px-3 py-3">
      <h2 className="mb-2 border-b border-gray-200 pb-1.5 text-fluid-2xs font-semibold text-gray-800 whitespace-pre-line">
        {title}
      </h2>
      <ul className="space-y-2">
        {items.map((item, j) => (
          <li key={j} className="flex gap-2 text-fluid-2xs leading-relaxed text-gray-600">
            <span className="shrink-0 text-gray-400">•</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
