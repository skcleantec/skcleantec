import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { fetchCashbillCertificateStatus, openCashbillCertificateUrl } from '../../api/cashbill';

const STEP = 'rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-fluid-2xs leading-snug text-slate-800';

function openCertPopup(url: string): Window | null {
  const left = Math.max(0, window.screenX + 460);
  const top = Math.max(0, window.screenY + 80);
  return window.open(url, 'cbiseoCertRegister', `popup,width=480,height=720,left=${left},top=${top}`);
}

export function CashbillCertRegisterModal({
  operatingCompanyId,
  onClose,
  onRegistered,
}: {
  operatingCompanyId: string;
  onClose: (status: { valid: boolean; expireDate: string | null }) => void;
  onRegistered: (status: { valid: boolean; expireDate: string | null }) => void;
}) {
  const [embed, setEmbed] = useState<boolean | null>(null);
  const [frameUrl, setFrameUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mobile, setMobile] = useState(false);
  const popupRef = useRef<Window | null>(null);
  const onRegisteredRef = useRef(onRegistered);
  const onCloseRef = useRef(onClose);
  onRegisteredRef.current = onRegistered;
  onCloseRef.current = onClose;

  useEffect(() => {
    const media = window.matchMedia('(max-width: 1023px)');
    const apply = () => setMobile(media.matches);
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let opened: Window | null = null;
    openCashbillCertificateUrl(operatingCompanyId)
      .then((issued) => {
        if (cancelled) return;
        setEmbed(issued.embed);
        if (issued.embed) setFrameUrl(issued.url);
        else {
          opened = openCertPopup(issued.url);
          popupRef.current = opened;
          if (!opened) setError('등록 창이 브라우저에 막혔습니다. 팝업을 허용한 뒤 다시 열어 주세요.');
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : '공동인증서 등록 창을 열지 못했습니다.');
      });
    return () => {
      cancelled = true;
      popupRef.current?.close();
    };
  }, [operatingCompanyId]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void fetchCashbillCertificateStatus(operatingCompanyId)
        .then((status) => {
        if (!status.valid) return;
        popupRef.current?.close();
        onRegisteredRef.current(status);
        })
        .catch(() => undefined);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [operatingCompanyId]);

  async function reopen() {
    setError(null);
    popupRef.current?.close();
    try {
      const issued = await openCashbillCertificateUrl(operatingCompanyId);
      setEmbed(issued.embed);
      if (issued.embed) {
        setFrameUrl(issued.url);
        popupRef.current = null;
      } else {
        setFrameUrl(null);
        const next = openCertPopup(issued.url);
        popupRef.current = next;
        if (!next) setError('등록 창이 브라우저에 막혔습니다. 팝업을 허용한 뒤 다시 열어 주세요.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '공동인증서 등록 창을 열지 못했습니다.');
    }
  }

  async function close() {
    popupRef.current?.close();
    const status = await fetchCashbillCertificateStatus(operatingCompanyId).catch(() => ({ valid: false, expireDate: null }));
    if (status.valid) onRegisteredRef.current(status);
    else onCloseRef.current(status);
  }

  return createPortal(
    <div className="modal-mobile-safe-overlay fixed inset-0 z-[80] flex items-end justify-center bg-slate-900/40 lg:items-center">
      <div className="modal-mobile-fullscreen-panel flex max-h-[100dvh] w-full flex-col bg-white lg:max-h-[90vh] lg:max-w-3xl lg:rounded-2xl">
        <header className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 px-3 py-2">
          <h2 className="text-fluid-sm font-semibold text-slate-900">공동인증서 등록</h2>
          <button
            type="button"
            className="min-h-10 rounded-lg px-3 text-fluid-xs text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
            onClick={() => void close()}
          >
            닫기
          </button>
        </header>
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2 sm:p-3">
          {mobile ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-fluid-2xs leading-snug text-amber-950">
              PC에서 등록을 권장합니다
            </p>
          ) : null}
          <ol className="grid gap-1.5 sm:grid-cols-3">
            <li className={STEP}>① 인증서 위치 선택</li>
            <li className={STEP}>② 인증서 선택</li>
            <li className={STEP}>③ 비밀번호 입력</li>
          </ol>
          {error ? <p className="text-fluid-xs text-red-700">{error}</p> : null}
          {embed === false ? (
            <p className="text-fluid-xs text-slate-600">등록 창이 따로 열렸습니다. 위 순서대로 진행하면 끝나면 이 창이 닫힙니다.</p>
          ) : null}
          {embed && frameUrl ? (
            <iframe title="공동인증서 등록" src={frameUrl} className="h-[60dvh] w-full rounded-lg border border-slate-200 lg:h-[480px]" />
          ) : null}
          <button
            type="button"
            className="min-h-10 rounded-lg border border-slate-300 px-3 text-fluid-xs text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
            onClick={() => void reopen()}
          >
            등록 창 다시 열기
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
