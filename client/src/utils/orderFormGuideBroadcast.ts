/** 발주서 탭 ↔ `/info` 안내 탭 간 동의 체크 동기화 (같은 출처) */
export const ORDER_FORM_GUIDE_CHANNEL = 'skcleanteck-order-form-guide-v1';

export type OrderFormGuideMessage = { type: 'agree-terms' };

export function postOrderGuideAgreeTerms(): void {
  try {
    const bc = new BroadcastChannel(ORDER_FORM_GUIDE_CHANNEL);
    bc.postMessage({ type: 'agree-terms' } satisfies OrderFormGuideMessage);
    bc.close();
  } catch {
    /* BroadcastChannel 미지원 등 */
  }
}

/** 다른 탭에서 안내 확인·동의 시 콜백 (발주서 페이지에서 구독) */
export function subscribeOrderGuideAgreeTerms(onAgree: () => void): () => void {
  try {
    const bc = new BroadcastChannel(ORDER_FORM_GUIDE_CHANNEL);
    bc.onmessage = (ev: MessageEvent<OrderFormGuideMessage>) => {
      if (ev.data?.type === 'agree-terms') onAgree();
    };
    return () => {
      bc.onmessage = null;
      bc.close();
    };
  } catch {
    return () => {};
  }
}
