import { useState } from 'react';
import { CrmSlideDrawer } from '../layout/CrmSlideDrawer';
import { CrmActionButton } from '../crmUi';
import { sendSoomgoBridgeMessage } from '../../../api/soomgoBridge';

export function CrmSoomgoDrawer({
  open,
  onClose,
  busy,
  onDispatchNotice,
}: {
  open: boolean;
  onClose: () => void;
  busy?: boolean;
  onDispatchNotice?: (message: string) => void;
}) {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const notify = (msg: string) => onDispatchNotice?.(msg);

  const handleSend = async () => {
    const body = message.trim();
    if (!body) {
      notify('보낼 메시지를 입력해 주세요.');
      return;
    }
    setSending(true);
    setError(null);
    try {
      await sendSoomgoBridgeMessage(body);
      setMessage('');
      notify('숨고 채팅방에 메시지를 보냈습니다.');
      onClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : '메시지 전송에 실패했습니다.';
      setError(msg);
      notify(msg);
    } finally {
      setSending(false);
    }
  };

  return (
    <CrmSlideDrawer
      open={open}
      onClose={onClose}
      title="숨고 메시지"
      subtitle="Chrome 숨고 채팅방에 전송합니다."
      widthClass="w-[min(420px,94vw)]"
    >
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <p className="text-fluid-xs text-gray-500">
          숨고 Chrome 창에서 채팅방을 연 상태에서 보내 주세요.
        </p>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={8}
          placeholder="채팅방에 보낼 내용"
          className="min-h-[160px] w-full resize-y rounded-xl border border-sky-200 bg-white px-3 py-2 text-fluid-sm"
        />
        {error ? <p className="text-fluid-xs text-rose-600">{error}</p> : null}
        <CrmActionButton
          accent="soomgo"
          variant="solid"
          disabled={busy || sending || !message.trim()}
          onClick={() => void handleSend()}
        >
          {sending ? '전송 중…' : '메시지 보내기'}
        </CrmActionButton>
      </div>
    </CrmSlideDrawer>
  );
}
