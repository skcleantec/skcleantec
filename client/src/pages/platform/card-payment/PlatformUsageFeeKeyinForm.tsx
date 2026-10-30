import { useEffect, useState, type FormEvent } from 'react';
import { listPlatformTenants, type PlatformTenantRow } from '../../../api/platformTenants';
import {
  fetchUsageFeeOpenPeriods,
  payPlatformUsageFeeKeyin,
  type UsageFeeOpenPeriod,
} from '../../../api/platformCardPayment';
import { usageFeeChargeKrw } from '@shared/tenantBilling';
import { getPlatformToken } from '../../../stores/platformAuth';
import { Button } from '../../../components/ui/Button';
import { PlatformPayInquiryPick } from './PlatformPayInquiryPick';
import { cardBrand, friendlyKeyinFailure, splitVatIncluded, type PayLinkSeed } from './keyinPayUi';

const INSTALLMENTS = [
  { value: '00', label: '일시불' },
  { value: '02', label: '2개월' },
  { value: '03', label: '3개월' },
  { value: '04', label: '4개월' },
  { value: '05', label: '5개월' },
  { value: '06', label: '6개월' },
];

const FIELD = 'w-full rounded-[9px] border border-[#dde3ea] bg-white px-3 py-2.5 text-sm text-[#141b26] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1f4fb8]';

type Purpose = PayLinkSeed['purpose'];

type OkResult = {
  amountWon: number;
  installmentLabel: string;
  brand: string | null;
  last4: string;
  approvalNo: string;
  buyerName: string;
  when: string;
};

export function PlatformUsageFeeKeyinForm({
  onPaid,
  onOpenHistory,
  onSendLink,
}: {
  onPaid: () => void;
  onOpenHistory: () => void;
  onSendLink: (seed: PayLinkSeed) => void;
}) {
  const [purpose, setPurpose] = useState<Purpose>('INVOICE');
  const [inquiryId, setInquiryId] = useState('');
  const [tenants, setTenants] = useState<PlatformTenantRow[]>([]);
  const [tenantId, setTenantId] = useState('');
  const [periods, setPeriods] = useState<UsageFeeOpenPeriod[]>([]);
  const [periodStartYmd, setPeriodStartYmd] = useState('');
  const [memo, setMemo] = useState('');
  const [goodsName, setGoodsName] = useState('솔루션 이용료');
  const [amountWon, setAmountWon] = useState('');
  const [buyerName, setBuyerName] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [cardNo, setCardNo] = useState('');
  const [expire, setExpire] = useState('');
  const [installment, setInstallment] = useState('00');
  const [certPw, setCertPw] = useState('');
  const [certNo, setCertNo] = useState('');
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState<OkResult | null>(null);
  const [fail, setFail] = useState<{ easy: string; pg: string | null } | null>(null);

  const amount = Number(amountWon.replace(/[^\d]/g, '')) || 0;
  const installmentOk = amount >= 50000;
  const brand = cardBrand(cardNo);
  const last4 = cardNo.slice(-4);
  const split = splitVatIncluded(amount);
  const installmentLabel = INSTALLMENTS.find((row) => row.value === installment)?.label ?? '일시불';

  useEffect(() => {
    const token = getPlatformToken();
    if (!token) return;
    void listPlatformTenants(token).then(setTenants).catch(() => setTenants([]));
  }, []);

  useEffect(() => {
    if (purpose !== 'INVOICE' || !tenantId) {
      setPeriods([]);
      setPeriodStartYmd('');
      return;
    }
    void fetchUsageFeeOpenPeriods(tenantId)
      .then((res) => {
        setPeriods(res.items);
        setPeriodStartYmd(res.items[0]?.periodStartYmd ?? '');
      })
      .catch(() => setPeriods([]));
  }, [purpose, tenantId]);

  useEffect(() => {
    if (purpose !== 'INVOICE') return;
    const period = periods.find((item) => item.periodStartYmd === periodStartYmd);
    if (!period) {
      setAmountWon('');
      return;
    }
    setAmountWon(String(period.chargeAmountKrw ?? usageFeeChargeKrw(period.amountKrw)));
    setGoodsName(`솔루션 이용료 ${period.periodLabel}`);
  }, [purpose, periods, periodStartYmd]);

  useEffect(() => {
    if (!installmentOk && installment !== '00') setInstallment('00');
  }, [installmentOk, installment]);

  function seed(): PayLinkSeed {
    return { purpose, tenantId, inquiryId, periodStartYmd, goodsName, amountWon: String(amount), buyerName, buyerPhone, memo };
  }

  function clearCard() {
    setCardNo('');
    setExpire('');
    setCertPw('');
    setCertNo('');
    setInstallment('00');
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const mm = expire.slice(0, 2);
    const yy = expire.slice(2);
    setBusy(true);
    setFail(null);
    void payPlatformUsageFeeKeyin({
      purpose,
      tenantId: tenantId || undefined,
      periodStartYmd: purpose === 'INVOICE' ? periodStartYmd : undefined,
      memo: purpose === 'INVOICE' ? undefined : memo,
      inquiryId: purpose === 'CLEANING_PROXY' ? inquiryId || undefined : undefined,
      goodsName,
      amountWon: amount,
      buyerName,
      buyerPhone,
      cardNo,
      expireMM: mm,
      expireYY: yy,
      installment,
      certPw,
      certNo,
    })
      .then((result) => {
        if (!result.ok) {
          setFail(friendlyKeyinFailure(result.message || '결제되지 않았어요'));
          clearCard();
          return;
        }
        const now = new Date();
        setOk({
          amountWon: result.amountWon ?? amount,
          installmentLabel,
          brand,
          last4: result.cardLast4 || last4,
          approvalNo: result.approvalNo || '',
          buyerName,
          when: `${now.getMonth() + 1}.${now.getDate()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
        });
        clearCard();
        onPaid();
      })
      .catch((err: unknown) => {
        setFail(friendlyKeyinFailure(err instanceof Error ? err.message : '결제되지 않았어요'));
        clearCard();
      })
      .finally(() => setBusy(false));
  }

  if (ok) {
    return (
      <section className="grid gap-2.5 rounded-[14px] border border-[#a9dfc1] bg-[#e3f6ec] px-5 py-[18px]">
        <h3 className="text-base font-bold text-[#126b3f]">결제됐어요</h3>
        <dl className="grid grid-cols-[90px_1fr] gap-x-3 gap-y-1 text-[13px]">
          <dt className="text-[#5d6878]">금액</dt>
          <dd className="tabular-nums">{ok.amountWon.toLocaleString('ko-KR')}원 · {ok.installmentLabel}</dd>
          <dt className="text-[#5d6878]">카드</dt>
          <dd className="tabular-nums">{[ok.brand, ok.last4 ? `끝 ${ok.last4}` : ''].filter(Boolean).join(' ')}</dd>
          <dt className="text-[#5d6878]">승인번호</dt>
          <dd className="tabular-nums">{ok.approvalNo || '—'}</dd>
          <dt className="text-[#5d6878]">고객</dt>
          <dd>{ok.buyerName}</dd>
          <dt className="text-[#5d6878]">시각</dt>
          <dd className="tabular-nums">{ok.when}</dd>
        </dl>
        <p className="text-xs text-[#5d6878]">오늘 안에는 결제 내역에서 전액 취소할 수 있어요. 카드번호·비밀번호는 저장하지 않았어요.</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" size="lg" onClick={() => setOk(null)}>새 결제</Button>
          <Button variant="secondary" size="lg" onClick={onOpenHistory}>결제 내역 보기</Button>
        </div>
      </section>
    );
  }

  if (fail) {
    return (
      <section className="grid gap-2.5 rounded-[14px] border border-[#f3b8b1] bg-[#fdecea] px-5 py-[18px]">
        <h3 className="text-base font-bold text-[#b42318]">결제되지 않았어요</h3>
        <p>{fail.easy}</p>
        {fail.pg ? <p className="text-xs text-[#5d6878]">카드사 메시지: {fail.pg}</p> : null}
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" size="lg" onClick={() => setFail(null)}>카드번호 고치기</Button>
          <Button variant="secondary" size="lg" onClick={() => onSendLink(seed())}>이 금액으로 링크 보내기</Button>
        </div>
        <p className="text-xs text-[#5d6878]">입력한 금액·고객 정보는 그대로 남아 있어요. 카드 정보만 다시 넣으면 돼요.</p>
      </section>
    );
  }

  return (
    <form className="overflow-hidden rounded-2xl border border-[#dde3ea] bg-white" autoComplete="off" onSubmit={onSubmit}>
      <div className="grid lg:grid-cols-2">
        <div className="grid content-start gap-3.5 p-5">
          <h2 className="text-[15px] font-bold">무엇을 받나요</h2>
          <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="용도">
            {(
              [
                ['INVOICE', '이용료', '청구서 납부'],
                ['CLEANING_PROXY', '청소비 대신 받기', '다른 업체 건'],
                ['OTHER', '기타', '그 밖의 결제'],
              ] as const
            ).map(([id, label, hint]) => (
              <button
                key={id}
                type="button"
                aria-pressed={purpose === id}
                className={`grid gap-0.5 rounded-[10px] border px-2.5 py-2 text-left text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1f4fb8] ${purpose === id ? 'border-[#111a2b] font-bold shadow-[0_0_0_1px_#111a2b]' : 'border-[#dde3ea] bg-white'}`}
                onClick={() => {
                  setPurpose(id);
                  if (id === 'OTHER') setGoodsName('기타 결제');
                  if (id === 'CLEANING_PROXY') setGoodsName('입주청소 서비스');
                  if (id !== 'INVOICE') setAmountWon('');
                }}
              >
                {label}
                <small className="text-[11px] font-normal text-[#5d6878]">{hint}</small>
              </button>
            ))}
          </div>
          <div className="rounded-[10px] border border-[#cdbff5] bg-[#efeafd] px-3 py-2 text-xs text-[#5134a8]">
            고객 카드 영수증에 서비스브릿지가 찍힙니다.
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <label className="grid gap-1 text-[13px] text-[#5d6878]">
              {purpose === 'CLEANING_PROXY' ? '청소한 업체' : `업체${purpose === 'OTHER' ? ' (선택)' : ''}`}
              <select className={FIELD} value={tenantId} required={purpose !== 'OTHER'} autoComplete="off" onChange={(e) => { setTenantId(e.target.value); setInquiryId(''); }}>
                <option value="">{purpose === 'OTHER' ? '업체 없음' : '업체를 선택하세요'}</option>
                {tenants.map((tenant) => (
                  <option key={tenant.id} value={tenant.id}>{tenant.name}</option>
                ))}
              </select>
            </label>
            {purpose === 'INVOICE' ? (
              <label className="grid gap-1 text-[13px] text-[#5d6878]">
                결제할 달
                <select className={FIELD} value={periodStartYmd} required autoComplete="off" onChange={(e) => setPeriodStartYmd(e.target.value)}>
                  <option value="">달을 선택하세요</option>
                  {periods.map((period) => (
                    <option key={period.periodStartYmd} value={period.periodStartYmd}>{period.periodLabel}</option>
                  ))}
                </select>
              </label>
            ) : purpose === 'CLEANING_PROXY' ? (
              <div className="grid gap-1 text-[13px] text-[#5d6878]">
                접수 건 (선택)
                <PlatformPayInquiryPick tenantId={tenantId} inquiryId={inquiryId} onChange={setInquiryId} />
              </div>
            ) : (
              <label className="grid gap-1 text-[13px] text-[#5d6878]">
                내용
                <input className={FIELD} value={memo} required onChange={(e) => setMemo(e.target.value)} />
              </label>
            )}
          </div>
          {purpose === 'CLEANING_PROXY' ? (
            <label className="grid gap-1 text-[13px] text-[#5d6878]">
              내부 메모
              <input className={FIELD} value={memo} autoComplete="off" onChange={(e) => setMemo(e.target.value)} />
            </label>
          ) : null}
          <label className="grid gap-1 text-[13px] text-[#5d6878]">
            영수증 상품명
            <input id="k-goods" className={FIELD} value={goodsName} required autoComplete="off" onChange={(e) => setGoodsName(e.target.value)} />
          </label>
          <label className="grid gap-1 text-[13px] text-[#5d6878]">
            결제 금액
            <input
              className={`${FIELD} text-right text-[22px] font-bold tabular-nums`}
              inputMode="numeric"
              autoComplete="off"
              readOnly={purpose === 'INVOICE'}
              value={amount ? amount.toLocaleString('ko-KR') : ''}
              onChange={(e) => setAmountWon(e.target.value.replace(/[^\d]/g, ''))}
              required
            />
          </label>
          <div className="flex justify-between text-xs tabular-nums text-[#5d6878]">
            <span>공급가 {split.supply.toLocaleString('ko-KR')}</span>
            <span>부가세 {split.vat.toLocaleString('ko-KR')}</span>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <label className="grid gap-1 text-[13px] text-[#5d6878]">
              고객 이름
              <input className={FIELD} value={buyerName} required autoComplete="name" onChange={(e) => setBuyerName(e.target.value)} />
            </label>
            <label className="grid gap-1 text-[13px] text-[#5d6878]">
              고객 휴대폰 (선택)
              <input className={`${FIELD} tabular-nums`} inputMode="numeric" autoComplete="off" value={buyerPhone} onChange={(e) => setBuyerPhone(e.target.value.replace(/\D/g, '').slice(0, 11))} />
            </label>
          </div>
        </div>
        <div className="grid content-start gap-3.5 border-t border-[#dde3ea] bg-[#f6f8fb] p-5 lg:border-l lg:border-t-0">
          <h2 className="text-[15px] font-bold">카드 정보</h2>
          <label className="grid gap-1 text-[13px] text-[#5d6878]" htmlFor="kc-no">
            카드번호
            <span className="relative">
              <input
                id="kc-no"
                name="kc-no"
                className={`${FIELD} pr-16 text-base tabular-nums`}
                inputMode="numeric"
                autoComplete="off"
                value={cardNo.replace(/(\d{4})(?=\d)/g, '$1 ')}
                onChange={(e) => setCardNo(e.target.value.replace(/\D/g, '').slice(0, 16))}
                required
              />
              {brand ? <span className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-[#dde3ea] bg-white px-1.5 text-[11px] font-bold text-[#5d6878]">{brand}</span> : null}
            </span>
          </label>
          <div className="grid grid-cols-2 gap-2.5">
            <label className="grid gap-1 text-[13px] text-[#5d6878]" htmlFor="kc-exp">
              유효기간 (월/년)
              <input
                id="kc-exp"
                name="kc-exp"
                className={`${FIELD} tabular-nums`}
                inputMode="numeric"
                autoComplete="off"
                placeholder="MM/YY"
                value={expire.length > 2 ? `${expire.slice(0, 2)}/${expire.slice(2)}` : expire}
                onChange={(e) => setExpire(e.target.value.replace(/\D/g, '').slice(0, 4))}
                required
              />
            </label>
            <label className="grid gap-1 text-[13px] text-[#5d6878]" htmlFor="kc-inst">
              할부
              <select id="kc-inst" name="kc-inst" className={FIELD} autoComplete="off" value={installment} disabled={!installmentOk} onChange={(e) => setInstallment(e.target.value)}>
                {INSTALLMENTS.map((row) => (
                  <option key={row.value} value={row.value}>{row.label}</option>
                ))}
              </select>
            </label>
          </div>
          <p className="text-xs text-[#5d6878]">할부는 5만 원 이상부터 고를 수 있어요.</p>
          <div className="grid gap-2.5 rounded-xl border border-[#b9cdf7] bg-[#e8f0ff] p-3">
            <div className="text-[13px] font-bold text-[#1f4fb8]">카드사 본인 확인</div>
            <div className="grid grid-cols-2 gap-2.5">
              <label className="grid gap-1 text-[13px] text-[#5d6878]" htmlFor="kc-owner">
                생년월일 6자리
                <input id="kc-owner" name="kc-owner" className={`${FIELD} tabular-nums`} inputMode="numeric" autoComplete="off" placeholder="900101" value={certNo} required onChange={(e) => setCertNo(e.target.value.replace(/\D/g, '').slice(0, 10))} />
              </label>
              <label className="grid gap-1 text-[13px] text-[#5d6878]" htmlFor="kc-pin">
                비밀번호 앞 2자리
                <input id="kc-pin" name="kc-pin" type="password" className={`${FIELD} text-center tracking-[0.5em]`} inputMode="numeric" autoComplete="new-password" maxLength={2} value={certPw} required onChange={(e) => setCertPw(e.target.value.replace(/\D/g, '').slice(0, 2))} />
              </label>
            </div>
            <p className="text-xs text-[#5d6878]">법인카드는 생년월일 자리에 사업자번호 10자리를 넣어요.</p>
            <div className="rounded-lg border border-dashed border-[#b9cdf7] bg-white px-2.5 py-2 text-xs text-[#141b26]">
              고객 안내 문구: &quot;카드사에서 본인 확인용으로 요청하는 정보예요. 저희는 저장하지 않고 결제 후 바로 지워져요.&quot;
            </div>
          </div>
          <p className="text-xs text-[#5d6878]">불안해하시면 링크 결제를 보내세요. 고객이 직접 입력해서 비밀번호를 말할 필요가 없어요.</p>
        </div>
      </div>
      <div className="flex flex-col gap-3 border-t border-[#dde3ea] px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <b className="text-xl tabular-nums">{amount.toLocaleString('ko-KR')}원</b>
          <span className="block text-xs text-[#5d6878]">{installmentLabel}{brand ? ` · ${brand}` : ''}{last4.length === 4 ? ` 끝 ${last4}` : ''} · 서비스브릿지 수기 가맹</span>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="secondary" size="lg" className="w-full sm:w-auto" onClick={() => onSendLink(seed())}>이 금액으로 링크 보내기</Button>
          <Button variant="primary" size="lg" type="submit" className="w-full sm:w-auto" disabled={busy}>{busy ? '승인 요청 중' : `${amount.toLocaleString('ko-KR')}원 결제하기`}</Button>
        </div>
      </div>
    </form>
  );
}
