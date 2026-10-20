import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { formatWon } from '@shared/cardPayment';
import {
  confirmCardPaymentKeyin,
  confirmCardPaymentLink,
  createCardPayment,
  fetchCardPaymentPrefill,
} from '../../api/cardPayment';
import { TeamCardPaymentKeyinForm, type TeamKeyinCard } from '../../components/team/card-payment/TeamCardPaymentKeyinForm';
import { TeamCardPaymentShareSheet } from '../../components/team/card-payment/TeamCardPaymentShareSheet';
import { TEAM_PAY_BTN, TEAM_PAY_FIELD, TEAM_PAY_LABEL } from '../../components/team/card-payment/teamCardPaymentUi';
import { LineMdIcon } from '../../components/ui/LineMdIcon';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useLoginScrollSurface } from '../../hooks/useMobileInputVisibility';
import { teamBiPlain } from '../../i18n/team/teamI18n';
import { getToken } from '../../stores/auth';
import { getTeamToken } from '../../stores/teamAuth';
import { copyTextToClipboard } from '../../utils/clipboard';

type Step = 'pick' | 'keyin' | 'auth' | 'link' | 'paid';

function readToken() {
  return getTeamToken() || getToken();
}

/** 접수 카드결재. 수기는 그 업체 키로 승인하고, 인증은 고객 링크를 만든다. */
export function TeamCardPaymentPage() {
  useDocumentTitle(teamBiPlain('team.cardPayment.pageTitle'));
  const [params] = useSearchParams();
  const inquiryId = params.get('inquiryId') || '';
  const { scrollRef, onFieldFocus } = useLoginScrollSurface();
  const [pgConnected, setPgConnected] = useState<boolean | null>(inquiryId ? null : false);
  const [keyinConnected, setKeyinConnected] = useState(false);
  const [linkConnected, setLinkConnected] = useState(false);
  const [step, setStep] = useState<Step>('pick');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [amount, setAmount] = useState('');
  const [goodsName, setGoodsName] = useState('청소비');
  const [linkUrl, setLinkUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [paidMessage, setPaidMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = readToken();
    if (!token || !inquiryId) {
      setPgConnected(false);
      return;
    }
    void fetchCardPaymentPrefill(token, inquiryId)
      .then((res) => {
        setPgConnected(res.pgConnected);
        setKeyinConnected(res.keyinConnected);
        setLinkConnected(res.linkConnected);
        setCustomerName(res.customerName);
        setCustomerPhone(res.customerPhone || '');
        setAmount(String(res.amountWon || 0));
        setGoodsName(res.customerName ? `${res.customerName} 청소비` : '청소비');
      })
      .catch(() => setPgConnected(false));
  }, [inquiryId]);

  const amountWon = Math.round(Number(amount.replace(/[^\d]/g, '')) || 0);
  const shareMessage = `${customerName || '고객'} 고객님\n${goodsName.trim() || '청소비'}\n${formatWon(amountWon)}\n${linkUrl}`;

  const goPick = () => {
    setStep('pick');
    setError(null);
    setCopied(false);
    setShareOpen(false);
  };

  const makeLink = () => {
    const token = readToken();
    if (!token || !inquiryId) return;
    if (!linkConnected) {
      setError('인증결제 키가 연결되지 않았습니다.');
      return;
    }
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

  const approveKeyin = (card: TeamKeyinCard) => {
    const token = readToken();
    if (!token || !inquiryId) return;
    if (!keyinConnected) {
      setError('수기결제 키가 연결되지 않았습니다.');
      return;
    }
    setBusy(true);
    setError(null);
    void createCardPayment(token, {
      inquiryId,
      amountWon,
      method: 'KEYIN',
      goodsName: goodsName.trim() || '청소비',
    })
      .then((created) =>
        confirmCardPaymentKeyin(token, created.payment.id, {
          ...card,
          buyerPhone: customerPhone,
        }),
      )
      .then((result) => {
        if (!result.ok) {
          setError(result.message);
          return;
        }
        setPaidMessage(result.message);
        setStep('paid');
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : '승인에 실패했습니다.'))
      .finally(() => setBusy(false));
  };

  return (
    <div
      ref={scrollRef}
      onFocusCapture={onFieldFocus}
      className="login-surface min-h-dvh overflow-y-auto overscroll-y-contain bg-slate-100"
    >
      <div className="login-scroll-content mx-auto flex w-full max-w-md flex-col gap-3 px-3 py-4">
        <header className="flex items-center gap-2">
          {step === 'pick' ? (
            <Link
              to="/team/schedule"
              className="flex size-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
              aria-label="팀 일정으로"
            >
              <LineMdIcon name="chevron-left" className="size-5" />
            </Link>
          ) : (
            <button
              type="button"
              className="flex size-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
              onClick={goPick}
              aria-label="다시 고르기"
            >
              <LineMdIcon name="chevron-left" className="size-5" />
            </button>
          )}
          <div className="min-w-0">
            <p className="text-fluid-sm font-semibold text-slate-900">카드결재</p>
            {customerName ? <p className="truncate text-fluid-2xs text-slate-500">{customerName}</p> : null}
          </div>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          {customerName ? (
            <p className="text-fluid-2xl font-semibold tabular-nums text-slate-900">{formatWon(amountWon)}</p>
          ) : null}
          {!inquiryId ? <p className="text-fluid-xs text-slate-600">접수 상세에서 카드결재를 눌러 주세요.</p> : null}
          {inquiryId && pgConnected === null ? <p className="text-fluid-xs text-slate-500">불러오는 중</p> : null}
          {inquiryId && pgConnected === false ? (
            <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-fluid-sm text-slate-700">
              PG사 신청 후 사용 가능합니다.
            </p>
          ) : null}
          {error ? (
            <p className="mt-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-fluid-xs text-red-700">{error}</p>
          ) : null}

          {inquiryId && pgConnected && step === 'pick' ? (
            <div className="mt-3 grid gap-2">
              <button
                type="button"
                className="flex min-h-16 items-center gap-3 rounded-2xl bg-slate-900 px-3 text-left text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
                onClick={() => {
                  setError(null);
                  setStep('keyin');
                }}
              >
                <span className="min-w-0">
                  <span className="block text-fluid-sm font-semibold">수기결재</span>
                  <span className="block text-fluid-2xs font-normal text-slate-200">현장에서 카드를 받아 바로 승인</span>
                </span>
              </button>
              <button
                type="button"
                className="flex min-h-16 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 text-left text-slate-900 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
                onClick={() => {
                  setError(null);
                  setStep('auth');
                }}
              >
                <span className="min-w-0">
                  <span className="block text-fluid-sm font-semibold">인증결재</span>
                  <span className="block text-fluid-2xs font-normal text-slate-500">링크를 만들어 고객에게 보냄</span>
                </span>
              </button>
            </div>
          ) : null}

          {step === 'keyin' ? (
            <div className="mt-3">
              <TeamCardPaymentKeyinForm
                amount={amount}
                goodsName={goodsName}
                busy={busy}
                onAmountChange={setAmount}
                onGoodsNameChange={setGoodsName}
                onSubmit={approveKeyin}
              />
            </div>
          ) : null}

          {step === 'auth' ? (
            <div className="mt-3 space-y-3">
              <label className={TEAM_PAY_LABEL}>
                결제 금액
                <input
                  inputMode="numeric"
                  className={`${TEAM_PAY_FIELD} tabular-nums`}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))}
                />
              </label>
              <label className={TEAM_PAY_LABEL}>
                결제 내용
                <input
                  className={TEAM_PAY_FIELD}
                  maxLength={80}
                  value={goodsName}
                  onChange={(e) => setGoodsName(e.target.value)}
                />
              </label>
              <button
                type="button"
                disabled={busy || amountWon < 100}
                className={`${TEAM_PAY_BTN} bg-slate-900 text-white hover:bg-slate-800`}
                onClick={makeLink}
              >
                {busy ? '만드는 중' : '링크 만들기'}
              </button>
            </div>
          ) : null}

          {step === 'link' && linkUrl ? (
            <div className="mt-3 space-y-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-fluid-xs text-slate-600">{goodsName.trim() || '청소비'}</p>
                <p className="mt-1 text-fluid-lg font-semibold tabular-nums text-slate-900">{formatWon(amountWon)}</p>
                <p className="mt-2 break-all text-fluid-2xs text-slate-700">{linkUrl}</p>
              </div>
              <button
                type="button"
                className={`${TEAM_PAY_BTN} bg-slate-900 text-white hover:bg-slate-800`}
                onClick={() => setShareOpen(true)}
              >
                공유하기
              </button>
              <button
                type="button"
                className={`${TEAM_PAY_BTN} border border-slate-300 bg-white text-slate-900 hover:bg-slate-50`}
                onClick={() => {
                  void copyTextToClipboard(linkUrl).then((ok) => setCopied(ok));
                }}
              >
                <LineMdIcon name="clipboard" className="size-4" />
                {copied ? '링크를 복사했습니다' : '링크 복사'}
              </button>
            </div>
          ) : null}

          {step === 'paid' ? (
            <div className="mt-3 space-y-3">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-4 text-center">
                <LineMdIcon name="confirm" className="mx-auto size-8 text-emerald-700" />
                <p className="mt-2 text-fluid-sm font-semibold text-emerald-900">승인되었습니다</p>
                <p className="mt-1 text-fluid-xs text-emerald-800">{paidMessage}</p>
              </div>
              <Link to="/team/schedule" className={`${TEAM_PAY_BTN} bg-slate-900 text-white hover:bg-slate-800`}>
                일정으로
              </Link>
            </div>
          ) : null}
        </section>
      </div>
      <TeamCardPaymentShareSheet
        open={shareOpen}
        phone={customerPhone}
        message={shareMessage}
        onClose={() => setShareOpen(false)}
      />
    </div>
  );
}
