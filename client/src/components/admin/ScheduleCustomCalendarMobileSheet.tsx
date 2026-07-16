import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import type { UserCustomCalendarItem } from '../../api/userCustomCalendars';
import { ScheduleCustomCalendarListSection } from './ScheduleCustomCalendarListSection';

function BarsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
    </svg>
  );
}

export type ScheduleCustomCalendarMobileSheetProps = {
  open: boolean;
  onClose: () => void;
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

export function ScheduleCustomCalendarMobileMenuButton({
  onClick,
  hasActiveFilter,
  className = '',
}: {
  onClick: () => void;
  hasActiveFilter: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative inline-flex h-8 w-8 min-h-[32px] min-w-[32px] items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50 hover:text-slate-900 touch-manipulation lg:hidden ${className}`}
      aria-label="맞춤 캘린더 메뉴"
    >
      <BarsIcon className="h-4 w-4" />
      {hasActiveFilter ? (
        <span
          className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-sky-600 ring-1 ring-white"
          aria-hidden
        />
      ) : null}
    </button>
  );
}

export function ScheduleCustomCalendarDesktopMenuTrigger({
  onClick,
  hasActiveFilter,
  activeRegionCalendar,
  activeCompanyCalendar,
  activePartnerCalendar,
}: {
  onClick: () => void;
  hasActiveFilter: boolean;
  activeRegionCalendar: UserCustomCalendarItem | null;
  activeCompanyCalendar: UserCustomCalendarItem | null;
  activePartnerCalendar: UserCustomCalendarItem | null;
}) {
  const activeLabels = [
    activeRegionCalendar ? `지역 · ${activeRegionCalendar.name}` : null,
    activeCompanyCalendar ? `업체 · ${activeCompanyCalendar.name}` : null,
    activePartnerCalendar ? `파트너 · ${activePartnerCalendar.name}` : null,
  ].filter(Boolean);

  return (
    <button
      type="button"
      onClick={onClick}
      className="relative flex w-full min-w-0 items-center gap-2.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-left shadow-md transition-colors hover:bg-slate-800 active:bg-slate-950 touch-manipulation"
      aria-label="맞춤 캘린더 메뉴 열기"
    >
      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-600 bg-slate-800 text-white">
        <BarsIcon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-fluid-xs font-semibold text-white">맞춤 캘린더</span>
        <span
          className="mt-0.5 block truncate text-[10px] leading-snug text-slate-400"
          title={activeLabels.length > 0 ? activeLabels.join(' · ') : undefined}
        >
          {activeLabels.length > 0 ? activeLabels.join(' · ') : '지역 · 업체 · 파트너 필터'}
        </span>
      </span>
      {hasActiveFilter ? (
        <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-sky-400 ring-1 ring-slate-900" aria-hidden />
      ) : null}
    </button>
  );
}

export function ScheduleCustomCalendarMobileSheet({
  open,
  onClose,
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
}: ScheduleCustomCalendarMobileSheetProps) {
  const [slideIn, setSlideIn] = useState(false);
  const [addExpanded, setAddExpanded] = useState(false);

  useEffect(() => {
    if (!open) {
      setSlideIn(false);
      setAddExpanded(false);
      return;
    }
    const id = requestAnimationFrame(() => setSlideIn(true));
    return () => cancelAnimationFrame(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;
  const root = typeof document !== 'undefined' ? document.body : null;
  if (!root) return null;

  const activeFilterLabels = [
    activeRegionCalendar ? `지역 · ${activeRegionCalendar.name}` : null,
    activeCompanyCalendar ? `업체 · ${activeCompanyCalendar.name}` : null,
    activePartnerCalendar ? `파트너 · ${activePartnerCalendar.name}` : null,
  ].filter(Boolean);

  const handleSelectRegion = (id: string | null) => {
    onSelectRegion(id);
    onClose();
  };

  const handleSelectCompany = (id: string | null) => {
    onSelectCompany(id);
    onClose();
  };

  const handleSelectPartner = (id: string | null) => {
    onSelectPartner(id);
    onClose();
  };

  const handleAddRegion = () => {
    onAddRegion();
    onClose();
  };

  const handleAddCompany = () => {
    onAddCompany();
    onClose();
  };

  const handleAddPartner = () => {
    onAddPartner();
    onClose();
  };

  const handleEdit = (cal: UserCustomCalendarItem) => {
    onEditCalendar?.(cal);
    onClose();
  };

  const handleClearAll = () => {
    onSelectRegion(null);
    onSelectCompany(null);
    onSelectPartner(null);
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-[610] lg:hidden" role="presentation">
      <button
        type="button"
        aria-label="메뉴 닫기"
        className={`absolute inset-0 bg-black/40 transition-opacity duration-200 ${
          slideIn ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onClose}
      />

      <aside
        role="dialog"
        aria-modal
        aria-labelledby="schedule-custom-cal-drawer-title"
        className={`absolute inset-y-0 left-0 flex w-[min(16rem,78vw)] max-w-full flex-col bg-white shadow-2xl border-r border-slate-200 transform transition-transform duration-200 ease-out ${
          slideIn ? 'translate-x-0' : '-translate-x-full'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 flex items-center justify-between gap-1.5 border-b border-slate-100 px-2.5 py-2">
          <div className="min-w-0">
            <h2 id="schedule-custom-cal-drawer-title" className="font-semibold text-slate-900 text-[12px] leading-tight">
              맞춤 캘린더
            </h2>
            {activeFilterLabels.length > 0 ? (
              <p className="mt-0.5 truncate text-[10px] text-slate-500 leading-tight">
                {activeFilterLabels.join(' ∩ ')}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-600 hover:bg-slate-50 touch-manipulation"
            aria-label="닫기"
          >
            <CloseIcon className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain px-2.5 py-2 space-y-3 [-webkit-overflow-scrolling:touch]">
          {canManage ? (
            <section className="space-y-0.5">
              <button
                type="button"
                onClick={() => setAddExpanded((v) => !v)}
                className="flex w-full items-center justify-between rounded border border-dashed border-slate-300 bg-slate-50/80 px-2 py-1.5 min-h-[34px] touch-manipulation hover:bg-slate-100/80"
                aria-expanded={addExpanded}
              >
                <span className="text-[11px] font-semibold text-slate-800">캘린더 추가</span>
                <span className="text-base font-light leading-none text-slate-600" aria-hidden>
                  {addExpanded ? '−' : '+'}
                </span>
              </button>
              {addExpanded ? (
                <ul className="space-y-px pl-0.5">
                  <li>
                    <button
                      type="button"
                      onClick={handleAddRegion}
                      className="flex w-full items-center gap-1.5 rounded px-1.5 py-1.5 text-left text-[11px] text-slate-700 hover:bg-slate-100 min-h-[32px] touch-manipulation leading-tight"
                    >
                      <span className="w-2.5 text-center text-[10px] text-slate-400">—</span>
                      지역 캘린더
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={handleAddCompany}
                      className="flex w-full items-center gap-1.5 rounded px-1.5 py-1.5 text-left text-[11px] text-slate-700 hover:bg-slate-100 min-h-[32px] touch-manipulation leading-tight"
                    >
                      <span className="w-2.5 text-center text-[10px] text-slate-400">—</span>
                      업체 캘린더
                    </button>
                  </li>
                  {showPartnerRow ? (
                    <li>
                      <button
                        type="button"
                        onClick={handleAddPartner}
                        className="flex w-full items-center gap-1.5 rounded px-1.5 py-1.5 text-left text-[11px] text-slate-700 hover:bg-slate-100 min-h-[32px] touch-manipulation leading-tight"
                      >
                        <span className="w-2.5 text-center text-[10px] text-slate-400">—</span>
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
              !(activeRegionCalendarId || activeCompanyCalendarId || activePartnerCalendarId)
                ? 'font-semibold text-slate-900'
                : ''
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
            onSelect={handleSelectRegion}
            onEditCalendar={onEditCalendar ? handleEdit : undefined}
          />

          <ScheduleCustomCalendarListSection
            title="업체별"
            calendars={companyCalendars}
            activeId={activeCompanyCalendarId}
            rowKind="company"
            externalCompanyNames={externalCompanyNames}
            partnerTenantNames={partnerTenantNames}
            onSelect={handleSelectCompany}
            onEditCalendar={onEditCalendar ? handleEdit : undefined}
          />

          {showPartnerRow ? (
            <ScheduleCustomCalendarListSection
              title="파트너별"
              calendars={partnerCalendars}
              activeId={activePartnerCalendarId}
              rowKind="partner"
              externalCompanyNames={externalCompanyNames}
              partnerTenantNames={partnerTenantNames}
              onSelect={handleSelectPartner}
              onEditCalendar={onEditCalendar ? handleEdit : undefined}
            />
          ) : null}
        </div>

        <div className="shrink-0 border-t border-slate-100 bg-slate-50/80 px-2.5 py-2">
          <Link
            to="/admin/service-zones"
            onClick={onClose}
            className="block text-center text-[10px] font-medium text-slate-500 hover:text-slate-800 underline-offset-2 hover:underline py-0.5 leading-tight"
          >
            서비스 권역 관리
          </Link>
        </div>
      </aside>
    </div>,
    root,
  );
}
