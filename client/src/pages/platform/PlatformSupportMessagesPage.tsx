import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  broadcastPlatformSupportMessage,
  getPlatformSupportThread,
  getPlatformSupportUnreadCount,
  listPlatformSupportTenants,
  listPlatformSupportThreads,
  sendPlatformSupportMessage,
  type PlatformSupportMessageDto,
  type PlatformSupportThreadDto,
  type PlatformSupportThreadListItem,
} from '../../api/platformSupportMessages';
import { ListPaginationBar } from '../../components/ui/ListPaginationBar';
import { LineMdIcon } from '../../components/ui/LineMdIcon';
import { BTN_PRIMARY, BTN_SECONDARY, CARD_SECTION, INPUT_BASE } from '../../utils/platformUi';
import {
  INQUIRY_LIST_DEFAULT_PAGE_SIZE,
  clampListPage,
  parseInquiryListPageSize,
  parseListPage,
} from '../../utils/listPagination';

type WaitingFilter = 'all' | 'PLATFORM' | 'unread';

function formatWhen(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function PlatformSupportMessagesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tenantSlugFromUrl = searchParams.get('tenant')?.trim() ?? '';
  const page = parseListPage(searchParams.get('page'));
  const pageSize = parseInquiryListPageSize(searchParams.get('pageSize')) || INQUIRY_LIST_DEFAULT_PAGE_SIZE;
  const q = searchParams.get('q') ?? '';
  const waiting = (searchParams.get('waiting') as WaitingFilter) || 'all';

  const [items, setItems] = useState<PlatformSupportThreadListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [unreadNav, setUnreadNav] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [thread, setThread] = useState<PlatformSupportThreadDto | null>(null);
  const [threadLoading, setThreadLoading] = useState(false);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  const setQuery = (patch: Record<string, string | null>) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [k, v] of Object.entries(patch)) {
          if (!v) next.delete(k);
          else next.set(k, v);
        }
        return next;
      },
      { replace: true },
    );
  };

  const loadList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, unread] = await Promise.all([
        listPlatformSupportThreads({
          q: q.trim() || undefined,
          waiting: waiting === 'PLATFORM' ? 'PLATFORM' : 'all',
          unreadOnly: waiting === 'unread',
          limit: pageSize,
          offset: (page - 1) * pageSize,
        }),
        getPlatformSupportUnreadCount(),
      ]);
      setItems(list.items);
      setTotal(list.total);
      setUnreadNav(unread);
      if (tenantSlugFromUrl && !selectedTenantId) {
        const hit = list.items.find((row) => row.tenantSlug === tenantSlugFromUrl);
        if (hit) setSelectedTenantId(hit.tenantId);
        else {
          const all = await listPlatformSupportTenants(tenantSlugFromUrl);
          const match = all.find((t) => t.slug === tenantSlugFromUrl);
          if (match) setSelectedTenantId(match.id);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '목록을 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  }, [q, waiting, page, pageSize, tenantSlugFromUrl, selectedTenantId]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    if (!selectedTenantId) {
      setThread(null);
      return;
    }
    setThreadLoading(true);
    void getPlatformSupportThread(selectedTenantId)
      .then((row) => {
        setThread(row);
        setQuery({ tenant: row.tenantSlug });
      })
      .catch((e) => setSendError(e instanceof Error ? e.message : '대화를 불러올 수 없습니다.'))
      .finally(() => setThreadLoading(false));
  }, [selectedTenantId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'auto' });
  }, [thread?.messages.length]);

  const safePage = clampListPage(page, total, pageSize);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTenantId || !reply.trim() || sending) return;
    setSending(true);
    setSendError(null);
    try {
      const msg = await sendPlatformSupportMessage(selectedTenantId, reply.trim());
      setThread((prev) =>
        prev ? { ...prev, messages: [...prev.messages, msg], unreadCount: 0 } : prev,
      );
      setReply('');
      void loadList();
    } catch (err) {
      setSendError(err instanceof Error ? err.message : '전송에 실패했습니다.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">메시지</h1>
          <p className="mt-1 text-fluid-xs text-slate-500">
            업체 관리자·마케터와 1:1로 주고받습니다. 업체가 보내면 이용료 알림 메일로도 옵니다.
          </p>
        </div>
        <button type="button" className={BTN_PRIMARY} onClick={() => setComposeOpen(true)}>
          새 메시지
        </button>
      </div>

      <div className={`${CARD_SECTION} !p-3 sm:!p-4`}>
        <div className="flex flex-wrap items-center gap-2">
          <input
            className={`${INPUT_BASE} max-w-xs`}
            value={q}
            onChange={(e) => setQuery({ q: e.target.value || null, page: '1' })}
            placeholder="업체명·코드 검색"
          />
          {(
            [
              { id: 'all', label: '전체' },
              { id: 'unread', label: unreadNav > 0 ? `안 읽음 ${unreadNav}` : '안 읽음' },
              { id: 'PLATFORM', label: '답장 대기' },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setQuery({ waiting: opt.id === 'all' ? null : opt.id, page: '1' })}
              className={`rounded-lg border px-2.5 py-1.5 text-fluid-2xs hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 ${
                waiting === opt.id ? 'border-slate-900 bg-slate-900 text-white hover:bg-slate-800' : 'border-slate-200 text-slate-600'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <ListPaginationBar
          mode="summary"
          page={safePage}
          pageSize={pageSize}
          total={total}
          onPageChange={(p) => setQuery({ page: String(p) })}
          onPageSizeChange={(n) => setQuery({ pageSize: String(n), page: '1' })}
        />
      </div>

      {error ? <p className="text-fluid-sm text-red-600">{error}</p> : null}

      <div className="grid min-h-[480px] grid-cols-1 overflow-hidden rounded-xl border border-slate-200 bg-white lg:grid-cols-[minmax(0,280px)_1fr]">
        <div className="min-h-0 border-b border-slate-100 lg:border-b-0 lg:border-r">
          <div className="max-h-[40vh] overflow-y-auto lg:max-h-[70vh]">
            {loading && items.length === 0 ? (
              <p className="p-6 text-center text-fluid-sm text-slate-400">불러오는 중…</p>
            ) : items.length === 0 ? (
              <p className="p-6 text-center text-fluid-sm text-slate-400">대화가 없습니다.</p>
            ) : (
              items.map((row) => {
                const active = row.tenantId === selectedTenantId;
                return (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => setSelectedTenantId(row.tenantId)}
                    className={`flex w-full min-w-0 items-start gap-2 border-b border-slate-50 px-3 py-2.5 text-left hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${
                      active ? 'bg-slate-100' : ''
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-fluid-sm font-semibold text-slate-900">{row.tenantName}</span>
                        <span className="shrink-0 text-fluid-2xs text-slate-400">{formatWhen(row.lastMessageAt)}</span>
                      </div>
                      <p className="truncate text-fluid-xs text-slate-500">{row.lastMessagePreview || '대화 없음'}</p>
                    </div>
                    {row.unread ? (
                      <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-red-500" aria-label="안 읽음" />
                    ) : null}
                  </button>
                );
              })
            )}
          </div>
          {!loading ? (
            <ListPaginationBar
              mode="nav"
              page={safePage}
              pageSize={pageSize}
              total={total}
              onPageChange={(p) => setQuery({ page: String(p) })}
              onPageSizeChange={(n) => setQuery({ pageSize: String(n), page: '1' })}
            />
          ) : null}
        </div>

        <div className="flex min-h-[360px] min-w-0 flex-col">
          {threadLoading && !thread ? (
            <p className="m-auto text-fluid-sm text-slate-400">불러오는 중…</p>
          ) : thread ? (
            <>
              <div className="shrink-0 border-b border-slate-100 px-4 py-3">
                <p className="text-fluid-sm font-semibold text-slate-900">{thread.tenantName}</p>
                <p className="text-fluid-2xs text-slate-500">{thread.tenantSlug}</p>
              </div>
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
                {thread.messages.length === 0 ? (
                  <p className="text-center text-fluid-sm text-slate-400">아직 메시지가 없습니다.</p>
                ) : (
                  thread.messages.map((m) => <Bubble key={m.id} message={m} mine={m.senderKind === 'PLATFORM'} />)
                )}
                <div ref={endRef} />
              </div>
              <form onSubmit={handleSend} className="shrink-0 space-y-2 border-t border-slate-100 p-3">
                <textarea
                  className={`${INPUT_BASE} min-h-20 resize-y`}
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="답장을 입력하세요"
                />
                {sendError ? <p className="text-fluid-xs text-red-600">{sendError}</p> : null}
                <button type="submit" className={BTN_PRIMARY} disabled={sending || !reply.trim()}>
                  {sending ? '보내는 중…' : '보내기'}
                </button>
              </form>
            </>
          ) : (
            <p className="m-auto px-6 text-center text-fluid-sm text-slate-400">왼쪽에서 업체를 고르거나 「새 메시지」로 보내세요.</p>
          )}
        </div>
      </div>

      {composeOpen ? (
        <ComposeModal
          onClose={() => setComposeOpen(false)}
          onSent={() => {
            setComposeOpen(false);
            void loadList();
          }}
        />
      ) : null}
    </div>
  );
}

function Bubble({ message, mine }: { message: PlatformSupportMessageDto; mine: boolean }) {
  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-fluid-sm ${mine ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-800'}`}>
        <p className={`mb-0.5 text-fluid-2xs ${mine ? 'text-slate-300' : 'text-slate-500'}`}>
          {message.senderName}
          {message.senderRoleLabel ? ` · ${message.senderRoleLabel}` : ''}
          {message.broadcastBatchId ? ' · 단체' : ''}
        </p>
        <p className="whitespace-pre-wrap break-words">{message.body}</p>
        <p className={`mt-1 text-fluid-2xs ${mine ? 'text-slate-400' : 'text-slate-400'}`}>{formatWhen(message.createdAt)}</p>
      </div>
    </div>
  );
}

function ComposeModal({ onClose, onSent }: { onClose: () => void; onSent: () => void }) {
  const [mode, setMode] = useState<'all' | 'pick'>('all');
  const [q, setQ] = useState('');
  const [tenants, setTenants] = useState<{ id: string; name: string; slug: string }[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void listPlatformSupportTenants(q).then(setTenants).catch(() => setTenants([]));
  }, [q]);

  const targetLabel = useMemo(() => {
    if (mode === 'all') return `이용 중인 업체 전체 (${tenants.length}곳)`;
    if (picked.length === 0) return '업체를 선택하세요';
    return `${picked.length}곳`;
  }, [mode, picked.length, tenants.length]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim() || sending) return;
    if (mode === 'pick' && picked.length === 0) {
      setError('보낼 업체를 선택해 주세요.');
      return;
    }
    const ok = window.confirm(`${targetLabel}에 메시지를 보낼까요?`);
    if (!ok) return;
    setSending(true);
    setError(null);
    try {
      await broadcastPlatformSupportMessage(body.trim(), mode === 'all' ? undefined : picked);
      onSent();
    } catch (err) {
      setError(err instanceof Error ? err.message : '전송에 실패했습니다.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4">
      <form
        onSubmit={submit}
        className="flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <h2 className="text-fluid-sm font-semibold text-slate-900">새 메시지</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
            aria-label="닫기"
          >
            <LineMdIcon name="close" className="size-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
          <div className="flex gap-2">
            <button
              type="button"
              className={`${mode === 'all' ? BTN_PRIMARY : BTN_SECONDARY} !px-3 !py-1.5 text-fluid-xs`}
              onClick={() => setMode('all')}
            >
              전체
            </button>
            <button
              type="button"
              className={`${mode === 'pick' ? BTN_PRIMARY : BTN_SECONDARY} !px-3 !py-1.5 text-fluid-xs`}
              onClick={() => setMode('pick')}
            >
              개별·여러 업체
            </button>
          </div>
          <p className="text-fluid-xs text-slate-500">{targetLabel}</p>
          {mode === 'pick' ? (
            <>
              <input
                className={INPUT_BASE}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="업체 검색"
              />
              <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
                {tenants.map((t) => {
                  const on = picked.includes(t.id);
                  return (
                    <label key={t.id} className="flex items-center gap-2 rounded px-1 py-1 text-fluid-xs hover:bg-slate-50">
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() =>
                          setPicked((prev) => (on ? prev.filter((id) => id !== t.id) : [...prev, t.id]))
                        }
                      />
                      <span className="truncate">
                        {t.name} <span className="text-slate-400">({t.slug})</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </>
          ) : null}
          <textarea
            className={`${INPUT_BASE} min-h-28 resize-y`}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="보낼 내용을 입력하세요"
            required
          />
          {error ? <p className="text-fluid-xs text-red-600">{error}</p> : null}
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-100 px-4 py-3">
          <button type="button" className={BTN_SECONDARY} onClick={onClose}>
            취소
          </button>
          <button type="submit" className={BTN_PRIMARY} disabled={sending || !body.trim()}>
            {sending ? '보내는 중…' : '보내기'}
          </button>
        </div>
      </form>
    </div>
  );
}
