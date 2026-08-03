/** body overflow·모달 등으로 스크롤이 리셋되지 않게 전후 위치 보존 */
export function captureDocumentScroll(): { windowY: number; loginTop: number | null } {
  const login = document.querySelector('.login-surface') as HTMLElement | null;
  return {
    windowY: window.scrollY || document.documentElement.scrollTop || 0,
    loginTop: login ? login.scrollTop : null,
  };
}

export function restoreDocumentScroll(saved: { windowY: number; loginTop: number | null }): void {
  const apply = () => {
    const login = document.querySelector('.login-surface') as HTMLElement | null;
    if (login && saved.loginTop != null) {
      login.scrollTop = saved.loginTop;
    }
    window.scrollTo({ top: saved.windowY, left: 0, behavior: 'auto' });
  };
  apply();
  requestAnimationFrame(() => {
    apply();
    requestAnimationFrame(apply);
  });
}

export function scrollToOrderFormField(fieldId: string): void {
  const el = document.getElementById(fieldId);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  if (el instanceof HTMLElement) {
    el.classList.add('ring-2', 'ring-amber-400', 'ring-offset-2');
    window.setTimeout(() => {
      el.classList.remove('ring-2', 'ring-amber-400', 'ring-offset-2');
    }, 2400);
    const focusable = el.matches('input, textarea, select, button')
      ? el
      : el.querySelector<HTMLElement>('input, textarea, select, button');
    focusable?.focus({ preventScroll: true });
  }
}
