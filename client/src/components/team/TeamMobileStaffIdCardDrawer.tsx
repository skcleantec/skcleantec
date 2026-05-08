import { useState, useEffect, useRef, useCallback, useSyncExternalStore, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { formatPreferredDateInputYmd } from '../../utils/dateFormat';
import { pickStaffHonorificsForUserId } from '../../utils/staffIdCardHonorifics';
import { pickSyntheticHireYmdForUserId } from '../../utils/staffIdSyntheticHire';
import { teamT } from '../../i18n/team/teamI18n';

const MOBILE_MQ = '(max-width: 639px)';
const EDGE_PX = 40;
const LS_EDGE_BOTTOM_VH = 'skcleanteck:teamStaffIdCardEdgeBottomVh';
const LONG_PRESS_MS = 420;
const CANCEL_HOLD_MOVE_PX = 14;
const TAP_MAX_MOVE_PX = 12;
const TAP_MAX_MS = 500;
const EDGE_VH_MIN = 12;
const EDGE_VH_MAX = 78;
const DEFAULT_EDGE_BOTTOM_VH = 22;

function clampEdgeVh(v: number): number {
  return Math.min(EDGE_VH_MAX, Math.max(EDGE_VH_MIN, v));
}

function subscribeMobile(cb: () => void) {
  const mq = window.matchMedia(MOBILE_MQ);
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
}

function getMobileServerSnapshot() {
  return false;
}

function getMobileSnapshot() {
  return window.matchMedia(MOBILE_MQ).matches;
}

function formatHireDisplay(iso: string | null | undefined): string {
  if (!iso) return '';
  const ymd = formatPreferredDateInputYmd(iso);
  if (!ymd) return '';
  return ymd.replace(/-/g, '.');
}

type Props = {
  viewerUserId: string | null | undefined;
  imageUrl: string | null | undefined;
  hireDateIso: string | null | undefined;
  viewerName: string | null | undefined;
  /** TEAM_LEADER / EXTERNAL_PARTNER 등 사원증 대상만 true */
  show: boolean;
};

/**
 * 모바일(639px 이하) — 오른쪽 엣지 스와이프 또는 탭으로 사원증 패널.
 * 엣지 탭은 길게 누른 뒤 위아래로 드래그해 세로 위치 저장(localStorage).
 */
export function TeamMobileStaffIdCardDrawer({
  viewerUserId,
  imageUrl,
  hireDateIso,
  viewerName,
  show,
}: Props) {
  const isMobile = useSyncExternalStore(subscribeMobile, getMobileSnapshot, getMobileServerSnapshot);
  const [open, setOpen] = useState(false);
  const [edgeBottomVh, setEdgeBottomVh] = useState(DEFAULT_EDGE_BOTTOM_VH);
  const [repositionGlow, setRepositionGlow] = useState(false);
  const touchRef = useRef<{ x: number; y: number } | null>(null);
  const tabRef = useRef<HTMLButtonElement>(null);
  const edgeBottomVhRef = useRef(DEFAULT_EDGE_BOTTOM_VH);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointerDownRef = useRef<{ t: number; x: number; y: number } | null>(null);
  const lastPointerYRef = useRef(0);
  const pointerIdRef = useRef<number | null>(null);
  const repositioningRef = useRef(false);
  const dragRef = useRef<{ y: number; bottomVh: number } | null>(null);
  const blockNextClickRef = useRef(false);

  const enabled = Boolean(show && imageUrl && isMobile);

  useEffect(() => {
    edgeBottomVhRef.current = edgeBottomVh;
  }, [edgeBottomVh]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_EDGE_BOTTOM_VH);
      if (raw == null) return;
      const n = Number(raw);
      if (Number.isFinite(n)) setEdgeBottomVh(clampEdgeVh(n));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!enabled) setOpen(false);
  }, [enabled]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const clearHoldTimer = useCallback(() => {
    if (holdTimerRef.current != null) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  }, []);

  const endReposition = useCallback(
    (el: HTMLElement | null, pointerId: number | null) => {
      repositioningRef.current = false;
      dragRef.current = null;
      setRepositionGlow(false);
      if (el && pointerId != null) {
        try {
          el.releasePointerCapture(pointerId);
        } catch {
          /* already released */
        }
      }
      try {
        localStorage.setItem(LS_EDGE_BOTTOM_VH, String(edgeBottomVhRef.current));
      } catch {
        /* ignore */
      }
    },
    [],
  );

  const onEdgeTouchStart = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0];
    if (t.clientX < window.innerWidth - EDGE_PX) {
      touchRef.current = null;
      return;
    }
    touchRef.current = { x: t.clientX, y: t.clientY };
  }, []);

  const onEdgeTouchEnd = useCallback((e: React.TouchEvent) => {
    if (repositioningRef.current) return;
    const start = touchRef.current;
    touchRef.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = start.x - t.clientX;
    const dy = Math.abs(start.y - t.clientY);
    if (dx > 52 && dy < 72) {
      setOpen(true);
    }
  }, []);

  const onTabPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      pointerDownRef.current = { t: Date.now(), x: e.clientX, y: e.clientY };
      lastPointerYRef.current = e.clientY;
      pointerIdRef.current = e.pointerId;
      clearHoldTimer();
      holdTimerRef.current = setTimeout(() => {
        holdTimerRef.current = null;
        const tab = tabRef.current;
        const pid = pointerIdRef.current;
        if (!tab || pid == null) return;
        repositioningRef.current = true;
        setRepositionGlow(true);
        dragRef.current = { y: lastPointerYRef.current, bottomVh: edgeBottomVhRef.current };
        try {
          tab.setPointerCapture(pid);
        } catch {
          /* ignore */
        }
      }, LONG_PRESS_MS);
    },
    [clearHoldTimer],
  );

  const onTabPointerMove = useCallback(
    (e: React.PointerEvent) => {
      lastPointerYRef.current = e.clientY;
      const down = pointerDownRef.current;
      if (down && !repositioningRef.current && holdTimerRef.current != null) {
        const d = Math.hypot(e.clientX - down.x, e.clientY - down.y);
        if (d > CANCEL_HOLD_MOVE_PX) clearHoldTimer();
      }
      if (!repositioningRef.current || !dragRef.current) return;
      const deltaY = dragRef.current.y - e.clientY;
      const deltaVh = (deltaY / Math.max(window.innerHeight, 1)) * 100;
      const next = clampEdgeVh(dragRef.current.bottomVh + deltaVh);
      edgeBottomVhRef.current = next;
      setEdgeBottomVh(next);
      dragRef.current = { y: e.clientY, bottomVh: next };
    },
    [clearHoldTimer],
  );

  const onTabPointerUp = useCallback(
    (e: React.PointerEvent) => {
      const wasRepositioning = repositioningRef.current;
      if (wasRepositioning) {
        blockNextClickRef.current = true;
        endReposition(tabRef.current, e.pointerId);
        pointerDownRef.current = null;
        clearHoldTimer();
        return;
      }
      clearHoldTimer();
      const down = pointerDownRef.current;
      pointerDownRef.current = null;
      if (!down) return;
      const elapsed = Date.now() - down.t;
      const d = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      if (elapsed < TAP_MAX_MS && d < TAP_MAX_MOVE_PX) {
        setOpen(true);
      }
    },
    [clearHoldTimer, endReposition],
  );

  const onTabPointerCancel = useCallback(
    (e: React.PointerEvent) => {
      clearHoldTimer();
      pointerDownRef.current = null;
      if (repositioningRef.current) {
        blockNextClickRef.current = true;
        endReposition(tabRef.current, e.pointerId);
      }
    },
    [clearHoldTimer, endReposition],
  );

  const close = useCallback(() => setOpen(false), []);

  const honorifics = useMemo(() => pickStaffHonorificsForUserId(viewerUserId ?? null), [viewerUserId]);

  const hireDateDisplay = useMemo(() => {
    const real = formatHireDisplay(hireDateIso);
    if (real) return real;
    return pickSyntheticHireYmdForUserId(viewerUserId ?? null).replace(/-/g, '.');
  }, [hireDateIso, viewerUserId]);

  if (!enabled || !imageUrl) return null;

  const hireLine = `${teamT('team.staffIdCard.hireLabel')} ${hireDateDisplay}`;
  const bottomStyle = `${clampEdgeVh(edgeBottomVh)}vh`;

  return (
    <>
      <div
        className="pointer-events-none fixed right-0 z-[43] flex flex-row items-center"
        style={{ bottom: bottomStyle, transform: 'translateY(50%)' }}
      >
        <div
          className="pointer-events-auto h-[min(42vh,13.5rem)] w-2 bg-transparent"
          aria-hidden
          onTouchStart={onEdgeTouchStart}
          onTouchEnd={onEdgeTouchEnd}
        />
        <button
          ref={tabRef}
          type="button"
          onPointerDown={onTabPointerDown}
          onPointerMove={onTabPointerMove}
          onPointerUp={onTabPointerUp}
          onPointerCancel={onTabPointerCancel}
          onClick={(e) => {
            if (blockNextClickRef.current) {
              e.preventDefault();
              e.stopPropagation();
              blockNextClickRef.current = false;
            }
          }}
          className={`pointer-events-auto relative flex h-[5.25rem] w-[1.85rem] touch-manipulation flex-col items-center justify-center gap-0.5 rounded-l-[14px] border border-white/70 bg-gradient-to-br from-white via-slate-50/98 to-slate-100/95 py-2 shadow-[4px_6px_24px_rgba(15,23,42,0.14),2px_2px_8px_rgba(15,23,42,0.08),inset_0_1px_0_rgba(255,255,255,0.95),inset_0_-1px_0_rgba(15,23,42,0.04)] backdrop-blur-md transition-[box-shadow,transform] active:scale-[0.98] motion-reduce:transition-none ${
            repositionGlow
              ? 'scale-[1.02] ring-2 ring-sky-400/50 ring-offset-2 ring-offset-gray-50/80 shadow-[4px_10px_32px_rgba(14,116,144,0.22)]'
              : ''
          }`}
          aria-label={teamT('team.staffIdCard.openSwipe')}
          title={teamT('team.staffIdCard.edgeDragHint')}
          aria-expanded={open}
        >
          <span
            className="pointer-events-none absolute inset-0 rounded-l-[14px] bg-gradient-to-b from-white/50 to-transparent opacity-90"
            aria-hidden
          />
          <span className="pointer-events-none relative flex flex-col items-center gap-0.5" aria-hidden>
            <span className="text-[9px] font-bold leading-none text-slate-500/90 drop-shadow-sm">◂</span>
            <span className="h-7 w-px rounded-full bg-gradient-to-b from-transparent via-slate-300 to-transparent shadow-[0_0_6px_rgba(255,255,255,0.9)]" />
            <span className="text-[8px] font-semibold leading-none text-slate-400">ID</span>
          </span>
        </button>
      </div>

      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-[200] flex justify-end bg-gradient-to-l from-black/55 via-black/45 to-black/30 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] backdrop-blur-[4px]"
            role="presentation"
            onClick={(e) => {
              if (e.target === e.currentTarget) close();
            }}
          >
            <div
              className="flex h-full w-[min(92vw,20.5rem)] flex-col bg-gradient-to-b from-slate-100/98 via-gray-100 to-slate-100/90"
              style={{
                boxShadow:
                  '-18px 0 56px rgba(15,23,42,0.2), -6px 0 20px rgba(15,23,42,0.12), inset 1px 0 0 rgba(255,255,255,0.65)',
              }}
              role="dialog"
              aria-modal="true"
              aria-label={teamT('team.staffIdCard.sheetTitle')}
            >
              <div className="flex items-center justify-between border-b border-white/60 bg-gradient-to-b from-white to-slate-50/95 px-3 py-2.5 shadow-[0_4px_12px_rgba(15,23,42,0.06)]">
                <span className="text-fluid-sm font-semibold tracking-tight text-slate-800 drop-shadow-sm">
                  {teamT('team.staffIdCard.sheetTitle')}
                </span>
                <button
                  type="button"
                  onClick={close}
                  className="rounded-lg px-2.5 py-1 text-fluid-sm font-medium text-slate-600 shadow-sm transition hover:bg-white/90 hover:text-slate-900 hover:shadow"
                >
                  {teamT('team.staffIdCard.close')}
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain bg-gradient-to-b from-slate-200/40 to-transparent px-3 py-4">
                <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white">
                  <div className="relative z-0 py-3.5">
                    <div className="relative mx-auto w-full max-w-full">
                      <img
                        src={imageUrl}
                        alt={viewerName ? `${viewerName} 사원증` : '사원증'}
                        className="relative z-0 mx-auto block max-h-[min(58vh,24rem)] w-full object-contain"
                        loading="lazy"
                      />
                    </div>
                  </div>
                  {honorifics.length > 0 ? (
                    <div className="relative z-[3] border-t border-slate-200/90 bg-gradient-to-b from-[#f8f9fb] via-white to-[#f4f6f9] px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
                      <div className="mb-3 flex items-center gap-2">
                        <span className="h-px min-w-[1.25rem] flex-1 bg-gradient-to-r from-slate-300/0 via-slate-400/50 to-slate-300/0" />
                        <span className="shrink-0 text-center text-[0.58rem] font-semibold uppercase tracking-[0.18em] text-slate-500">
                          {teamT('team.staffIdCard.honorificSection')}
                        </span>
                        <span className="h-px min-w-[1.25rem] flex-1 bg-gradient-to-r from-slate-300/0 via-slate-400/50 to-slate-300/0" />
                      </div>
                      <ul className="space-y-2" aria-label={teamT('team.staffIdCard.honorificSection')}>
                        {honorifics.map((h, index) => (
                          <li
                            key={`${h.titleEn}-${index}`}
                            className="group flex gap-2.5 rounded-xl border border-slate-200/80 bg-white/95 px-2.5 py-2 shadow-[0_2px_8px_rgba(15,23,42,0.05),inset_0_1px_0_rgba(255,255,255,1)] transition-shadow group-hover:shadow-[0_4px_14px_rgba(15,23,42,0.07)]"
                          >
                            <div
                              className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg border border-slate-200/90 bg-gradient-to-br from-slate-50 via-white to-slate-100/80 shadow-[inset_0_1px_1px_rgba(255,255,255,0.95),0_1px_2px_rgba(15,23,42,0.06)]"
                              aria-hidden
                            >
                              <span className="text-[1.05rem] leading-none drop-shadow-sm">{h.emoji}</span>
                            </div>
                            <div className="min-w-0 flex-1 border-l border-amber-500/25 pl-2.5 text-left">
                              <div className="flex items-start justify-between gap-1.5">
                                <p className="text-[0.69rem] font-semibold leading-snug tracking-tight text-slate-800">
                                  {h.titleKo}
                                </p>
                                <span
                                  className="shrink-0 rounded border border-slate-300/60 bg-gradient-to-b from-slate-50 to-slate-100/90 px-1 py-0.5 text-[0.46875rem] font-bold tabular-nums uppercase tracking-[0.14em] text-slate-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] motion-safe:animate-honorific-cert-blink motion-reduce:animate-none"
                                  style={{ animationDelay: `${index * 0.12}s` }}
                                >
                                  {teamT('team.staffIdCard.honorificCert')}
                                </span>
                              </div>
                              <p className="mt-0.5 text-[0.58rem] font-medium uppercase leading-snug tracking-[0.08em] text-slate-500">
                                {h.titleEn}
                              </p>
                            </div>
                          </li>
                        ))}
                      </ul>
                      <p className="mt-2.5 border-t border-slate-200/60 pt-2 text-center text-[0.52rem] leading-relaxed text-slate-400">
                        {teamT('team.staffIdCard.honorificNote')}
                      </p>
                    </div>
                  ) : null}
                  <div
                    className="relative z-[3] px-3 pb-3 pt-10 text-center"
                    style={{
                      background:
                        'linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0) 38%, rgba(100,116,139,0.07) 52%, rgba(100,116,139,0.2) 66%, rgba(100,116,139,0.38) 78%, rgba(100,116,139,0.52) 90%, rgba(100,116,139,0.56) 100%)',
                    }}
                  >
                    <p className="text-[0.68rem] font-semibold tracking-wide text-slate-800">
                      {teamT('team.staffIdCard.licenseCaption')}
                    </p>
                    <p className="mt-1.5 tabular-nums text-[0.72rem] text-slate-700">
                      {hireLine}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
