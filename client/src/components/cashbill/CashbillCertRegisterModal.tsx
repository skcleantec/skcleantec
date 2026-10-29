import { useEffect, useRef, useState } from 'react';
import { fetchCashbillCertificateStatus, openCashbillCertificateUrl } from '../../api/cashbill';
import { IssueModalFrame } from '../receipts/IssueModalFrame';
import { certExpireLabel } from './cashbillCertDisplay';

const BTN =
  'min-h-11 w-full rounded-lg bg-slate-900 px-3 text-fluid-xs font-medium text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none sm:w-auto';
const GHOST =
  'min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-fluid-xs text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none';

function openCertPopup(url: string): Window | null {
  const left = Math.max(0, window.screenX + 460);
  const top = Math.max(0, window.screenY + 80);
  return window.open(url, 'cbiseoCertRegister', `popup,width=480,height=720,left=${left},top=${top}`);
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
  const [frameUrl, setFrameUrl] = useState<string | null>(null);
  const [watching, setWatching] = useState(false);
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

  async function openWindow() {
    setError(null);
    setDone(null);
    popupRef.current?.close();
    try {
      const issued = await openCashbillCertificateUrl(operatingCompanyId);
      openedAt.current = Date.now();
      setWatching(true);
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
          <button type="button" className={BTN} onClick={() => void openWindow()}>
            {frameUrl || watching ? '다시 열기' : '등록 창 열기'}
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
      {watching && !done ? <p className="text-fluid-xs text-slate-600">등록을 확인하는 중…</p> : null}
      {done ? <p className="text-fluid-sm font-medium text-emerald-800">등록 완료 · 만료일 {certExpireLabel(done.expireDate)}</p> : null}
      {error ? <p className="text-fluid-xs text-red-700">{error} · 다시 확인 / 다시 열기</p> : null}
      {frameUrl ? <iframe title="공동인증서 등록" src={frameUrl} className="h-[50dvh] w-full rounded-lg border border-slate-200" /> : null}
    </IssueModalFrame>
  );
}
