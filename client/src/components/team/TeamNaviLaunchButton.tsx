import { useState, type MouseEvent } from 'react';
import { LineMdIcon } from '../ui/LineMdIcon';
import { postTeamInquiryNaviDestination } from '../../api/team';
import { TeamBiInline, teamBiPlain } from '../../i18n/team/teamI18n';
import {
  canLaunchStaffFieldNavi,
  httpsUrlForStaffFieldNavi,
  launchStaffFieldNavi,
  type StaffFieldNaviApp,
  type StaffFieldNaviDestination,
} from '../../utils/staffFieldNavi';
import { readPreferredTeamNavi, writePreferredTeamNavi } from '../../utils/teamPreferredNavi';

type TeamNaviLaunchButtonProps = {
  inquiryId: string;
  token: string | null;
  compact?: boolean;
  variant?: 'inline' | 'bar';
};

const CHOICE =
  'flex min-h-12 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-left touch-manipulation';

export function TeamNaviLaunchButton({
  inquiryId,
  token,
  compact,
  variant = 'inline',
}: TeamNaviLaunchButtonProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dest, setDest] = useState<StaffFieldNaviDestination | null>(null);
  const [preferred, setPreferred] = useState<StaffFieldNaviApp | null>(() => readPreferredTeamNavi());

  const loadDest = async () => {
    if (!token || busy) return;
    if (!canLaunchStaffFieldNavi()) {
      setError(teamBiPlain('team.navi.phoneOnly'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const next = await postTeamInquiryNaviDestination(token, inquiryId);
      setDest(next);
      setOpen(true);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : teamBiPlain('team.navi.fail'));
      setOpen(true);
    } finally {
      setBusy(false);
    }
  };

  const onNativeOrHref = (app: StaffFieldNaviApp, event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    if (!dest) return;
    writePreferredTeamNavi(app);
    setPreferred(app);
    try {
      launchStaffFieldNavi(app, dest);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : teamBiPlain('team.navi.fail'));
    }
  };

  const barClass =
    'inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-fluid-xs font-semibold text-slate-800 touch-manipulation';
  const inlineClass = compact
    ? 'inline-flex min-h-11 w-full items-center justify-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-fluid-xs font-semibold text-slate-800 touch-manipulation'
    : 'inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-fluid-xs font-semibold text-slate-800 touch-manipulation';
  const btnClass = variant === 'bar' ? barClass : inlineClass;

  return (
    <div className={variant === 'bar' ? 'w-full' : 'mt-1.5 w-full min-w-0'}>
      <button type="button" className={btnClass} disabled={!token || busy} onClick={() => void loadDest()}>
        <LineMdIcon name="map-marker" className="size-4 shrink-0 text-slate-700" />
        <TeamBiInline id="team.navi.guide" />
      </button>
      {error && !open ? (
        <p className="mt-1 w-full text-fluid-2xs text-red-600" role="alert">
          {error}
        </p>
      ) : null}
      {open ? (
        <div className="relative z-10 mt-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="text-fluid-sm font-semibold text-slate-900">
              <TeamBiInline id="team.navi.sheetTitle" />
            </h2>
            <button
              type="button"
              className="inline-flex size-11 items-center justify-center rounded-lg text-slate-600 touch-manipulation"
              onClick={() => setOpen(false)}
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
          {busy || !dest ? (
            <p className="text-fluid-2xs text-slate-500" role="status">
              <TeamBiInline id="team.navi.opening" />
            </p>
          ) : (
            <div className="grid gap-2">
              <a
                href={httpsUrlForStaffFieldNavi('kakaonavi', dest)}
                className={CHOICE}
                onClick={(event) => onNativeOrHref('kakaonavi', event)}
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
              </a>
              <a
                href={httpsUrlForStaffFieldNavi('tmap', dest)}
                className={CHOICE}
                onClick={(event) => onNativeOrHref('tmap', event)}
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
              </a>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
