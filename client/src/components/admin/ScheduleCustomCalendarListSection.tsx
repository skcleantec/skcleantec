import type { UserCustomCalendarItem } from '../../api/userCustomCalendars';
import { customCalendarColorTokens } from '../../constants/customCalendarColors';
import {
  formatCompanyTabHint,
  formatPartnerTabHint,
  formatRegionTabHint,
} from '../../utils/customCalendarClassification';
import { EditAppIcon } from '../icons/EditAppIcon';

export type ScheduleCustomCalendarListSectionProps = {
  title: string;
  calendars: readonly UserCustomCalendarItem[];
  activeId: string | null;
  rowKind: 'region' | 'company' | 'partner';
  externalCompanyNames: ReadonlyMap<string, string>;
  partnerTenantNames: ReadonlyMap<string, string>;
  onSelect: (id: string | null) => void;
  onEditCalendar?: (cal: UserCustomCalendarItem) => void;
};

export function ScheduleCustomCalendarListSection({
  title,
  calendars,
  activeId,
  rowKind,
  externalCompanyNames,
  partnerTenantNames,
  onSelect,
  onEditCalendar,
}: ScheduleCustomCalendarListSectionProps) {
  return (
    <section>
      <h3 className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 px-0.5 leading-none">{title}</h3>
      <ul className="space-y-0" role="list">
        {calendars.map((cal) => {
          const t = customCalendarColorTokens(cal.colorKey);
          const active = activeId === cal.id;
          const hint =
            rowKind === 'partner'
              ? formatPartnerTabHint(cal.partnerTenantIds, partnerTenantNames)
              : rowKind === 'company'
                ? formatCompanyTabHint(cal.externalCompanyIds, externalCompanyNames)
                : formatRegionTabHint(cal.regions);
          return (
            <li key={cal.id}>
              <div className="flex items-stretch rounded overflow-hidden">
                <button
                  type="button"
                  onClick={() => onSelect(active ? null : cal.id)}
                  className={`flex min-w-0 flex-1 items-center gap-1 pl-1 pr-0.5 py-0.5 text-left min-h-[26px] touch-manipulation hover:bg-slate-100 active:bg-slate-200/70 ${
                    active ? 'font-semibold text-slate-900' : 'text-slate-700'
                  }`}
                  title={hint}
                >
                  <span className="shrink-0 w-2 flex justify-center">
                    <span className={`h-1.5 w-1.5 rounded-full border border-black/10 ${t.dot}`} />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[11px] leading-tight">{cal.name}</span>
                </button>
                {active && onEditCalendar ? (
                  <button
                    type="button"
                    onClick={() => onEditCalendar(cal)}
                    className="flex shrink-0 items-center justify-center px-1 text-slate-600 hover:bg-slate-200/60 min-w-[24px] touch-manipulation"
                    title="캘린더 설정"
                    aria-label={`${cal.name} 설정`}
                  >
                    <EditAppIcon className="h-3 w-3" alt="" />
                  </button>
                ) : null}
              </div>
            </li>
          );
        })}
        {calendars.length === 0 ? (
          <li className="pl-3 py-0.5 text-[10px] text-slate-400 leading-tight">등록된 캘린더 없음</li>
        ) : null}
      </ul>
    </section>
  );
}
