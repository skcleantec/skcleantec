import { useState, type FormEvent } from 'react';
import { TEAM_PAY_BTN, TEAM_PAY_FIELD, TEAM_PAY_LABEL } from './teamCardPaymentUi';

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

export type TeamKeyinCard = {
  cardNo: string;
  expireMM: string;
  expireYY: string;
  installment: string;
  certPw: string;
  certNo: string;
};

const EMPTY: TeamKeyinCard = {
  cardNo: '',
  expireMM: '',
  expireYY: '',
  installment: '00',
  certPw: '',
  certNo: '',
};

export function TeamCardPaymentKeyinForm({
  amount,
  goodsName,
  busy,
  onAmountChange,
  onGoodsNameChange,
  onSubmit,
}: {
  amount: string;
  goodsName: string;
  busy: boolean;
  onAmountChange: (value: string) => void;
  onGoodsNameChange: (value: string) => void;
  onSubmit: (card: TeamKeyinCard) => void;
}) {
  const [card, setCard] = useState(EMPTY);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit(card);
  };

  return (
    <form className="space-y-3" autoComplete="off" onSubmit={submit}>
      <label className={TEAM_PAY_LABEL}>
        결제 금액
        <input
          inputMode="numeric"
          className={`${TEAM_PAY_FIELD} tabular-nums`}
          value={amount}
          onChange={(e) => onAmountChange(e.target.value.replace(/[^\d]/g, ''))}
        />
      </label>
      <label className={TEAM_PAY_LABEL}>
        결제 내용
        <input
          className={TEAM_PAY_FIELD}
          maxLength={80}
          value={goodsName}
          onChange={(e) => onGoodsNameChange(e.target.value)}
        />
      </label>
      <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
        <p className="text-fluid-xs font-semibold text-slate-800">카드 정보</p>
        <label className={TEAM_PAY_LABEL}>
          카드번호
          <input
            inputMode="numeric"
            autoComplete="off"
            className={`${TEAM_PAY_FIELD} tabular-nums`}
            value={card.cardNo}
            placeholder="숫자만"
            onChange={(e) => setCard((prev) => ({ ...prev, cardNo: e.target.value.replace(/\D/g, '').slice(0, 16) }))}
          />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className={TEAM_PAY_LABEL}>
            유효기간 월
            <select
              className={TEAM_PAY_FIELD}
              value={card.expireMM}
              onChange={(e) => setCard((prev) => ({ ...prev, expireMM: e.target.value }))}
            >
              <option value="">월</option>
              {MONTHS.map((month) => (
                <option key={month} value={month}>
                  {month}
                </option>
              ))}
            </select>
          </label>
          <label className={TEAM_PAY_LABEL}>
            유효기간 년
            <select
              className={TEAM_PAY_FIELD}
              value={card.expireYY}
              onChange={(e) => setCard((prev) => ({ ...prev, expireYY: e.target.value }))}
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
        <label className={TEAM_PAY_LABEL}>
          할부
          <select
            className={TEAM_PAY_FIELD}
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
          <label className={TEAM_PAY_LABEL}>
            비밀번호 앞 2자리
            <input
              type="password"
              inputMode="numeric"
              autoComplete="off"
              maxLength={2}
              className={TEAM_PAY_FIELD}
              value={card.certPw}
              onChange={(e) => setCard((prev) => ({ ...prev, certPw: e.target.value.replace(/\D/g, '').slice(0, 2) }))}
            />
          </label>
          <label className={TEAM_PAY_LABEL}>
            생년월일 또는 사업자번호
            <input
              inputMode="numeric"
              autoComplete="off"
              className={TEAM_PAY_FIELD}
              value={card.certNo}
              placeholder="6자리 또는 10자리"
              onChange={(e) => setCard((prev) => ({ ...prev, certNo: e.target.value.replace(/\D/g, '').slice(0, 10) }))}
            />
          </label>
        </div>
      </div>
      <button type="submit" disabled={busy} className={`${TEAM_PAY_BTN} bg-slate-900 text-white hover:bg-slate-800`}>
        {busy ? '승인 요청 중' : '승인 요청'}
      </button>
    </form>
  );
}
