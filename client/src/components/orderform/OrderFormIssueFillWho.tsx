import {
  describeIssueFillWho,
  type OrderFormFillRuleFlags,
} from '@shared/orderFormFillRules';

const BADGE_CLS: Record<ReturnType<typeof describeIssueFillWho>['kind'], string> = {
  marketer_required:
    'border-rose-200 bg-rose-50 text-rose-800',
  customer_required:
    'border-amber-200 bg-amber-50 text-amber-950',
  both: 'border-slate-200 bg-slate-100 text-slate-700',
};

const PILL =
  'inline-flex shrink-0 items-center rounded border px-1.5 py-0 text-fluid-2xs font-medium leading-5';

export function OrderFormIssueFillWhoBadge({ flags }: { flags: OrderFormFillRuleFlags }) {
  const who = describeIssueFillWho(flags);
  return (
    <span className={`${PILL} ${BADGE_CLS[who.kind]}`} title={who.label}>
      {who.label}
    </span>
  );
}

export function OrderFormIssueFillWhoLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-fluid-2xs leading-snug text-slate-700">
      <span className="font-medium text-slate-800">칸 표시</span>
      <OrderFormIssueFillWhoBadge flags={{ customer: false, marketer: true, required: true }} />
      <span>지금 꼭 적기</span>
      <OrderFormIssueFillWhoBadge flags={{ customer: true, marketer: false, required: true }} />
      <span>비우면 고객이 적음</span>
      <OrderFormIssueFillWhoBadge flags={{ customer: true, marketer: true, required: false }} />
      <span>상담사·고객 모두 가능</span>
    </div>
  );
}
