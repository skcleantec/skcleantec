import { useRef, useState, type FormEvent } from 'react';
import { payPlatformUsageFeeKeyin } from '../../../api/platformCardPayment';
import { useModalScrollKeyboardAvoidance } from '../../../hooks/useMobileInputVisibility';
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

const emptyCard = {
  cardNo: '',
  expireMM: '',
  expireYY: '',
  installment: '00',
  certPw: '',
  certNo: '',
};

export function PlatformUsageFeeKeyinForm() {
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

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    void payPlatformUsageFeeKeyin({
      goodsName,
      amountWon: Number(amountWon.replace(/,/g, '')),
      buyerName,
      buyerPhone,
      ...card,
    })
      .then((result) => {
        setMessage(result.message);
        if (result.ok) setCard(emptyCard);
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
      className="modal-form-scroll-surface space-y-3 border-t border-gray-100 pt-4"
    >
      <div>
        <h3 className="text-sm font-semibold text-gray-900">이용료 수기결재</h3>
        <p className="mt-1 text-xs text-gray-500">
          서비스브릿지 수기 가맹으로 바로 승인됩니다. 카드번호는 저장하지 않습니다. 팀장 청소비 결재와는 별개입니다.
        </p>
      </div>
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
          onChange={(e) => setAmountWon(e.target.value.replace(/[^\d]/g, ''))}
          placeholder="원"
          required
        />
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
          <select
            className={`${INPUT_BASE} mt-1`}
            value={card.expireMM}
            onChange={(e) => setCard((prev) => ({ ...prev, expireMM: e.target.value }))}
            required
          >
            <option value="">월</option>
            {MONTHS.map((month) => (
              <option key={month} value={month}>
                {month}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-gray-600">
          유효기간 년
          <select
            className={`${INPUT_BASE} mt-1`}
            value={card.expireYY}
            onChange={(e) => setCard((prev) => ({ ...prev, expireYY: e.target.value }))}
            required
          >
            <option value="">년</option>
            {YEARS.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="block text-xs text-gray-600">
        할부개월
        <select
          className={`${INPUT_BASE} mt-1`}
          value={card.installment}
          onChange={(e) => setCard((prev) => ({ ...prev, installment: e.target.value }))}
        >
          {INSTALLMENTS.map((row) => (
            <option key={row.value} value={row.value}>
              {row.label}
            </option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-xs text-gray-600">
          비밀번호 앞 2자리
          <input
            className={`${INPUT_BASE} mt-1`}
            type="password"
            inputMode="numeric"
            autoComplete="off"
            maxLength={2}
            value={card.certPw}
            onChange={(e) => setCard((prev) => ({ ...prev, certPw: e.target.value.replace(/\D/g, '').slice(0, 2) }))}
            required
          />
        </label>
        <label className="block text-xs text-gray-600">
          생년월일 6자리 또는 사업자번호
          <input
            className={`${INPUT_BASE} mt-1`}
            inputMode="numeric"
            autoComplete="off"
            value={card.certNo}
            onChange={(e) => setCard((prev) => ({ ...prev, certNo: e.target.value.replace(/\D/g, '').slice(0, 10) }))}
            required
          />
        </label>
      </div>
      <label className="block text-xs text-gray-600">
        구매자명
        <input className={`${INPUT_BASE} mt-1`} value={buyerName} onChange={(e) => setBuyerName(e.target.value)} required />
      </label>
      <label className="block text-xs text-gray-600">
        구매자 휴대전화
        <input
          className={`${INPUT_BASE} mt-1`}
          inputMode="numeric"
          value={buyerPhone}
          onChange={(e) => setBuyerPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
          placeholder="선택"
        />
      </label>
      <button type="submit" disabled={busy} className={`${BTN_PRIMARY} ${BTN}`}>
        {busy ? '승인 요청 중' : '수기결재'}
      </button>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {message ? <p className="text-sm text-gray-800">{message}</p> : null}
    </form>
  );
}
