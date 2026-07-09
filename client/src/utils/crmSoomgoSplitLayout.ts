/** 텔레CRM 팝업(좌) + 숨고 Chrome(우) 2분할 배치 */

/** CrmShell·3열 레이아웃 최소 폭 (이보다 좁으면 우측이 잘림) */
export const CRM_LAYOUT_MIN_WIDTH = 1280;

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

/** CRM 팝업을 작업 영역 전체(또는 최소 레이아웃 폭)로 맞춰 3열이 잘리지 않게 한다. */
export function fitCrmPopupWindow(): boolean {
  if (typeof window === 'undefined') return false;
  const { availLeft, availTop, availWidth, availHeight } = readSoomgoSplitScreenBounds();
  const width = Math.max(CRM_LAYOUT_MIN_WIDTH, availWidth);
  try {
    window.moveTo(availLeft, availTop);
    window.resizeTo(width, availHeight);
    return true;
  } catch {
    return false;
  }
}

/** 숨고 2분할 시 CRM 팝업을 좌측 반쪽으로 맞춘다. (숨고 연동 사용 시에만) */
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
