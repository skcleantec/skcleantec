import { useEffect, useRef, useState } from 'react';
import { isCbiseoStaffNativeApp } from '../../utils/cbiseoNativeApp';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential?: string }) => void;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              type?: 'standard' | 'icon';
              theme?: 'outline' | 'filled_blue' | 'filled_black';
              size?: 'large' | 'medium' | 'small';
              text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
              shape?: 'rectangular' | 'pill' | 'circle' | 'square';
              width?: number;
              locale?: string;
            },
          ) => void;
        };
      };
    };
  }
}

const GSI_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';

let gsiScriptPromise: Promise<void> | null = null;

function loadGoogleIdentityScript(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (gsiScriptPromise) return gsiScriptPromise;
  gsiScriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${GSI_SCRIPT_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Google 스크립트 로드 실패')), {
        once: true,
      });
      return;
    }
    const script = document.createElement('script');
    script.src = GSI_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Google 스크립트 로드 실패'));
    document.head.appendChild(script);
  });
  return gsiScriptPromise;
}

type Props = {
  clientId: string;
  disabled?: boolean;
  mode?: 'signup' | 'login';
  onCredential: (idToken: string) => void;
  onError?: (message: string) => void;
};

function GoogleStaticFallbackButton({
  mode,
  disabled,
  onClick,
}: {
  mode: 'signup' | 'login';
  disabled?: boolean;
  onClick?: () => void;
}) {
  const label = mode === 'login' ? 'Google로 로그인' : 'Google로 가입';
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex min-h-10 w-full max-w-[400px] items-center justify-center gap-2.5 rounded border border-slate-300 bg-white px-4 text-fluid-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
      aria-label={label}
    >
      <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" aria-hidden>
        <path
          fill="#4285F4"
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        />
        <path
          fill="#34A853"
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        />
        <path
          fill="#FBBC05"
          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        />
        <path
          fill="#EA4335"
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        />
      </svg>
      {label}
    </button>
  );
}

export function GoogleSignupButton({
  clientId,
  disabled,
  mode = 'signup',
  onCredential,
  onError,
}: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [ready, setReady] = useState(false);
  const [staticFallback, setStaticFallback] = useState(false);
  const staffNativeApp = isCbiseoStaffNativeApp();

  useEffect(() => {
    let cancelled = false;
    void loadGoogleIdentityScript()
      .then(() => {
        if (cancelled) return;
        setReady(true);
      })
      .catch((e) => {
        if (cancelled) return;
        if (staffNativeApp) {
          setStaticFallback(true);
          return;
        }
        onError?.(e instanceof Error ? e.message : 'Google 버튼을 불러오지 못했습니다.');
      });
    return () => {
      cancelled = true;
    };
  }, [onError, staffNativeApp]);

  useEffect(() => {
    if (!ready || !clientId || !hostRef.current || disabled || staticFallback) return;
    const host = hostRef.current;
    host.innerHTML = '';
    try {
      window.google?.accounts.id.initialize({
        client_id: clientId,
        callback: (response) => {
          const credential = response.credential?.trim();
          if (!credential) {
            onError?.('Google 인증이 취소되었습니다.');
            return;
          }
          onCredential(credential);
        },
        auto_select: false,
        cancel_on_tap_outside: true,
      });
      window.google?.accounts.id.renderButton(host, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        text: mode === 'login' ? 'signin_with' : 'signup_with',
        shape: 'rectangular',
        width: Math.min(400, host.parentElement?.clientWidth ?? 320),
        locale: 'ko',
      });
    } catch (e) {
      if (staffNativeApp) {
        setStaticFallback(true);
        return;
      }
      onError?.(e instanceof Error ? e.message : 'Google 버튼을 표시하지 못했습니다.');
    }
  }, [ready, clientId, disabled, mode, onCredential, onError, staffNativeApp, staticFallback]);

  if (!clientId) return null;

  const label = mode === 'login' ? 'Google로 로그인' : 'Google로 가입';

  if (staticFallback) {
    return (
      <div className="flex min-h-10 w-full justify-center">
        <GoogleStaticFallbackButton
          mode={mode}
          disabled={disabled}
          onClick={() =>
            onError?.('앱 WebView에서는 Google 로그인 연동 테스트만 가능합니다. 실제 로그인은 PC 브라우저를 이용해 주세요.')
          }
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-10 w-full justify-center">
      <div ref={hostRef} className="min-h-10" aria-label={label} />
    </div>
  );
}
