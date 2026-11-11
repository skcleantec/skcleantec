/** 청소비서 고객센터(/help)를 PC 크기 새 창으로 연다. 팝업이 막히면 새 탭으로. */
export const HELP_CENTER_WINDOW_NAME = 'cbiseo-help-center';

export function openHelpCenterWindow(path = '/help'): void {
  if (typeof window === 'undefined') return;
  const url = new URL(path, window.location.origin).toString();
  const availW = window.screen?.availWidth || 1280;
  const availH = window.screen?.availHeight || 900;
  const width = Math.min(1280, availW);
  const height = Math.min(900, availH);
  const left = Math.max(0, Math.round((availW - width) / 2));
  const top = Math.max(0, Math.round((availH - height) / 2));
  const win = window.open(
    url,
    HELP_CENTER_WINDOW_NAME,
    `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`,
  );
  if (win) {
    win.focus();
    return;
  }
  window.open(url, '_blank', 'noopener');
}
