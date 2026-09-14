import { YmdSelect } from '../../ui/DateQuerySelects';
import { LineMdIcon } from '../../ui/LineMdIcon';
import { kstTodayYmd } from '../../../utils/payrollCycleClient';

type PayrollAsOfFilterProps = {
  value: string;
  onChange: (ymd: string) => void;
  disabled?: boolean;
};

/** 월정산표 팀원·미정산현황 — 월급일 주기 안에서 기준일까지 근무일·일당 */
export function PayrollAsOfFilter({ value, onChange, disabled = false }: PayrollAsOfFilterProps) {
  const today = kstTodayYmd();
  const isToday = value === today;

  return (
    <div className="inline-flex flex-wrap items-center gap-1.5 min-w-0">
      <span className="inline-flex items-center gap-1 text-fluid-xs text-gray-600 whitespace-nowrap">
        <LineMdIcon name="calendar" className="size-4 text-slate-600" />
        기준일
      </span>
      <YmdSelect
        idPrefix="payroll-asof"
        value={value}
        onChange={onChange}
        compact
        disabled={disabled}
      />
      <button
        type="button"
        disabled={disabled || isToday}
        onClick={() => onChange(today)}
        className={
          isToday
            ? 'rounded-md bg-slate-900 px-2 py-1 text-fluid-2xs font-medium text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none'
            : 'rounded-md border border-slate-300 bg-white px-2 py-1 text-fluid-2xs font-medium text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none'
        }
      >
        오늘
      </button>
    </div>
  );
}
