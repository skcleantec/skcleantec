import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { TEAM_CARD_PAYMENT_URL } from '../../constants/teamCardPayment';
import { teamBiPlain } from '../../i18n/team/teamI18n';

export function TeamCardPaymentPage() {
  useDocumentTitle(teamBiPlain('team.cardPayment.pageTitle'));
  const [redirectFailed, setRedirectFailed] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        window.location.replace(TEAM_CARD_PAYMENT_URL);
      } catch {
        setRedirectFailed(true);
      }
    }, 400);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-slate-100 px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-lg">
        <p className="text-fluid-sm font-semibold text-slate-900">
          {teamBiPlain('team.cardPayment.heading')}
        </p>
        <p className="mt-2 text-fluid-xs leading-relaxed text-slate-600">
          {teamBiPlain('team.cardPayment.body')}
        </p>
        <p className="mt-4 text-fluid-2xs text-slate-500">
          {redirectFailed
            ? teamBiPlain('team.cardPayment.redirectFailed')
            : teamBiPlain('team.cardPayment.redirecting')}
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <a
            href={TEAM_CARD_PAYMENT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-fluid-sm font-semibold text-white touch-manipulation hover:bg-slate-800"
          >
            {teamBiPlain('team.cardPayment.openSite')}
          </a>
          <button
            type="button"
            onClick={() => window.close()}
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-fluid-sm font-medium text-slate-800 touch-manipulation hover:bg-slate-50"
          >
            {teamBiPlain('team.common.close')}
          </button>
        </div>
        <p className="mt-4 text-fluid-2xs text-slate-500">
          <Link to="/team/dashboard" className="text-sky-700 underline-offset-2 hover:underline">
            {teamBiPlain('team.cardPayment.backToTeam')}
          </Link>
        </p>
      </div>
    </div>
  );
}
