import { useEffect, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { formatWon } from '@shared/cardPayment';
import {
  confirmCardPaymentKeyin,
  confirmCardPaymentLink,
  createCardPayment,
  fetchCardPaymentPrefill,
  type CardPaymentRow,
} from '../../api/cardPayment';
import { TeamCardPaymentAmountFields } from '../../components/team/card-payment/TeamCardPaymentAmountFields';
import { TeamCardPaymentKeyinForm, type TeamKeyinCard } from '../../components/team/card-payment/TeamCardPaymentKeyinForm';
import { TeamCardPaymentShareSheet } from '../../components/team/card-payment/TeamCardPaymentShareSheet';
import { CardPaymentApprovedAlert } from '../../components/card-payment/CardPaymentApprovedAlert';
import {
  TEAM_PAY_CARD,
  TEAM_PAY_FOOTER,
  TEAM_PAY_SHEET_MAX,
} from '../../components/team/card-payment/teamCardPaymentUi';
import { Button } from '../../components/ui/Button';
import { LineMdIcon } from '../../components/ui/LineMdIcon';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useLoginScrollSurface } from '../../hooks/useMobileInputVisibility';
import { teamBiPlain } from '../../i18n/team/teamI18n';
import { getToken } from '../../stores/auth';
import { getTeamToken } from '../../stores/teamAuth';
import { buildCardPaymentShareMessage } from '../../utils/cardPaymentShare';
import { copyTextToClipboard } from '../../utils/clipboard';

type Step = 'pick' | 'keyin' | 'auth' | 'link' | 'paid';
type PickMethod = 'keyin' | 'link';

function readToken() {
  return getTeamToken() || getToken();
}

function leavePay(staff: boolean) {
  if (window.opener && !window.opener.closed) {
    window.close();
    return;
  }
  window.location.assign(staff ? '/admin/inquiries' : '/team/schedule');
}

function formatLinkDeadline(days = 7): string {
  const d = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

function installmentLabel(code: string): string {
  if (!code || code === '00' || code === '0') return '일시불';
  const n = Number(code);
  if (!Number.isFinite(n) || n <= 1) return '일시불';
  return `${n}개월`;
}

/** 접수 카드결제. 수기는 그 업체 키로 승인하고, 인증은 고객 링크를 만든다. */
export function TeamCardPaymentPage() {
  useDocumentTitle(teamBiPlain('team.cardPayment.pageTitle'));
  const location = useLocation();
  const staffPay = location.pathname.startsWith('/admin/');
  const [params] = useSearchParams();
  const inquiryId = params.get('inquiryId') || '';
  const { scrollRef, onFieldFocus } = useLoginScrollSurface();
  const [pgConnected, setPgConnected] = useState<boolean | null>(inquiryId ? null : false);
  const [keyinConnected, setKeyinConnected] = useState(false);
  const [linkConnected, setLinkConnected] = useState(false);
  const [step, setStep] = useState<Step>('pick');
  const [picked, setPicked] = useState<PickMethod | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [inquiryNumber, setInquiryNumber] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState('');
  const [includeCompanyName, setIncludeCompanyName] = useState(true);
  const [serviceWord, setServiceWord] = useState('청소');
  const [cleaningWon, setCleaningWon] = useState(0);
  const [depositWon, setDepositWon] = useState(0);
  const [balanceWon, setBalanceWon] = useState(0);
  const [storedExtraWon, setStoredExtraWon] = useState(0);
  const [amount, setAmount] = useState('');
  const [extraAmount, setExtraAmount] = useState('');
  const [goodsName, setGoodsName] = useState('청소비');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkDeadline, setLinkDeadline] = useState('');
  const [copied, setCopied] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [paidPayment, setPaidPayment] = useState<CardPaymentRow | null>(null);
  const [paidInstallment, setPaidInstallment] = useState('00');
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
        setInquiryNumber(res.inquiryNumber);
        setCompanyName(res.companyName || '');
        setIncludeCompanyName(res.includeCompanyName !== false && Boolean(res.companyName?.trim()));
        const word = res.serviceWord?.trim() || '청소';
        setServiceWord(word);
        setCleaningWon(Math.max(0, Math.round(res.cleaningWon || 0)));
        setDepositWon(Math.max(0, Math.round(res.depositWon || 0)));
        setBalanceWon(Math.max(0, Math.round(res.balanceWon || 0)));
        setStoredExtraWon(Math.max(0, Math.round(res.extraWorkWon || 0)));
        setAmount(String(res.amountWon || 0));
        setGoodsName(res.customerName ? `${res.customerName} ${word}비` : `${word}비`);
      })
      .catch(() => setPgConnected(false));
  }, [inquiryId]);

  const baseWon = Math.round(Number(amount.replace(/[^\d]/g, '')) || 0);
  const extraWon = Math.round(Number(extraAmount.replace(/[^\d]/g, '')) || 0);
  const amountWon = baseWon + extraWon;
  const messageExtraWon = extraWon > 0 ? extraWon : storedExtraWon;
  const shareMessage = buildCardPaymentShareMessage({
    companyName,
    includeCompanyName,
    serviceWord,
    cleaningWon: cleaningWon > 0 ? cleaningWon : baseWon,
    depositWon,
    balanceWon: balanceWon > 0 ? balanceWon : baseWon,
    extraWon: messageExtraWon,
    linkUrl,
  });

  const goPick = () => {
    setStep('pick');
    setError(null);
    setCopied(false);
    setShareOpen(false);
  };

  const goNextFromPick = () => {
    if (!picked) return;
    setError(null);
    setStep(picked === 'keyin' ? 'keyin' : 'auth');
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
        setLinkDeadline(formatLinkDeadline(7));
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
        setPaidPayment(result.payment);
        setPaidInstallment(card.installment);
        setPaidMessage(result.message);
        setStep('paid');
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : '승인에 실패했습니다.'))
      .finally(() => setBusy(false));
  };

  const pickCardClass = (id: PickMethod) => {
    const on = picked === id;
    return `flex w-full items-start gap-3 rounded-[18px] border-2 px-3 py-3.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 ${
      on
        ? 'border-[#0F172A] bg-white shadow-sm'
        : 'border-slate-200 bg-white hover:border-slate-300'
    }`;
  };

  return (
    <div className="login-surface flex min-h-dvh flex-col bg-[#F4F6FA]">
      <CardPaymentApprovedAlert token={readToken()} enabled />
      <header className="sticky top-0 z-30 flex shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
        {step === 'pick' ? (
          <button
            type="button"
            onClick={() => leavePay(staffPay)}
            className="flex size-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
            aria-label={staffPay ? '접수로' : '팀 일정으로'}
          >
            <LineMdIcon name="chevron-left" className="size-5" />
          </button>
        ) : (
          <button
            type="button"
            className="flex size-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 disabled:opacity-50"
            onClick={goPick}
            aria-label="다시 고르기"
          >
            <LineMdIcon name="chevron-left" className="size-5" />
          </button>
        )}
        <div className="min-w-0">
          <p className="text-fluid-sm font-semibold text-[#0F172A]">카드결제</p>
          {customerName ? <p className="truncate text-fluid-2xs text-slate-500">{customerName}</p> : null}
        </div>
      </header>

      <div
        ref={scrollRef}
        onFocusCapture={onFieldFocus}
        className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain px-4 py-4"
      >
        <div className={`login-scroll-content ${TEAM_PAY_SHEET_MAX} flex flex-col gap-3`}>
          {!inquiryId ? (
            <p className={`${TEAM_PAY_CARD} text-fluid-xs text-slate-600`}>접수 상세에서 카드결제를 눌러 주세요.</p>
          ) : null}
          {inquiryId && pgConnected === null ? (
            <p className={`${TEAM_PAY_CARD} text-fluid-xs text-slate-500`}>불러오는 중</p>
          ) : null}
          {inquiryId && pgConnected === false ? (
            <p className={`${TEAM_PAY_CARD} text-fluid-sm text-slate-700`}>PG사 신청 후 사용 가능합니다.</p>
          ) : null}
          {error ? (
            <p className="rounded-[16px] border border-red-200 bg-red-50 px-3 py-2 text-fluid-xs text-red-700">
              {error}
            </p>
          ) : null}

          {inquiryId && pgConnected && step === 'pick' ? (
            <>
              <section className="rounded-[18px] bg-[#0F172A] p-4 text-white shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-fluid-2xs text-slate-300">고객</p>
                    <p className="truncate text-fluid-sm font-semibold">{customerName || '고객'}</p>
                    {inquiryNumber ? (
                      <p className="mt-1 text-fluid-2xs text-slate-400">접수번호 {inquiryNumber}</p>
                    ) : null}
                  </div>
                  <div className="text-right">
                    <p className="text-fluid-2xs text-slate-300">받을 금액</p>
                    <p
                      className="tabular-nums"
                      style={{ fontSize: 28, fontWeight: 800, lineHeight: 1.15 }}
                    >
                      {formatWon(amountWon)}
                    </p>
                  </div>
                </div>
                {(cleaningWon > 0 || depositWon > 0) && (
                  <p className="mt-3 border-t border-white/10 pt-3 text-fluid-2xs text-slate-300">
                    청소비 {formatWon(cleaningWon || amountWon)}
                    {depositWon > 0 ? ` − 예약금 ${formatWon(depositWon)}` : ''}
                  </p>
                )}
              </section>

              <div className="grid gap-2.5" role="radiogroup" aria-label="결제 방법">
                <button
                  type="button"
                  className={pickCardClass('keyin')}
                  aria-pressed={picked === 'keyin'}
                  onClick={() => setPicked('keyin')}
                >
                  <span
                    className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border ${
                      picked === 'keyin' ? 'border-[#0F172A] bg-[#0F172A] text-white' : 'border-slate-300'
                    }`}
                  >
                    {picked === 'keyin' ? <LineMdIcon name="confirm" className="size-3.5" /> : null}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-fluid-sm font-semibold text-[#0F172A]">
                      현장 수기결제(바로 승인)
                    </span>
                    <span className="mt-0.5 block text-fluid-2xs text-slate-500">
                      카드를 받아 이 화면에서 바로 승인합니다.
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  className={pickCardClass('link')}
                  aria-pressed={picked === 'link'}
                  onClick={() => setPicked('link')}
                >
                  <span
                    className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border ${
                      picked === 'link' ? 'border-[#0F172A] bg-[#0F172A] text-white' : 'border-slate-300'
                    }`}
                  >
                    {picked === 'link' ? <LineMdIcon name="confirm" className="size-3.5" /> : null}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-fluid-sm font-semibold text-[#0F172A]">
                      결제 링크 보내기(고객 직접)
                    </span>
                    <span className="mt-0.5 block text-fluid-2xs text-slate-500">
                      고객이 카드사 인증 결제창에서 직접 결제합니다.
                    </span>
                  </span>
                </button>
              </div>
            </>
          ) : null}

          {step === 'keyin' ? (
            <TeamCardPaymentKeyinForm
              amount={amount}
              extra={extraAmount}
              goodsName={goodsName}
              totalWon={amountWon}
              busy={busy}
              onAmountChange={setAmount}
              onExtraChange={setExtraAmount}
              onGoodsNameChange={setGoodsName}
              onSubmit={approveKeyin}
            />
          ) : null}

          {step === 'auth' ? (
            <div className="space-y-3 pb-28">
              <section className={TEAM_PAY_CARD}>
                <TeamCardPaymentAmountFields
                  amount={amount}
                  extra={extraAmount}
                  goodsName={goodsName}
                  totalWon={amountWon}
                  onAmountChange={setAmount}
                  onExtraChange={setExtraAmount}
                  onGoodsNameChange={setGoodsName}
                />
              </section>
              <div className={TEAM_PAY_FOOTER}>
                <Button
                  type="button"
                  variant="primary"
                  size="lg"
                  disabled={busy || amountWon < 100}
                  className="h-[54px] w-full rounded-[14px]"
                  onClick={makeLink}
                >
                  <LineMdIcon name="link" className="size-4" />
                  {busy ? '만드는 중' : '링크 만들기'}
                </Button>
              </div>
            </div>
          ) : null}

          {step === 'link' && linkUrl ? (
            <div className="space-y-3 pb-28">
              <section className={TEAM_PAY_CARD}>
                <p className="text-fluid-sm font-bold text-[#0F172A]">결제 링크를 만들었어요</p>
                {linkDeadline ? (
                  <p className="mt-1 text-fluid-2xs text-slate-500">유효기한 {linkDeadline}까지</p>
                ) : null}
                <div className="mt-4 rounded-2xl rounded-tl-md bg-[#EFF6FF] px-3.5 py-3 text-fluid-xs leading-relaxed text-slate-800">
                  <p className="mb-1 text-fluid-2xs font-medium text-[#1D4ED8]">고객 문자 미리보기</p>
                  <p className="whitespace-pre-wrap break-all">{shareMessage}</p>
                </div>
                <div className="mt-3 flex items-center gap-2 rounded-xl border border-slate-200 bg-[#F4F6FA] px-3 py-2.5">
                  <code className="min-w-0 flex-1 truncate text-fluid-2xs text-slate-700">{linkUrl}</code>
                </div>
              </section>
              <div className={`${TEAM_PAY_FOOTER} grid gap-2`}>
                <Button
                  type="button"
                  variant="primary"
                  size="lg"
                  className="h-[54px] w-full rounded-[14px]"
                  onClick={() => setShareOpen(true)}
                >
                  <LineMdIcon name="chat" className="size-4" />
                  고객에게 보내기
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="lg"
                  className="h-[54px] w-full rounded-[14px]"
                  onClick={() => {
                    void copyTextToClipboard(linkUrl).then((ok) => setCopied(ok));
                  }}
                >
                  <LineMdIcon name="clipboard" className="size-4" />
                  {copied ? '링크를 복사했습니다' : '링크만 복사'}
                </Button>
              </div>
            </div>
          ) : null}

          {step === 'paid' ? (
            <div className="space-y-3 pb-28">
              <section className={`${TEAM_PAY_CARD} flex flex-col items-center text-center`}>
                <span className="flex size-14 items-center justify-center rounded-full bg-[#DCFCE7] text-[#15803D]">
                  <LineMdIcon name="confirm" className="size-7" />
                </span>
                <p className="mt-3 text-fluid-lg font-bold text-[#0F172A]">결제가 완료됐어요</p>
                <p
                  className="mt-2 tabular-nums text-[#0F172A]"
                  style={{ fontSize: 30, fontWeight: 800, lineHeight: 1.2 }}
                >
                  {formatWon(paidPayment?.amountWon ?? amountWon)}
                </p>
                {paidMessage ? <p className="mt-1 text-fluid-2xs text-slate-500">{paidMessage}</p> : null}
              </section>
              <section className={TEAM_PAY_CARD}>
                <dl className="grid grid-cols-[96px_1fr] gap-x-3 gap-y-2.5 text-fluid-xs">
                  {companyName ? (
                    <>
                      <dt className="text-slate-500">가맹점</dt>
                      <dd className="text-right">{companyName}</dd>
                    </>
                  ) : null}
                  <dt className="text-slate-500">결제 내용</dt>
                  <dd className="text-right">{goodsName}</dd>
                  {paidPayment?.cardLast4 ? (
                    <>
                      <dt className="text-slate-500">카드</dt>
                      <dd className="text-right tabular-nums">····{paidPayment.cardLast4}</dd>
                    </>
                  ) : null}
                  <dt className="text-slate-500">할부</dt>
                  <dd className="text-right">{installmentLabel(paidInstallment)}</dd>
                  {paidPayment?.approvalNo ? (
                    <>
                      <dt className="text-slate-500">승인번호</dt>
                      <dd className="text-right tabular-nums">{paidPayment.approvalNo}</dd>
                    </>
                  ) : null}
                  {paidPayment?.paidAt ? (
                    <>
                      <dt className="text-slate-500">승인 일시</dt>
                      <dd className="text-right tabular-nums">
                        {new Date(paidPayment.paidAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}
                      </dd>
                    </>
                  ) : null}
                </dl>
              </section>
              <div className={`${TEAM_PAY_FOOTER} grid gap-2`}>
                <Button
                  type="button"
                  variant="secondary"
                  size="lg"
                  className="h-[54px] w-full rounded-[14px]"
                  onClick={() => window.alert('카드사 영수증은 카드사 문자·앱에서 확인할 수 있어요.')}
                >
                  영수증 보기
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="lg"
                  className="h-[54px] w-full rounded-[14px]"
                  onClick={() => leavePay(staffPay)}
                >
                  닫기
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {inquiryId && pgConnected && step === 'pick' ? (
        <div className={TEAM_PAY_FOOTER}>
          <div className={TEAM_PAY_SHEET_MAX}>
            <Button
              type="button"
              variant="primary"
              size="lg"
              disabled={!picked}
              className="h-[54px] w-full rounded-[14px]"
              onClick={goNextFromPick}
            >
              다음
            </Button>
          </div>
        </div>
      ) : null}

      <TeamCardPaymentShareSheet
        open={shareOpen}
        phone={customerPhone}
        message={shareMessage}
        onClose={() => setShareOpen(false)}
      />
    </div>
  );
}
