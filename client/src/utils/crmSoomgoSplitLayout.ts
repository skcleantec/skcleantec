/** 텔레CRM 팝업(좌) + 숨고 Chrome(우) 2분할 배치 */

export type SoomgoSplitScreenBounds = {
  availLeft: number;
  availTop: number;
  availWidth: number;
  availHeight: number;
};

type ScreenWithAvail = Screen & { availLeft?: number; availTop?: number };

export function readSoomgoSplitScreenBounds(): SoomgoSplitScreenBounds {
  const s = window.screen as ScreenWithAvail;
  return {
    availLeft: s.availLeft ?? 0,
    availTop: s.availTop ?? 0,
    availWidth: s.availWidth || 1920,
    availHeight: s.availHeight || 1080,
  };
}

/** CRM 팝업 창을 작업 영역 좌측 반쪽으로 맞춘다. */
export function arrangeCrmPopupLeftHalf(): boolean {
  if (typeof window === 'undefined') return false;
  const { availLeft, availTop, availWidth, availHeight } = readSoomgoSplitScreenBounds();
  const half = Math.max(640, Math.floor(availWidth / 2));
  try {
    window.moveTo(availLeft, availTop);
    window.resizeTo(half, availHeight);
    return true;
  } catch {
    return false;
  }
}
