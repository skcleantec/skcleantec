import { useState } from 'react';
import type { MisoBridgeStatus } from '@shared/misoBridge';
import { CrmSlideDrawer } from '../layout/CrmSlideDrawer';

export function CrmMisoDrawer({
  open,
  onClose,
  busy,
  bridgeStatus,
  onSend,
}: {
  open: boolean;
  onClose: () => void;
  busy?: boolean;
  bridgeStatus?: MisoBridgeStatus | null;
  onSend: (message: string) => Promise<boolean>;
}) {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendDisabled = busy || sending;
  const inChatHint =
    bridgeStatus?.currentChatTitle?.trim() ||
    (bridgeStatus?.misoForeground ? '미소 앱 실행 중' : '채팅방을 연 뒤 전송하세요');

  const handleSend = async () => {
    const body = message.trim();
    if (!body) {
      setError('보낼 메시지를 입력해 주세요.');
      return;
    }
    setSending(true);
    setError(null);
    try {
      const ok = await onSend(body);
      if (ok) {
        setMessage('');
        onClose();
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <CrmSlideDrawer
      open={open}
      onClose={onClose}
      title="미소 메시지"
      subtitle="에뮬레이터 미소 채팅방으로 전송"
    >
      <div className="flex min-h-0 flex-1 flex-col gap-2 p-3">
        <p className="rounded-lg border border-violet-100 bg-violet-50/80 px-2.5 py-1.5 text-[11px] text-violet-900">
          {inChatHint}
        </p>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={6}
          placeholder="보낼 메시지를 입력하세요"
          disabled={sendDisabled}
          className="min-h-[120px] w-full resize-y rounded-xl border border-slate-200 px-3 py-2 text-fluid-xs text-slate-900 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 disabled:opacity-50"
        />
        {error ? <p className="text-[11px] text-rose-600">{error}</p> : null}
        <div className="mt-auto flex gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={sending}
            className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-fluid-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            닫기
          </button>
          <button
            type="button"
            disabled={sendDisabled}
            onClick={() => void handleSend()}
            className="flex-1 rounded-lg bg-violet-600 px-3 py-2 text-fluid-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
          >
            {sending ? '전송 중…' : '미소 채팅 보내기'}
          </button>
        </div>
      </div>
    </CrmSlideDrawer>
  );
}
