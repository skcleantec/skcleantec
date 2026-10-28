import { useState } from 'react';
import { API } from '../../api/apiPrefix';

const BTN =
  'min-h-9 rounded-lg border border-slate-300 bg-white px-2 text-fluid-2xs text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none';

function fileUrl(token: string, file: 'png' | 'pdf', version: string): string {
  return `${API}/public/receipts/${encodeURIComponent(token)}/${file}?v=${encodeURIComponent(version)}`;
}

export function ReceiptCopyButtons({
  publicToken,
  copyReady,
}: {
  publicToken: string | null;
  copyReady: boolean;
}) {
  const [note, setNote] = useState('');
  const ready = copyReady && Boolean(publicToken);
  const open = (file: 'png' | 'pdf') => {
    if (!publicToken) return;
    window.open(fileUrl(publicToken, file, String(Date.now())), '_blank', 'noopener');
  };
  const share = async () => {
    if (!publicToken) return;
    const link = `${window.location.origin}/receipt/${publicToken}`;
    try {
      const res = await fetch(fileUrl(publicToken, 'png', String(Date.now())));
      if (!res.ok) throw new Error('image');
      const blob = await res.blob();
      const file = new File([blob], '영수증.png', { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: '영수증' });
        setNote('');
        return;
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
    }
    try {
      await navigator.clipboard.writeText(link);
      setNote('링크를 복사했습니다');
    } catch {
      setNote(link);
    }
  };
  return (
    <div className="flex flex-wrap items-center justify-center gap-1">
      <button type="button" className={BTN} disabled={!ready} onClick={() => open('png')}>이미지</button>
      <button type="button" className={BTN} disabled={!ready} onClick={() => open('pdf')}>PDF</button>
      <button type="button" className={BTN} disabled={!ready} onClick={() => void share()}>공유</button>
      {note ? <span className="w-full text-center text-fluid-2xs text-slate-500">{note}</span> : null}
    </div>
  );
}
