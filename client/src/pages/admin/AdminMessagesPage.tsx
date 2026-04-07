import { useState, useEffect, useRef, useCallback } from 'react';
import { broadcastToTeamLeaders, getConversations, getMessages, sendMessage } from '../../api/messages';
import { getToken } from '../../stores/auth';
import { formatDateTimeCompactWithWeekday } from '../../utils/dateFormat';
import { useMessageThreadPoll } from '../../hooks/useMessageThreadPoll';
import { useInboxRealtime } from '../../hooks/useInboxRealtime';

interface Conversation {
  id: string;
  name: string;
  role: string;
  lastMessage: { content: string; createdAt: string; senderId: string } | null;
  unreadCount: number;
}

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

function scrollToEnd(ref: React.RefObject<HTMLDivElement | null>, behavior: ScrollBehavior = 'smooth') {
  requestAnimationFrame(() => ref.current?.scrollIntoView({ behavior }));
}

export function AdminMessagesPage() {
  const token = getToken();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [broadcastText, setBroadcastText] = useState('');
  const [broadcasting, setBroadcasting] = useState(false);
  const [broadcastError, setBroadcastError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const selectedIdRef = useRef<string | null>(null);
  selectedIdRef.current = selectedId;

  const loadConversations = useCallback(() => {
    if (!token) return;
    getConversations(token).then(setConversations).catch(() => setConversations([]));
  }, [token]);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    getConversations(token)
      .then(setConversations)
      .catch(() => setConversations([]))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    if (!token || !selectedId) {
      setMessages([]);
      return;
    }
    getMessages(token, selectedId)
      .then((msgs) => {
        setMessages(msgs);
        (window as { __refreshUnreadCount?: () => void }).__refreshUnreadCount?.();
        scrollToEnd(messagesEndRef, 'auto');
      })
      .catch(() => setMessages([]));
  }, [token, selectedId]);

  const pollInbox = useCallback(() => {
    if (!token) return;
    loadConversations();
    const sid = selectedIdRef.current;
    if (!sid) return;
    const el = chatScrollRef.current;
    const nearBottom = !el || el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    getMessages(token, sid)
      .then((msgs) => {
        setMessages(msgs);
        (window as { __refreshUnreadCount?: () => void }).__refreshUnreadCount?.();
        if (nearBottom) scrollToEnd(messagesEndRef, 'smooth');
      })
      .catch(() => {});
  }, [token, loadConversations]);

  const { connected: wsConnected } = useInboxRealtime(token, pollInbox, Boolean(token));
  useMessageThreadPoll(Boolean(token) && !wsConnected, pollInbox);

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !broadcastText.trim() || broadcasting) return;
    setBroadcasting(true);
    setBroadcastError(null);
    try {
      await broadcastToTeamLeaders(token, broadcastText.trim());
      setBroadcastText('');
      loadConversations();
      if (selectedId) {
        const msgs = await getMessages(token, selectedId);
        setMessages(msgs);
        scrollToEnd(messagesEndRef, 'auto');
      }
      (window as { __refreshUnreadCount?: () => void }).__refreshUnreadCount?.();
    } catch (err) {
      setBroadcastError(err instanceof Error ? err.message : '전송에 실패했습니다.');
    } finally {
      setBroadcasting(false);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !selectedId || !input.trim() || sending) return;
    setSending(true);
    try {
      const msg = await sendMessage(token, selectedId, input.trim());
      setMessages((prev) => [...prev, { ...msg, readAt: null }]);
      setInput('');
      loadConversations();
      scrollToEnd(messagesEndRef, 'smooth');
    } catch {
      // ignore
    } finally {
      setSending(false);
    }
  };

  const selected = conversations.find((c) => c.id === selectedId);

  if (loading) {
    return (
      <div className="py-12 text-center text-gray-500 text-sm">로딩 중...</div>
    );
  }

  return (
    <div className="flex flex-col min-w-0 gap-3 flex-1 min-h-0 h-full overflow-hidden">
      <h1 className="text-xl font-semibold text-gray-800 shrink-0">메시지</h1>

      <div className="bg-white border border-gray-200 rounded-lg p-4 sm:p-5 shrink-0">
        <h2 className="text-sm font-semibold text-gray-900 mb-2">전체 팀장에게 공지</h2>
        <form onSubmit={handleBroadcast} className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <textarea
            value={broadcastText}
            onChange={(e) => setBroadcastText(e.target.value)}
            rows={3}
            placeholder="공지 내용을 입력하세요. 모든 팀장에게 동일하게 전달됩니다."
            className="flex-1 max-w-full min-w-0 max-h-40 px-3 py-2 border border-gray-300 rounded text-sm resize-y overflow-y-auto focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={broadcasting}
          />
          <button
            type="submit"
            disabled={broadcasting || !broadcastText.trim()}
            className="shrink-0 px-4 py-2.5 bg-gray-800 text-white text-sm font-medium rounded hover:bg-gray-900 disabled:opacity-50 min-h-[44px] touch-manipulation"
          >
            {broadcasting ? '전송 중…' : '전체 전송'}
          </button>
        </form>
        {broadcastError && (
          <p className="text-sm text-red-600 mt-2" role="alert">
            {broadcastError}
          </p>
        )}
      </div>

      {/* 팀장 목록·채팅: main 영역 높이 안 — 메시지는 이 카드 안에서만 세로 스크롤 */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden flex flex-col sm:flex-row flex-1 min-h-0 min-w-0">
        <div className="flex w-full flex-col min-h-0 max-h-[min(42vh,20rem)] sm:max-h-none sm:h-full sm:w-[3.75rem] sm:shrink-0 sm:self-stretch border-b sm:border-b-0 sm:border-r border-gray-200">
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">
            {conversations.length === 0 ? (
              <div className="p-4 text-sm text-gray-500 sm:p-2 sm:text-xs sm:text-center">대화 상대가 없습니다.</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {conversations.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedId(c.id)}
                    title={
                      c.unreadCount > 0
                        ? `${c.name} · 새 메시지 ${c.unreadCount}건`
                        : c.lastMessage
                          ? `${c.name} — ${c.lastMessage.content}`
                          : c.name
                    }
                    className={`w-full text-left py-3.5 px-3 hover:bg-gray-50 flex flex-col gap-1.5 sm:py-3 sm:px-1.5 sm:items-center sm:gap-1 sm:text-center ${
                      selectedId === c.id ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 min-w-0 sm:flex-col sm:justify-center sm:gap-1 sm:w-full">
                      <span className="font-medium text-gray-900 truncate sm:text-xs sm:leading-tight sm:w-full sm:text-center">
                        {c.name}
                      </span>
                      {c.unreadCount > 0 && (
                        <div className="flex shrink-0 items-center gap-1 sm:flex-col sm:gap-1">
                          <span className="text-red-600 text-xs font-medium sm:hidden">새 메시지</span>
                          <span className="min-w-[1.125rem] rounded-full bg-red-500 px-1 py-0.5 text-center text-[10px] font-medium leading-none text-white tabular-nums sm:scale-90">
                            {c.unreadCount > 99 ? '99+' : c.unreadCount}
                          </span>
                        </div>
                      )}
                    </div>
                    {c.lastMessage && (
                      <span
                        className={`text-xs truncate sm:hidden ${c.unreadCount > 0 ? 'text-gray-700 font-medium' : 'text-gray-500'}`}
                      >
                        {c.lastMessage.content}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col min-w-0">
          {selected ? (
            <>
              <div className="p-3 sm:p-4 border-b border-gray-200 bg-gray-50 shrink-0">
                <h2 className="font-medium text-gray-900">{selected.name}</h2>
                <span className="text-xs text-gray-500">팀장</span>
              </div>
              <div
                ref={chatScrollRef}
                className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain p-4 space-y-3"
                style={{ WebkitOverflowScrolling: 'touch' }}
              >
                {messages.map((m) => {
                  const isMine = m.senderId !== selectedId;
                  return (
                    <div
                      key={m.id}
                      className={`flex ${m.senderId === selectedId ? 'justify-start' : 'justify-end'}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                          m.senderId === selectedId
                            ? 'bg-gray-200 text-gray-900'
                            : 'bg-blue-600 text-white'
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
                })}
                <div ref={messagesEndRef} />
              </div>
              <form
                onSubmit={handleSend}
                className="shrink-0 border-t border-gray-200 bg-white p-3 sm:p-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
              >
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="메시지 입력..."
                    className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={sending}
                    autoComplete="off"
                  />
                  <button
                    type="submit"
                    disabled={sending || !input.trim()}
                    className="shrink-0 px-4 py-2 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 disabled:opacity-50 min-h-[44px] touch-manipulation"
                  >
                    전송
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="flex-1 min-h-0 flex items-center justify-center text-gray-500 text-sm p-4">
              대화를 선택해주세요.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
