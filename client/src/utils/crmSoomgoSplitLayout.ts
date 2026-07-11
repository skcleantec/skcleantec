/** 텔레CRM 팝업(좌) + 숨고 Chrome(우) 2분할 배치 */

/** CrmShell·3열 레이아웃 최소 폭 (이보다 좁으면 우측이 잘림) */
export const CRM_LAYOUT_MIN_WIDTH = 1280;

/** 숨고 채팅 목록·채팅방에 필요한 최소 가로 폭 */
export const SOOMGO_SPLIT_MIN_WIDTH = 420;

export type SoomgoSplitScreenBounds = {
  availLeft: number;
  availTop: number;
  availWidth: number;
  availHeight: number;
  /** CRM 팝업 가로 폭 (브릿지 우측 배치 계산용) */
  crmWidth: number;
  /** 숨고 Chrome 가로 폭 */
  soomgoWidth: number;
};

type ScreenWithAvail = Screen & { availLeft?: number; availTop?: number };

export function computeSoomgoSplitLayout(availWidth: number): { crmWidth: number; soomgoWidth: number } {
  const minSoomgo = SOOMGO_SPLIT_MIN_WIDTH;
  const minCrm = 640;

  if (availWidth < minCrm + minSoomgo) {
    const half = Math.max(minCrm, Math.floor(availWidth / 2));
    return { crmWidth: half, soomgoWidth: availWidth - half };
  }

  let soomgoWidth = minSoomgo;
  let crmWidth = availWidth - soomgoWidth;

  if (crmWidth < CRM_LAYOUT_MIN_WIDTH && availWidth >= CRM_LAYOUT_MIN_WIDTH + minSoomgo) {
    crmWidth = CRM_LAYOUT_MIN_WIDTH;
    soomgoWidth = availWidth - crmWidth;
  }

  return { crmWidth, soomgoWidth };
}

export function readSoomgoSplitScreenBounds(): SoomgoSplitScreenBounds {
  const s = window.screen as ScreenWithAvail;
  const availLeft = s.availLeft ?? 0;
  const availTop = s.availTop ?? 0;
  const availWidth = s.availWidth || 1920;
  const availHeight = s.availHeight || 1080;
  const { crmWidth, soomgoWidth } = computeSoomgoSplitLayout(availWidth);
  return {
    availLeft,
    availTop,
    availWidth,
    availHeight,
    crmWidth,
    soomgoWidth,
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

/** 숨고 연동 시 CRM 팝업을 좌측 넓게, 숨고는 우측 최소 폭으로 맞춘다. */
export function arrangeCrmPopupLeftHalf(): boolean {
  if (typeof window === 'undefined') return false;
  const { availLeft, availTop, availHeight, crmWidth } = readSoomgoSplitScreenBounds();
  try {
    window.moveTo(availLeft, availTop);
    window.resizeTo(crmWidth, availHeight);
    return true;
  } catch {
    return false;
  }
}
