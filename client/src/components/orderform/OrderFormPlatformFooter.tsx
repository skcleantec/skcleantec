import { ORDER_FORM_PLATFORM_FOOTER } from '@shared/orderFormPlatformFooter';

/** 발주서 문서 하단 — 플랫폼 한 줄(보이스피싱 안심). 고정 제출 막대에는 넣지 않는다. */
export function OrderFormPlatformFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="text-center text-fluid-2xs leading-snug text-gray-500" aria-label="플랫폼 정보">
      <p>
        <span className="font-medium text-gray-700">{ORDER_FORM_PLATFORM_FOOTER.productName}</span>
        <span className="text-gray-400">
          {' '}
          · {ORDER_FORM_PLATFORM_FOOTER.operatorName} · {ORDER_FORM_PLATFORM_FOOTER.siteHost} · © {year}
        </span>
      </p>
    </footer>
  );
}
