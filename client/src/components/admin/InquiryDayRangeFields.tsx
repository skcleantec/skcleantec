import { YmdSelect } from '../ui/DateQuerySelects';

export function InquiryDayRangeFields(props: {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
}) {
  const { from, to, onChange } = props;
  return (
    <div className="flex flex-wrap items-center gap-1">
      <YmdSelect value={from} onChange={(next) => onChange(next, to)} idPrefix="inq-day-from" compact />
      <span className="text-fluid-2xs text-slate-500">부터</span>
      <YmdSelect value={to} onChange={(next) => onChange(from, next)} idPrefix="inq-day-to" compact />
      <span className="text-fluid-2xs text-slate-500">까지</span>
    </div>
  );
}
