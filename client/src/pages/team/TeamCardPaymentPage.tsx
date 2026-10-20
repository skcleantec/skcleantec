import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { formatWon } from '@shared/cardPayment';
import { confirmCardPaymentLink, createCardPayment, fetchCardPaymentPrefill } from '../../api/cardPayment';
import { openWspayHostedWindow } from '../../constants/teamCardPayment';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useLoginScrollSurface } from '../../hooks/useMobileInputVisibility';
import { teamBiPlain } from '../../i18n/team/teamI18n';
import { getToken } from '../../stores/auth';
import { copyTextToClipboard } from '../../utils/clipboard';

const BTN =
  'flex min-h-11 w-full items-center justify-center rounded-xl text-fluid-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50';

type Step = 'pick' | 'keyin' | 'auth' | 'link';

/** 접수 카드결재. 수기는 원성 페이지, 인증은 고객 링크. */
export function TeamCardPaymentPage() {
  useDocumentTitle(teamBiPlain('team.cardPayment.pageTitle'));
  const [params] = useSearchParams();
  const inquiryId = params.get('inquiryId') || '';
  const { scrollRef, onFieldFocus } = useLoginScrollSurface();
  const [step, setStep] = useState<Step>('pick');
  const [customerName, setCustomerName] = useState('');
  const [amount, setAmount] = useState('');
  const [goodsName, setGoodsName] = useState('청소비');
  const [linkUrl, setLinkUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token || !inquiryId) return;
    void fetchCardPaymentPrefill(token, inquiryId)
      .then((res) => {
        setCustomerName(res.customerName);
        setAmount(String(res.amountWon || 0));
        setGoodsName(res.customerName ? `${res.customerName} 청소비` : '청소비');
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : '접수 정보를 불러오지 못했습니다.'));
  }, [inquiryId]);

  const amountWon = Math.round(Number(amount.replace(/[^\d]/g, '')) || 0);

  const makeLink = () => {
    const token = getToken();
    if (!token || !inquiryId) return;
    setBusy(true);
    setError(null);
    void createCardPayment(token, {
      inquiryId,
      amountWon,
      method: 'CUSTOMER_LINK',
      goodsName: goodsName.trim() || '청소비',
    })
      .then((created) => confirmCardPaymentLink(token, created.payment.id))
      .then((sent) => {
        setLinkUrl(sent.linkUrl);
        setStep('link');
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : '링크를 만들지 못했습니다.'))
      .finally(() => setBusy(false));
  };

  const shareText = `${customerName || '고객'} 고객님\n${goodsName.trim() || '청소비'}\n${formatWon(amountWon)}\n${linkUrl}`;

  return (
    <div
      ref={scrollRef}
      onFocusCapture={onFieldFocus}
      className="login-surface min-h-dvh overflow-y-auto overscroll-y-contain bg-slate-100 px-3 py-4"
    >
      <div className="login-scroll-content mx-auto w-full max-w-md space-y-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-lg">
        <p className="text-fluid-sm font-semibold text-slate-900">{teamBiPlain('team.cardPayment.heading')}</p>
        <p className="text-fluid-2xs leading-snug text-slate-500">{teamBiPlain('team.cardPayment.body')}</p>
        {inquiryId && customerName ? (
          <p className="text-fluid-xs text-slate-800">
            {customerName} · {formatWon(amountWon)}
          </p>
        ) : null}
        {!inquiryId ? <p className="text-fluid-xs text-slate-600">접수 상세에서 카드결재를 눌러 주세요.</p> : null}
        {error ? <p className="text-fluid-xs text-red-700">{error}</p> : null}

        {inquiryId && step === 'pick' ? (
          <div className="grid gap-2">
            <button
              type="button"
              className={`${BTN} bg-slate-900 text-white hover:bg-slate-800`}
              onClick={() => {
                setStep('keyin');
                openWspayHostedWindow();
              }}
            >
              수기결재
            </button>
            <button
              type="button"
              className={`${BTN} border border-slate-300 bg-white text-slate-900 hover:bg-slate-50`}
              onClick={() => setStep('auth')}
            >
              인증결재
            </button>
          </div>
        ) : null}

        {step === 'keyin' ? (
          <div className="space-y-2">
            <p className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-fluid-2xs leading-snug text-slate-700">
              원성 수기결재 페이지로 이동합니다. 카드번호는 그 페이지에 입력합니다. 금액은 {formatWon(amountWon)} 입니다.
            </p>
            <button
              type="button"
              className={`${BTN} bg-slate-900 text-white hover:bg-slate-800`}
              onClick={() => openWspayHostedWindow()}
            >
              원성 수기결재 열기
            </button>
          </div>
        ) : null}

        {step === 'auth' ? (
          <div className="space-y-2">
            <label className="block">
              <span className="text-fluid-2xs text-slate-500">결제 금액</span>
              <input
                inputMode="numeric"
                className="login-field-input mt-1 w-full min-h-11 rounded-xl border border-slate-200 px-3 text-fluid-sm tabular-nums"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))}
              />
            </label>
            <label className="block">
              <span className="text-fluid-2xs text-slate-500">결제 내용</span>
              <input
                className="login-field-input mt-1 w-full min-h-11 rounded-xl border border-slate-200 px-3 text-fluid-sm"
                value={goodsName}
                maxLength={80}
                onChange={(e) => setGoodsName(e.target.value)}
              />
            </label>
            <button
              type="button"
              disabled={busy || amountWon < 100}
              className={`${BTN} bg-slate-900 text-white hover:bg-slate-800`}
              onClick={makeLink}
            >
              {busy ? '만드는 중…' : '링크 만들기'}
            </button>
          </div>
        ) : null}

        {step === 'link' && linkUrl ? (
          <div className="space-y-2">
            <p className="text-fluid-xs text-slate-800">{goodsName.trim() || '청소비'}</p>
            <p className="text-fluid-sm font-semibold tabular-nums text-slate-900">{formatWon(amountWon)}</p>
            <p className="break-all rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-fluid-2xs text-slate-700">{linkUrl}</p>
            <button
              type="button"
              className={`${BTN} bg-slate-900 text-white hover:bg-slate-800`}
              onClick={() => {
                void copyTextToClipboard(shareText).then((ok) => setCopied(ok));
              }}
            >
              {copied ? '복사됨' : '링크 복사'}
            </button>
            <button
              type="button"
              className={`${BTN} border border-slate-300 bg-white text-slate-900 hover:bg-slate-50`}
              onClick={() => {
                const share = navigator.share?.bind(navigator);
                if (!share) {
                  void copyTextToClipboard(shareText).then((ok) => setCopied(ok));
                  return;
                }
                void share({ title: '카드결재', text: shareText, url: linkUrl }).catch(() => undefined);
              }}
            >
              카톡으로 보내기
            </button>
            <p className="text-fluid-2xs text-slate-500">복사한 글을 고객 카톡에 붙여 넣으면, 고객이 링크에서 결제합니다.</p>
          </div>
        ) : null}

        {step !== 'pick' ? (
          <button
            type="button"
            className="text-fluid-2xs text-slate-600 underline-offset-2 hover:underline"
            onClick={() => {
              setStep('pick');
              setCopied(false);
              setError(null);
            }}
          >
            다시 고르기
          </button>
        ) : null}

        <p className="text-center text-fluid-2xs">
          <Link to="/team/schedule" className="text-sky-700 underline-offset-2 hover:underline">
            {teamBiPlain('team.cardPayment.backToTeam')}
          </Link>
        </p>
      </div>
    </div>
  );
}
