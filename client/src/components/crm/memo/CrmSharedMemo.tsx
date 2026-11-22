import { useCallback, useEffect, useState } from 'react';
import { getToken } from '../../../stores/auth';
import { getScheduleStaffNoticeBoard, type ScheduleStaffNoticeBoardDto } from '../../../api/schedule';
import { useScheduleStaffNoticeBoardRealtime } from '../../../hooks/useInboxRealtime';
import { ScheduleStaffNoticeBoardPanel } from '../../admin/ScheduleStaffNoticeBoardPanel';

const SEEN_KEY = 'crm.sharedMemo.seenAt.v1';
const PIN_KEY = 'crm.sharedMemo.pinned.v1';

function readLocal(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLocal(key: string, value: string | null) {
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* 저장이 안 돼도 화면은 그대로 쓴다 */
  }
}

/** 스케줄 화면의 「공유 메모」를 CRM에서 같이 본다 — 새 글 표시와 한 줄 고정을 맡는다. */
export function useCrmSharedMemo(enabled: boolean) {
  const token = getToken();
  const [board, setBoard] = useState<ScheduleStaffNoticeBoardDto | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [seenAt, setSeenAt] = useState<string | null>(() => readLocal(SEEN_KEY));
  const [pinned, setPinnedState] = useState(() => readLocal(PIN_KEY) === '1');

  const load = useCallback(() => {
    if (!token || !enabled) return;
    getScheduleStaffNoticeBoard(token)
      .then((res) => {
        setBoard(res);
        setBlocked(false);
      })
      .catch(() => setBlocked(true));
  }, [token, enabled]);

  useEffect(() => {
    load();
  }, [load]);

  useScheduleStaffNoticeBoardRealtime(token, load, enabled && Boolean(token));

  const updatedAt = board?.updatedAt ?? null;
  const hasBody = Boolean(board?.body.trim());
  const unread = hasBody && updatedAt != null && updatedAt !== seenAt;

  const markSeen = useCallback(() => {
    if (!updatedAt) return;
    setSeenAt(updatedAt);
    writeLocal(SEEN_KEY, updatedAt);
  }, [updatedAt]);

  const setPinned = useCallback((next: boolean) => {
    setPinnedState(next);
    writeLocal(PIN_KEY, next ? '1' : null);
  }, []);

  return { board, blocked, unread, hasBody, markSeen, pinned, setPinned, reload: load };
}

export function CrmIconMemo({ className = 'h-[18px] w-[18px]' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 3h9l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 10h6M9 14h6M9 18h3" />
    </svg>
  );
}

/** 도구 메뉴를 펼쳤을 때 단추 아래에 바로 보이는 메모 쪽지 — 누르면 창이 열린다 */
export function CrmSharedMemoNote({
  body,
  unread,
  updatedBy,
  onOpen,
}: {
  body: string;
  unread: boolean;
  updatedBy?: string | null;
  onOpen: () => void;
}) {
  const text = body.trim();
  return (
    <button
      type="button"
      onClick={onOpen}
      title="공유 메모 크게 보기"
      className="flex min-h-0 flex-1 flex-col rounded-xl border border-[#f3d58a] bg-[#fffbeb] px-2 py-1.5 text-left hover:bg-[#fef3c7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
    >
      <span className="flex shrink-0 items-center gap-1 text-[11px] font-bold text-amber-950">
        공유 메모
        {unread ? <span className="h-1.5 w-1.5 rounded-full bg-rose-500" aria-label="새 글" /> : null}
      </span>
      <span className="mt-1 min-h-0 flex-1 overflow-y-auto whitespace-pre-wrap break-words text-[11.5px] leading-snug text-slate-800">
        {text || '아직 적힌 메모가 없어요.'}
      </span>
      {updatedBy ? <span className="mt-1 shrink-0 truncate text-[10.5px] text-amber-900/80">{updatedBy}</span> : null}
    </button>
  );
}

/** 맨 위 한 줄 고정 띠 */
export function CrmSharedMemoStrip({
  body,
  unread,
  onOpen,
  onUnpin,
}: {
  body: string;
  unread: boolean;
  onOpen: () => void;
  onUnpin: () => void;
}) {
  // 한 줄에 들어가는 만큼 — 줄바꿈은 「 · 」로 이어 붙인다
  const firstLine = body
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join(' · ');
  if (!firstLine) return null;
  return (
    <div className="flex items-center gap-2 border-b border-[#f3d58a] bg-[#fffbeb] px-3 py-1 text-fluid-xs text-amber-950">
      <span className="inline-flex shrink-0 items-center gap-1 font-bold">
        <CrmIconMemo className="h-3.5 w-3.5" />
        공유 메모
        {unread ? <span className="h-1.5 w-1.5 rounded-full bg-rose-500" aria-label="새 글" /> : null}
      </span>
      <span className="min-w-0 flex-1 truncate">{firstLine}</span>
      <button
        type="button"
        onClick={onOpen}
        className="inline-flex h-6 shrink-0 items-center rounded-md border border-amber-300 bg-white px-2 text-fluid-2xs font-semibold text-amber-900 hover:bg-amber-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
      >
        펼치기
      </button>
      <button
        type="button"
        onClick={onUnpin}
        className="inline-flex h-6 shrink-0 items-center rounded-md px-1.5 text-fluid-2xs font-semibold text-amber-900/80 hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
      >
        고정 풀기
      </button>
    </div>
  );
}

/** 도구 메뉴 옆에서 열리는 공유 메모 창 */
export function CrmSharedMemoDrawer({
  open,
  onClose,
  canEdit,
  blocked,
  pinned,
  onTogglePin,
}: {
  open: boolean;
  onClose: () => void;
  canEdit: boolean;
  /** 메모를 볼 권한이 없을 때 */
  blocked: boolean;
  pinned: boolean;
  onTogglePin: () => void;
}) {
  const token = getToken();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !token) return null;

  return (
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label="공유 메모">
      <button type="button" aria-label="닫기" onClick={onClose} className="absolute inset-0 cursor-default bg-slate-900/20" />
      <div className="absolute inset-y-0 left-0 flex w-[min(420px,92vw)] flex-col bg-white shadow-2xl">
        <div className="flex items-center gap-2 border-b border-slate-200 px-3 py-2.5">
          <p className="min-w-0 flex-1 text-fluid-sm font-bold text-slate-900">공유 메모</p>
          {!blocked ? (
            <button
              type="button"
              aria-pressed={pinned}
              onClick={onTogglePin}
              className={`inline-flex h-7 items-center rounded-lg border px-2 text-fluid-2xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                pinned ? 'border-amber-500 bg-amber-500 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {pinned ? '위에 고정됨' : '위에 한 줄로 고정'}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-7 items-center rounded-lg px-2 text-fluid-2xs font-semibold text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
          >
            닫기
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
          {blocked ? (
            <p className="rounded-xl border border-dashed border-slate-300 px-3 py-3 text-fluid-xs leading-relaxed text-slate-700">
              이 계정은 공유 메모를 볼 권한이 없어요. 관리자에게 스케줄 보기 권한을 요청해 주세요.
            </p>
          ) : (
            <>
              <p className="text-fluid-2xs leading-relaxed text-slate-600">
                스케줄 화면의 「공유 메모」와 같은 내용이에요. 누가 고치면 바로 바뀌어요.
                {canEdit ? '' : ' 이 계정은 보기만 할 수 있어요.'}
              </p>
              <ScheduleStaffNoticeBoardPanel token={token} canEdit={canEdit} canResize={false} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
