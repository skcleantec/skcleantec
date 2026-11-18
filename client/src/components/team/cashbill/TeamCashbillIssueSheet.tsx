import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  cashbillCustomerSms,
  fetchTeamCashbillPrefill,
  issueTeamCashbill,
  requestTeamCashbillCharge,
  TeamCashbillError,
  type TeamCashbillPrefill,
} from '../../../api/teamCashbill';
import { useModalScrollKeyboardAvoidance } from '../../../hooks/useMobileInputVisibility';
import { teamFooterActionPrimaryClass, teamFooterActionSecondaryClass } from '../../../utils/teamInspectionDisplay';
import { openPaymentSms } from '../../../utils/cardPaymentShare';
import { STAFF_APP_SAFE_OVERLAY } from '../../../utils/staffAppSafeArea';
import { fetchTeamTaxAccess } from '../../../api/teamTaxInvoice';
import { TeamReceiptKindTabs } from './TeamReceiptKindTabs';
import { TeamTaxInvoiceSheet } from './TeamTaxInvoiceSheet';

type Usage = 'phone' | 'biz';
type TaxKind = 'taxable' | 'exempt';

type Issued = {
  ntsConfirmNum: string | null;
  totalWon: number;
  customerName: string;
  phone: string;
  usage: Usage;
  brandName: string;
  shareUrl: string;
};

function usageLabel(usage: Usage): string {
  return usage === 'biz' ? '지출증빙' : '소득공제';
}

function taxLabel(kind: TaxKind): string {
  return kind === 'exempt' ? '면세' : '과세';
}

function taxHint(amountWon: number, kind: TaxKind): string {
  if (kind === 'exempt') return '면세 · 부가세 없음';
  const supply = Math.round(amountWon / 1.1);
  const vat = amountWon - supply;
  return `공급가액 ${supply.toLocaleString('ko-KR')} · 부가세 ${vat.toLocaleString('ko-KR')}`;
}

function digits(value: string): string {
  return value.replace(/\D/g, '');
}

function grouped(value: string): string {
  const raw = digits(value);
  if (!raw) return '';
  return Number(raw).toLocaleString('ko-KR');
}

function needsReason(prefill: TeamCashbillPrefill | null, amount: number): boolean {
  if (!prefill) return false;
  if (prefill.alreadyIssued) return true;
  if (prefill.totalWon > 0 && amount > prefill.totalWon) return true;
  if (amount > prefill.remainingWon) return true;
  return false;
}

function overTotal(prefill: TeamCashbillPrefill | null, amount: number): string | null {
  if (prefill && prefill.totalWon > 0 && amount > prefill.totalWon) {
    return '금액이 접수 총액보다 큽니다. 맞는지 확인해 주세요.';
  }
  return null;
}

/** 아래에서 올라오는 발행 창. 확인과 완료는 화면 가운데. */
export function TeamCashbillIssueSheet({
  open,
  inquiryId,
  onClose,
  showTaxTab = false,
  initialKind = 'cash',
}: {
  open: boolean;
  inquiryId: string | null;
  onClose: () => void;
  showTaxTab?: boolean;
  /** 처음 열 때 고를 탭 (영수증 메뉴에서 보고 있던 탭) */
  initialKind?: 'cash' | 'tax';
}) {
  const titleId = useId();
  const [kind, setKind] = useState<'cash' | 'tax'>('cash');
  const [taxOn, setTaxOn] = useState(showTaxTab);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { onFieldFocus } = useModalScrollKeyboardAvoidance(scrollRef, open);
  const [prefill, setPrefill] = useState<TeamCashbillPrefill | null>(null);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [usage, setUsage] = useState<Usage>('phone');
  const [taxKind, setTaxKind] = useState<TaxKind>('taxable');
  const [phone, setPhone] = useState('');
  const [amount, setAmount] = useState('');
  const [brandId, setBrandId] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [walletShort, setWalletShort] = useState(false);
  const [chargeSent, setChargeSent] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [issued, setIssued] = useState<Issued | null>(null);

  useEffect(() => {
    if (!open) return;
    setKind(initialKind);
    void fetchTeamTaxAccess().then((res) => setTaxOn(showTaxTab && res.taxInvoiceOn)).catch(() => setTaxOn(false));
    setPrefill(null);
    setError(null);
    setWalletShort(false);
    setChargeSent(false);
    setConfirming(false);
    setIssued(null);
    setUsage('phone');
    setTaxKind('taxable');
    setReason('');
    setLoading(true);
    let stop = false;
    fetchTeamCashbillPrefill(inquiryId)
      .then((res) => {
        if (stop) return;
        setPrefill(res);
        setName(res.customerName);
        setPhone(res.customerPhone);
        setAmount(res.defaultAmountWon > 0 ? String(res.defaultAmountWon) : '');
        setBrandId(res.brands[0]?.id ?? '');
        setTaxKind(res.defaultTaxKind === 'exempt' ? 'exempt' : 'taxable');
        setWalletShort(res.walletShort);
      })
      .catch((err: unknown) => {
        if (!stop) setError(err instanceof Error ? err.message : '발행 정보를 불러오지 못했습니다.');
      })
      .finally(() => {
        if (!stop) setLoading(false);
      });
    return () => {
      stop = true;
    };
  }, [inquiryId, open, showTaxTab, initialKind]);

  if (!open) return null;
  if (taxOn && kind === 'tax') {
    return (
      <TeamTaxInvoiceSheet
        open
        inquiryId={inquiryId}
        onClose={onClose}
        onCash={() => setKind('cash')}
        showTabs
      />
    );
  }

  const amountWon = Math.round(Number(digits(amount)));
  const selectedTaxType = inquiryId
    ? prefill?.issueTaxType
    : prefill?.brands.find((brand) => brand.id === brandId)?.taxType;
  const exemptLocked = selectedTaxType === '4';
  const activeTax: TaxKind = exemptLocked ? 'exempt' : taxKind;
  const warning = overTotal(prefill, amountWon);
  const reasonOn = needsReason(prefill, amountWon);

  const askConfirm = () => {
    setError(null);
    if (!name.trim()) {
      setError('이름을 입력해 주세요.');
      return;
    }
    if (usage === 'biz') {
      if (digits(phone).length !== 10) {
        setError('사업자번호 10자리를 입력해 주세요.');
        return;
      }
    } else if (!/^01\d{8,9}$/.test(digits(phone))) {
      setError('휴대폰 번호를 확인해 주세요.');
      return;
    }
    if (!Number.isFinite(amountWon) || amountWon < 1) {
      setError('금액을 입력해 주세요.');
      return;
    }
    if (!inquiryId && !brandId) {
      setError('발행할 브랜드를 선택해 주세요.');
      return;
    }
    if (reasonOn && !reason.trim()) {
      setError('추가 발행 사유를 입력해 주세요.');
      return;
    }
    setConfirming(true);
  };

  const submit = () => {
    setSaving(true);
    setError(null);
    void issueTeamCashbill({
      inquiryId,
      operatingCompanyId: inquiryId ? undefined : brandId,
      amount: amountWon,
      identity: digits(phone),
      customerName: name.trim(),
      usage,
      taxKind: activeTax,
      extraReason: reason.trim() || undefined,
      requestId: crypto.randomUUID().replace(/-/g, '').slice(0, 20),
    })
      .then((res) => {
        setConfirming(false);
        setIssued({
          ntsConfirmNum: res.ntsConfirmNum,
          totalWon: res.totalWon,
          customerName: res.customerName,
          phone: res.phone || digits(phone),
          usage,
          brandName: res.brandName,
          shareUrl: res.shareUrl,
        });
      })
      .catch((err: unknown) => {
        const code = err instanceof TeamCashbillError ? err.code : undefined;
        if (code === 'wallet_short') setWalletShort(true);
        setConfirming(false);
        setError(err instanceof Error ? err.message : '발행하지 못했습니다.');
      })
      .finally(() => setSaving(false));
  };

  const sendCharge = () => {
    setSaving(true);
    setError(null);
    void requestTeamCashbillCharge()
      .then(() => setChargeSent(true))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : '요청을 보내지 못했습니다.'))
      .finally(() => setSaving(false));
  };

  const sheet = (
    <div className={`${STAFF_APP_SAFE_OVERLAY} fixed inset-0 z-[640] flex items-end justify-center bg-slate-900/45 pt-[max(1.5rem,env(safe-area-inset-top,0px),var(--cbiseo-safe-area-top,0px))] pb-[max(0px,env(safe-area-inset-bottom,0px),var(--cbiseo-safe-area-bottom,0px))]`}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-full w-full max-w-lg flex-col overflow-hidden rounded-t-2xl lg:mt-6 lg:max-h-[calc(100%-1.5rem)] bg-white shadow-xl"
      >
        <div className="space-y-2 border-b border-slate-100 px-3 py-2">
          <div className="flex items-center justify-between">
            <h2 id={titleId} className="text-fluid-sm font-semibold text-slate-900">
              영수증
            </h2>
            <button type="button" onClick={onClose} className="text-fluid-xs text-slate-500">
              닫기
            </button>
          </div>
          {taxOn ? <TeamReceiptKindTabs kind="cash" onChange={setKind} /> : null}
        </div>
        <div
          ref={scrollRef}
          className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3"
          style={{ paddingBottom: 'var(--modal-keyboard-inset, 0px)' }}
        >
          {loading ? <p className="text-fluid-sm text-slate-500">불러오는 중…</p> : null}
          {!inquiryId && (prefill?.brands.length ?? 0) > 1 ? (
            <label className="block text-fluid-2xs font-medium text-slate-600">
              브랜드
              <select
                value={brandId}
                onChange={(event) => setBrandId(event.target.value)}
                onFocus={onFieldFocus}
                className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 px-3 text-fluid-sm"
              >
                {prefill?.brands.map((brand) => (
                  <option key={brand.id} value={brand.id}>
                    {brand.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="block text-fluid-2xs font-medium text-slate-600">
            이름
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              onFocus={onFieldFocus}
              className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 px-3 text-fluid-sm"
            />
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              aria-pressed={usage === 'phone'}
              onClick={() => {
                if (usage === 'phone') return;
                setUsage('phone');
                setPhone(prefill?.customerPhone ?? '');
              }}
              className={usage === 'phone' ? teamFooterActionPrimaryClass : teamFooterActionSecondaryClass}
            >
              개인 소득공제
            </button>
            <button
              type="button"
              aria-pressed={usage === 'biz'}
              onClick={() => {
                if (usage === 'biz') return;
                setUsage('biz');
                setPhone('');
              }}
              className={usage === 'biz' ? teamFooterActionPrimaryClass : teamFooterActionSecondaryClass}
            >
              사업자 지출증빙
            </button>
          </div>
          {exemptLocked ? (
            <p className="text-fluid-xs text-slate-600">면세사업자는 면세로 고정됩니다.</p>
          ) : (
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                aria-pressed={activeTax === 'taxable'}
                onClick={() => setTaxKind('taxable')}
                className={activeTax === 'taxable' ? teamFooterActionPrimaryClass : teamFooterActionSecondaryClass}
              >
                과세
              </button>
              <button
                type="button"
                aria-pressed={activeTax === 'exempt'}
                onClick={() => setTaxKind('exempt')}
                className={activeTax === 'exempt' ? teamFooterActionPrimaryClass : teamFooterActionSecondaryClass}
              >
                면세
              </button>
            </div>
          )}
          <label className="block text-fluid-2xs font-medium text-slate-600">
            {usage === 'biz' ? '사업자번호' : '휴대폰 번호'}
            <input
              value={phone}
              inputMode={usage === 'biz' ? 'numeric' : 'tel'}
              onChange={(event) => setPhone(event.target.value)}
              onFocus={onFieldFocus}
              className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 px-3 text-fluid-sm"
            />
          </label>
          <label className="block text-fluid-2xs font-medium text-slate-600">
            금액
            <input
              value={grouped(amount)}
              inputMode="numeric"
              onChange={(event) => setAmount(digits(event.target.value))}
              onFocus={onFieldFocus}
              className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 px-3 text-fluid-sm tabular-nums"
            />
          </label>
          <p className="-mt-2 text-fluid-2xs text-slate-500">{taxHint(Number.isFinite(amountWon) ? amountWon : 0, activeTax)}</p>
          {inquiryId && prefill ? (
            <p className="-mt-2 text-fluid-2xs text-slate-500">
              잔금 자동 입력 · 총액 {prefill.totalWon.toLocaleString('ko-KR')} − 예약금 {prefill.depositWon.toLocaleString('ko-KR')}
            </p>
          ) : null}
          {warning ? <p className="text-fluid-xs font-medium text-amber-800">{warning}</p> : null}
          {prefill?.alreadyIssued ? (
            <p className="text-fluid-xs text-slate-600">이 접수에 이미 발행한 현금영수증이 있습니다.</p>
          ) : null}
          {reasonOn ? (
            <label className="block text-fluid-2xs font-medium text-slate-600">
              추가 발행 사유
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                onFocus={onFieldFocus}
                rows={2}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-fluid-sm"
              />
            </label>
          ) : null}
          {walletShort ? (
            <p className="text-fluid-xs text-amber-800">발행 잔액이 부족합니다. 사무실에 충전해 달라고 요청해 주세요.</p>
          ) : null}
          {chargeSent ? <p className="text-fluid-xs text-emerald-800">사무실에 충전 요청을 보냈습니다.</p> : null}
          {error ? <p className="text-fluid-xs text-red-700">{error}</p> : null}
        </div>
        <p className="border-t border-slate-100 px-3 pt-2 text-center text-fluid-2xs text-slate-500">
          업체 잔액 {(prefill?.walletBalanceKrw ?? 0).toLocaleString('ko-KR')}원 · 1건 {(prefill?.unitKrw ?? 100).toLocaleString('ko-KR')}원
        </p>
        <div className="grid grid-cols-2 gap-1.5 px-3 py-2">
          <button type="button" onClick={onClose} className={teamFooterActionSecondaryClass}>
            닫기
          </button>
          {walletShort ? (
            <button type="button" disabled={saving || chargeSent} onClick={sendCharge} className={teamFooterActionPrimaryClass}>
              사무실에 충전 요청
            </button>
          ) : (
            <button type="button" disabled={loading || saving} onClick={askConfirm} className={teamFooterActionPrimaryClass}>
              발행
            </button>
          )}
        </div>
      </div>
    </div>
  );

  const confirm = confirming ? (
    <div className={`${STAFF_APP_SAFE_OVERLAY} fixed inset-0 z-[660] flex items-center justify-center bg-slate-900/45 p-4 pt-[max(1.5rem,env(safe-area-inset-top,0px),var(--cbiseo-safe-area-top,0px))] pb-[max(1rem,env(safe-area-inset-bottom,0px),var(--cbiseo-safe-area-bottom,0px))]`}>
      <div role="dialog" aria-modal="true" className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-xl">
        <p className="text-fluid-sm font-semibold text-slate-900">이 내용으로 발행할까요?</p>
        <p className="mt-2 text-fluid-xs text-slate-700">
          {name.trim()} · {usageLabel(usage)}
          <br />
          {usage === 'biz' ? '사업자번호' : '휴대폰'} {phone}
          <br />
          {amountWon.toLocaleString('ko-KR')}원 · {taxLabel(activeTax)}
        </p>
        {warning ? <p className="mt-2 text-fluid-xs font-medium text-amber-800">{warning}</p> : null}
        <div className="mt-3 grid grid-cols-2 gap-1.5">
          <button type="button" disabled={saving} onClick={() => setConfirming(false)} className={teamFooterActionSecondaryClass}>
            닫기
          </button>
          <button type="button" disabled={saving} onClick={submit} className={teamFooterActionPrimaryClass}>
            {saving ? '발행 중…' : '발행'}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  const done = issued ? (
    <div className={`${STAFF_APP_SAFE_OVERLAY} fixed inset-0 z-[680] flex items-center justify-center bg-slate-900/45 p-4 pt-[max(1.5rem,env(safe-area-inset-top,0px),var(--cbiseo-safe-area-top,0px))] pb-[max(1rem,env(safe-area-inset-bottom,0px),var(--cbiseo-safe-area-bottom,0px))]`}>
      <div role="dialog" aria-modal="true" className="w-full max-w-sm rounded-2xl bg-white p-4 text-center shadow-xl">
        <p className="text-fluid-sm font-semibold text-slate-900">발행했습니다</p>
        <p className="mt-2 text-fluid-xs text-slate-600">승인번호</p>
        <p className="mt-1 text-fluid-base font-semibold tabular-nums text-slate-900">{issued.ntsConfirmNum || '확인 중'}</p>
        <div className="mt-3 grid grid-cols-1 gap-1.5">
          {issued.ntsConfirmNum && issued.usage === 'phone' && issued.shareUrl ? (
            <button
              type="button"
              className={teamFooterActionPrimaryClass}
              onClick={() =>
                openPaymentSms(
                  issued.phone,
                  cashbillCustomerSms({
                    brandName: issued.brandName,
                    totalWon: issued.totalWon,
                    ntsConfirmNum: issued.ntsConfirmNum ?? '',
                    url: issued.shareUrl,
                  }),
                )
              }
            >
              고객에게 문자로 보내기
            </button>
          ) : null}
          <button type="button" onClick={onClose} className={teamFooterActionSecondaryClass}>
            닫기
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return createPortal(
    <>
      {sheet}
      {confirm}
      {done}
    </>,
    document.body,
  );
}
