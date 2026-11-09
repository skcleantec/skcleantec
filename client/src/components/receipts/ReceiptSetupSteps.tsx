import { useState } from 'react';
import {
  BAROBILL_USER_ID_MESSAGE,
  CASHBILL_UNIT_PRICE_KRW,
  TAXINVOICE_UNIT_PRICE_KRW,
  barobillUserIdError,
} from '@shared/barobillPolicy';
import type { CashbillSettings } from '../../api/cashbill';
import { cancelCashbillLinkRequest, requestCashbillLink } from '../../api/cashbill';
import { CashbillCertRegisterModal } from '../cashbill/CashbillCertRegisterModal';
import { CashbillLinkForm } from '../cashbill/CashbillLinkForm';
import { certExpireLabel } from '../cashbill/cashbillCertDisplay';
import { LineMdIcon } from '../ui/LineMdIcon';
import { useReceiptWallet } from '../wallet/ReceiptWalletProvider';
import {
  approxIssueCount,
  type ReceiptSetupKind,
  type ReceiptSetupStep,
  writeCertSkipped,
} from './receiptSetupState';

const BTN =
  'min-h-11 rounded-lg bg-slate-900 px-3 text-fluid-xs font-medium text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none';
const GHOST =
  'min-h-11 rounded-lg border border-[#dde3ea] bg-white px-3 text-fluid-xs font-medium text-[#141b26] hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none';
const INPUT =
  'mt-1 block w-full min-h-11 rounded-lg border border-[#dde3ea] px-3 py-2 text-fluid-xs text-[#141b26] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-50';

const CHARGE_PRESETS = [50_000, 100_000, 200_000, 300_000] as const;

function won(n: number): string {
  return `${n.toLocaleString('ko-KR')}원`;
}

function StepRail({
  kind,
  step,
  certExpireDate,
  certDone,
}: {
  kind: ReceiptSetupKind;
  step: ReceiptSetupStep;
  certExpireDate: string | null;
  certDone: boolean;
}) {
  const items: { id: ReceiptSetupStep; title: string; sub?: string }[] = [
    { id: 1, title: '① 바로빌 가입' },
    {
      id: 2,
      title: '② 공동인증서 등록',
      sub: kind === 'taxinvoice' ? '세금계산서만 필요' : '세금계산서만 필요 · 현금은 건너뛰기 가능',
    },
    { id: 3, title: '③ 지갑 충전' },
  ];
  return (
    <ol className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      {items.map((item) => {
        const done = item.id < step || (item.id === 2 && certDone && step === 3);
        const current = item.id === step;
        return (
          <li
            key={item.id}
            className={`rounded-[10px] border px-3 py-2.5 ${
              current
                ? 'border-[#1f4fb8] bg-[#e8f0ff]'
                : done
                  ? 'border-[#a9dfc1] bg-[#e3f6ec]'
                  : 'border-[#dde3ea] bg-white'
            }`}
          >
            <div className="flex items-center gap-1.5">
              {done && !current ? (
                <LineMdIcon name="confirm" className="size-4 text-[#126b3f]" />
              ) : null}
              <span className={`text-fluid-xs font-medium ${current ? 'text-[#1f4fb8]' : done ? 'text-[#126b3f]' : 'text-[#141b26]'}`}>
                {item.title}
              </span>
              {done && !current ? (
                <span className="rounded bg-[#a9dfc1]/60 px-1.5 py-0.5 text-[11px] text-[#126b3f]">완료</span>
              ) : null}
            </div>
            {item.id === 2 && (done || current) && certExpireDate ? (
              <p className="mt-1 text-fluid-2xs text-[#5d6878]">만료일 {certExpireLabel(certExpireDate)}</p>
            ) : item.sub ? (
              <p className="mt-1 text-fluid-2xs text-[#5d6878]">{item.sub}</p>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

function FlowArrow() {
  return <LineMdIcon name="arrow-right" className="mx-auto size-4 shrink-0 text-[#5d6878] sm:mx-0" />;
}

function Step1Explain() {
  return (
    <div className="space-y-3 rounded-[14px] border border-[#dde3ea] bg-white p-4">
      <h2 className="text-fluid-sm font-semibold text-[#141b26]">이렇게 발행돼요</h2>
      <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:gap-1.5">
        {[
          { icon: 'clipboard' as const, title: '청소비서', body: '접수에서 발행 버튼' },
          { icon: 'cloud' as const, title: '바로빌', body: '우리 대신 국세청에 신고' },
          { icon: 'confirm' as const, title: '국세청·고객', body: '홈택스 등록·고객 문자 안내' },
        ].map((card, i) => (
          <div key={card.title} className="contents sm:contents">
            {i > 0 ? <FlowArrow /> : null}
            <div className="min-w-0 flex-1 rounded-[10px] border border-[#dde3ea] bg-[#f4f6f8] px-3 py-2.5">
              <div className="flex items-center gap-1.5">
                <LineMdIcon name={card.icon} className="size-4 text-[#1f4fb8]" />
                <span className="text-fluid-xs font-medium text-[#141b26]">{card.title}</span>
              </div>
              <p className="mt-1 text-fluid-2xs text-[#5d6878]">{card.body}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <div className="rounded-[10px] border border-[#dde3ea] px-3 py-2">
          <p className="text-fluid-2xs text-[#5d6878]">건당 요금 · 부가세 별도</p>
          <p className="text-fluid-xs text-[#141b26]">
            현금영수증 {won(CASHBILL_UNIT_PRICE_KRW)}
            <br />
            세금계산서 {won(TAXINVOICE_UNIT_PRICE_KRW)}
          </p>
        </div>
        <div className="rounded-[10px] border border-[#dde3ea] px-3 py-2">
          <p className="text-fluid-2xs text-[#5d6878]">필요한 것</p>
          <p className="text-fluid-xs text-[#141b26]">사업자정보(업체정보에서 채움)</p>
        </div>
        <div className="rounded-[10px] border border-[#dde3ea] px-3 py-2">
          <p className="text-fluid-2xs text-[#5d6878]">걸리는 시간</p>
          <p className="text-fluid-xs text-[#141b26]">약 1분</p>
        </div>
      </div>
      <p className="rounded-[10px] border border-[#f0d27a] bg-[#fff6dc] px-3 py-2 text-fluid-xs text-[#7a5300]">
        유료 기능이에요. 청소비서 지갑에 충전한 금액 안에서만 발행되고, 잔액이 모자라면 발행이 멈춰요.
      </p>
    </div>
  );
}

function Step2Explain() {
  return (
    <div className="space-y-3 rounded-[14px] border border-[#dde3ea] bg-white p-4">
      <h2 className="text-fluid-sm font-semibold text-[#141b26]">새 창에서 이 순서대로 하면 끝나요</h2>
      <div className="grid grid-cols-1 gap-2">
        {[
          { icon: 'document' as const, title: '인증서 위치 고르기', body: 'PC·USB' },
          {
            icon: 'security' as const,
            title: '사업자 인증서 고르기',
            body: '사업자 범용 또는 전자세금계산서용. 은행용 개인 인증서는 안 됩니다.',
          },
          {
            icon: 'lock' as const,
            title: '인증서 비밀번호 넣기',
            body: '바로빌 창에만 입력해요. 청소비서에는 저장되지 않습니다.',
          },
        ].map((card) => (
          <div key={card.title} className="flex gap-2 rounded-[10px] border border-[#dde3ea] bg-[#f4f6f8] px-3 py-2.5">
            <LineMdIcon name={card.icon} className="mt-0.5 size-4 shrink-0 text-[#1f4fb8]" />
            <div>
              <p className="text-fluid-xs font-medium text-[#141b26]">{card.title}</p>
              <p className="mt-0.5 text-fluid-2xs text-[#5d6878]">{card.body}</p>
            </div>
          </div>
        ))}
      </div>
      <p className="rounded-[10px] border border-[#b9cdf7] bg-[#e8f0ff] px-3 py-2 text-fluid-xs text-[#1f4fb8]">
        PC에서 진행하는 것을 권장해요. 등록 창이 안 열리면 주소창 옆 팝업 허용을 확인해 주세요.
      </p>
    </div>
  );
}

function LinkRequestPanel({
  memberId,
  onDone,
}: {
  memberId: string;
  onDone: () => void;
}) {
  const [hint, setHint] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setBusy(true);
    setError(null);
    try {
      await requestCashbillLink(memberId, hint);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : '연결 요청을 보내지 못했습니다.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2 rounded-[10px] border border-[#f0d27a] bg-[#fff6dc] px-3 py-3">
      <strong className="text-fluid-xs text-[#141b26]">이미 바로빌을 쓰고 있는 사업자인가요?</strong>
      <p className="text-fluid-2xs text-[#141b26]">연결 요청을 보내 주시면 청소비서가 대신 연결해 드려요.</p>
      <label className="block text-fluid-2xs text-[#5d6878]">
        바로빌 아이디
        <input className={INPUT} value={hint} maxLength={50} disabled={busy} onChange={(e) => setHint(e.target.value)} placeholder="예: clean_1234" />
      </label>
      {hint.trim() && barobillUserIdError(hint) ? (
        <p className="text-fluid-xs text-[#b42318]">{BAROBILL_USER_ID_MESSAGE}</p>
      ) : null}
      {error ? <p className="text-fluid-xs text-[#b42318]">{error}</p> : null}
      <button type="button" className={BTN} disabled={busy || Boolean(barobillUserIdError(hint))} onClick={() => void send()}>
        {busy ? '보내는 중…' : '연결 요청하기'}
      </button>
    </div>
  );
}

export function ReceiptSetupSteps({
  kind,
  step,
  settings,
  brand,
  balanceKrw,
  canEditCompany,
  onReload,
  onCertSkip,
}: {
  kind: ReceiptSetupKind;
  step: ReceiptSetupStep;
  settings: CashbillSettings;
  brand: CashbillSettings['brands'][number];
  balanceKrw: number;
  canEditCompany: boolean;
  onReload: () => void;
  onCertSkip: () => void;
}) {
  const { openCharge } = useReceiptWallet();
  const [certOpen, setCertOpen] = useState(false);
  const [chargePick, setChargePick] = useState<number>(50_000);
  const member = brand.member;
  const certDone = member?.certValid === true;
  const unit = kind === 'cashbill' ? CASHBILL_UNIT_PRICE_KRW : TAXINVOICE_UNIT_PRICE_KRW;
  const afterBalance = balanceKrw + chargePick;

  return (
    <div className="flex min-w-0 w-full max-w-full flex-col gap-3">
      <div>
        <h1 className="text-fluid-lg font-semibold text-[#141b26]">
          {kind === 'cashbill' ? '현금영수증' : '세금계산서'} 시작하기
        </h1>
        <p className="mt-0.5 text-fluid-xs text-[#5d6878]">기본 브랜드({brand.name}) 기준으로 준비합니다.</p>
      </div>

      <StepRail
        kind={kind}
        step={step}
        certExpireDate={member?.certExpireDate ?? null}
        certDone={certDone}
      />

      {step === 1 ? (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <Step1Explain />
          <div className="space-y-3 rounded-[14px] border border-[#dde3ea] bg-white p-4">
            <h2 className="text-fluid-sm font-semibold text-[#141b26]">바로빌 가입</h2>
            {settings.blockReason ? (
              <p className="rounded-[10px] border border-[#f0d27a] bg-[#fff6dc] px-3 py-2 text-fluid-xs text-[#7a5300]">
                {settings.blockReason}
              </p>
            ) : null}
            {member?.status === 'PENDING_REVIEW' || member?.status === 'PROCESSING' ? (
              <p className="rounded-[10px] border border-[#b9cdf7] bg-[#e8f0ff] px-3 py-2 text-fluid-xs text-[#1f4fb8]">
                검토·연결 처리 중이에요. 끝나면 이 화면에서 이어서 진행할 수 있어요.
              </p>
            ) : null}
            {member?.linkRequestedAt && member.status !== 'ACTIVE' ? (
              <div className="space-y-2">
                <p className="rounded-lg bg-[#111a2b] px-3 py-2 text-fluid-xs text-white">연결 요청을 보냈어요</p>
                <button
                  type="button"
                  className={GHOST}
                  onClick={() => {
                    void cancelCashbillLinkRequest(member.id).then(onReload).catch(() => undefined);
                  }}
                >
                  요청 취소
                </button>
              </div>
            ) : null}
            {!member || member.status === 'REJECTED' || member.status === 'FAILED' ? (
              <CashbillLinkForm
                brand={brand}
                prefill={settings.prefill}
                missing={brand.isDefault ? settings.missing : []}
                canEditCompany={canEditCompany}
                canRegister={settings.canRegister}
                mode="join"
                submitLabel="바로빌 가입하기"
                requirePaidConsent
                onDone={() => onReload()}
              />
            ) : null}
            {member?.status === 'LINK_REQUIRED' && !member.linkRequestedAt ? (
              <LinkRequestPanel memberId={member.id} onDone={onReload} />
            ) : null}
            {!member ? (
              <p className="text-fluid-2xs text-[#5d6878]">
                이미 바로빌을 쓰고 있는 사업자인가요? 가입 후 연결이 막히면 「연결 요청하기」가 이어서 보여요.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <Step2Explain />
          <div className="space-y-3 rounded-[14px] border border-[#dde3ea] bg-white p-4">
            <h2 className="text-fluid-sm font-semibold text-[#141b26]">인증서 등록</h2>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-fluid-xs">
              <dt className="text-[#5d6878]">브랜드</dt>
              <dd className="text-[#141b26]">{brand.name}</dd>
              <dt className="text-[#5d6878]">바로빌</dt>
              <dd className="text-[#126b3f]">가입 완료</dd>
              <dt className="text-[#5d6878]">인증서</dt>
              <dd className="text-[#141b26]">
                {certDone
                  ? `등록됨 · 만료 ${certExpireLabel(member?.certExpireDate)}`
                  : '미등록'}
              </dd>
            </dl>
            <button type="button" className={BTN} onClick={() => setCertOpen(true)}>
              등록 창 열기
            </button>
            {kind === 'cashbill' ? (
              <button
                type="button"
                className={GHOST}
                onClick={() => {
                  writeCertSkipped(brand.operatingCompanyId);
                  onCertSkip();
                }}
              >
                나중에 하고 충전으로 넘어가기
              </button>
            ) : null}
          </div>
          {certOpen ? (
            <CashbillCertRegisterModal
              operatingCompanyId={brand.operatingCompanyId}
              onClose={() => {
                setCertOpen(false);
                onReload();
              }}
              onRegistered={() => {
                setCertOpen(false);
                onReload();
              }}
            />
          ) : null}
        </div>
      ) : null}

      {step === 3 ? (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <div className="space-y-3 rounded-[14px] border border-[#dde3ea] bg-white p-4">
            <p className="rounded-[10px] border border-[#f5b5b0] bg-[#fff1f0] px-3 py-2 text-fluid-xs text-[#b42318]">
              충전 잔액이 없어 발행할 수 없어요 · 지금 {won(balanceKrw)}
            </p>
            <div>
              <p className="text-fluid-xs text-[#5d6878]">충전 금액</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {CHARGE_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    className={`min-h-11 rounded-lg border px-3 text-fluid-xs tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 ${
                      chargePick === preset
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-[#dde3ea] bg-white text-[#141b26] hover:bg-slate-50'
                    }`}
                    onClick={() => setChargePick(preset)}
                  >
                    {won(preset)}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-fluid-xs text-[#141b26]">
                고른 금액으로 현금영수증 약 {approxIssueCount(chargePick, CASHBILL_UNIT_PRICE_KRW)}건
                {' / '}
                세금계산서 약 {approxIssueCount(chargePick, TAXINVOICE_UNIT_PRICE_KRW)}건
              </p>
            </div>
            <ul className="space-y-1 text-fluid-2xs text-[#5d6878]">
              <li>· 알림톡과 같은 청소비서 지갑을 씁니다.</li>
              <li>· 발행에 실패하면 차감한 금액을 바로 돌려드립니다.</li>
              <li>· 사업자상태 조회는 무료입니다.</li>
            </ul>
          </div>
          <div className="space-y-3 rounded-[14px] border border-[#dde3ea] bg-white p-4">
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-fluid-xs">
              <dt className="text-[#5d6878]">지금 잔액</dt>
              <dd className="tabular-nums text-[#141b26]">{won(balanceKrw)}</dd>
              <dt className="text-[#5d6878]">충전 금액</dt>
              <dd className="tabular-nums text-[#141b26]">{won(chargePick)}</dd>
              <dt className="text-[#5d6878]">충전 후 잔액</dt>
              <dd className="tabular-nums text-[#141b26]">{won(afterBalance)}</dd>
              <dt className="text-[#5d6878]">부가세 10%</dt>
              <dd className="tabular-nums text-[#141b26]">{won(Math.round(chargePick * 0.1))}</dd>
              <dt className="font-semibold text-[#141b26]">결제 금액</dt>
              <dd className="font-semibold tabular-nums text-[#141b26]">{won(chargePick + Math.round(chargePick * 0.1))}</dd>
            </dl>
            <p className="text-fluid-2xs text-[#5d6878]">
              이 화면 요금 기준 약 {approxIssueCount(afterBalance, unit)}건 발행 가능
            </p>
            <button type="button" className={BTN} onClick={() => openCharge(chargePick)}>
              {won(chargePick + Math.round(chargePick * 0.1))} 결제하고 충전
            </button>
            <p className="text-fluid-2xs text-[#5d6878]">결제 후 세금계산서가 담당 이메일로 가요</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function ReceiptReadyStatusBar({
  kind,
  brand,
  balanceKrw,
}: {
  kind: ReceiptSetupKind;
  brand: CashbillSettings['brands'][number];
  balanceKrw: number;
}) {
  const { openCharge } = useReceiptWallet();
  const certLabel = brand.member?.certValid
    ? `인증서 ${certExpireLabel(brand.member.certExpireDate)}`
    : kind === 'cashbill'
      ? '인증서 나중에'
      : '인증서 없음';
  const cashLeft = approxIssueCount(balanceKrw, CASHBILL_UNIT_PRICE_KRW);
  const taxLeft = approxIssueCount(balanceKrw, TAXINVOICE_UNIT_PRICE_KRW);
  const lowCash = balanceKrw > 0 && balanceKrw < 3_000;
  const GHOST_SM =
    'min-h-11 rounded-lg border border-[#dde3ea] bg-white px-3 text-fluid-xs font-medium text-[#141b26] hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2';

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-[10px] border border-[#dde3ea] bg-white px-3 py-2">
        <p className="text-fluid-xs text-[#141b26]">
          <span className="text-[#126b3f]">✓바로빌 가입</span>
          {' '}
          <span className="text-[#126b3f]">✓{certLabel}</span>
          <span className="mx-1.5 text-[#dde3ea]">|</span>
          지갑 잔액 {won(balanceKrw)}
          {' · '}
          현금영수증 약 {cashLeft}건
          {' · '}
          세금계산서 약 {taxLeft}건
        </p>
        <button type="button" className={GHOST_SM} onClick={() => openCharge()}>
          충전하기
        </button>
      </div>
      {lowCash ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-[10px] border border-[#f0d27a] bg-[#fff6dc] px-3 py-2">
          <p className="text-fluid-xs text-[#7a5300]">
            현금영수증 {cashLeft}건 남짓 남았어요. 0원이 되면 발행 버튼이 잠겨요
          </p>
          <button type="button" className={GHOST_SM} onClick={() => openCharge()}>
            충전하기
          </button>
        </div>
      ) : null}
    </div>
  );
}
