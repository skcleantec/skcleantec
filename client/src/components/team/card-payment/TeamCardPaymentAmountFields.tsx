import { formatWon } from '@shared/cardPayment';
import { TEAM_PAY_FIELD, TEAM_PAY_LABEL } from './teamCardPaymentUi';

export function TeamCardPaymentAmountFields({
  amount,
  extra,
  goodsName,
  totalWon,
  onAmountChange,
  onExtraChange,
  onGoodsNameChange,
}: {
  amount: string;
  extra: string;
  goodsName: string;
  totalWon: number;
  onAmountChange: (value: string) => void;
  onExtraChange: (value: string) => void;
  onGoodsNameChange: (value: string) => void;
}) {
  return (
    <div className="space-y-3">
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
        추가 결제 금액
        <input
          inputMode="numeric"
          placeholder="0"
          className={`${TEAM_PAY_FIELD} tabular-nums`}
          value={extra}
          onChange={(e) => onExtraChange(e.target.value.replace(/[^\d]/g, ''))}
        />
      </label>
      <p className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-fluid-sm">
        <span className="text-slate-500">합계</span>
        <span className="font-semibold tabular-nums text-slate-900">{formatWon(totalWon)}</span>
      </p>
      <label className={TEAM_PAY_LABEL}>
        결제 내용
        <input
          className={TEAM_PAY_FIELD}
          maxLength={80}
          value={goodsName}
          onChange={(e) => onGoodsNameChange(e.target.value)}
        />
      </label>
    </div>
  );
}
