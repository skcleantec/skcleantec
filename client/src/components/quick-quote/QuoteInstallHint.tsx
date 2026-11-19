import { useEffect, useState } from 'react';
import { Button } from '../ui/Button';

const DISMISS_KEY = 'cbiseo.quoteInstallHint.dismissed';

function alreadyInstalled(): boolean {
  if (typeof window === 'undefined') return true;
  const nav = navigator as Navigator & { standalone?: boolean };
  if (nav.standalone) return true;
  return window.matchMedia('(display-mode: standalone)').matches;
}

function hintText(): string {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return '아이폰: 공유 → 홈 화면에 추가';
  return '안드로이드: 메뉴 → 홈 화면에 추가';
}

/** 한 번 닫으면 다시 안 보여 준다. 이미 홈 화면에 있으면 숨긴다. */
export function QuoteInstallHint() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(DISMISS_KEY) === '1') return;
    } catch {
      return;
    }
    if (alreadyInstalled()) return;
    setVisible(true);
  }, []);

  if (!visible) return null;

  return (
    <p className="flex items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5 text-fluid-2xs leading-snug text-slate-600">
      <span className="min-w-0 flex-1">{hintText()}</span>
      <Button
        variant="quiet"
        size="sm"
        onClick={() => {
          try {
            localStorage.setItem(DISMISS_KEY, '1');
          } catch {
            /* 저장이 안 되면 이번만 닫는다 */
          }
          setVisible(false);
        }}
      >
        닫기
      </Button>
    </p>
  );
}
