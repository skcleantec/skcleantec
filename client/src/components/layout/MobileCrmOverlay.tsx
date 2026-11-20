import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { isCbiseoStaffNativeApp } from '../../utils/cbiseoNativeApp';

/** 앱·휴대폰에서 모바일 CRM을 여는 신호. 대시보드 카드 등에서 보낸다. */
export const MOBILE_CRM_OPEN_EVENT = 'cbiseo:mobile-crm-open';

/** 모바일 CRM 안(iframe)에서 바깥 청소비서로 보내는 메시지 */
export type MobileCrmMessage =
  | { type: 'cbiseo-crm:close' }
  | { type: 'cbiseo-crm:open-path'; path: string }
  | { type: 'cbiseo-crm:tel'; phone: string };

/** 앱 또는 휴대폰 화면이면 새 창 대신 청소비서 위에 겹쳐 연다 */
export function shouldOverlayMobileCrm(): boolean {
  if (typeof window === 'undefined') return false;
  if (isCbiseoStaffNativeApp()) return true;
  return !window.matchMedia('(min-width: 1024px)').matches;
}

export function openMobileCrm(): void {
  window.dispatchEvent(new Event(MOBILE_CRM_OPEN_EVENT));
}

/**
 * 청소비서 화면 위에 모바일 CRM을 겹쳐 둔다.
 * 닫아도 지우지 않고 숨기기만 해서, 다시 열면 보던 탭·검색이 그대로 남는다.
 */
export function MobileCrmOverlay({ enabled }: { enabled: boolean }) {
  const navigate = useNavigate();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    const onOpen = () => {
      setMounted(true);
      setOpen(true);
    };
    window.addEventListener(MOBILE_CRM_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(MOBILE_CRM_OPEN_EVENT, onOpen);
  }, [enabled]);

  useEffect(() => {
    if (!mounted) return;
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      const data = e.data as MobileCrmMessage | null;
      if (!data || typeof data !== 'object') return;
      if (data.type === 'cbiseo-crm:close') setOpen(false);
      else if (data.type === 'cbiseo-crm:open-path' && typeof data.path === 'string' && data.path.startsWith('/')) {
        setOpen(false);
        navigate(data.path);
      } else if (data.type === 'cbiseo-crm:tel' && typeof data.phone === 'string') {
        const digits = data.phone.replace(/\D/g, '');
        if (digits) window.location.href = `tel:${digits}`;
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [mounted, navigate]);

  useEffect(() => {
    window.__cbiseoMobileCrmBack = () => {
      if (!open) return false;
      setOpen(false);
      return true;
    };
    return () => {
      window.__cbiseoMobileCrmBack = undefined;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!enabled || !mounted) return null;

  return (
    <>
      <div
        className={`fixed inset-0 z-[120] flex flex-col bg-[#121828] pt-[max(env(safe-area-inset-top,0px),var(--cbiseo-safe-area-top,0px))] transition-transform duration-200 ease-out motion-reduce:transition-none ${
          open ? 'translate-y-0' : 'pointer-events-none translate-y-full'
        }`}
        aria-hidden={!open}
        role="dialog"
        aria-label="모바일 CRM"
      >
        <iframe
          title="모바일 CRM"
          src="/m/quote?embed=1"
          allow="clipboard-write; clipboard-read"
          className="min-h-0 w-full flex-1 border-0 bg-canvas"
        />
        <div className="shrink-0 bg-canvas pb-[max(env(safe-area-inset-bottom,0px),var(--cbiseo-safe-area-bottom,0px))]" />
      </div>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed right-3 z-[110] flex items-center gap-1.5 rounded-full border border-white/10 bg-[#16181d]/90 py-2 pl-2.5 pr-3 text-fluid-2xs font-bold text-white shadow-[0_8px_22px_rgba(0,0,0,0.28)] backdrop-blur-xl lg:hidden"
          style={{ bottom: 'calc(env(safe-area-inset-bottom) + 5.75rem)' }}
          aria-label="모바일 CRM 다시 열기"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M4 5h16v11H9l-5 4z" />
            <path d="M8 9h8M8 12h5" />
          </svg>
          CRM
        </button>
      ) : null}
    </>
  );
}
