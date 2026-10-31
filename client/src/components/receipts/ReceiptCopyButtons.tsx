import { useState } from 'react';
import { TOAST_BTN } from '../ui/Toast';
import { API, apiErrorMessage } from '../../api/apiPrefix';
import { getToken } from '../../stores/auth';

const BTN =
  'min-h-9 rounded-lg border border-slate-300 bg-white px-2 text-fluid-2xs text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none';

type Kind = 'cashbill' | 'taxinvoice';

function fileUrl(token: string, file: 'png' | 'pdf'): string {
  return `${API}/public/receipts/${encodeURIComponent(token)}/${file}?v=${Date.now()}`;
}

async function officialUrl(kind: Kind, issueId: string, mode: 'mail' | 'print'): Promise<string> {
  const path = kind === 'cashbill' ? 'cashbill/issues' : 'tax-invoices';
  const res = await fetch(`${API}/${path}/${issueId}/mail-url?kind=${mode}`, {
    headers: { Authorization: `Bearer ${getToken() ?? ''}` },
  });
  if (!res.ok) throw new Error(await apiErrorMessage(res, '바로빌 주소를 받지 못했습니다.'));
  const body = (await res.json()) as { url?: string };
  if (!body.url) throw new Error('바로빌 주소를 받지 못했습니다.');
  return body.url;
}

export function ReceiptCopyButtons({
  kind,
  issueId,
  official,
  publicToken,
  copyReady,
  menu = false,
  shareOnly = false,
  inToast = false,
}: {
  kind: Kind;
  issueId: string;
  official: boolean;
  publicToken: string | null;
  copyReady: boolean;
  menu?: boolean;
  shareOnly?: boolean;
  /** 결과 팝업 안: 팝업 버튼 모양으로, 감싸는 div 없이 */
  inToast?: boolean;
}) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [fallback, setFallback] = useState(false);
  const readyCopy = copyReady && Boolean(publicToken);

  const share = async () => {
    setBusy(true);
    setNote('');
    try {
      const link = official
        ? await officialUrl(kind, issueId, 'mail')
        : publicToken
          ? `${window.location.origin}/receipt/${publicToken}`
          : '';
      if (!link) throw new Error('공유할 주소가 없습니다.');
      await navigator.clipboard.writeText(link);
      setNote(official ? '공식 영수증 링크를 복사했습니다' : '확인용 링크를 복사했습니다');
      setFallback(!official);
    } catch (err) {
      if (readyCopy && publicToken) {
        const link = `${window.location.origin}/receipt/${publicToken}`;
        try {
          await navigator.clipboard.writeText(link);
          setFallback(true);
          setNote('바로빌 주소를 받지 못해 확인용 링크를 복사했습니다');
          return;
        } catch {
          setNote(link);
          return;
        }
      }
      setNote(err instanceof Error ? err.message : '공유하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const print = async () => {
    setBusy(true);
    setNote('');
    try {
      const link = await officialUrl(kind, issueId, 'print');
      const opened = window.open(link, 'cbiseoReceiptPrint', 'popup,width=820,height=760');
      if (!opened) throw new Error('인쇄 창이 브라우저에 막혔습니다. 팝업을 허용해 주세요.');
    } catch (err) {
      setFallback(true);
      setNote(err instanceof Error ? err.message : '인쇄 주소를 받지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const klass = menu
    ? 'block w-full min-h-9 rounded-md px-2 text-left text-fluid-xs text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 disabled:opacity-50 disabled:pointer-events-none'
    : inToast
      ? TOAST_BTN.secondary
      : BTN;
  return (
    <div className={inToast ? 'contents' : menu ? 'space-y-0.5' : 'flex flex-wrap items-center justify-center gap-1'}>
      <button type="button" className={klass} disabled={busy || (!official && !readyCopy)} onClick={() => void share()}>
        {shareOnly ? '링크 복사' : '공유 링크 복사'}
      </button>
      {shareOnly ? null : (
        <button type="button" className={klass} disabled={busy || !official} onClick={() => void print()}>
          인쇄/PDF
        </button>
      )}
      {fallback && readyCopy ? (
        <>
          <button type="button" className={BTN} onClick={() => publicToken && window.open(fileUrl(publicToken, 'png'), '_blank', 'noopener')}>
            확인용 이미지
          </button>
          <button type="button" className={BTN} onClick={() => publicToken && window.open(fileUrl(publicToken, 'pdf'), '_blank', 'noopener')}>
            확인용 PDF
          </button>
        </>
      ) : null}
      {note ? <span className={`w-full text-center text-fluid-2xs text-slate-500 ${inToast ? 'col-span-full' : ''}`}>{note}</span> : null}
    </div>
  );
}
