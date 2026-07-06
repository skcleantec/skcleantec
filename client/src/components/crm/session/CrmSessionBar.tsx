import { useCallback, useEffect, useRef, useState } from 'react';
import { getToken } from '../../../stores/auth';
import { getActiveAdSession, getAdChannels, startAdSession, type ActiveSession } from '../../../api/advertising';
import { AdWorkSessionEndModal } from '../../advertising/AdWorkSessionEndModal';

function SessionPulseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path strokeLinecap="round" d="M4 12h4l2-7 4 14 2-7h4" />
    </svg>
  );
}

/** CRM 헤더 — 광고 세션 상태·종료 (mod_advertising + ads.sessions) */
export function CrmSessionBar({ enabled }: { enabled: boolean }) {
  const token = getToken();
  const [session, setSession] = useState<ActiveSession | null>(null);
  const [channels, setChannels] = useState<Awaited<ReturnType<typeof getAdChannels>>['items']>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const autoStartAttempted = useRef(false);

  const refresh = useCallback(async () => {
    if (!token || !enabled) return;
    setLoading(true);
    try {
      const [active, chRes] = await Promise.all([getActiveAdSession(token), getAdChannels(token)]);
      setSession(active.session);
      setChannels(chRes.items.filter((c) => c.isActive));
    } catch {
      setSession(null);
    } finally {
      setLoading(false);
    }
  }, [token, enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!enabled || !token || loading || session || channels.length === 0) return;
    if (autoStartAttempted.current) return;
    autoStartAttempted.current = true;
    void startAdSession(token)
      .catch(() => {})
      .then(() => refresh());
  }, [enabled, token, loading, session, channels.length, refresh]);

  if (!enabled || !token) return null;

  return (
    <>
      <div className="inline-flex max-w-full shrink-0 flex-nowrap items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-1 text-fluid-xs whitespace-nowrap sm:gap-2 sm:px-2.5">
        {loading ? (
          <span className="text-white/60">세션…</span>
        ) : session ? (
          <>
            <span className="relative inline-flex h-2 w-2 shrink-0" aria-hidden>
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            <SessionPulseIcon className="h-3.5 w-3.5 shrink-0 text-emerald-300" />
            <span className="shrink-0 font-medium text-emerald-100">광고 세션</span>
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="shrink-0 rounded-md bg-emerald-500/25 px-2 py-0.5 font-semibold text-emerald-50 hover:bg-emerald-500/40"
            >
              종료·정산
            </button>
          </>
        ) : channels.length === 0 ? (
          <span className="text-white/50">광고 채널 없음</span>
        ) : (
          <span className="text-white/60">세션 준비 중</span>
        )}
      </div>
      <AdWorkSessionEndModal
        open={modalOpen}
        token={token}
        channels={channels}
        onClose={() => setModalOpen(false)}
        onEnded={() => {
          setModalOpen(false);
          void refresh();
        }}
      />
    </>
  );
}
