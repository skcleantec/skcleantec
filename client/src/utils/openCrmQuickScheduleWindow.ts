import { postCrmQuickSchedule } from './crmQuickScheduleChannel';

export const CRM_QUICK_WINDOW_NAME = 'cbiseo-quick-schedule';
const RECT_KEY = 'crm-quick-window-rect';

type WindowRect = { left: number; top: number; width: number; height: number };

function readRect(): WindowRect | null {
  try {
    const raw = localStorage.getItem(RECT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<WindowRect>;
    const left = Number(parsed.left);
    const top = Number(parsed.top);
    const width = Number(parsed.width);
    const height = Number(parsed.height);
    if (![left, top, width, height].every((n) => Number.isFinite(n))) return null;
    if (width < 480 || height < 360 || width > 4000 || height > 4000) return null;
    return { left, top, width: Math.round(width), height: Math.round(height) };
  } catch {
    return null;
  }
}

export function rememberCrmQuickWindowRect(): void {
  try {
    const rect: WindowRect = {
      left: window.screenX,
      top: window.screenY,
      width: window.outerWidth,
      height: window.outerHeight,
    };
    localStorage.setItem(RECT_KEY, JSON.stringify(rect));
  } catch {
    /* 저장 실패는 다음 열기 기본 크기로 넘어갑니다. */
  }
}

export function openCrmQuickScheduleWindow(operatingCompanyId: string): Window | null {
  const saved = readRect();
  const width = saved?.width ?? 1180;
  const height = saved?.height ?? 760;
  const left = saved?.left ?? Math.max(0, window.screenX + 48);
  const top = saved?.top ?? Math.max(0, window.screenY + 48);
  const features = `popup,width=${width},height=${height},left=${Math.round(left)},top=${Math.round(top)}`;
  const url = `/admin/crm/quick-schedule-window?operatingCompanyId=${encodeURIComponent(operatingCompanyId)}`;
  const popup = window.open(url, CRM_QUICK_WINDOW_NAME, features);
  if (!popup || popup.closed) return null;
  try {
    popup.focus();
  } catch {
    /* 포커스는 브라우저가 막을 수 있습니다. */
  }
  postCrmQuickSchedule({ type: 'brand', operatingCompanyId });
  return popup;
}
