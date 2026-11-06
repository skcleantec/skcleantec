import { useMemo, useState, type FormEvent } from 'react';
import { formatWon } from '@shared/cardPayment';
import { Button } from '../../ui/Button';
import { LineMdIcon } from '../../ui/LineMdIcon';
import { TeamCardPaymentAmountFields } from './TeamCardPaymentAmountFields';
import { TEAM_PAY_FIELD, TEAM_PAY_FOOTER, TEAM_PAY_LABEL } from './teamCardPaymentUi';

const QUICK_INSTALLMENTS = [
  { value: '00', label: '일시불' },
  { value: '02', label: '2개월' },
  { value: '03', label: '3개월' },
];
const MORE_INSTALLMENTS = [
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

function formatCardNo(digits: string): string {
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
}

function formatExpiryDisplay(mm: string, yy: string): string {
  if (!mm && !yy) return '';
  if (mm.length < 2) return mm;
  return yy ? `${mm}/${yy}` : `${mm}/`;
}

function parseExpiry(raw: string): { mm: string; yy: string } {
  const digits = raw.replace(/\D/g, '').slice(0, 4);
  return { mm: digits.slice(0, 2), yy: digits.slice(2, 4) };
}

export function TeamCardPaymentKeyinForm({
  amount,
  extra,
  goodsName,
  totalWon,
  busy,
  onAmountChange,
  onExtraChange,
  onGoodsNameChange,
  onSubmit,
}: {
  amount: string;
  extra: string;
  goodsName: string;
  totalWon: number;
  busy: boolean;
  onAmountChange: (value: string) => void;
  onExtraChange: (value: string) => void;
  onGoodsNameChange: (value: string) => void;
  onSubmit: (card: TeamKeyinCard) => void;
}) {
  const [card, setCard] = useState(EMPTY);
  const [amountOpen, setAmountOpen] = useState(false);
  const [moreInst, setMoreInst] = useState(false);

  const installmentOptions = useMemo(
    () => (moreInst ? [...QUICK_INSTALLMENTS, ...MORE_INSTALLMENTS] : QUICK_INSTALLMENTS),
    [moreInst],
  );

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit(card);
  };

  return (
    <form className="flex min-h-0 flex-1 flex-col" autoComplete="off" onSubmit={submit}>
      <div className="space-y-3 pb-28">
        <div className="flex items-end justify-between gap-3 rounded-[18px] border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <div className="min-w-0">
            <p className="text-fluid-2xs text-slate-500">승인 금액</p>
            <p
              className="tabular-nums text-[#0F172A]"
              style={{ fontSize: 30, fontWeight: 800, lineHeight: 1.2 }}
            >
              {formatWon(totalWon)}
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="shrink-0 rounded-xl"
            onClick={() => setAmountOpen((v) => !v)}
            aria-expanded={amountOpen}
          >
            {amountOpen ? '접기' : '금액 변경'}
          </Button>
        </div>

        {amountOpen ? (
          <div className="rounded-[18px] border border-slate-200 bg-white p-4 shadow-sm">
            <TeamCardPaymentAmountFields
              amount={amount}
              extra={extra}
              goodsName={goodsName}
              totalWon={totalWon}
              onAmountChange={onAmountChange}
              onExtraChange={onExtraChange}
              onGoodsNameChange={onGoodsNameChange}
            />
          </div>
        ) : null}

        <div className="space-y-3 rounded-[18px] border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-[#EFF6FF] px-2.5 py-1 text-fluid-2xs font-medium text-[#1D4ED8]">
              <LineMdIcon name="security" className="size-3.5" />
              암호화 전송
            </span>
            <span className="text-fluid-2xs text-slate-500">카드번호 저장 안 함</span>
          </div>

          <label className={TEAM_PAY_LABEL}>
            카드번호
            <input
              id="kc-no"
              name="kc-no"
              inputMode="numeric"
              autoComplete="off"
              className={`${TEAM_PAY_FIELD} tabular-nums tracking-wide`}
              value={formatCardNo(card.cardNo)}
              placeholder="0000 0000 0000 0000"
              onChange={(e) =>
                setCard((prev) => ({ ...prev, cardNo: e.target.value.replace(/\D/g, '').slice(0, 16) }))
              }
            />
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label className={TEAM_PAY_LABEL}>
              유효기간
              <input
                id="kc-exp"
                name="kc-exp"
                inputMode="numeric"
                autoComplete="off"
                className={`${TEAM_PAY_FIELD} tabular-nums`}
                placeholder="MM/YY"
                value={formatExpiryDisplay(card.expireMM, card.expireYY)}
                onChange={(e) => {
                  const next = parseExpiry(e.target.value);
                  setCard((prev) => ({ ...prev, expireMM: next.mm, expireYY: next.yy }));
                }}
              />
            </label>
            <label className={TEAM_PAY_LABEL}>
              비밀번호 앞 2자리
              <input
                id="kc-pin"
                name="kc-pin"
                type="password"
                inputMode="numeric"
                autoComplete="new-password"
                maxLength={2}
                className={TEAM_PAY_FIELD}
                value={card.certPw}
                onChange={(e) =>
                  setCard((prev) => ({ ...prev, certPw: e.target.value.replace(/\D/g, '').slice(0, 2) }))
                }
              />
            </label>
          </div>

          <label className={TEAM_PAY_LABEL}>
            생년월일 6자리 (법인 10자리)
            <input
              id="kc-owner"
              name="kc-owner"
              inputMode="numeric"
              autoComplete="off"
              className={TEAM_PAY_FIELD}
              value={card.certNo}
              placeholder="YYMMDD 또는 사업자번호"
              onChange={(e) =>
                setCard((prev) => ({ ...prev, certNo: e.target.value.replace(/\D/g, '').slice(0, 10) }))
              }
            />
          </label>

          <div>
            <p className={TEAM_PAY_LABEL}>할부</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5" role="group" aria-label="할부">
              {installmentOptions.map((row) => {
                const on = card.installment === row.value;
                return (
                  <button
                    key={row.value}
                    type="button"
                    className={`min-h-9 rounded-xl px-3 text-fluid-2xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${
                      on
                        ? 'bg-[#0F172A] text-white'
                        : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                    aria-pressed={on}
                    onClick={() => setCard((prev) => ({ ...prev, installment: row.value }))}
                  >
                    {row.label}
                  </button>
                );
              })}
              {!moreInst ? (
                <button
                  type="button"
                  className="min-h-9 rounded-xl border border-slate-200 bg-white px-3 text-fluid-2xs font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                  onClick={() => setMoreInst(true)}
                >
                  더보기
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className={TEAM_PAY_FOOTER}>
        <Button
          type="submit"
          variant="primary"
          size="lg"
          disabled={busy || totalWon < 100}
          className="h-[54px] w-full rounded-[14px]"
        >
          {busy ? '승인 요청 중' : `${formatWon(totalWon)} 승인 요청`}
        </Button>
      </div>
    </form>
  );
}
