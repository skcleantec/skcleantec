import { useState, useEffect, useRef, useCallback } from 'react';
import { getTeamOfficeMessages, sendTeamToManagement } from '../../api/messages';
import { getMe } from '../../api/auth';
import { getTeamToken } from '../../stores/teamAuth';
import { formatDateTimeCompactWithWeekday } from '../../utils/dateFormat';

interface Message {
  id: string;
  content: string;
  createdAt: string;
  readAt: string | null;
  senderId: string;
  receiverId: string;
  batchId?: string | null;
  sender: { id: string; name: string };
}

export function TeamMessagesPage() {
  const token = getTeamToken();
  const [myId, setMyId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!token) return;
    getMe(token)
      .then((u: { id?: string }) => setMyId(typeof u.id === 'string' ? u.id : null))
      .catch(() => setMyId(null));
  }, [token]);

  const loadMessages = useCallback((opts?: { silent?: boolean }) => {
    if (!token) return;
    if (!opts?.silent) setLoadError(null);
    getTeamOfficeMessages(token)
      .then((list) => {
        setMessages(Array.isArray(list) ? list : []);
        (window as { __refreshUnreadCount?: () => void }).__refreshUnreadCount?.();
      })
      .catch(() => {
        setMessages([]);
        setLoadError('메시지를 불러올 수 없습니다.');
      })
      .finally(() => {
        if (!opts?.silent) setLoading(false);
      });
  }, [token]);

  useEffect(() => {
    setLoading(true);
    loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !input.trim() || sending) return;
    setSending(true);
    setSendError(null);
    try {
      await sendTeamToManagement(token, input.trim());
      setInput('');
      loadMessages({ silent: true });
    } catch (err) {
      setSendError(err instanceof Error ? err.message : '전송에 실패했습니다.');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="py-12 text-center text-gray-500 text-sm">로딩 중...</div>
    );
  }

  return (
    <div className="flex flex-col gap-4 min-w-0">
      <h1 className="text-xl font-semibold text-gray-800">메시지</h1>

      {loadError && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded px-3 py-2">{loadError}</p>
      )}

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden flex flex-col min-h-[400px]">
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <h2 className="font-medium text-gray-900">운영팀</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[200px]">
          {messages.length === 0 ? (
            <div className="text-center text-sm text-gray-500 py-8">아직 메시지가 없습니다.</div>
          ) : (
            messages.map((m) => {
              const isMine = myId != null && m.senderId === myId;
              return (
                <div
                  key={m.id}
                  className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                      isMine ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-900'
                    }`}
                  >
                    <div className="font-medium text-xs opacity-80 mb-0.5">{m.sender.name}</div>
                    <div className="break-words">{m.content}</div>
                    <div className="text-[11px] opacity-70 mt-1 flex items-center gap-2 tabular-nums">
                      <span>{formatDateTimeCompactWithWeekday(m.createdAt)}</span>
                      {isMine && !m.batchId && (
                        <span className={m.readAt ? 'text-blue-300' : 'text-gray-400'}>
                          {m.readAt ? '읽음' : '읽지 않음'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>
        <form onSubmit={handleSend} className="p-4 border-t border-gray-200">
          {sendError && (
            <p className="text-sm text-red-600 mb-2" role="alert">
              {sendError}
            </p>
          )}
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="메시지 입력..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={sending}
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              전송
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
