import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '../ui/Button';
import { isCbiseoStaffNativeApp } from '../../utils/cbiseoNativeApp';

const DISMISS_KEY = 'cbiseo.quoteInstallHint.dismissed';

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

declare global {
  interface Window {
    __cbiseoQuoteInstallPrompt?: InstallPromptEvent | null;
  }
}

type InstallEnv =
  | 'kakao'
  | 'inapp-android'
  | 'inapp-ios'
  | 'ios'
  | 'samsung'
  | 'android'
  | 'other';

function alreadyInstalled(): boolean {
  if (typeof window === 'undefined') return true;
  const nav = navigator as Navigator & { standalone?: boolean };
  if (nav.standalone) return true;
  return window.matchMedia('(display-mode: standalone)').matches;
}

function detectEnv(): InstallEnv {
  const ua = navigator.userAgent || '';
  const iOS = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const android = /Android/i.test(ua);
  if (/KAKAOTALK/i.test(ua)) return 'kakao';
  const inApp =
    isCbiseoStaffNativeApp() ||
    /NAVER\(inapp|Instagram|FBAN|FBAV|Line\/|DaumApps|everytimeApp/i.test(ua) ||
    (android && /; wv\)/i.test(ua));
  if (inApp) return iOS ? 'inapp-ios' : 'inapp-android';
  if (iOS) return 'ios';
  if (/SamsungBrowser/i.test(ua)) return 'samsung';
  if (android) return 'android';
  return 'other';
}

function readPrompt(): InstallPromptEvent | null {
  return typeof window !== 'undefined' ? window.__cbiseoQuoteInstallPrompt ?? null : null;
}

function openInExternalBrowser(env: InstallEnv) {
  const url = window.location.href;
  if (env === 'kakao') {
    window.location.href = `kakaotalk://web/openExternal?url=${encodeURIComponent(url)}`;
    return;
  }
  if (env === 'inapp-android') {
    const noScheme = url.replace(/^https?:\/\//, '');
    window.location.href = `intent://${noScheme}#Intent;scheme=https;package=com.android.chrome;end`;
  }
}

function GuideSteps({ env }: { env: InstallEnv }) {
  const steps: string[] =
    env === 'ios'
      ? ['아래(또는 위) 공유 버튼 □↑ 을 눌러요', '「홈 화면에 추가」를 찾아 눌러요', '오른쪽 위 「추가」를 누르면 끝']
      : env === 'samsung'
        ? ['아래 메뉴 ≡ 를 눌러요', '「현재 페이지 추가」 → 「홈 화면」을 눌러요', '「추가」를 누르면 끝']
        : env === 'android'
          ? ['오른쪽 위 ⋮ 메뉴를 눌러요', '「홈 화면에 추가」 또는 「앱 설치」를 눌러요', '「설치」(추가)를 누르면 끝']
          : env === 'inapp-ios'
            ? ['아래 「주소 복사」를 눌러요', '사파리를 열고 주소창에 붙여넣어요', '공유 □↑ → 「홈 화면에 추가」']
            : ['휴대폰의 크롬·사파리로 이 화면을 열어요', '브라우저 메뉴에서 「홈 화면에 추가」를 눌러요'];
  return (
    <ol className="mt-4 space-y-2 text-left">
      {steps.map((step, i) => (
        <li key={step} className="flex items-start gap-2.5 rounded-xl bg-slate-50 px-3 py-2.5">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#1f4fb8] text-[11px] font-bold text-white">
            {i + 1}
          </span>
          <span className="text-fluid-sm leading-snug text-slate-800">{step}</span>
        </li>
      ))}
    </ol>
  );
}

/** 홈 화면 추가 — 크롬 설치창이 되면 바로 띄우고, 안 되는 환경은 가운데 안내창으로 방법을 보여 준다 */
export function QuoteInstallHint() {
  const [visible, setVisible] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [env, setEnv] = useState<InstallEnv>('other');
  const [hasPrompt, setHasPrompt] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(DISMISS_KEY) === '1') return;
    } catch {
      /* 저장소를 못 읽으면 그냥 보여 준다 */
    }
    if (alreadyInstalled()) return;
    setEnv(detectEnv());
    setHasPrompt(Boolean(readPrompt()));
    setVisible(true);
    const onReady = () => setHasPrompt(Boolean(readPrompt()));
    const onInstalled = () => {
      setVisible(false);
      setGuideOpen(false);
    };
    window.addEventListener('cbiseo:quote-install-ready', onReady);
    window.addEventListener('cbiseo:quote-installed', onInstalled);
    return () => {
      window.removeEventListener('cbiseo:quote-install-ready', onReady);
      window.removeEventListener('cbiseo:quote-installed', onInstalled);
    };
  }, []);

  useEffect(() => {
    if (!guideOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setGuideOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [guideOpen]);

  const onAdd = useCallback(async () => {
    const prompt = readPrompt();
    if (prompt) {
      try {
        await prompt.prompt();
        const choice = await prompt.userChoice;
        window.__cbiseoQuoteInstallPrompt = null;
        setHasPrompt(false);
        if (choice.outcome === 'accepted') setVisible(false);
        return;
      } catch {
        /* 설치창을 못 띄우면 안내창으로 */
      }
    }
    setGuideOpen(true);
  }, []);

  const copyUrl = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt('아래 주소를 복사해 주세요.', url);
    }
  };

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* 저장이 안 되면 이번만 닫는다 */
    }
    setVisible(false);
  };

  if (!visible) return null;

  const inApp = env === 'kakao' || env === 'inapp-android' || env === 'inapp-ios';
  const appLabel = env === 'kakao' ? '카카오톡' : '이 앱';

  return (
    <>
      <div className="flex items-center gap-2 px-3 pb-2">
        <p className="min-w-0 flex-1 text-fluid-2xs leading-snug text-white/80">홈 화면에 두면 앱처럼 바로 열려요</p>
        <button
          type="button"
          onClick={() => void onAdd()}
          className="inline-flex h-7 shrink-0 items-center gap-1 rounded-lg bg-white px-2.5 text-fluid-2xs font-semibold text-[#1f4fb8] shadow-sm active:scale-[0.97]"
        >
          <span aria-hidden>＋</span>
          {hasPrompt ? '홈 화면에 설치' : '홈 화면에 추가'}
        </button>
        <Button variant="quiet" size="sm" className="!px-1.5 !text-white/70" onClick={dismiss}>
          닫기
        </Button>
      </div>
      {guideOpen
        ? createPortal(
            <div
              className="fixed inset-0 z-[700] flex items-center justify-center bg-slate-900/45 p-4"
              role="dialog"
              aria-modal="true"
              aria-labelledby="quote-install-guide-title"
              onClick={(e) => {
                if (e.target === e.currentTarget) setGuideOpen(false);
              }}
            >
              <div className="w-full max-w-sm rounded-2xl bg-white p-5 text-center shadow-xl">
                <img src="/icons/app-icon-192.png" alt="" className="mx-auto h-12 w-12 rounded-xl" />
                <h2 id="quote-install-guide-title" className="mt-3 text-fluid-base font-bold text-slate-900">
                  홈 화면에 추가
                </h2>
                {inApp ? (
                  <p className="mt-1 text-fluid-sm leading-snug text-amber-800">
                    {appLabel} 안에서는 홈 화면에 추가가 안 돼요.
                    <br />
                    {env === 'inapp-ios' ? '사파리' : '크롬'}에서 열어 주세요.
                  </p>
                ) : (
                  <p className="mt-1 text-fluid-sm text-slate-500">아래 순서대로 한 번만 하면 돼요</p>
                )}
                {inApp && env !== 'inapp-ios' ? (
                  <button
                    type="button"
                    onClick={() => openInExternalBrowser(env)}
                    className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-xl bg-[#1f4fb8] text-fluid-sm font-semibold text-white active:scale-[0.98]"
                  >
                    크롬으로 열기
                  </button>
                ) : null}
                {!inApp || env === 'inapp-ios' ? <GuideSteps env={env} /> : null}
                {inApp ? (
                  <button
                    type="button"
                    onClick={() => void copyUrl()}
                    className="mt-2 inline-flex h-10 w-full items-center justify-center rounded-xl border border-slate-200 bg-white text-fluid-sm font-semibold text-slate-700"
                  >
                    {copied ? '복사됨' : '주소 복사'}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setGuideOpen(false)}
                  className="mt-3 inline-flex h-10 w-full items-center justify-center rounded-xl text-fluid-sm font-medium text-slate-500 hover:bg-slate-50"
                >
                  닫기
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
