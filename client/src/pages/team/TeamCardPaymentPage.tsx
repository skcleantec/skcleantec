import { useEffect, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { formatWon } from '@shared/cardPayment';
import {
  confirmCardPaymentKeyin,
  confirmCardPaymentLink,
  createCardPayment,
  fetchCardPaymentPrefill,
  fetchCardPaymentStatus,
  fetchPayLinkAlimtalkReady,
  previewCardPaymentAlimtalk,
  sendCardPaymentAlimtalk,
  type CardPaymentRow,
  type PayLinkAlimtalkReady,
} from '../../api/cardPayment';
import { TeamCardPaymentAmountFields } from '../../components/team/card-payment/TeamCardPaymentAmountFields';
import { TeamCardPaymentKeyinForm, type TeamKeyinCard } from '../../components/team/card-payment/TeamCardPaymentKeyinForm';
import {
  TeamCardPaymentAlimtalkConfirm,
  TeamCardPaymentShareSheet,
  usePayCelebrate,
} from '../../components/team/card-payment/TeamCardPaymentShareSheet';
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

type LinkSession = {
  paymentId: string;
  linkUrl: string;
  amountWon: number;
  goodsName: string;
  alimtalkSentAt?: string;
  alimtalkMaskedPhone?: string;
};

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

function linkSessionKey(inquiryId: string) {
  return `cbiseo:pay-link:${inquiryId}`;
}

function loadLinkSession(inquiryId: string): LinkSession | null {
  try {
    const raw = sessionStorage.getItem(linkSessionKey(inquiryId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LinkSession;
    if (!parsed?.paymentId || !parsed?.linkUrl) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveLinkSession(inquiryId: string, session: LinkSession) {
  try {
    sessionStorage.setItem(linkSessionKey(inquiryId), JSON.stringify(session));
  } catch {
    /* ignore */
  }
}

function clearLinkSession(inquiryId: string) {
  try {
    sessionStorage.removeItem(linkSessionKey(inquiryId));
  } catch {
    /* ignore */
  }
}

function formatSentClock(iso: string): string {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(iso));
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
  const [linkPaymentId, setLinkPaymentId] = useState('');
  const [copied, setCopied] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [alimtalkReady, setAlimtalkReady] = useState<PayLinkAlimtalkReady | null>(null);
  const [alimtalkPhone, setAlimtalkPhone] = useState('');
  const [alimtalkSentAt, setAlimtalkSentAt] = useState<string | null>(null);
  const [alimtalkMaskedPhone, setAlimtalkMaskedPhone] = useState<string | null>(null);
  const [alimtalkConfirmOpen, setAlimtalkConfirmOpen] = useState(false);
  const [alimtalkPreview, setAlimtalkPreview] = useState<{ text: string; masked: string } | null>(null);
  const [alimtalkBusy, setAlimtalkBusy] = useState(false);
  const [paidPayment, setPaidPayment] = useState<CardPaymentRow | null>(null);
  const [paidInstallment, setPaidInstallment] = useState('00');
  const [paidMessage, setPaidMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const celebrate = usePayCelebrate();

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
        setAlimtalkPhone(res.customerPhone || '');
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

    void fetchPayLinkAlimtalkReady(token)
      .then(setAlimtalkReady)
      .catch(() =>
        setAlimtalkReady({
          ready: false,
          reason: '카카오 승인 대기 중 — 공유·복사로 보내 주세요',
          label: '결제 링크 안내 (수동)',
          barobillStatus: null,
          barobillStatusLabel: null,
        }),
      );

    const saved = loadLinkSession(inquiryId);
    if (!saved) return;
    void fetchCardPaymentStatus(token, saved.paymentId)
      .then((st) => {
        setLinkPaymentId(saved.paymentId);
        setLinkUrl(saved.linkUrl);
        setAlimtalkSentAt(saved.alimtalkSentAt ?? null);
        setAlimtalkMaskedPhone(saved.alimtalkMaskedPhone ?? null);
        if (st.status === 'APPROVED') {
          setPaidPayment({
            id: st.id,
            inquiryId,
            inquiryNumber: null,
            method: 'CUSTOMER_LINK',
            status: 'APPROVED',
            amountWon: st.amountWon,
            tenantFeeBps: 0,
            platformCostBps: 0,
            tenantFeeWon: 0,
            platformCostWon: 0,
            platformSpreadWon: 0,
            tenantNetWon: st.amountWon,
            customerName: st.customerName,
            customerPhoneMasked: null,
            cardLast4: st.cardLast4,
            approvalNo: st.approvalNo,
            pgOrderId: null,
            paidAt: st.paidAt,
            failReason: null,
            createdAt: st.paidAt || new Date().toISOString(),
            createdBy: { id: '', name: '' },
          });
          setPaidMessage(st.approvalNo ? `승인번호 ${st.approvalNo}` : '');
          setGoodsName(st.goodsName || saved.goodsName);
          setStep('paid');
          return;
        }
        if (st.waiting) {
          setAmount(String(saved.amountWon));
          setGoodsName(saved.goodsName);
          setStep('link');
        } else {
          clearLinkSession(inquiryId);
        }
      })
      .catch(() => clearLinkSession(inquiryId));
  }, [inquiryId]);

  useEffect(() => {
    if (step !== 'link' || !linkPaymentId) return;
    const token = readToken();
    if (!token) return;
    let cancelled = false;
    const tick = () => {
      void fetchCardPaymentStatus(token, linkPaymentId)
        .then((st) => {
          if (cancelled) return;
          if (st.status !== 'APPROVED') return;
          setPaidPayment({
            id: st.id,
            inquiryId: inquiryId || null,
            inquiryNumber: null,
            method: 'CUSTOMER_LINK',
            status: 'APPROVED',
            amountWon: st.amountWon,
            tenantFeeBps: 0,
            platformCostBps: 0,
            tenantFeeWon: 0,
            platformCostWon: 0,
            platformSpreadWon: 0,
            tenantNetWon: st.amountWon,
            customerName: st.customerName,
            customerPhoneMasked: null,
            cardLast4: st.cardLast4,
            approvalNo: st.approvalNo,
            pgOrderId: null,
            paidAt: st.paidAt,
            failReason: null,
            createdAt: st.paidAt || new Date().toISOString(),
            createdBy: { id: '', name: '' },
          });
          setPaidMessage(st.approvalNo ? `승인번호 ${st.approvalNo}` : '');
          if (st.goodsName) setGoodsName(st.goodsName);
          setStep('paid');
          celebrate();
        })
        .catch(() => {
          /* keep polling */
        });
    };
    tick();
    const id = window.setInterval(tick, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [step, linkPaymentId, inquiryId, celebrate]);

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
    setAlimtalkConfirmOpen(false);
  };

  const goNextFromPick = () => {
    if (!picked) return;
    setError(null);
    setStep(picked === 'keyin' ? 'keyin' : 'auth');
  };

  const persistLinkSession = (patch: Partial<LinkSession> & Pick<LinkSession, 'paymentId' | 'linkUrl'>) => {
    if (!inquiryId) return;
    const next: LinkSession = {
      paymentId: patch.paymentId,
      linkUrl: patch.linkUrl,
      amountWon: patch.amountWon ?? amountWon,
      goodsName: patch.goodsName ?? (goodsName.trim() || '청소비'),
      alimtalkSentAt: patch.alimtalkSentAt ?? alimtalkSentAt ?? undefined,
      alimtalkMaskedPhone: patch.alimtalkMaskedPhone ?? alimtalkMaskedPhone ?? undefined,
    };
    saveLinkSession(inquiryId, next);
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
        setLinkPaymentId(sent.payment.id);
        setAlimtalkSentAt(null);
        setAlimtalkMaskedPhone(null);
        setAlimtalkPhone(customerPhone);
        persistLinkSession({
          paymentId: sent.payment.id,
          linkUrl: sent.linkUrl,
          amountWon,
          goodsName: goodsName.trim() || '청소비',
          alimtalkSentAt: undefined,
          alimtalkMaskedPhone: undefined,
        });
        setStep('link');
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : '링크를 만들지 못했습니다.'))
      .finally(() => setBusy(false));
  };

  const openAlimtalkConfirm = () => {
    const token = readToken();
    if (!token || !linkPaymentId || !linkUrl) return;
    if (alimtalkReady && !alimtalkReady.ready) return;
    if (alimtalkSentAt) {
      const ok = window.confirm('이미 알림톡을 보냈습니다. 다시 보낼까요?');
      if (!ok) return;
    }
    setAlimtalkBusy(true);
    setError(null);
    void previewCardPaymentAlimtalk(token, linkPaymentId, {
      payTokenOrUrl: linkUrl,
      toPhone: alimtalkPhone,
    })
      .then((res) => {
        setAlimtalkPreview({ text: res.previewText, masked: res.maskedPhone });
        setAlimtalkConfirmOpen(true);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : '미리보기를 불러오지 못했습니다.'))
      .finally(() => setAlimtalkBusy(false));
  };

  const confirmAlimtalkSend = () => {
    const token = readToken();
    if (!token || !linkPaymentId || !linkUrl) return;
    setAlimtalkBusy(true);
    setError(null);
    void sendCardPaymentAlimtalk(token, linkPaymentId, {
      payTokenOrUrl: linkUrl,
      toPhone: alimtalkPhone,
    })
      .then((res) => {
        const sentAt = res.sentAtIso || new Date().toISOString();
        const masked = res.maskedPhone || alimtalkPreview?.masked || '';
        setAlimtalkSentAt(sentAt);
        setAlimtalkMaskedPhone(masked);
        setAlimtalkConfirmOpen(false);
        persistLinkSession({
          paymentId: linkPaymentId,
          linkUrl,
          alimtalkSentAt: sentAt,
          alimtalkMaskedPhone: masked,
        });
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : '알림톡 발송에 실패했습니다.'))
      .finally(() => setAlimtalkBusy(false));
  };

  const alimtalkEnabled = Boolean(alimtalkReady?.ready);

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
              <section className="rounded-[18px] border border-amber-200 bg-amber-50 px-4 py-4 text-center shadow-sm">
                <p className="text-fluid-sm font-bold text-amber-900">고객 결제 기다리는 중</p>
                <p className="mt-1 text-fluid-2xs text-amber-800/80">5초마다 결제 상태를 확인합니다.</p>
                <p
                  className="mt-3 tabular-nums text-amber-950"
                  style={{ fontSize: 26, fontWeight: 800, lineHeight: 1.15 }}
                >
                  {formatWon(amountWon)}
                </p>
              </section>
              <section className={TEAM_PAY_CARD}>
                <p className="text-fluid-sm font-bold text-[#0F172A]">결제 링크를 만들었어요</p>
                <p className="mt-1 text-fluid-2xs text-slate-500">지금 결제해 달라고 안내해 주세요.</p>
                <label className="mt-3 block">
                  <span className="text-fluid-2xs text-slate-500">받는 번호</span>
                  <input
                    type="tel"
                    inputMode="tel"
                    className="login-field-input mt-1 w-full min-h-11 rounded-xl border border-slate-200 px-3 text-fluid-sm tabular-nums"
                    value={alimtalkPhone}
                    onChange={(e) => setAlimtalkPhone(e.target.value)}
                    placeholder="01012345678"
                  />
                </label>
                {alimtalkSentAt ? (
                  <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-fluid-xs text-emerald-800">
                    알림톡을 보냈어요 · {alimtalkMaskedPhone || '번호'} · {formatSentClock(alimtalkSentAt)}
                  </p>
                ) : null}
                {!alimtalkEnabled ? (
                  <p className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-fluid-2xs leading-snug text-slate-600">
                    {alimtalkReady?.reason || '카카오 승인 대기 중 — 공유·복사로 보내 주세요'}
                  </p>
                ) : null}
                <div className="mt-3 flex items-center gap-2 rounded-xl border border-slate-200 bg-[#F4F6FA] px-3 py-2.5">
                  <code className="min-w-0 flex-1 truncate text-fluid-2xs text-slate-700">{linkUrl}</code>
                </div>
              </section>
              <div className={`${TEAM_PAY_FOOTER} grid gap-2`}>
                <Button
                  type="button"
                  variant="primary"
                  size="lg"
                  disabled={!alimtalkEnabled || alimtalkBusy}
                  className="h-[54px] w-full rounded-[14px]"
                  onClick={openAlimtalkConfirm}
                >
                  <LineMdIcon name="chat" className="size-4" />
                  {alimtalkBusy ? '준비 중…' : alimtalkSentAt ? '알림톡 다시 보내기' : '알림톡 보내기'}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="lg"
                  className="h-[54px] w-full rounded-[14px]"
                  onClick={() => setShareOpen(true)}
                >
                  공유
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
              <section className={`${TEAM_PAY_CARD} flex flex-col items-center text-center border-emerald-200 bg-emerald-50`}>
                <span className="flex size-14 items-center justify-center rounded-full bg-[#DCFCE7] text-[#15803D]">
                  <LineMdIcon name="confirm" className="size-7" />
                </span>
                <p className="mt-3 text-fluid-lg font-bold text-emerald-900">
                  결제 완료 · {formatWon(paidPayment?.amountWon ?? amountWon)}
                  {paidPayment?.approvalNo ? ` · ${paidPayment.approvalNo}` : ''}
                </p>
                <p
                  className="mt-2 tabular-nums text-emerald-950"
                  style={{ fontSize: 30, fontWeight: 800, lineHeight: 1.2 }}
                >
                  {formatWon(paidPayment?.amountWon ?? amountWon)}
                </p>
                <p className="mt-2 text-fluid-sm font-semibold text-emerald-800">철수해도 돼요</p>
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
        phone={alimtalkPhone || customerPhone}
        message={shareMessage}
        onClose={() => setShareOpen(false)}
      />
      <TeamCardPaymentAlimtalkConfirm
        open={alimtalkConfirmOpen}
        previewText={alimtalkPreview?.text || ''}
        maskedPhone={alimtalkPreview?.masked || ''}
        busy={alimtalkBusy}
        onConfirm={confirmAlimtalkSend}
        onClose={() => setAlimtalkConfirmOpen(false)}
      />
    </div>
  );
}
