import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { isStandalonePwa } from '../../utils/pwaStandalone';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function isIosDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) && !(window as Window & { MSStream?: unknown }).MSStream;
}

export function PwaAddToHomeButton({ compact = false }: { compact?: boolean }) {
  const [standalone, setStandalone] = useState(() => isStandalonePwa());
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [hintOpen, setHintOpen] = useState(false);

  useEffect(() => {
    setStandalone(isStandalonePwa());
    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onBip);
    return () => window.removeEventListener('beforeinstallprompt', onBip);
  }, []);

  if (standalone) return null;

  const handleClick = async () => {
    if (deferred) {
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      if (outcome === 'accepted') setDeferred(null);
      return;
    }
    setHintOpen(true);
  };

  const hintTitle = isIosDevice() ? 'Safari에서 홈 화면에 추가' : '홈 화면에 추가';
  const hintBody = isIosDevice() ? (
    <>
      하단 <strong>공유</strong> 버튼을 누른 뒤 <strong>홈 화면에 추가</strong>를 선택하세요. 추가하면 앱처럼 바로
      로그인 화면으로 열립니다.
    </>
  ) : (
    <>브라우저 메뉴에서 <strong>앱 설치</strong> 또는 <strong>홈 화면에 추가</strong>를 선택하세요.</>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => void handleClick()}
        className={
          compact
            ? 'inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-slate-50/90 px-2 py-1.5 text-[11px] font-semibold leading-none text-slate-600 transition hover:border-sky-300 hover:bg-sky-50/80 hover:text-sky-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 min-h-8'
            : 'flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50/80 py-2.5 text-fluid-xs font-semibold text-slate-700 transition hover:border-sky-300 hover:bg-sky-50/80 hover:text-sky-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2'
        }
        title="홈 화면에 추가"
      >
        <svg
          className={compact ? 'h-3 w-3 shrink-0' : 'h-4 w-4 shrink-0'}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 4.5v15m7.5-7.5h-15M4.5 19.5h15a1.5 1.5 0 001.5-1.5v-11a1.5 1.5 0 00-1.5-1.5h-15A1.5 1.5 0 003 7v11a1.5 1.5 0 001.5 1.5z"
          />
        </svg>
        {compact ? '홈 추가' : '홈 화면에 추가'}
      </button>

      {hintOpen
        ? createPortal(
            <div
              className="fixed inset-0 z-[120] flex items-end justify-center bg-slate-900/40 p-4 sm:items-center"
              role="dialog"
              aria-modal="true"
              aria-labelledby="pwa-hint-title"
              onClick={() => setHintOpen(false)}
            >
              <div
                className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 id="pwa-hint-title" className="text-fluid-sm font-semibold text-slate-900">
                  {hintTitle}
                </h3>
                <p className="mt-2 text-fluid-xs leading-relaxed text-slate-600">{hintBody}</p>
                <button
                  type="button"
                  onClick={() => setHintOpen(false)}
                  className="mt-4 w-full rounded-xl bg-slate-900 py-2.5 text-fluid-xs font-semibold text-white hover:bg-slate-800"
                >
                  확인
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
