import { useState } from 'react';
import { LineMdIcon } from '../ui/LineMdIcon';
import { postTeamInquiryNaviDestination } from '../../api/team';
import { postInquiryNaviDestination } from '../../api/inquiries';
import { TeamBiInline, teamBiPlain } from '../../i18n/team/teamI18n';
import { canLaunchStaffFieldNavi, launchStaffFieldNavi } from '../../utils/staffFieldNavi';

type TeamNaviLaunchButtonProps = {
  inquiryId: string;
  token: string | null;
  compact?: boolean;
  /** 상세 하단 고정줄. header=접수 상세 알약 */
  variant?: 'inline' | 'bar' | 'header';
  /** 기본은 팀장(본인 배정). staff=관리자·마케터(배정 불필요) */
  destinationApi?: 'team' | 'staff';
};

export function TeamNaviLaunchButton({
  inquiryId,
  token,
  compact,
  variant = 'inline',
  destinationApi = 'team',
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
      const dest =
        destinationApi === 'staff'
          ? await postInquiryNaviDestination(token, inquiryId)
          : await postTeamInquiryNaviDestination(token, inquiryId);
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
  const headerClass =
    'inline-flex items-center gap-0.5 rounded-md border border-slate-300 bg-white px-1.5 py-0.5 text-[11px] font-semibold leading-tight text-slate-800 touch-manipulation hover:bg-slate-50 active:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none sm:px-2.5 sm:py-1 sm:text-fluid-xs';
  const btnClass = variant === 'bar' ? barClass : variant === 'header' ? headerClass : inlineClass;
  const wrapClass =
    variant === 'bar' ? 'w-full' : variant === 'header' ? 'inline-flex shrink-0' : 'mt-1.5 w-full min-w-0';

  return (
    <div className={wrapClass}>
      <button
        type="button"
        className={btnClass}
        disabled={!token || busy}
        title={error ?? undefined}
        onClick={() => void onGuide()}
      >
        <LineMdIcon name="map-marker" className="size-4 shrink-0 text-slate-700" />
        <TeamBiInline id="team.navi.guide" />
      </button>
      {variant !== 'header' && status ? (
        <p className="mt-1 w-full text-fluid-2xs text-slate-600" role="status">
          {status}
        </p>
      ) : null}
      {variant !== 'header' && error ? (
        <p className="mt-1 w-full text-fluid-2xs text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
