import { useEffect, useRef, useState } from 'react';
import { fetchPlatformReceiptCert, openPlatformReceiptCertUrl, type PlatformReceiptCert } from '../../api/platformReceipts';
import { BTN_PRIMARY, BTN_SECONDARY } from '../../utils/platformUi';
import { createPortal } from 'react-dom';

const POPUP_BLOCKED = '팝업이 차단됐어요. 주소창 오른쪽의 팝업 허용을 눌러 주세요';

function openBlankCertWindow(): Window | null {
  const width = 900;
  const height = 760;
  const left = Math.round(window.screenX + Math.max(0, (window.outerWidth - width) / 2));
  const top = Math.round(window.screenY + Math.max(0, (window.outerHeight - height) / 2));
  return window.open(
    'about:blank',
    'cbiseoPlatformCertRegister',
    `popup,width=${width},height=${height},left=${left},top=${top}`,
  );
}

function certExpireLabel(expireDate: string | null): string {
  if (!expireDate) return '만료일 미상';
  return new Date(expireDate).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' });
}

export function PlatformCertRegisterModal({
  onClose,
  onRegistered,
}: {
  onClose: () => void;
  onRegistered: (cert: PlatformReceiptCert) => void;
}) {
  const [watching, setWatching] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<PlatformReceiptCert | null>(null);
  const popupRef = useRef<Window | null>(null);
  const openedAt = useRef<number | null>(null);
  const onRegisteredRef = useRef(onRegistered);
  onRegisteredRef.current = onRegistered;

  useEffect(() => () => {
    popupRef.current?.close();
  }, []);

  async function checkOnce(fromClose = false) {
    try {
      const cert = await fetchPlatformReceiptCert();
      if (cert.valid) {
        popupRef.current?.close();
        setWatching(false);
        setBlocked(false);
        setError(null);
        setDone(cert);
        onRegisteredRef.current(cert);
        return;
      }
      if (fromClose || (openedAt.current != null && Date.now() - openedAt.current > 90_000)) {
        setError('등록이 확인되지 않았어요');
        setWatching(false);
      }
    } catch {
      if (fromClose) setError('등록이 확인되지 않았어요');
    }
  }

  useEffect(() => {
    if (!watching) return undefined;
    let ticks = 0;
    const poll = window.setInterval(() => {
      ticks += 1;
      if (popupRef.current?.closed) {
        popupRef.current = null;
        void checkOnce(true);
        return;
      }
      if (ticks % 5 === 0) void checkOnce(false);
    }, 1000);
    return () => window.clearInterval(poll);
  }, [watching]);

  function openWindow() {
    setError(null);
    setDone(null);
    setBlocked(false);
    const previous = popupRef.current;
    const popup = openBlankCertWindow();
    if (!popup) {
      setWatching(false);
      setBlocked(true);
      return;
    }
    if (previous && previous !== popup && !previous.closed) previous.close();
    popupRef.current = popup;
    void loadUrl(popup);
  }

  async function loadUrl(popup: Window) {
    try {
      const { url } = await openPlatformReceiptCertUrl();
      if (popup.closed || popupRef.current !== popup) {
        setWatching(false);
        setError('등록이 확인되지 않았어요');
        return;
      }
      popup.location.href = url;
      openedAt.current = Date.now();
      setWatching(true);
      setBlocked(false);
    } catch (err) {
      if (!popup.closed) popup.close();
      popupRef.current = null;
      setWatching(false);
      setError(err instanceof Error ? err.message : '공동인증서 등록 창을 열지 못했습니다.');
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl" role="dialog" aria-modal="true" aria-labelledby="cert-modal-title">
        <h2 id="cert-modal-title" className="text-base font-semibold text-gray-900">공동인증서 등록</h2>
        <div className="mt-4 space-y-3 text-sm text-gray-700">
          <p>세금계산서를 발행하려면 플랫폼 사업자의 공동인증서가 필요합니다.</p>
          <ol className="space-y-1 text-sm text-gray-700">
            <li>① 인증서 위치 선택 (PC·USB 등)</li>
            <li>② 사업자 인증서 선택 (전자세금용 또는 사업자 범용)</li>
            <li>③ 인증서 비밀번호 입력</li>
          </ol>
          {watching && !done ? (
            <p className="text-sm text-gray-600">바로빌 창에서 등록을 진행해 주세요 · 등록을 확인하는 중…</p>
          ) : null}
          {done ? (
            <p className="text-sm font-medium text-emerald-700">✓ 등록 완료 · 만료일 {certExpireLabel(done.expireDate)}</p>
          ) : null}
          {blocked ? <p className="text-sm text-red-700">{POPUP_BLOCKED}</p> : null}
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          {watching && !done ? (
            <button type="button" className={BTN_SECONDARY} onClick={() => void checkOnce(true)}>다시 확인</button>
          ) : null}
          {!done ? (
            <button type="button" className={BTN_PRIMARY} onClick={openWindow}>
              {watching || blocked ? '다시 열기' : '등록 창 열기'}
            </button>
          ) : (
            <button type="button" className={BTN_PRIMARY} onClick={onClose}>닫기</button>
          )}
          {!done ? (
            <button type="button" className={BTN_SECONDARY} onClick={onClose}>취소</button>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}
