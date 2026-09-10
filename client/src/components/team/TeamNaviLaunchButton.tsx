import { useState } from 'react';
import { LineMdIcon } from '../ui/LineMdIcon';
import { postTeamInquiryNaviDestination } from '../../api/team';
import { TeamBiInline, teamBiPlain } from '../../i18n/team/teamI18n';
import { canLaunchStaffFieldNavi, launchStaffFieldNavi } from '../../utils/staffFieldNavi';

type TeamNaviLaunchButtonProps = {
  inquiryId: string;
  token: string | null;
  compact?: boolean;
  variant?: 'inline' | 'bar';
};

export function TeamNaviLaunchButton({
  inquiryId,
  token,
  compact,
  variant = 'inline',
}: TeamNaviLaunchButtonProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const onGuide = async () => {
    if (!token || busy) return;
    if (!canLaunchStaffFieldNavi()) {
      setError(teamBiPlain('team.navi.phoneOnly'));
      return;
    }
    setBusy(true);
    setError(null);
    setStatus(teamBiPlain('team.navi.opening'));
    try {
      const dest = await postTeamInquiryNaviDestination(token, inquiryId);
      if (!dest.tmapAppRoutesUrl) {
        setStatus(teamBiPlain('team.navi.tmapNeedKey'));
      }
      launchStaffFieldNavi(dest);
    } catch (err) {
      setStatus(null);
      setError(err instanceof Error && err.message ? err.message : teamBiPlain('team.navi.fail'));
    } finally {
      setBusy(false);
    }
  };

  const barClass =
    'inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-fluid-xs font-semibold text-slate-800 touch-manipulation hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none';
  const inlineClass = compact
    ? 'inline-flex min-h-11 w-full items-center justify-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-fluid-xs font-semibold text-slate-800 touch-manipulation hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none'
    : 'inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-fluid-xs font-semibold text-slate-800 touch-manipulation hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none';
  const btnClass = variant === 'bar' ? barClass : inlineClass;

  return (
    <div className={variant === 'bar' ? 'w-full' : 'mt-1.5 w-full min-w-0'}>
      <button type="button" className={btnClass} disabled={!token || busy} onClick={() => void onGuide()}>
        <LineMdIcon name="map-marker" className="size-4 shrink-0 text-slate-700" />
        <TeamBiInline id="team.navi.guide" />
      </button>
      {status ? (
        <p className="mt-1 w-full text-fluid-2xs text-slate-600" role="status">
          {status}
        </p>
      ) : null}
      {error ? (
        <p className="mt-1 w-full text-fluid-2xs text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
