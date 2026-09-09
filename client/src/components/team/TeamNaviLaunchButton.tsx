import { useState, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { LineMdIcon } from '../ui/LineMdIcon';
import { postTeamInquiryNaviDestination } from '../../api/team';
import { TeamBiInline, teamBiPlain } from '../../i18n/team/teamI18n';
import { useSuppressTeamMobileBottomNav } from '../../hooks/useSuppressTeamMobileBottomNav';
import {
  canLaunchStaffFieldNavi,
  launchStaffFieldNavi,
  type StaffFieldNaviApp,
} from '../../utils/staffFieldNavi';
import { readPreferredTeamNavi, writePreferredTeamNavi } from '../../utils/teamPreferredNavi';

type TeamNaviLaunchButtonProps = {
  inquiryId: string;
  token: string | null;
  compact?: boolean;
  /** 상세 하단 고정줄 — 시스템 뒤로/홈에 가리지 않게 */
  variant?: 'inline' | 'bar';
};

export function TeamNaviLaunchButton({
  inquiryId,
  token,
  compact,
  variant = 'inline',
}: TeamNaviLaunchButtonProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preferred, setPreferred] = useState<StaffFieldNaviApp | null>(() => readPreferredTeamNavi());

  useSuppressTeamMobileBottomNav(sheetOpen);

  const runApp = async (app: StaffFieldNaviApp, event?: MouseEvent) => {
    event?.preventDefault();
    event?.stopPropagation();
    if (!token || busy) return;
    if (!canLaunchStaffFieldNavi()) {
      setError(teamBiPlain('team.navi.phoneOnly'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const dest = await postTeamInquiryNaviDestination(token, inquiryId);
      writePreferredTeamNavi(app);
      setPreferred(app);
      launchStaffFieldNavi(app, dest);
    } catch (err) {
      setError(err instanceof Error ? err.message : teamBiPlain('team.navi.fail'));
    } finally {
      setBusy(false);
    }
  };

  const onGuideClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setError(null);
    setSheetOpen(true);
  };

  const inlineClass = compact
    ? 'inline-flex min-h-11 w-full items-center justify-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-fluid-xs font-semibold text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50'
    : 'inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-fluid-xs font-semibold text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50';

  const barClass =
    'inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-fluid-xs font-semibold text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50';

  const btnClass = variant === 'bar' ? barClass : inlineClass;

  return (
    <div className={variant === 'bar' ? 'w-full' : 'mt-1.5 w-full min-w-0'}>
      <button type="button" className={btnClass} disabled={!token || busy} onClick={onGuideClick}>
        <LineMdIcon name="map-marker" className="size-4 shrink-0 text-slate-700" />
        <TeamBiInline id="team.navi.guide" />
      </button>
      {error && !sheetOpen ? (
        <p className="mt-1 w-full text-fluid-2xs text-red-600" role="alert">
          {error}
        </p>
      ) : null}
      {sheetOpen
        ? createPortal(
            <div
              className="fixed inset-0 z-[130] flex items-end justify-center sm:items-center"
              onClick={(event) => event.stopPropagation()}
              role="presentation"
            >
              <button
                type="button"
                className="absolute inset-0 bg-slate-900/40"
                aria-label={teamBiPlain('team.navi.close')}
                onClick={() => !busy && setSheetOpen(false)}
              />
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="team-navi-sheet-title"
                className="relative z-[131] mb-[max(4.5rem,calc(env(safe-area-inset-bottom,0px)+3.25rem))] w-full max-w-md rounded-2xl border border-slate-200 bg-white p-3 shadow-xl sm:mb-0 sm:p-4"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h2 id="team-navi-sheet-title" className="text-fluid-sm font-semibold text-slate-900">
                    <TeamBiInline id="team.navi.sheetTitle" />
                  </h2>
                  <button
                    type="button"
                    className="inline-flex size-11 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
                    disabled={busy}
                    onClick={() => setSheetOpen(false)}
                  >
                    <LineMdIcon name="close" className="size-5" title={teamBiPlain('team.navi.close')} />
                  </button>
                </div>
                <p className="mb-3 text-fluid-2xs text-slate-500">
                  <TeamBiInline id="team.navi.sheetHint" />
                </p>
                {error ? (
                  <p className="mb-2 text-fluid-2xs text-red-600" role="alert">
                    {error}
                  </p>
                ) : null}
                {busy ? (
                  <p className="mb-2 text-fluid-2xs text-slate-500" role="status">
                    <TeamBiInline id="team.navi.opening" />
                  </p>
                ) : null}
                <div className="grid gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={(event) => void runApp('kakaonavi', event)}
                    className="flex min-h-12 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-left hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
                  >
                    <LineMdIcon name="navigation-left-up" className="size-6 shrink-0 text-slate-800" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-fluid-sm font-semibold text-slate-900">
                        <TeamBiInline id="team.navi.kakao" />
                      </span>
                      {preferred === 'kakaonavi' ? (
                        <span className="text-fluid-2xs text-slate-500">
                          <TeamBiInline id="team.navi.recent" />
                        </span>
                      ) : null}
                    </span>
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={(event) => void runApp('tmap', event)}
                    className="flex min-h-12 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-left hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
                  >
                    <LineMdIcon name="compass" className="size-6 shrink-0 text-slate-800" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-fluid-sm font-semibold text-slate-900">
                        <TeamBiInline id="team.navi.tmap" />
                      </span>
                      {preferred === 'tmap' ? (
                        <span className="text-fluid-2xs text-slate-500">
                          <TeamBiInline id="team.navi.recent" />
                        </span>
                      ) : null}
                    </span>
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
