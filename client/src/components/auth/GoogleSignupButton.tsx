import { useEffect, useRef, useState } from 'react';

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
  onCredential: (idToken: string) => void;
  onError?: (message: string) => void;
};

export function GoogleSignupButton({ clientId, disabled, onCredential, onError }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void loadGoogleIdentityScript()
      .then(() => {
        if (cancelled) return;
        setReady(true);
      })
      .catch((e) => {
        if (cancelled) return;
        onError?.(e instanceof Error ? e.message : 'Google 버튼을 불러오지 못했습니다.');
      });
    return () => {
      cancelled = true;
    };
  }, [onError]);

  useEffect(() => {
    if (!ready || !clientId || !hostRef.current || disabled) return;
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
        text: 'signup_with',
        shape: 'rectangular',
        width: Math.min(400, host.parentElement?.clientWidth ?? 320),
        locale: 'ko',
      });
    } catch (e) {
      onError?.(e instanceof Error ? e.message : 'Google 버튼을 표시하지 못했습니다.');
    }
  }, [ready, clientId, disabled, onCredential, onError]);

  if (!clientId) return null;

  return (
    <div className="flex min-h-10 w-full justify-center">
      <div ref={hostRef} className="min-h-10" aria-label="Google로 가입" />
    </div>
  );
}
