import { useCallback, useEffect, useRef, useState } from 'react';
import { getToken } from '../../../stores/auth';
import { getActiveAdSession, getAdChannels, startAdSession, type ActiveSession } from '../../../api/advertising';
import { AdWorkSessionEndModal } from '../../advertising/AdWorkSessionEndModal';

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
      <div className="flex items-center gap-2 text-fluid-xs">
        {loading ? (
          <span className="text-white/60">세션…</span>
        ) : session ? (
          <>
            <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400" aria-hidden />
            <span className="text-white/90">광고 세션 진행 중</span>
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="rounded-md border border-white/25 px-2 py-0.5 hover:bg-white/10"
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
