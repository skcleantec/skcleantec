import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getActiveAdSession,
  getAdChannels,
  startAdSession,
  type ActiveSession,
  type AdChannel,
} from '../../api/advertising';
import { getToken } from '../../stores/auth';
import { DashboardAdSettleButton } from '../dashboard/dashboardUiParts';
import { AdWorkSessionEndModal } from '../advertising/AdWorkSessionEndModal';
import { DashboardTopCard } from './dashboard/DashboardTopCard';

export function TelemarketingSessionBlock() {
  const token = getToken();
  const [session, setSession] = useState<ActiveSession | null>(null);
  const [channels, setChannels] = useState<AdChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const autoStartAttempted = useRef(false);
  const prevHadSession = useRef(false);

  const refresh = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [active, chRes] = await Promise.all([getActiveAdSession(token), getAdChannels(token)]);
      setSession(active.session);
      setChannels(chRes.items.filter((c) => c.isActive));
    } catch (e) {
      setError(e instanceof Error ? e.message : '불러오기 실패');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (prevHadSession.current && !session) {
      autoStartAttempted.current = false;
    }
    prevHadSession.current = Boolean(session);
  }, [session]);

  useEffect(() => {
    if (!token || loading || channels.length === 0) return;
    if (session) return;
    if (autoStartAttempted.current) return;
    autoStartAttempted.current = true;
    let cancelled = false;
    void (async () => {
      try {
        await startAdSession(token);
      } catch {
        /* 이미 진행 중 등 */
      }
      if (!cancelled) await refresh();
    })();
    return () => {
      cancelled = true;
    };
  }, [token, loading, session, channels.length, refresh]);

  if (!token) return null;

  return (
    <DashboardTopCard>
      <h2 className="text-base font-semibold text-slate-900">텔레마케팅 · 광고비</h2>
      <p className="mt-1.5 flex-1 text-fluid-xs leading-snug text-slate-600">
        업무 종료 시 채널별로 당일 광고비를 저장합니다. 건수 방식 채널은 관리자 「광고비 → 설정」에서 과목·단가를
        맞춘 뒤 건수만 입력하면 됩니다.
      </p>

      {error ? (
        <div className="mb-3 text-fluid-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</div>
      ) : null}

      <div className="mt-auto pt-4">
        {loading ? (
          <p className="text-fluid-xs text-slate-500">불러오는 중…</p>
        ) : session ? (
          <div className="flex flex-wrap items-center gap-3">
            <DashboardAdSettleButton onClick={() => setModalOpen(true)} disabled={channels.length === 0} />
            {channels.length === 0 ? (
              <span className="text-fluid-2xs text-amber-700">
                채널이 없습니다. 관리자가 <strong className="text-slate-800">광고비 → 설정</strong>에서 채널을 추가하세요.
              </span>
            ) : null}
          </div>
        ) : channels.length === 0 ? (
          <p className="text-fluid-xs text-slate-500">활성 광고 채널이 없습니다. 관리자가 광고비 메뉴에서 채널을 추가할 수 있습니다.</p>
        ) : (
          <p className="text-fluid-xs text-slate-500">세션 준비 중… 잠시 후 새로고침해 주세요.</p>
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
    </DashboardTopCard>
  );
}
