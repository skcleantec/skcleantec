import { ORDER_FORM_PARTNER_CONSENT_SECTION } from '@shared/orderFormPartnerConsent';

/** 업체 안내사항 편집과 무관 — 청소비서→파트너사 전달 고지 (발주서·/info 공통) */
export function OrderFormPartnerConsentBlock() {
  const { title, items } = ORDER_FORM_PARTNER_CONSENT_SECTION;
  return (
    <section className="rounded-xl border-2 border-sky-200 bg-sky-50/90 px-4 py-4 shadow-sm">
      <h2 className="mb-3 border-b border-sky-200 pb-2 text-sm font-bold text-sky-950 whitespace-pre-line">
        {title}
      </h2>
      <ul className="space-y-3">
        {items.map((item, j) => (
          <li key={j} className="flex gap-2.5 text-sm leading-relaxed text-sky-950">
            <span className="shrink-0 font-semibold text-sky-600">•</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
