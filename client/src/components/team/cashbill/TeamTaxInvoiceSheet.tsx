import { useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  fetchTeamTaxPrefill,
  issueTeamTaxInvoice,
  requestTeamTaxCert,
  requestTeamTaxCharge,
  TeamTaxInvoiceError,
  type TeamTaxBuyer,
  type TeamTaxPrefill,
} from '../../../api/teamTaxInvoice';
import { teamFooterActionPrimaryClass, teamFooterActionSecondaryClass } from '../../../utils/teamInspectionDisplay';
import { STAFF_APP_SAFE_OVERLAY } from '../../../utils/staffAppSafeArea';
import { TeamReceiptKindTabs } from './TeamReceiptKindTabs';

function digits(value: string): string {
  return value.replace(/\D/g, '');
}

function grouped(value: string): string {
  const raw = digits(value);
  if (!raw) return '';
  return Number(raw).toLocaleString('ko-KR');
}

function splitTax(total: number, exempt: boolean): { supply: number; tax: number } {
  if (total < 1) return { supply: 0, tax: 0 };
  if (exempt) return { supply: total, tax: 0 };
  const supply = Math.round(total / 1.1);
  return { supply, tax: total - supply };
}

export function TeamTaxInvoiceSheet({
  open,
  inquiryId,
  onClose,
  onCash,
  showTabs,
}: {
  open: boolean;
  inquiryId: string | null;
  onClose: () => void;
  onCash: () => void;
  showTabs: boolean;
}) {
  const titleId = useId();
  const [prefill, setPrefill] = useState<TeamTaxPrefill | null>(null);
  const [loading, setLoading] = useState(false);
  const [brandId, setBrandId] = useState('');
  const [biz, setBiz] = useState('');
  const [corpName, setCorpName] = useState('');
  const [ceoName, setCeoName] = useState('');
  const [email, setEmail] = useState('');
  const [addr, setAddr] = useState('');
  const [bizType, setBizType] = useState('');
  const [bizClass, setBizClass] = useState('');
  const [amount, setAmount] = useState('');
  const [itemName, setItemName] = useState('청소 서비스');
  const [purpose, setPurpose] = useState<1 | 2>(1);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [walletShort, setWalletShort] = useState(false);
  const [chargeSent, setChargeSent] = useState(false);
  const [certSent, setCertSent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [issued, setIssued] = useState<{ email: string; shareUrl: string } | null>(null);

  useEffect(() => {
    if (!open) return;
    setIssued(null);
    setConfirming(false);
    setError(null);
    setLoading(true);
    void fetchTeamTaxPrefill(inquiryId)
      .then((res) => {
        setPrefill(res);
        setBrandId(res.brands[0]?.id ?? '');
        setAmount(res.defaultAmountWon > 0 ? String(res.defaultAmountWon) : '');
        setItemName(res.itemName || '청소 서비스');
        setWalletShort(res.walletShort);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : '발행 정보를 불러오지 못했습니다.'))
      .finally(() => setLoading(false));
  }, [open, inquiryId]);

  if (!open) return null;

  const brand = prefill?.brands.find((item) => item.id === brandId) ?? prefill?.brands[0];
  const certReady = Boolean(brand?.certReady);
  const exempt = brand?.taxKind === 'exempt';
  const amountWon = Number(digits(amount)) || 0;
  const priced = splitTax(amountWon, exempt);
  const reasonOn = Boolean(prefill?.alreadyIssued) || (Boolean(prefill && prefill.totalWon > 0 && amountWon > prefill.totalWon));

  const applyBuyer = (buyer: TeamTaxBuyer) => {
    setBiz(buyer.bizNumber);
    setCorpName(buyer.corpName);
    setCeoName(buyer.ceoName);
    setEmail(buyer.email);
    setAddr(buyer.addr);
    setBizType(buyer.bizType);
    setBizClass(buyer.bizClass);
  };

  const askConfirm = () => {
    if (digits(biz).length !== 10) {
      setError('사업자번호 10자리를 입력해 주세요.');
      return;
    }
    if (!corpName.trim() || !ceoName.trim() || !addr.trim() || !email.includes('@')) {
      setError('상호, 대표자, 주소, 이메일을 입력해 주세요.');
      return;
    }
    if (amountWon < 1) {
      setError('금액을 입력해 주세요.');
      return;
    }
    if (reasonOn && !reason.trim()) {
      setError('추가 발행 사유를 입력해 주세요.');
      return;
    }
    setError(null);
    setConfirming(true);
  };

  const submit = () => {
    setSaving(true);
    setError(null);
    void issueTeamTaxInvoice({
      inquiryId,
      operatingCompanyId: inquiryId ? undefined : brandId,
      amount: amountWon,
      itemName: itemName.trim() || '청소 서비스',
      purposeType: purpose,
      extraReason: reason.trim() || undefined,
      requestId: crypto.randomUUID().replace(/-/g, '').slice(0, 20),
      buyer: {
        corpNum: digits(biz),
        corpName: corpName.trim(),
        ceoName: ceoName.trim(),
        addr: addr.trim(),
        email: email.trim(),
        bizType: bizType.trim(),
        bizClass: bizClass.trim(),
      },
    })
      .then((res) => {
        setConfirming(false);
        setIssued({ email: res.email || email.trim(), shareUrl: res.shareUrl });
      })
      .catch((err: unknown) => {
        const code = err instanceof TeamTaxInvoiceError ? err.code : undefined;
        if (code === 'wallet_short') setWalletShort(true);
        setConfirming(false);
        setError(err instanceof Error ? err.message : '발행하지 못했습니다.');
      })
      .finally(() => setSaving(false));
  };

  const field = 'mt-1 min-h-11 w-full rounded-xl border border-slate-200 px-3 text-fluid-sm';
  const label = 'block text-fluid-2xs font-medium text-slate-600';

  const sheet = (
    <div className={`${STAFF_APP_SAFE_OVERLAY} fixed inset-0 z-[640] flex items-end justify-center bg-slate-900/45 pt-[max(1.5rem,env(safe-area-inset-top,0px),var(--cbiseo-safe-area-top,0px))] pb-[max(0px,env(safe-area-inset-bottom,0px),var(--cbiseo-safe-area-bottom,0px))]`}>
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="flex max-h-full w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl">
        <div className="space-y-2 border-b border-slate-100 px-3 py-2">
          <div className="flex items-center justify-between">
            <h2 id={titleId} className="text-fluid-sm font-semibold text-slate-900">영수증</h2>
            <button type="button" onClick={onClose} className="text-fluid-xs text-slate-500">닫기</button>
          </div>
          {showTabs ? <TeamReceiptKindTabs kind="tax" onChange={(next) => { if (next === 'cash') onCash(); }} /> : null}
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3">
          {loading ? <p className="text-fluid-sm text-slate-500">불러오는 중…</p> : null}
          {!loading && prefill && prefill.brands.length === 0 ? (
            <p className="text-fluid-sm text-slate-700">사무실에서 계산서 연결이 필요해요.</p>
          ) : null}
          {!loading && brand && !certReady ? (
            <div className="space-y-2">
              <p className="text-fluid-sm text-slate-800">사무실에서 인증서를 등록해야 발행할 수 있어요</p>
              <button
                type="button"
                disabled={certSent}
                className={teamFooterActionPrimaryClass}
                onClick={() => {
                  setSaving(true);
                  void requestTeamTaxCert()
                    .then(() => setCertSent(true))
                    .catch((err: unknown) => setError(err instanceof Error ? err.message : '요청을 보내지 못했습니다.'))
                    .finally(() => setSaving(false));
                }}
              >
                {certSent ? '요청을 보냈습니다' : '사무실에 등록 요청'}
              </button>
            </div>
          ) : null}
          {brand && certReady ? (
            <>
              {!inquiryId && (prefill?.brands.length ?? 0) > 1 ? (
                <label className={label}>
                  브랜드
                  <select value={brandId} onChange={(event) => setBrandId(event.target.value)} className={field}>
                    {prefill?.brands.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                </label>
              ) : null}
              {(prefill?.buyers.length ?? 0) > 0 ? (
                <label className={label}>
                  저장된 곳
                  <select
                    value=""
                    onChange={(event) => {
                      const found = prefill?.buyers.find((buyer) => buyer.bizNumber === event.target.value);
                      if (found) applyBuyer(found);
                    }}
                    className={field}
                  >
                    <option value="">선택</option>
                    {prefill?.buyers.map((buyer) => (
                      <option key={buyer.bizNumber} value={buyer.bizNumber}>{buyer.corpName}</option>
                    ))}
                  </select>
                </label>
              ) : null}
              <label className={label}>
                사업자번호
                <input value={biz} inputMode="numeric" onChange={(event) => {
                  const next = digits(event.target.value).slice(0, 10);
                  setBiz(next);
                  const found = prefill?.buyers.find((buyer) => buyer.bizNumber === next);
                  if (found) applyBuyer(found);
                }} className={field} />
              </label>
              <label className={label}>상호<input value={corpName} onChange={(event) => setCorpName(event.target.value)} className={field} /></label>
              <label className={label}>대표자<input value={ceoName} onChange={(event) => setCeoName(event.target.value)} className={field} /></label>
              <label className={label}>받을 이메일<input value={email} inputMode="email" onChange={(event) => setEmail(event.target.value)} className={field} /></label>
              <label className={label}>주소<input value={addr} onChange={(event) => setAddr(event.target.value)} className={field} /></label>
              <label className={label}>업태<input value={bizType} onChange={(event) => setBizType(event.target.value)} className={field} /></label>
              <label className={label}>
                합계 금액
                <input value={grouped(amount)} inputMode="numeric" onChange={(event) => setAmount(digits(event.target.value))} className={`${field} tabular-nums`} />
              </label>
              {inquiryId && prefill ? (
                <p className="-mt-2 text-fluid-2xs text-slate-500">
                  잔금 자동 입력 · 총액 {prefill.totalWon.toLocaleString('ko-KR')} − 예약금 {prefill.depositWon.toLocaleString('ko-KR')}
                </p>
              ) : null}
              <p className="text-fluid-2xs text-slate-600">
                공급가액 {priced.supply.toLocaleString('ko-KR')}원 · 세액 {priced.tax.toLocaleString('ko-KR')}원
              </p>
              <label className={label}>품목<input value={itemName} onChange={(event) => setItemName(event.target.value)} className={field} /></label>
              <div className="grid grid-cols-2 gap-1.5">
                <button type="button" onClick={() => setPurpose(1)} className={purpose === 1 ? teamFooterActionPrimaryClass : teamFooterActionSecondaryClass}>영수</button>
                <button type="button" onClick={() => setPurpose(2)} className={purpose === 2 ? teamFooterActionPrimaryClass : teamFooterActionSecondaryClass}>청구</button>
              </div>
              {prefill?.alreadyIssued ? <p className="text-fluid-xs text-slate-600">이 접수에 이미 발행한 세금계산서가 있습니다.</p> : null}
              {reasonOn ? (
                <label className={label}>
                  추가 발행 사유
                  <textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={2} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-fluid-sm" />
                </label>
              ) : null}
            </>
          ) : null}
          {walletShort ? <p className="text-fluid-xs text-amber-800">발행 잔액이 부족합니다. 사무실에 충전해 달라고 요청해 주세요.</p> : null}
          {chargeSent ? <p className="text-fluid-xs text-emerald-800">사무실에 충전 요청을 보냈습니다.</p> : null}
          {error ? <p className="text-fluid-xs text-red-700">{error}</p> : null}
        </div>
        <p className="border-t border-slate-100 px-3 pt-2 text-center text-fluid-2xs text-slate-500">
          업체 잔액 {(prefill?.walletBalanceKrw ?? 0).toLocaleString('ko-KR')}원 · 1건 {(prefill?.unitKrw ?? 150).toLocaleString('ko-KR')}원
        </p>
        <div className="grid grid-cols-2 gap-1.5 px-3 py-2">
          <button type="button" onClick={onClose} className={teamFooterActionSecondaryClass}>닫기</button>
          {walletShort ? (
            <button type="button" disabled={saving || chargeSent} onClick={() => {
              setSaving(true);
              void requestTeamTaxCharge().then(() => setChargeSent(true)).catch((err: unknown) => setError(err instanceof Error ? err.message : '요청을 보내지 못했습니다.')).finally(() => setSaving(false));
            }} className={teamFooterActionPrimaryClass}>사무실에 충전 요청</button>
          ) : (
            <button type="button" disabled={loading || saving || !certReady} onClick={askConfirm} className={teamFooterActionPrimaryClass}>발행</button>
          )}
        </div>
      </div>
    </div>
  );

  const confirm = confirming ? (
    <div className={`${STAFF_APP_SAFE_OVERLAY} fixed inset-0 z-[660] flex items-center justify-center bg-slate-900/45 p-4 pt-[max(1.5rem,env(safe-area-inset-top,0px),var(--cbiseo-safe-area-top,0px))] pb-[max(1rem,env(safe-area-inset-bottom,0px),var(--cbiseo-safe-area-bottom,0px))]`}>
      <div role="dialog" aria-modal="true" className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-xl">
        <p className="text-center text-fluid-sm font-semibold text-slate-900">이 내용으로 발행할까요?</p>
        <p className="mt-2 text-center text-fluid-xs text-slate-700">
          {corpName.trim()}
          <br />
          합계 {amountWon.toLocaleString('ko-KR')}원
          <br />
          공급가액 {priced.supply.toLocaleString('ko-KR')}원 · 세액 {priced.tax.toLocaleString('ko-KR')}원
          <br />
          {email.trim()}
        </p>
        <div className="mt-3 grid grid-cols-2 gap-1.5">
          <button type="button" disabled={saving} onClick={() => setConfirming(false)} className={teamFooterActionSecondaryClass}>닫기</button>
          <button type="button" disabled={saving} onClick={submit} className={teamFooterActionPrimaryClass}>{saving ? '발행 중…' : '발행'}</button>
        </div>
      </div>
    </div>
  ) : null;

  const done = issued ? (
    <div className={`${STAFF_APP_SAFE_OVERLAY} fixed inset-0 z-[680] flex items-center justify-center bg-slate-900/45 p-4 pt-[max(1.5rem,env(safe-area-inset-top,0px),var(--cbiseo-safe-area-top,0px))] pb-[max(1rem,env(safe-area-inset-bottom,0px),var(--cbiseo-safe-area-bottom,0px))]`}>
      <div role="dialog" aria-modal="true" className="w-full max-w-sm rounded-2xl bg-white p-4 text-center shadow-xl">
        <p className="text-fluid-sm font-semibold text-slate-900">발행했습니다</p>
        <p className="mt-2 text-fluid-xs text-slate-700">{issued.email}로 메일이 갔어요</p>
        <div className="mt-3 grid grid-cols-1 gap-1.5">
          {issued.shareUrl ? (
            <button type="button" className={teamFooterActionPrimaryClass} onClick={() => window.open(issued.shareUrl, '_blank', 'noopener')}>영수증 보기</button>
          ) : null}
          <button type="button" onClick={onClose} className={teamFooterActionSecondaryClass}>닫기</button>
        </div>
      </div>
    </div>
  ) : null;

  return createPortal(<>{sheet}{confirm}{done}</>, document.body);
}
