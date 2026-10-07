import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useLoginScrollSurface } from '../../hooks/useMobileInputVisibility';
import { getToken } from '../../stores/auth';
import { teamBiPlain } from '../../i18n/team/teamI18n';
import {
  confirmCardPaymentKeyin,
  confirmCardPaymentLink,
  confirmCardPaymentWindow,
  createCardPayment,
  fetchCardPaymentPrefill,
} from '../../api/cardPayment';
import { openWspayHostedWindow, TEAM_CARD_PAYMENT_URL } from '../../constants/teamCardPayment';
import {
  TeamCardPaymentAmountStep,
  TeamCardPaymentHostedResult,
  TeamCardPaymentMethodStep,
  useLiveQuote,
} from '../../components/team/card-payment/TeamCardPaymentFlow';
import type { CardPaymentFeeBreakdown, CardPaymentMethod } from '@shared/cardPayment';
import { formatWon } from '@shared/cardPayment';

type Step = 'amount' | 'method' | 'link' | 'done';

export function TeamCardPaymentPage() {
  useDocumentTitle(teamBiPlain('team.cardPayment.pageTitle'));
  const [params] = useSearchParams();
  const inquiryId = params.get('inquiryId') || '';
  const { scrollRef, onFieldFocus } = useLoginScrollSurface();

  const [customerName, setCustomerName] = useState('');
  const [amount, setAmount] = useState('');
  const [initialQuote, setInitialQuote] = useState<CardPaymentFeeBreakdown | null>(null);
  const [step, setStep] = useState<Step>('amount');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkUrl, setLinkUrl] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pgWindowUrl, setPgWindowUrl] = useState(TEAM_CARD_PAYMENT_URL);
  const quote = useLiveQuote(amount, initialQuote);

  useEffect(() => {
    const token = getToken();
    if (!token || !inquiryId) return;
    void fetchCardPaymentPrefill(token, inquiryId)
      .then((res) => {
        setCustomerName(res.customerName);
        setAmount(String(res.amountWon || ''));
        setInitialQuote(res.quote);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : '접수 정보를 불러오지 못했습니다.'));
  }, [inquiryId]);

  const runMethod = async (method: CardPaymentMethod | 'PAY_WINDOW') => {
    const token = getToken();
    if (!token || !inquiryId) return;
    setBusy(true);
    setError(null);
    const payScreen = window.matchMedia('(max-width: 1023px)').matches ? 'M' : 'P';
    try {
      const created = await createCardPayment(token, {
        inquiryId,
        amountWon: Math.round(Number(amount) || 0),
        method,
        payScreen,
      });
      if (method === 'PAY_WINDOW') {
        const res = await confirmCardPaymentWindow(token, created.payment.id, payScreen);
        setPgWindowUrl(res.redirectUrl);
        setNotice(null);
        openWspayHostedWindow(res.redirectUrl);
        setStep('done');
      } else if (method === 'KEYIN') {
        const res = await confirmCardPaymentKeyin(token, created.payment.id);
        setPgWindowUrl('');
        setNotice(res.pgMessage);
        setStep('done');
      } else {
        const linked = await confirmCardPaymentLink(token, created.payment.id);
        setLinkUrl(linked.linkUrl);
        setNotice(linked.pgMessage);
        setPgWindowUrl(linked.pgWindowUrl || TEAM_CARD_PAYMENT_URL);
        setStep('link');
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '결제 건을 만들지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const copyLink = async () => {
    if (!linkUrl) return;
    await navigator.clipboard.writeText(
      `${customerName} 고객님, 카드결제 링크입니다. ${linkUrl}`,
    );
  };

  return (
    <div
      ref={scrollRef}
      onFocusCapture={onFieldFocus}
      className="login-surface min-h-dvh overflow-y-auto overscroll-y-contain bg-slate-100 px-4 py-8"
    >
      <div className="login-scroll-content mx-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white p-4 shadow-lg">
        <p className="text-fluid-sm font-semibold text-slate-900">{teamBiPlain('team.cardPayment.heading')}</p>
        <p className="mt-1 text-fluid-2xs leading-snug text-slate-500">{teamBiPlain('team.cardPayment.body')}</p>
        {!inquiryId ? (
          <p className="mt-3 text-fluid-xs text-slate-600">접수 상세에서 카드결재를 눌러 금액을 가져와 주세요.</p>
        ) : null}
        {error ? <p className="mt-2 text-fluid-xs text-red-700">{error}</p> : null}
        {inquiryId && step === 'amount' ? (
          <div className="mt-4">
            <TeamCardPaymentAmountStep
              customerName={customerName || '고객'}
              amount={amount}
              onAmountChange={setAmount}
              quote={quote}
              onNext={() => setStep('method')}
            />
          </div>
        ) : null}
        {step === 'method' ? (
          <div className="mt-4 space-y-3">
            <p className="text-fluid-xs text-slate-600">
              {formatWon(Number(amount) || 0)} · {customerName}
            </p>
            <TeamCardPaymentMethodStep busy={busy} onPick={(m) => void runMethod(m)} />
          </div>
        ) : null}
        {step === 'link' && linkUrl ? (
          <div className="mt-4 space-y-2">
            <p className="break-all rounded-lg bg-slate-50 px-2 py-2 text-fluid-2xs text-slate-700">{linkUrl}</p>
            {notice ? <p className="text-fluid-2xs text-amber-800">{notice}</p> : null}
            <button
              type="button"
              onClick={() => void copyLink()}
              className="min-h-11 w-full rounded-xl bg-slate-900 text-fluid-sm font-semibold text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none"
            >
              링크 복사
            </button>
          </div>
        ) : null}
        {step === 'done' ? (
          <div className="mt-4">
            <TeamCardPaymentHostedResult
              title={pgWindowUrl ? '결제창에서 카드번호를 입력해 주세요.' : '수기결재는 이 화면에서 카드번호를 받지 않습니다.'}
              notice={notice}
              windowUrl={pgWindowUrl}
              onOpenWindow={() => openWspayHostedWindow(pgWindowUrl)}
            />
          </div>
        ) : null}
        <p className="mt-6 text-center text-fluid-2xs">
          <Link to="/team/assignments" className="text-sky-700 underline-offset-2 hover:underline">
            {teamBiPlain('team.cardPayment.backToTeam')}
          </Link>
        </p>
      </div>
    </div>
  );
}
