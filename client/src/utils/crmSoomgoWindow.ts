const SOOMGO_COMPANION_WINDOW_NAME = 'telecrm_soomgo_companion';

/** 숨고 보조 창 URL (듀얼 모니터·2중 창 배치용) */
export function crmSoomgoCompanionUrl(): string {
  const url = new URL('/admin/crm/soomgo', window.location.origin);
  url.searchParams.set('popup', '1');
  return url.toString();
}

let companionWindow: Window | null = null;

/** 숨고 보조 창 열기 — 이미 열려 있으면 포커스 */
export function openCrmSoomgoCompanionWindow(): Window | null {
  const href = crmSoomgoCompanionUrl();
  if (companionWindow && !companionWindow.closed) {
    companionWindow.focus();
    return companionWindow;
  }
  companionWindow = window.open(
    href,
    SOOMGO_COMPANION_WINDOW_NAME,
    'width=440,height=760,menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=yes',
  );
  return companionWindow;
}

export function isCrmSoomgoCompanionOpen(): boolean {
  return Boolean(companionWindow && !companionWindow.closed);
}
