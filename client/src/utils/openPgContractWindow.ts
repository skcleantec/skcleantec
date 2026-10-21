/** 관리 화면 밖에서 가맹점 계약서를 적는 창. 클릭 안에서만 연다. */
export function openPgContractWindow(): void {
  const url = `${window.location.origin}/pg-contract`;
  const width = 1040;
  const height = Math.min(1100, Math.max(640, window.screen.availHeight - 48));
  const left = Math.max(0, Math.round(window.screenX + (window.outerWidth - width) / 2));
  const top = Math.max(0, Math.round(window.screenY + 24));
  const features = `popup=yes,width=${width},height=${height},left=${left},top=${top}`;
  const opened = window.open(url, '_blank', features);
  if (!opened) {
    window.location.assign(url);
    return;
  }
  opened.focus();
}
