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
    <section className="mb-4">
      <h3 className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400/80 px-1 leading-none">{title}</h3>
      <ul className="space-y-0.5" role="list">
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
              <div className={`flex items-stretch rounded-lg overflow-hidden transition-colors ${active ? 'bg-blue-50/80' : ''}`}>
                <button
                  type="button"
                  onClick={() => onSelect(active ? null : cal.id)}
                  className={`flex min-w-0 flex-1 items-center gap-2 pl-2 pr-1 py-1.5 text-left min-h-[34px] touch-manipulation hover:bg-slate-100/50 transition-colors ${
                    active ? 'font-semibold text-blue-700' : 'text-slate-700'
                  }`}
                  title={hint}
                >
                  <span className="shrink-0 w-3 flex justify-center">
                    <span className={`h-2 w-2 rounded-full border border-black/10 ${t.dot}`} />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-fluid-xs leading-tight">{cal.name}</span>
                </button>
                {active && onEditCalendar ? (
                  <button
                    type="button"
                    onClick={() => onEditCalendar(cal)}
                    className="flex shrink-0 items-center justify-center px-2 text-blue-600 hover:bg-blue-100/80 min-w-[32px] touch-manipulation transition-colors"
                    title="캘린더 설정"
                    aria-label={`${cal.name} 설정`}
                  >
                    <EditAppIcon className="h-3.5 w-3.5" alt="" />
                  </button>
                ) : null}
              </div>
            </li>
          );
        })}
        {calendars.length === 0 ? (
          <li className="pl-3 py-1 text-fluid-2xs text-slate-400 leading-tight">등록된 캘린더 없음</li>
        ) : null}
      </ul>
    </section>
  );
}
