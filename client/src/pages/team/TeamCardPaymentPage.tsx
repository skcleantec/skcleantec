import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useLoginScrollSurface } from '../../hooks/useMobileInputVisibility';
import { getToken } from '../../stores/auth';
import { teamBiPlain } from '../../i18n/team/teamI18n';
import { fetchCardPaymentPrefill } from '../../api/cardPayment';
import { openWspayHostedWindow } from '../../constants/teamCardPayment';
import { formatWon } from '@shared/cardPayment';

/** 가맹 코드가 오기 전에는 판매자센터 로그인만 연다. */
export function TeamCardPaymentPage() {
  useDocumentTitle(teamBiPlain('team.cardPayment.pageTitle'));
  const [params] = useSearchParams();
  const inquiryId = params.get('inquiryId') || '';
  const { scrollRef, onFieldFocus } = useLoginScrollSurface();
  const [customerName, setCustomerName] = useState('');
  const [amountWon, setAmountWon] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token || !inquiryId) return;
    void fetchCardPaymentPrefill(token, inquiryId)
      .then((res) => {
        setCustomerName(res.customerName);
        setAmountWon(res.amountWon || 0);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : '접수 정보를 불러오지 못했습니다.'));
  }, [inquiryId]);

  return (
    <div
      ref={scrollRef}
      onFocusCapture={onFieldFocus}
      className="login-surface min-h-dvh overflow-y-auto overscroll-y-contain bg-slate-100 px-4 py-8"
    >
      <div className="login-scroll-content mx-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white p-4 shadow-lg">
        <p className="text-fluid-sm font-semibold text-slate-900">{teamBiPlain('team.cardPayment.heading')}</p>
        <p className="mt-1 text-fluid-2xs leading-snug text-slate-500">{teamBiPlain('team.cardPayment.body')}</p>
        {inquiryId && (customerName || amountWon > 0) ? (
          <p className="mt-3 text-fluid-xs text-slate-700">
            {customerName || '고객'} · {formatWon(amountWon)}
          </p>
        ) : null}
        {!inquiryId ? (
          <p className="mt-3 text-fluid-xs text-slate-600">접수 상세에서 카드결재를 눌러 금액을 확인해 주세요.</p>
        ) : null}
        {error ? <p className="mt-2 text-fluid-xs text-red-700">{error}</p> : null}
        <button
          type="button"
          onClick={() => openWspayHostedWindow()}
          className="mt-4 flex min-h-11 w-full items-center justify-center rounded-xl bg-slate-900 text-fluid-sm font-semibold text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
        >
          {teamBiPlain('team.cardPayment.openSite')}
        </button>
        <p className="mt-6 text-center text-fluid-2xs">
          <Link to="/team/assignments" className="text-sky-700 underline-offset-2 hover:underline">
            {teamBiPlain('team.cardPayment.backToTeam')}
          </Link>
        </p>
      </div>
    </div>
  );
}
