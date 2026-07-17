/** 텔레CRM 팝업(좌) + 숨고 Chrome(우) 2분할 배치 */

/** CrmShell·3열 레이아웃 최소 폭 (이보다 좁으면 우측이 잘림) */
export const CRM_LAYOUT_MIN_WIDTH = 1280;

/** 숨고 채팅 목록·채팅방에 필요한 최소 가로 폭 */
export const SOOMGO_SPLIT_MIN_WIDTH = 420;

/** 숨고 우측 패널 권장 폭 (채팅 목록 가독성) */
export const SOOMGO_SPLIT_PREFERRED_WIDTH = 480;

export type SoomgoSplitScreenBounds = {
  availLeft: number;
  availTop: number;
  availWidth: number;
  availHeight: number;
  /** CRM 팝업 가로 폭 (브릿지 우측 배치 계산용) */
  crmWidth: number;
  /** 숨고 Chrome 가로 폭 */
  soomgoWidth: number;
  /** 숨고 Chrome 좌측 X — CRM 창 실제 오른쪽 끝 (있으면 브릿지가 우선 사용) */
  soomgoLeft?: number;
};

type ScreenWithAvail = Screen & { availLeft?: number; availTop?: number };

export function computeSoomgoSplitLayout(availWidth: number): { crmWidth: number; soomgoWidth: number } {
  const minSoomgo = SOOMGO_SPLIT_MIN_WIDTH;
  const minCrm = CRM_LAYOUT_MIN_WIDTH;

  if (availWidth <= minCrm) {
    return { crmWidth: availWidth, soomgoWidth: 0 };
  }

  if (availWidth < minCrm + minSoomgo) {
    return { crmWidth: minCrm, soomgoWidth: Math.max(0, availWidth - minCrm) };
  }

  let soomgoWidth = Math.min(
    SOOMGO_SPLIT_PREFERRED_WIDTH,
    Math.max(minSoomgo, Math.floor(availWidth * 0.28)),
  );
  let crmWidth = availWidth - soomgoWidth;

  if (crmWidth < minCrm) {
    crmWidth = minCrm;
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

/**
 * CRM 팝업 resize 직후 — 실제 창 위치·폭 기준으로 숨고 배치 좌표를 만든다.
 * (이론적 crmWidth만 쓰면 CRM resize 실패 시 숨고가 CRM 안쪽에 가려짐)
 */
export function readSoomgoSplitBoundsAfterCrmResize(): SoomgoSplitScreenBounds {
  const base = readSoomgoSplitScreenBounds();
  if (typeof window === 'undefined') return base;

  const winLeft = Number.isFinite(window.screenX) ? window.screenX : base.availLeft;
  const winOuter = window.outerWidth > 0 ? window.outerWidth : base.crmWidth;
  const availRight = base.availLeft + base.availWidth;
  const soomgoLeft = winLeft + winOuter;
  let soomgoWidth = base.soomgoWidth;

  if (soomgoLeft + soomgoWidth > availRight + 2) {
    soomgoWidth = Math.max(SOOMGO_SPLIT_MIN_WIDTH, availRight - soomgoLeft);
  }

  return {
    ...base,
    crmWidth: winOuter,
    soomgoWidth,
    soomgoLeft,
  };
}

const SPLIT_LAYOUT_SETTLE_MS = 80;

function waitForSplitLayoutSettle(): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, SPLIT_LAYOUT_SETTLE_MS));
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
  const { availLeft, availTop, availHeight, crmWidth, availWidth } = readSoomgoSplitScreenBounds();
  const width = Math.min(availWidth, Math.max(CRM_LAYOUT_MIN_WIDTH, crmWidth));
  try {
    window.moveTo(availLeft, availTop);
    window.resizeTo(width, availHeight);
    return true;
  } catch {
    return false;
  }
}

/** CRM 좁히기 → 숨고 Chrome 우측 배치 (브릿지 API 콜백 주입) */
export async function applyTelecrmSoomgoSplitLayout(
  arrangeBridge: (screen: SoomgoSplitScreenBounds) => Promise<unknown>,
  options?: { resizeCrm?: boolean },
): Promise<SoomgoSplitScreenBounds> {
  if (options?.resizeCrm !== false) {
    arrangeCrmPopupLeftHalf();
  }
  await waitForSplitLayoutSettle();
  const screen = readSoomgoSplitBoundsAfterCrmResize();
  try {
    await arrangeBridge(screen);
  } catch {
    /* Chrome·브릿지 미기동 */
  }
  return screen;
}
