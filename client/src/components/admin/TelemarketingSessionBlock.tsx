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
import type { DashboardAuxBlockVariant } from './dashboard/DashboardPageSections';

function TelemarketingIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 11v2a2 2 0 002 2h1l3.5 3.5a2 2 0 002.83 0L19 11.5V9a2 2 0 00-2-2h-1.5" />
      <path d="M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2" />
      <path d="M12 14v3" />
      <path d="M8 17h8" />
    </svg>
  );
}

export function TelemarketingSessionBlock({ variant = 'card' }: { variant?: DashboardAuxBlockVariant }) {
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

  const settleButtonClass =
    variant === 'row'
      ? 'rounded-lg bg-gradient-to-r from-amber-600 to-orange-600 px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm hover:from-amber-700 hover:to-orange-700 disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation whitespace-nowrap'
      : undefined;

  if (variant === 'row') {
    return (
      <>
        <div className="flex min-w-0 items-center gap-2.5 px-3 py-2.5">
          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-sm">
            <TelemarketingIcon className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-fluid-2xs font-semibold text-amber-950">텔레마케팅 · 광고비</h2>
            <p className="truncate text-[11px] text-slate-500">
              {error
                ? error
                : loading
                  ? '불러오는 중…'
                  : session
                    ? '업무 종료 시 채널별 당일 광고비 저장'
                    : '세션 준비 중…'}
            </p>
          </div>
          {session && !loading ? (
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              disabled={channels.length === 0}
              className={settleButtonClass}
            >
              정산
            </button>
          ) : null}
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

  return (
    <DashboardTopCard accent="amber">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-md shadow-amber-200/80">
          <TelemarketingIcon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-amber-950">텔레마케팅 · 광고비</h2>
          <p className="mt-1.5 flex-1 text-fluid-xs leading-snug text-slate-600">
            업무 종료 시 채널별로 당일 광고비를 저장합니다. 건수 방식 채널은 관리자 「광고비 → 설정」에서 과목·단가를
            맞춘 뒤 건수만 입력하면 됩니다.
          </p>
        </div>
      </div>

      {error ? (
        <div className="mt-3 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-fluid-xs text-red-600">
          {error}
        </div>
      ) : null}

      <div className="mt-auto pt-4">
        {loading ? (
          <p className="text-fluid-xs text-slate-500">불러오는 중…</p>
        ) : session ? (
          <div className="flex flex-wrap items-center gap-3">
            <DashboardAdSettleButton onClick={() => setModalOpen(true)} disabled={channels.length === 0} />
            {channels.length === 0 ? (
              <span className="text-fluid-2xs text-amber-800">
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
