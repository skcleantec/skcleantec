import { useEffect, useRef, useState } from 'react';
import { fetchCashbillCertificateStatus, openCashbillCertificateUrl } from '../../api/cashbill';
import { IssueModalFrame } from '../receipts/IssueModalFrame';
import { certExpireLabel } from './cashbillCertDisplay';

const BTN =
  'min-h-11 w-full rounded-lg bg-slate-900 px-3 text-fluid-xs font-medium text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none sm:w-auto';
const GHOST =
  'min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-fluid-xs text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none';

const POPUP_BLOCKED = '팝업이 차단됐어요. 주소창 오른쪽의 팝업 허용을 눌러 주세요';

function openBlankCertWindow(): Window | null {
  const width = 900;
  const height = 760;
  const left = Math.round(window.screenX + Math.max(0, (window.outerWidth - width) / 2));
  const top = Math.round(window.screenY + Math.max(0, (window.outerHeight - height) / 2));
  const popup = window.open(
    'about:blank',
    'cbiseoCertRegister',
    `popup,width=${width},height=${height},left=${left},top=${top}`,
  );
  if (!popup) return null;
  return popup;
}

export function CashbillCertRegisterModal({
  operatingCompanyId,
  onClose,
  onRegistered,
  onIssue,
}: {
  operatingCompanyId: string;
  onClose: () => void;
  onRegistered: (status: { valid: boolean; expireDate: string | null }) => void;
  onIssue?: () => void;
}) {
  const [mobile, setMobile] = useState(false);
  const [watching, setWatching] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ expireDate: string | null } | null>(null);
  const popupRef = useRef<Window | null>(null);
  const openedAt = useRef<number | null>(null);
  const onRegisteredRef = useRef(onRegistered);
  onRegisteredRef.current = onRegistered;

  useEffect(() => {
    const media = window.matchMedia('(max-width: 1023px)');
    const apply = () => setMobile(media.matches);
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, []);

  useEffect(() => () => {
    popupRef.current?.close();
  }, []);

  async function checkOnce(fromClose = false) {
    try {
      const status = await fetchCashbillCertificateStatus(operatingCompanyId);
      if (status.valid) {
        popupRef.current?.close();
        setWatching(false);
        setBlocked(false);
        setError(null);
        setDone({ expireDate: status.expireDate });
        onRegisteredRef.current(status);
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
  }, [watching, operatingCompanyId]);

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
      const issued = await openCashbillCertificateUrl(operatingCompanyId);
      if (popup.closed || popupRef.current !== popup) {
        setWatching(false);
        setError('등록이 확인되지 않았어요');
        return;
      }
      popup.location.href = issued.url;
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

  return (
    <IssueModalFrame
      title="공동인증서 등록"
      onClose={onClose}
      footer={done ? (
        <button type="button" className={BTN} onClick={() => { onIssue?.(); onClose(); }}>
          세금계산서 발행하기
        </button>
      ) : (
        <div className="flex flex-wrap justify-end gap-2">
          {watching ? (
            <button type="button" className={GHOST} onClick={() => void checkOnce(true)}>다시 확인</button>
          ) : null}
          <button type="button" className={BTN} onClick={openWindow}>
            {watching || blocked ? '다시 열기' : '등록 창 열기'}
          </button>
        </div>
      )}
    >
      <p className="text-fluid-xs text-slate-700">세금계산서를 발행하려면 사업자 공동인증서가 필요합니다. 1년에 한 번.</p>
      {mobile ? (
        <p className="rounded-lg border border-slate-200 bg-slate-100 px-2.5 py-1.5 text-fluid-xs text-slate-700">
          공동인증서는 보통 PC에 있어요. PC에서 등록을 권장합니다
        </p>
      ) : null}
      <ol className="space-y-1 text-fluid-xs text-slate-800">
        <li>① 인증서 위치 선택 (PC·USB 등)</li>
        <li>② 사업자 인증서 선택 (전자세금용 또는 사업자 범용)</li>
        <li>③ 인증서 비밀번호 입력</li>
      </ol>
      {watching && !done ? (
        <p className="text-fluid-xs text-slate-700">바로빌 창에서 등록을 진행해 주세요 · 등록을 확인하는 중…</p>
      ) : null}
      {done ? <p className="text-fluid-sm font-medium text-emerald-800">✓ 등록 완료 · 만료일 {certExpireLabel(done.expireDate)}</p> : null}
      {blocked ? <p className="text-fluid-xs text-red-700">{POPUP_BLOCKED}</p> : null}
      {error ? <p className="text-fluid-xs text-red-700">{error} · 다시 확인 / 다시 열기</p> : null}
    </IssueModalFrame>
  );
}
