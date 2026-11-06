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
  compact,
}: {
  amount: string;
  extra: string;
  goodsName: string;
  totalWon: number;
  onAmountChange: (value: string) => void;
  onExtraChange: (value: string) => void;
  onGoodsNameChange: (value: string) => void;
  /** true면 합계·결제 내용만 (펼침 전 요약용은 페이지에서 처리) */
  compact?: boolean;
}) {
  if (compact) {
    return (
      <p className="flex items-center justify-between rounded-xl bg-[#F4F6FA] px-3 py-2.5 text-fluid-sm">
        <span className="text-slate-500">합계</span>
        <span className="font-bold tabular-nums text-[#0F172A]">{formatWon(totalWon)}</span>
      </p>
    );
  }

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
        추가 금액
        <input
          inputMode="numeric"
          placeholder="0"
          className={`${TEAM_PAY_FIELD} tabular-nums`}
          value={extra}
          onChange={(e) => onExtraChange(e.target.value.replace(/[^\d]/g, ''))}
        />
      </label>
      <p className="flex items-center justify-between rounded-xl bg-[#F4F6FA] px-3 py-2.5 text-fluid-sm">
        <span className="text-slate-500">합계</span>
        <span className="font-bold tabular-nums text-[#0F172A]">{formatWon(totalWon)}</span>
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
