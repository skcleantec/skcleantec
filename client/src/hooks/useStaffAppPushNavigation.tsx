import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { isCbiseoStaffNativeApp } from '../utils/cbiseoNativeApp';

/** 밖에서 막 돌아온 직후(알림을 눌러 들어온 경우)로 보는 시간 */
const CAME_BACK_MS = 2500;
/** 화면이 막 열린 직후(앱을 알림으로 켠 경우)로 보는 시간 */
const JUST_OPENED_MS = 6000;
/** 안내 줄이 저절로 닫히는 시간 */
const PROMPT_MS = 20000;

function promptLabel(path: string): string {
  if (path.includes('/deposits')) return '입금 알림이 왔어요';
  if (path.includes('/messages')) return '새 메시지가 왔어요';
  if (path.includes('/cs')) return 'C/S 알림이 왔어요';
  return '새 알림이 왔어요';
}

/**
 * 앱 알림 → 화면 이동.
 * 알림을 눌러 들어온 경우에만 바로 이동한다.
 * 앱을 쓰고 있는 중에 알림이 온 경우에는 이동하지 않고, 위쪽에 작은 안내 줄만 띄운다
 * (작성 중이던 화면이 닫히지 않게).
 */
export function useStaffAppPushNavigation(enabled = true): ReactNode {
  const navigate = useNavigate();
  const location = useLocation();
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const cameBackAtRef = useRef(0);
  const openedAtRef = useRef(0);
  const currentRef = useRef('');

  useEffect(() => {
    currentRef.current = location.pathname + location.search;
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!enabled || !isCbiseoStaffNativeApp()) return;
    openedAtRef.current = Date.now();

    const markBack = () => {
      if (!document.hidden) cameBackAtRef.current = Date.now();
    };
    const handler = (event: Event) => {
      const path = (event as CustomEvent<{ path?: string }>).detail?.path?.trim();
      if (!path || !path.startsWith('/')) return;
      if (path === currentRef.current) return;
      const now = Date.now();
      const tapped =
        document.hidden ||
        now - cameBackAtRef.current < CAME_BACK_MS ||
        now - openedAtRef.current < JUST_OPENED_MS;
      if (tapped) {
        setPendingPath(null);
        navigate(path);
        return;
      }
      setPendingPath(path);
    };

    window.addEventListener('cbiseo:navigate', handler);
    window.addEventListener('focus', markBack);
    document.addEventListener('visibilitychange', markBack);
    return () => {
      window.removeEventListener('cbiseo:navigate', handler);
      window.removeEventListener('focus', markBack);
      document.removeEventListener('visibilitychange', markBack);
    };
  }, [enabled, navigate]);

  useEffect(() => {
    if (!pendingPath) return;
    const timer = window.setTimeout(() => setPendingPath(null), PROMPT_MS);
    return () => window.clearTimeout(timer);
  }, [pendingPath]);

  const open = useCallback(() => {
    if (!pendingPath) return;
    const path = pendingPath;
    setPendingPath(null);
    navigate(path);
  }, [navigate, pendingPath]);

  if (!pendingPath) return null;
  return createPortal(
    <div
      className="pointer-events-none fixed inset-x-0 z-[1000] flex justify-center px-3"
      style={{ top: 'calc(env(safe-area-inset-top, 0px) + 8px)' }}
      role="status"
    >
      <div className="pointer-events-auto flex max-w-full items-center gap-2 rounded-full bg-slate-900/95 py-1.5 pl-3.5 pr-1.5 text-xs text-white shadow-lg">
        <span className="min-w-0 truncate">{promptLabel(pendingPath)}</span>
        <button
          type="button"
          onClick={open}
          className="shrink-0 rounded-full bg-violet-600 px-3 py-1 text-xs font-semibold text-white"
        >
          보기
        </button>
        <button
          type="button"
          onClick={() => setPendingPath(null)}
          aria-label="닫기"
          className="shrink-0 rounded-full px-2 py-1 text-xs text-slate-300"
        >
          닫기
        </button>
      </div>
    </div>,
    document.body,
  );
}
