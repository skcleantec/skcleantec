import { useEffect, useRef, useState, type FormEvent } from 'react';
import { listPlatformTenants, type PlatformTenantRow } from '../../../api/platformTenants';
import {
  fetchUsageFeeOpenPeriods,
  payPlatformUsageFeeKeyin,
  type UsageFeeOpenPeriod,
} from '../../../api/platformCardPayment';
import { usageFeeChargeKrw } from '@shared/tenantBilling';
import { useModalScrollKeyboardAvoidance } from '../../../hooks/useMobileInputVisibility';
import { getPlatformToken } from '../../../stores/platformAuth';
import { BTN_PRIMARY, INPUT_BASE } from '../../../utils/platformUi';

const BTN =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2 disabled:pointer-events-none';

const MONTHS = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
const YEARS = ['26', '27', '28', '29', '30', '31', '32', '33', '34', '35', '36'];
const INSTALLMENTS = [
  { value: '00', label: '일시불' },
  { value: '02', label: '2개월' },
  { value: '03', label: '3개월' },
  { value: '04', label: '4개월' },
  { value: '05', label: '5개월' },
  { value: '06', label: '6개월' },
];

const STATUS_LABEL: Record<string, string> = {
  SCHEDULED: '예정',
  ISSUED: '청구',
  OVERDUE: '미납',
  DRAFT: '작성',
};

const emptyCard = {
  cardNo: '',
  expireMM: '',
  expireYY: '',
  installment: '00',
  certPw: '',
  certNo: '',
};

export function PlatformUsageFeeKeyinForm({ onPaid }: { onPaid: () => void }) {
  const [purpose, setPurpose] = useState<'INVOICE' | 'OTHER'>('INVOICE');
  const [tenants, setTenants] = useState<PlatformTenantRow[]>([]);
  const [tenantId, setTenantId] = useState('');
  const [periods, setPeriods] = useState<UsageFeeOpenPeriod[]>([]);
  const [periodStartYmd, setPeriodStartYmd] = useState('');
  const [memo, setMemo] = useState('');
  const [goodsName, setGoodsName] = useState('솔루션 이용료');
  const [amountWon, setAmountWon] = useState('');
  const [buyerName, setBuyerName] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [card, setCard] = useState(emptyCard);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLFormElement>(null);
  const { onFieldFocus } = useModalScrollKeyboardAvoidance(scrollRef, true);

  useEffect(() => {
    const token = getPlatformToken();
    if (!token) return;
    void listPlatformTenants(token)
      .then((rows) => setTenants(rows))
      .catch(() => setTenants([]));
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
      .catch((e: unknown) => {
        setPeriods([]);
        setError(e instanceof Error ? e.message : '이용료 일정을 불러오지 못했습니다.');
      });
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

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    void payPlatformUsageFeeKeyin({
      purpose,
      tenantId: tenantId || undefined,
      periodStartYmd: purpose === 'INVOICE' ? periodStartYmd : undefined,
      memo: purpose === 'OTHER' ? memo : undefined,
      goodsName,
      amountWon: Number(amountWon.replace(/,/g, '')),
      buyerName,
      buyerPhone,
      ...card,
    })
      .then((result) => {
        setMessage(result.message);
        if (result.ok) {
          setCard(emptyCard);
          onPaid();
        }
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : '결제에 실패했습니다.'))
      .finally(() => setBusy(false));
  }

  return (
    <form
      ref={scrollRef}
      onSubmit={onSubmit}
      onFocusCapture={onFieldFocus}
      autoComplete="off"
      className="modal-form-scroll-surface space-y-3"
    >
      <div className="inline-flex gap-0.5 rounded-lg border border-gray-200 bg-gray-50 p-0.5">
        <button
          type="button"
          className={`${BTN} rounded-md px-3 py-1.5 text-sm ${purpose === 'INVOICE' ? 'bg-slate-900 text-white' : 'text-gray-700 hover:bg-white'}`}
          onClick={() => setPurpose('INVOICE')}
        >
          이용료
        </button>
        <button
          type="button"
          className={`${BTN} rounded-md px-3 py-1.5 text-sm ${purpose === 'OTHER' ? 'bg-slate-900 text-white' : 'text-gray-700 hover:bg-white'}`}
          onClick={() => {
            setPurpose('OTHER');
            setGoodsName('기타 결제');
            setAmountWon('');
          }}
        >
          기타
        </button>
      </div>
      <p className="text-xs text-gray-500">
        {purpose === 'INVOICE'
          ? '업체와 달을 고르면 이용료에 부가세 10%를 더한 금액으로 승인되고, 성공하면 그 달 청구가 납부 처리됩니다.'
          : '업체나 달과 관계없는 결제입니다. 청구서 상태는 바뀌지 않고 기록만 남습니다.'}
      </p>
      <label className="block text-xs text-gray-600">
        업체{purpose === 'OTHER' ? ' (선택)' : ''}
        <select className={`${INPUT_BASE} mt-1`} value={tenantId} onChange={(e) => setTenantId(e.target.value)} required={purpose === 'INVOICE'}>
          <option value="">{purpose === 'INVOICE' ? '업체를 선택하세요' : '업체 없음'}</option>
          {tenants.map((tenant) => (
            <option key={tenant.id} value={tenant.id}>
              {tenant.name}
            </option>
          ))}
        </select>
      </label>
      {purpose === 'INVOICE' ? (
        <label className="block text-xs text-gray-600">
          결제할 달
          <select
            className={`${INPUT_BASE} mt-1`}
            value={periodStartYmd}
            onChange={(e) => setPeriodStartYmd(e.target.value)}
            required
          >
            <option value="">달을 선택하세요</option>
            {periods.map((period) => (
              <option key={period.periodStartYmd} value={period.periodStartYmd}>
                {period.periodLabel} · {period.amountKrw.toLocaleString('ko-KR')}원 · {STATUS_LABEL[period.status] ?? period.status}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <label className="block text-xs text-gray-600">
          내용
          <input className={`${INPUT_BASE} mt-1`} value={memo} onChange={(e) => setMemo(e.target.value)} required placeholder="무엇에 대한 결제인지" />
        </label>
      )}
      <label className="block text-xs text-gray-600">
        상품명
        <input className={`${INPUT_BASE} mt-1`} value={goodsName} onChange={(e) => setGoodsName(e.target.value)} required />
      </label>
      <label className="block text-xs text-gray-600">
        승인금액
        <input
          className={`${INPUT_BASE} mt-1`}
          inputMode="numeric"
          value={amountWon}
          readOnly={purpose === 'INVOICE'}
          onChange={(e) => setAmountWon(e.target.value.replace(/[^\d]/g, ''))}
          placeholder="원"
          required
        />
        {purpose === 'INVOICE' && amountWon ? (
          <span className="mt-1 block text-gray-500">이용료에 부가세 10%를 더한 금액입니다.</span>
        ) : null}
      </label>
      <label className="block text-xs text-gray-600">
        카드번호
        <input
          className={`${INPUT_BASE} mt-1`}
          inputMode="numeric"
          autoComplete="off"
          value={card.cardNo}
          onChange={(e) => setCard((prev) => ({ ...prev, cardNo: e.target.value.replace(/\D/g, '').slice(0, 16) }))}
          placeholder="하이픈 없이"
          required
        />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-xs text-gray-600">
          유효기간 월
          <select className={`${INPUT_BASE} mt-1`} value={card.expireMM} onChange={(e) => setCard((prev) => ({ ...prev, expireMM: e.target.value }))} required>
            <option value="">월</option>
            {MONTHS.map((month) => (
              <option key={month} value={month}>{month}</option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-gray-600">
          유효기간 년
          <select className={`${INPUT_BASE} mt-1`} value={card.expireYY} onChange={(e) => setCard((prev) => ({ ...prev, expireYY: e.target.value }))} required>
            <option value="">년</option>
            {YEARS.map((year) => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </label>
      </div>
      <label className="block text-xs text-gray-600">
        할부개월
        <select className={`${INPUT_BASE} mt-1`} value={card.installment} onChange={(e) => setCard((prev) => ({ ...prev, installment: e.target.value }))}>
          {INSTALLMENTS.map((row) => (
            <option key={row.value} value={row.value}>{row.label}</option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-xs text-gray-600">
          비밀번호 앞 2자리
          <input className={`${INPUT_BASE} mt-1`} type="password" inputMode="numeric" autoComplete="off" maxLength={2} value={card.certPw} onChange={(e) => setCard((prev) => ({ ...prev, certPw: e.target.value.replace(/\D/g, '').slice(0, 2) }))} required />
        </label>
        <label className="block text-xs text-gray-600">
          생년월일 6자리 또는 사업자번호
          <input className={`${INPUT_BASE} mt-1`} inputMode="numeric" autoComplete="off" value={card.certNo} onChange={(e) => setCard((prev) => ({ ...prev, certNo: e.target.value.replace(/\D/g, '').slice(0, 10) }))} required />
        </label>
      </div>
      <label className="block text-xs text-gray-600">
        구매자명
        <input className={`${INPUT_BASE} mt-1`} value={buyerName} onChange={(e) => setBuyerName(e.target.value)} required />
      </label>
      <label className="block text-xs text-gray-600">
        구매자 휴대전화
        <input className={`${INPUT_BASE} mt-1`} inputMode="numeric" value={buyerPhone} onChange={(e) => setBuyerPhone(e.target.value.replace(/\D/g, '').slice(0, 11))} placeholder="선택" />
      </label>
      <button type="submit" disabled={busy} className={`${BTN_PRIMARY} ${BTN}`}>
        {busy ? '승인 요청 중' : '수기결재'}
      </button>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {message ? <p className="text-sm text-gray-800">{message}</p> : null}
    </form>
  );
}
