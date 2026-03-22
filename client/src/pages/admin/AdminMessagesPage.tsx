import { useState, useEffect, useRef } from 'react';
import { getConversations, getMessages, sendMessage } from '../../api/messages';
import { getToken } from '../../stores/auth';

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
  sender: { id: string; name: string };
}

export function AdminMessagesPage() {
  const token = getToken();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadConversations = () => {
    if (!token) return;
    getConversations(token)
      .then(setConversations)
      .catch(() => setConversations([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadConversations();
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
      })
      .catch(() => setMessages([]));
  }, [token, selectedId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !selectedId || !input.trim() || sending) return;
    setSending(true);
    try {
      const msg = await sendMessage(token, selectedId, input.trim());
      setMessages((prev) => [...prev, { ...msg, readAt: null }]);
      setInput('');
      loadConversations();
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
    <div className="flex flex-col gap-4 min-w-0">
      <h1 className="text-xl font-semibold text-gray-800">메시지</h1>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden flex flex-col sm:flex-row min-h-[400px]">
        {/* 대화 목록 */}
        <div className="w-full sm:w-64 border-b sm:border-b-0 sm:border-r border-gray-200 flex-shrink-0">
          {conversations.length === 0 ? (
            <div className="p-4 text-sm text-gray-500">대화 상대가 없습니다.</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {conversations.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  className={`w-full text-left p-4 hover:bg-gray-50 flex flex-col gap-1 ${
                    selectedId === c.id ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 min-w-0">
                    <span className="font-medium text-gray-900 truncate flex items-center gap-1.5">
                      {c.name}
                      {c.unreadCount > 0 && (
                        <span className="shrink-0 text-red-600 text-xs font-medium">새 메시지</span>
                      )}
                    </span>
                    {c.unreadCount > 0 && (
                      <span className="shrink-0 px-1.5 py-0.5 rounded-full bg-red-500 text-white text-xs font-medium">
                        {c.unreadCount}
                      </span>
                    )}
                  </div>
                  {c.lastMessage && (
                    <span className={`text-xs truncate ${c.unreadCount > 0 ? 'text-gray-700 font-medium' : 'text-gray-500'}`}>
                      {c.lastMessage.content}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 채팅 영역 */}
        <div className="flex-1 flex flex-col min-w-0">
          {selected ? (
            <>
              <div className="p-4 border-b border-gray-200 bg-gray-50">
                <h2 className="font-medium text-gray-900">{selected.name}</h2>
                <span className="text-xs text-gray-500">{selected.role === 'ADMIN' ? '관리자' : '팀장'}</span>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[200px]">
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
                        <div className="text-xs opacity-70 mt-1 flex items-center gap-2">
                          <span>{new Date(m.createdAt).toLocaleString('ko-KR')}</span>
                          {isMine && (
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
              <form onSubmit={handleSend} className="p-4 border-t border-gray-200">
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
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
              대화를 선택해주세요.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
