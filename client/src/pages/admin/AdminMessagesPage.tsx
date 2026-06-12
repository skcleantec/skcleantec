import { useState, useEffect, useRef, useCallback } from 'react';
import { broadcastToField, getConversations, getMessages, sendMessage } from '../../api/messages';
import { getToken } from '../../stores/auth';
import { useMessageThreadPoll } from '../../hooks/useMessageThreadPoll';
import { useInboxRealtime } from '../../hooks/useInboxRealtime';

interface Conversation {
  id: string;
  name: string;
  role: string;
  staffIdCardUrl?: string | null;
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
  sender: { id: string; name: string; staffIdCardUrl?: string | null };
}

function scrollToEnd(ref: React.RefObject<HTMLDivElement | null>, behavior: ScrollBehavior = 'smooth') {
  requestAnimationFrame(() => ref.current?.scrollIntoView({ behavior }));
}

function fieldPartnerRoleLabel(role: string): string {
  if (role === 'EXTERNAL_PARTNER') return '외부업체';
  if (role === 'TEAM_LEADER') return '팀장';
  return role;
}

const AVATAR_PALETTE = [
  { bg: '#f59e0b', text: '#ffffff' },
  { bg: '#3b82f6', text: '#ffffff' },
  { bg: '#10b981', text: '#ffffff' },
  { bg: '#6366f1', text: '#ffffff' },
  { bg: '#f43f5e', text: '#ffffff' },
  { bg: '#8b5cf6', text: '#ffffff' },
  { bg: '#14b8a6', text: '#ffffff' },
] as const;

function avatarPaletteIndex(name: string): number {
  let sum = 0;
  for (let i = 0; i < name.length; i++) {
    sum += name.charCodeAt(i);
  }
  return sum % AVATAR_PALETTE.length;
}

function getAvatarColors(name: string): { bg: string; text: string } {
  const entry = AVATAR_PALETTE[avatarPaletteIndex(name)]!;
  return { bg: entry.bg, text: entry.text };
}

function formatTimeForList(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleTimeString('ko-KR', {
      timeZone: 'Asia/Seoul',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return '';
  }
}

function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M15 6l-6 6 6 6" />
    </svg>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function AvatarCircle({
  name,
  photoUrl,
  size = 40,
}: {
  name: string;
  photoUrl?: string | null;
  size?: number;
}) {
  const [photoFailed, setPhotoFailed] = useState(false);
  const trimmedPhoto = photoUrl?.trim() || '';
  const showPhoto = Boolean(trimmedPhoto) && !photoFailed;

  useEffect(() => {
    setPhotoFailed(false);
  }, [trimmedPhoto]);

  const { bg, text } = getAvatarColors(name);
  const initial = name.trim().charAt(0) || '?';
  const fontSize = size <= 36 ? 13 : 15;
  const shellStyle = {
    width: size,
    height: size,
    minWidth: size,
    borderRadius: '50%' as const,
    boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
    flexShrink: 0,
    overflow: 'hidden' as const,
  };

  if (showPhoto) {
    return (
      <div style={shellStyle} aria-hidden>
        <img
          src={trimmedPhoto}
          alt=""
          width={size}
          height={size}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          onError={() => setPhotoFailed(true)}
        />
      </div>
    );
  }

  return (
    <div
      style={{
        ...shellStyle,
        background: bg,
        color: text,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 700,
        fontSize,
        userSelect: 'none',
      }}
      aria-hidden
    >
      {initial}
    </div>
  );
}

function MineMessageMeta({ message }: { message: Message }) {
  if (message.batchId) {
    return (
      <span className="kakaotalk-time-indicator pb-0.5">
        {formatTimeForList(message.createdAt)}
      </span>
    );
  }

  return (
    <div className="flex flex-col items-end gap-0.5 flex-shrink-0 pb-0.5">
      {message.readAt ? (
        <span className="kakaotalk-read-indicator">읽음</span>
      ) : (
        <span className="kakaotalk-unread-indicator" aria-label="읽지 않음">
          1
        </span>
      )}
      <span className="kakaotalk-time-indicator">{formatTimeForList(message.createdAt)}</span>
    </div>
  );
}

export function AdminMessagesPage() {
  const token = getToken();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [broadcastText, setBroadcastText] = useState('');
  const [broadcasting, setBroadcasting] = useState(false);
  const [broadcastError, setBroadcastError] = useState<string | null>(null);
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [toTeamLeaders, setToTeamLeaders] = useState(true);
  const [toExternalPartners, setToExternalPartners] = useState(false);
  const [toCrew, setToCrew] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const selectedIdRef = useRef<string | null>(null);
  selectedIdRef.current = selectedId;

  const loadConversations = useCallback(() => {
    if (!token) return Promise.resolve();
    return getConversations(token)
      .then((list) => {
        setConversations(list);
        (window as { __refreshUnreadCount?: () => void }).__refreshUnreadCount?.();
      })
      .catch(() => {
        setConversations([]);
        (window as { __refreshUnreadCount?: () => void }).__refreshUnreadCount?.();
      });
  }, [token]);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    void loadConversations().finally(() => setLoading(false));
  }, [token, loadConversations]);

  useEffect(() => {
    if (!token || !selectedId) {
      setMessages([]);
      setSendError(null);
      return;
    }
    setSendError(null);
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
    void loadConversations().then(() => {
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
    });
  }, [token, loadConversations]);

  const { connected: wsConnected } = useInboxRealtime(token, pollInbox, Boolean(token));
  useMessageThreadPoll(Boolean(token) && !wsConnected, pollInbox);

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !broadcastText.trim() || broadcasting) return;
    setBroadcasting(true);
    setBroadcastError(null);
    try {
      await broadcastToField(token, broadcastText.trim(), {
        toTeamLeaders,
        toExternalPartners,
        toCrew,
      });
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
    setSendError(null);
    try {
      const msg = await sendMessage(token, selectedId, input.trim());
      setMessages((prev) => [...prev, { ...msg, readAt: null }]);
      setInput('');
      loadConversations();
      scrollToEnd(messagesEndRef, 'smooth');
    } catch (err) {
      setSendError(err instanceof Error ? err.message : '메시지 전송에 실패했습니다.');
    } finally {
      setSending(false);
    }
  };

  const selected = conversations.find((c) => c.id === selectedId);
  // 모바일에서 채팅방이 선택됐을 때
  const mobileChatActive = Boolean(selectedId);

  if (loading) {
    return (
      <div className="py-12 text-center text-slate-500 text-fluid-sm">로딩 중…</div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minHeight: 0,
        minWidth: 0,
        gap: 12,
        height: '100%',
        overflow: 'hidden',
      }}
    >
      {/* 페이지 제목 - 모바일에서 채팅중일 때 숨김 */}
      <h1
        style={{
          fontSize: 20,
          fontWeight: 700,
          color: '#0f172a',
          letterSpacing: '-0.01em',
          flexShrink: 0,
        }}
        className={mobileChatActive ? 'max-md:hidden' : undefined}
      >
        메시지
      </h1>

      {/* 일괄 공지 패널 - 모바일에서 채팅중일 때 숨김 */}
      <div
        style={{
          flexShrink: 0,
          borderRadius: 12,
          border: '1px solid #e2e8f0',
          background: '#ffffff',
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
          overflow: 'hidden',
        }}
        className={mobileChatActive ? 'max-md:hidden' : undefined}
      >
        <button
          type="button"
          id="admin-broadcast-toggle"
          aria-expanded={broadcastOpen}
          aria-controls="admin-broadcast-panel"
          onClick={() => setBroadcastOpen((o) => !o)}
          style={{
            display: 'flex',
            width: '100%',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: '12px 16px',
            textAlign: 'left',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>📢</span>
            현장 공지(일괄 발송)
          </span>
          <ChevronDownIcon
            className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${broadcastOpen ? 'rotate-180' : ''}`}
          />
        </button>

        {broadcastOpen && (
          <div
            id="admin-broadcast-panel"
            role="region"
            aria-labelledby="admin-broadcast-toggle"
            style={{ borderTop: '1px solid #f1f5f9', padding: '16px', background: '#f8fafc' }}
          >
            <form onSubmit={handleBroadcast} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <fieldset
                style={{
                  border: '1px solid #e2e8f0',
                  borderRadius: 10,
                  padding: 12,
                  background: '#fff',
                }}
              >
                <legend className="sr-only">공지 수신 대상</legend>
                <p style={{ fontSize: 12, color: '#64748b', fontWeight: 500, marginBottom: 8 }}>수신 대상을 1개 이상 선택하세요.</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 20px' }}>
                  {[
                    { label: '팀장', value: toTeamLeaders, set: setToTeamLeaders },
                    { label: '외부업체', value: toExternalPartners, set: setToExternalPartners },
                    { label: '팀원(크루)', value: toCrew, set: setToCrew },
                  ].map(({ label, value, set }) => (
                    <label key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600, color: '#334155', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={value}
                        onChange={(e) => set(e.target.checked)}
                        disabled={broadcasting}
                        className="h-4 w-4 rounded border-slate-300 text-amber-500 focus:ring-amber-500"
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </fieldset>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <textarea
                  value={broadcastText}
                  onChange={(e) => setBroadcastText(e.target.value)}
                  rows={2}
                  placeholder="현장으로 공지할 내용을 입력하세요. 전송 시 대상의 채팅창에 일괄적으로 메시지가 남습니다."
                  style={{
                    flex: 1,
                    minWidth: 200,
                    maxHeight: 120,
                    resize: 'vertical',
                    borderRadius: 10,
                    border: '1px solid #cbd5e1',
                    padding: '10px 14px',
                    fontSize: 14,
                    outline: 'none',
                  }}
                  disabled={broadcasting}
                />
                <button
                  type="submit"
                  disabled={broadcasting || !broadcastText.trim() || (!toTeamLeaders && !toExternalPartners && !toCrew)}
                  style={{
                    height: 44,
                    padding: '0 20px',
                    borderRadius: 10,
                    background: '#fbbf24',
                    color: '#0f172a',
                    fontWeight: 700,
                    fontSize: 14,
                    border: 'none',
                    cursor: 'pointer',
                    opacity: (broadcasting || !broadcastText.trim() || (!toTeamLeaders && !toExternalPartners && !toCrew)) ? 0.5 : 1,
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  {broadcasting ? '전송 중…' : '공지 발송'}
                </button>
              </div>
            </form>
            {broadcastError && (
              <p style={{ marginTop: 8, fontSize: 12, color: '#dc2626', fontWeight: 600 }} role="alert">
                {broadcastError}
              </p>
            )}
          </div>
        )}
      </div>

      {/* 메인 채팅 레이아웃: 대화목록(좌) + 채팅방(우) */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'row',
          borderRadius: 12,
          border: '1px solid #e2e8f0',
          background: '#fff',
          boxShadow: '0 1px 6px rgba(0,0,0,0.07)',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* 좌측: 대화 목록 사이드바 */}
        {/* PC: 항상 260px 고정 / 모바일: 채팅 선택 전 = 전체폭, 선택 후 = 숨김 */}
        <div
          style={{
            flexDirection: 'column',
            borderRight: '1px solid #e8edf3',
            background: '#ffffff',
            flexShrink: 0,
          }}
          className={
            mobileChatActive
              ? 'hidden md:flex md:w-[260px] md:min-w-[260px] md:max-w-[260px]'
              : 'flex w-full md:w-[260px] md:min-w-[260px] md:max-w-[260px]'
          }
        >
          {/* 사이드바 헤더 */}
          <div
            style={{
              padding: '14px 16px 10px',
              borderBottom: '1px solid #f1f5f9',
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: 15, fontWeight: 700, color: '#1e293b' }}>대화 목록</span>
          </div>

          {/* 대화 목록 */}
          <div
            style={{
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
              WebkitOverflowScrolling: 'touch',
              overscrollBehavior: 'contain',
            }}
          >
            {conversations.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', fontSize: 13, color: '#94a3b8' }}>
                대화 상대가 없습니다.
              </div>
            ) : (
              conversations.map((c) => {
                const isActive = selectedId === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedId(c.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      width: '100%',
                      padding: '12px 14px',
                      textAlign: 'left',
                      border: 'none',
                      borderBottom: '1px solid #f8fafc',
                      background: isActive ? '#eef4ff' : 'transparent',
                      cursor: 'pointer',
                      transition: 'background 0.15s',
                      minWidth: 0,
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) e.currentTarget.style.background = '#f8fafc';
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <AvatarCircle name={c.name} photoUrl={c.staffIdCardUrl} size={42} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4, marginBottom: 2 }}>
                        <span style={{ fontWeight: 700, fontSize: 13, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                          {c.name}
                        </span>
                        {c.lastMessage && (
                          <span style={{ fontSize: 10, color: '#94a3b8', flexShrink: 0 }}>
                            {formatTimeForList(c.lastMessage.createdAt)}
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                        <span style={{ fontSize: 12, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                          {c.lastMessage ? c.lastMessage.content : '대화 시작하기'}
                        </span>
                        {c.unreadCount > 0 && (
                          <span
                            style={{
                              minWidth: 18,
                              height: 18,
                              borderRadius: 9,
                              background: '#ef4444',
                              color: '#fff',
                              fontSize: 10,
                              fontWeight: 700,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              padding: '0 5px',
                              flexShrink: 0,
                            }}
                          >
                            {c.unreadCount > 99 ? '99+' : c.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* 우측: 채팅 스레드 */}
        {/* PC: flex-1 항상 표시 / 모바일: 채팅 선택 시만 표시 */}
        <div
          className={`kakaotalk-chat-bg flex-1 min-w-0 min-h-0 flex-col ${!mobileChatActive ? 'hidden md:flex' : 'flex'}`}
        >
          {selected ? (
            <>
              {/* 채팅방 헤더 */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 14px',
                  background: 'rgba(255,255,255,0.97)',
                  borderBottom: '1px solid #dde5ef',
                  flexShrink: 0,
                  backdropFilter: 'blur(8px)',
                  zIndex: 5,
                }}
              >
                {/* 모바일: 뒤로가기 버튼 */}
                <button
                  type="button"
                  aria-label="채팅 목록으로"
                  onClick={() => setSelectedId(null)}
                  className="md:hidden"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                    color: '#475569',
                    marginLeft: -4,
                    flexShrink: 0,
                  }}
                >
                  <ChevronLeftIcon className="h-5 w-5" />
                </button>
                <AvatarCircle name={selected.name} photoUrl={selected.staffIdCardUrl} size={34} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {selected.name}
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>
                    {fieldPartnerRoleLabel(selected.role)}
                  </div>
                </div>
              </div>

              <div ref={chatScrollRef} className="kakaotalk-chat-scroll">
                {messages.map((m) => {
                  const isMine = m.senderId !== selectedId;
                  if (!isMine) {
                    return (
                      <div key={m.id} className="kakaotalk-message-row-other">
                        <AvatarCircle name={m.sender.name} photoUrl={m.sender.staffIdCardUrl} size={34} />
                        <div className="flex min-w-0 max-w-[calc(100%-50px)] flex-col gap-0.5">
                          <span className="ml-0.5 text-[11px] font-bold text-slate-700">{m.sender.name}</span>
                          <div className="flex min-w-0 items-end gap-1.5">
                            <div className="kakaotalk-bubble kakaotalk-bubble-other">{m.content}</div>
                            <span className="kakaotalk-time-indicator pb-0.5">
                              {formatTimeForList(m.createdAt)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={m.id} className="kakaotalk-message-row-mine">
                      <div className="flex min-w-0 items-end justify-end gap-1.5">
                        <MineMessageMeta message={m} />
                        <div className="kakaotalk-bubble kakaotalk-bubble-mine">{m.content}</div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              <form onSubmit={handleSend} className="kakaotalk-composer">
                {sendError ? (
                  <p className="kakaotalk-send-error" role="alert">
                    {sendError}
                  </p>
                ) : null}
                <div className="kakaotalk-composer-row">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => {
                      setInput(e.target.value);
                      if (sendError) setSendError(null);
                    }}
                    placeholder="메시지를 입력하세요..."
                    className="kakaotalk-composer-input"
                    disabled={sending}
                    autoComplete="off"
                  />
                  <button
                    type="submit"
                    disabled={sending || !input.trim()}
                    className="kakaotalk-composer-send"
                  >
                    전송
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#4b5b6e',
                fontSize: 14,
                fontWeight: 500,
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <span style={{ fontSize: 36 }}>💬</span>
              <span>대화방을 선택하여 채팅을 시작해 보세요.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
