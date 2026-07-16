import { ORDER_FORM_PLATFORM_FOOTER } from '@shared/orderFormPlatformFooter';

/** 발주서 제출 버튼 아래 — 플랫폼 카피라이트(보이스피싱 안심) */
export function OrderFormPlatformFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="text-center text-fluid-2xs leading-relaxed text-gray-500" aria-label="플랫폼 정보">
      <p className="font-semibold text-gray-700">{ORDER_FORM_PLATFORM_FOOTER.productName}</p>
      <p>{ORDER_FORM_PLATFORM_FOOTER.tagline}</p>
      <p className="mt-0.5">운영 {ORDER_FORM_PLATFORM_FOOTER.operatorName}</p>
      <p className="mt-1 text-gray-400">
        © {year} {ORDER_FORM_PLATFORM_FOOTER.productName} · {ORDER_FORM_PLATFORM_FOOTER.siteHost}
      </p>
    </footer>
  );
}
