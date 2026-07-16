import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { UserCustomCalendarItem } from '../../api/userCustomCalendars';
import { ScheduleCustomCalendarListSection } from './ScheduleCustomCalendarListSection';

export type ScheduleCustomCalendarSidebarProps = {
  regionCalendars: readonly UserCustomCalendarItem[];
  companyCalendars: readonly UserCustomCalendarItem[];
  partnerCalendars: readonly UserCustomCalendarItem[];
  activeRegionCalendarId: string | null;
  activeCompanyCalendarId: string | null;
  activePartnerCalendarId: string | null;
  activeRegionCalendar: UserCustomCalendarItem | null;
  activeCompanyCalendar: UserCustomCalendarItem | null;
  activePartnerCalendar: UserCustomCalendarItem | null;
  onSelectRegion: (id: string | null) => void;
  onSelectCompany: (id: string | null) => void;
  onSelectPartner: (id: string | null) => void;
  onAddRegion: () => void;
  onAddCompany: () => void;
  onAddPartner: () => void;
  onEditCalendar?: (cal: UserCustomCalendarItem) => void;
  canManage: boolean;
  showPartnerRow?: boolean;
  externalCompanyNames: ReadonlyMap<string, string>;
  partnerTenantNames: ReadonlyMap<string, string>;
};

export function ScheduleCustomCalendarSidebar({
  regionCalendars,
  companyCalendars,
  partnerCalendars,
  activeRegionCalendarId,
  activeCompanyCalendarId,
  activePartnerCalendarId,
  activeRegionCalendar,
  activeCompanyCalendar,
  activePartnerCalendar,
  onSelectRegion,
  onSelectCompany,
  onSelectPartner,
  onAddRegion,
  onAddCompany,
  onAddPartner,
  onEditCalendar,
  canManage,
  showPartnerRow = false,
  externalCompanyNames,
  partnerTenantNames,
}: ScheduleCustomCalendarSidebarProps) {
  const [addExpanded, setAddExpanded] = useState(false);

  const activeFilterLabels = [
    activeRegionCalendar ? `지역 · ${activeRegionCalendar.name}` : null,
    activeCompanyCalendar ? `업체 · ${activeCompanyCalendar.name}` : null,
    activePartnerCalendar ? `파트너 · ${activePartnerCalendar.name}` : null,
  ].filter(Boolean);

  const hasActiveFilter = Boolean(activeRegionCalendarId || activeCompanyCalendarId || activePartnerCalendarId);

  const handleClearAll = () => {
    onSelectRegion(null);
    onSelectCompany(null);
    onSelectPartner(null);
  };

  return (
    <div className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="shrink-0 border-b border-slate-100 px-2 py-1.5">
        <h2 className="font-semibold text-slate-900 text-[12px] leading-tight">맞춤 캘린더</h2>
        {activeFilterLabels.length > 0 ? (
          <p className="mt-0.5 truncate text-[10px] text-slate-500 leading-tight" title={activeFilterLabels.join(' ∩ ')}>
            {activeFilterLabels.join(' ∩ ')}
          </p>
        ) : (
          <p className="mt-0.5 text-[10px] text-slate-400 leading-tight">지역 · 업체 · 파트너 필터</p>
        )}
      </div>

      <div className="min-h-0 max-h-[min(52vh,28rem)] overflow-y-auto overscroll-y-contain px-2 py-1.5 space-y-2 [-webkit-overflow-scrolling:touch]">
        {canManage ? (
          <section>
            <button
              type="button"
              onClick={() => setAddExpanded((v) => !v)}
              className="flex w-full items-center justify-between rounded border border-dashed border-slate-300 bg-slate-50/80 px-2 py-1 min-h-[28px] touch-manipulation hover:bg-slate-100/80"
              aria-expanded={addExpanded}
            >
              <span className="text-[11px] font-semibold text-slate-800">캘린더 추가</span>
              <span className="text-base font-light leading-none text-slate-600" aria-hidden>
                {addExpanded ? '−' : '+'}
              </span>
            </button>
            {addExpanded ? (
              <ul className="space-y-0 pl-0.5">
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      onAddRegion();
                      setAddExpanded(false);
                    }}
                    className="flex w-full items-center gap-1 rounded px-1 py-0.5 text-left text-[11px] text-slate-700 hover:bg-slate-100 min-h-[26px] touch-manipulation leading-tight"
                  >
                    <span className="w-2 text-center text-[10px] text-slate-400">—</span>
                    지역 캘린더
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      onAddCompany();
                      setAddExpanded(false);
                    }}
                    className="flex w-full items-center gap-1 rounded px-1 py-0.5 text-left text-[11px] text-slate-700 hover:bg-slate-100 min-h-[26px] touch-manipulation leading-tight"
                  >
                    <span className="w-2 text-center text-[10px] text-slate-400">—</span>
                    업체 캘린더
                  </button>
                </li>
                {showPartnerRow ? (
                  <li>
                    <button
                      type="button"
                      onClick={() => {
                        onAddPartner();
                        setAddExpanded(false);
                      }}
                      className="flex w-full items-center gap-1 rounded px-1 py-0.5 text-left text-[11px] text-slate-700 hover:bg-slate-100 min-h-[26px] touch-manipulation leading-tight"
                    >
                      <span className="w-2 text-center text-[10px] text-slate-400">—</span>
                      파트너 캘린더
                    </button>
                  </li>
                ) : null}
              </ul>
            ) : null}
          </section>
        ) : null}

        <button
          type="button"
          onClick={handleClearAll}
          className={`flex w-full items-center gap-1 rounded px-1 py-0.5 text-left min-h-[26px] touch-manipulation text-slate-700 hover:bg-slate-100 active:bg-slate-200/70 ${
            !hasActiveFilter ? 'font-semibold text-slate-900' : ''
          }`}
        >
          <span className="shrink-0 w-2 text-center text-[10px] text-slate-400">—</span>
          <span className="text-[11px] leading-tight">전체</span>
        </button>

        <ScheduleCustomCalendarListSection
          title="지역별"
          calendars={regionCalendars}
          activeId={activeRegionCalendarId}
          rowKind="region"
          externalCompanyNames={externalCompanyNames}
          partnerTenantNames={partnerTenantNames}
          onSelect={onSelectRegion}
          onEditCalendar={onEditCalendar}
        />

        <ScheduleCustomCalendarListSection
          title="업체별"
          calendars={companyCalendars}
          activeId={activeCompanyCalendarId}
          rowKind="company"
          externalCompanyNames={externalCompanyNames}
          partnerTenantNames={partnerTenantNames}
          onSelect={onSelectCompany}
          onEditCalendar={onEditCalendar}
        />

        {showPartnerRow ? (
          <ScheduleCustomCalendarListSection
            title="파트너별"
            calendars={partnerCalendars}
            activeId={activePartnerCalendarId}
            rowKind="partner"
            externalCompanyNames={externalCompanyNames}
            partnerTenantNames={partnerTenantNames}
            onSelect={onSelectPartner}
            onEditCalendar={onEditCalendar}
          />
        ) : null}
      </div>

      <div className="shrink-0 border-t border-slate-100 bg-slate-50/80 px-2 py-1.5">
        <Link
          to="/admin/service-zones"
          className="block text-center text-[10px] font-medium text-slate-500 hover:text-slate-800 underline-offset-2 hover:underline py-0.5 leading-tight"
        >
          서비스 권역 관리
        </Link>
      </div>
    </div>
  );
}
