import { YmdSelect } from '../../ui/DateQuerySelects';
import { LineMdIcon } from '../../ui/LineMdIcon';
import { kstMonthBoundsYmd } from '../../../utils/payrollCycleClient';

type PayrollWorkRangeFilterProps = {
  fromYmd: string;
  toYmd: string;
  monthKey: string;
  onChange: (fromYmd: string, toYmd: string) => void;
  disabled?: boolean;
};

/** 월정산표 팀원·미정산현황 — 시작일~종료일 근무 횟수×일당 */
export function PayrollAsOfFilter({
  fromYmd,
  toYmd,
  monthKey,
  onChange,
  disabled = false,
}: PayrollWorkRangeFilterProps) {
  const monthBounds = kstMonthBoundsYmd(monthKey);
  const hasRange = Boolean(fromYmd && toYmd);
  const isThisMonth =
    Boolean(monthBounds) && fromYmd === monthBounds?.fromYmd && toYmd === monthBounds?.toYmd;

  return (
    <div className="inline-flex flex-wrap items-center gap-1.5 min-w-0">
      <span className="inline-flex items-center gap-1 text-fluid-xs text-gray-600 whitespace-nowrap">
        <LineMdIcon name="calendar" className="size-4 text-slate-600" />
        조회 기간
      </span>
      <YmdSelect
        idPrefix="payroll-from"
        value={fromYmd}
        onChange={(ymd) => onChange(ymd, toYmd)}
        compact
        allowEmpty
        emitOnCompleteOnly
        disabled={disabled}
      />
      <span className="text-fluid-2xs text-slate-500">~</span>
      <YmdSelect
        idPrefix="payroll-to"
        value={toYmd}
        onChange={(ymd) => onChange(fromYmd, ymd)}
        compact
        allowEmpty
        emitOnCompleteOnly
        disabled={disabled}
      />
      <button
        type="button"
        disabled={disabled || !monthBounds || isThisMonth}
        onClick={() => {
          if (!monthBounds) return;
          onChange(monthBounds.fromYmd, monthBounds.toYmd);
        }}
        className={
          isThisMonth
            ? 'rounded-md bg-slate-900 px-2 py-1 text-fluid-2xs font-medium text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none'
            : 'rounded-md border border-slate-300 bg-white px-2 py-1 text-fluid-2xs font-medium text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none'
        }
      >
        이번 달
      </button>
      <button
        type="button"
        disabled={disabled || !hasRange}
        onClick={() => onChange('', '')}
        className="rounded-md border border-slate-300 bg-white px-2 py-1 text-fluid-2xs font-medium text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none"
      >
        지우기
      </button>
    </div>
  );
}
