/** 발주서 탭 ↔ `/info` 안내 탭 간 동의 체크 동기화 (같은 출처) */
export const ORDER_FORM_GUIDE_CHANNEL = 'skcleanteck-order-form-guide-v1';

export type OrderFormGuideMessage = {
  type: 'agree-terms';
  agreedAt: string;
  signaturePng: string;
  typedName: string;
};

export function postOrderGuideAgreeTerms(payload: {
  agreedAt: string;
  signaturePng: string;
  typedName: string;
}): void {
  try {
    const bc = new BroadcastChannel(ORDER_FORM_GUIDE_CHANNEL);
    bc.postMessage({ type: 'agree-terms', ...payload } satisfies OrderFormGuideMessage);
    bc.close();
  } catch {
    /* BroadcastChannel 미지원 등 */
  }
}

/** 다른 탭에서 안내 확인·서명 시 콜백 (발주서 페이지에서 구독) */
export function subscribeOrderGuideAgreeTerms(
  onAgree: (payload: { agreedAt: string; signaturePng: string; typedName: string }) => void,
): () => void {
  try {
    const bc = new BroadcastChannel(ORDER_FORM_GUIDE_CHANNEL);
    bc.onmessage = (ev: MessageEvent<OrderFormGuideMessage>) => {
      if (
        ev.data?.type === 'agree-terms' &&
        typeof ev.data.agreedAt === 'string' &&
        typeof ev.data.signaturePng === 'string' &&
        ev.data.signaturePng.startsWith('data:image/png') &&
        typeof ev.data.typedName === 'string' &&
        ev.data.typedName.trim().length >= 2
      ) {
        onAgree({
          agreedAt: ev.data.agreedAt,
          signaturePng: ev.data.signaturePng,
          typedName: ev.data.typedName.trim(),
        });
      }
    };
    return () => {
      bc.onmessage = null;
      bc.close();
    };
  } catch {
    return () => {};
  }
}
