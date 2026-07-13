import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import type { UserCustomCalendarItem } from '../../api/userCustomCalendars';
import { customCalendarColorTokens } from '../../constants/customCalendarColors';
import {
  formatCompanyTabHint,
  formatRegionTabHint,
} from '../../utils/customCalendarClassification';
import { EditAppIcon } from '../icons/EditAppIcon';

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

type CalendarListSectionProps = {
  title: string;
  calendars: readonly UserCustomCalendarItem[];
  activeId: string | null;
  isCompanyRow: boolean;
  externalCompanyNames: ReadonlyMap<string, string>;
  onSelect: (id: string | null) => void;
  onEditCalendar?: (cal: UserCustomCalendarItem) => void;
};

function CalendarListSection({
  title,
  calendars,
  activeId,
  isCompanyRow,
  externalCompanyNames,
  onSelect,
  onEditCalendar,
}: CalendarListSectionProps) {
  return (
    <section className="space-y-0.5">
      <h3 className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 px-0.5">{title}</h3>
      <ul className="space-y-px" role="list">
        <li>
          <button
            type="button"
            onClick={() => onSelect(null)}
            className={`flex w-full items-center gap-1.5 rounded pl-1.5 pr-1.5 py-1.5 text-left min-h-[34px] touch-manipulation ${
              activeId == null
                ? 'bg-slate-900 text-white'
                : 'text-slate-700 hover:bg-slate-100 active:bg-slate-200/70'
            }`}
          >
            <span className={`shrink-0 w-2.5 text-center text-[10px] ${activeId == null ? 'text-white/70' : 'text-slate-400'}`}>
              —
            </span>
            <span className="text-[11px] font-medium leading-tight">전체</span>
          </button>
        </li>
        {calendars.map((cal) => {
          const t = customCalendarColorTokens(cal.colorKey);
          const active = activeId === cal.id;
          const hint = isCompanyRow
            ? formatCompanyTabHint(cal.externalCompanyIds, externalCompanyNames)
            : formatRegionTabHint(cal.regions);
          return (
            <li key={cal.id}>
              <div className={`flex items-stretch rounded overflow-hidden ${active ? 'bg-slate-100 ring-1 ring-slate-200/80' : ''}`}>
                <button
                  type="button"
                  onClick={() => onSelect(active ? null : cal.id)}
                  className={`flex min-w-0 flex-1 items-center gap-1.5 pl-1.5 pr-0.5 py-1.5 text-left min-h-[34px] touch-manipulation ${
                    active ? 'text-slate-900' : 'text-slate-700 hover:bg-slate-100 active:bg-slate-200/70'
                  }`}
                  title={hint}
                >
                  <span className="shrink-0 w-2.5 flex justify-center">
                    <span className={`h-2 w-2 rounded-full border border-black/10 ${t.dot}`} />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[11px] font-medium leading-tight">{cal.name}</span>
                </button>
                {active && onEditCalendar ? (
                  <button
                    type="button"
                    onClick={() => onEditCalendar(cal)}
                    className="flex shrink-0 items-center justify-center px-1.5 text-slate-600 hover:bg-slate-200/60 min-w-[30px] touch-manipulation"
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
          <li className="pl-4 py-1 text-[10px] text-slate-400 leading-tight">등록된 캘린더 없음</li>
        ) : null}
      </ul>
    </section>
  );
}

export type ScheduleCustomCalendarMobileSheetProps = {
  open: boolean;
  onClose: () => void;
  regionCalendars: readonly UserCustomCalendarItem[];
  companyCalendars: readonly UserCustomCalendarItem[];
  activeRegionCalendarId: string | null;
  activeCompanyCalendarId: string | null;
  activeRegionCalendar: UserCustomCalendarItem | null;
  activeCompanyCalendar: UserCustomCalendarItem | null;
  onSelectRegion: (id: string | null) => void;
  onSelectCompany: (id: string | null) => void;
  onAddRegion: () => void;
  onAddCompany: () => void;
  onEditCalendar?: (cal: UserCustomCalendarItem) => void;
  canManage: boolean;
  externalCompanyNames: ReadonlyMap<string, string>;
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
      className={`relative inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-slate-600 shadow-sm hover:bg-slate-50 hover:text-slate-900 touch-manipulation lg:hidden ${className}`}
      aria-label="맞춤 캘린더 메뉴"
    >
      <BarsIcon className="h-5 w-5" />
      {hasActiveFilter ? (
        <span
          className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-sky-600 ring-2 ring-white"
          aria-hidden
        />
      ) : null}
    </button>
  );
}

export function ScheduleCustomCalendarMobileSheet({
  open,
  onClose,
  regionCalendars,
  companyCalendars,
  activeRegionCalendarId,
  activeCompanyCalendarId,
  activeRegionCalendar,
  activeCompanyCalendar,
  onSelectRegion,
  onSelectCompany,
  onAddRegion,
  onAddCompany,
  onEditCalendar,
  canManage,
  externalCompanyNames,
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

  const hasBothFilters = Boolean(activeRegionCalendar && activeCompanyCalendar);

  const handleSelectRegion = (id: string | null) => {
    onSelectRegion(id);
    onClose();
  };

  const handleSelectCompany = (id: string | null) => {
    onSelectCompany(id);
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

  const handleEdit = (cal: UserCustomCalendarItem) => {
    onEditCalendar?.(cal);
    onClose();
  };

  const handleClearAll = () => {
    onSelectRegion(null);
    onSelectCompany(null);
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
            {hasBothFilters ? (
              <p className="mt-0.5 truncate text-[10px] text-slate-500 leading-tight">
                {activeRegionCalendar!.name} ∩ {activeCompanyCalendar!.name}
              </p>
            ) : activeRegionCalendar ? (
              <p className="mt-0.5 truncate text-[10px] text-slate-500 leading-tight">지역 · {activeRegionCalendar.name}</p>
            ) : activeCompanyCalendar ? (
              <p className="mt-0.5 truncate text-[10px] text-slate-500 leading-tight">업체 · {activeCompanyCalendar.name}</p>
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
                </ul>
              ) : null}
            </section>
          ) : null}

          <CalendarListSection
            title="지역별"
            calendars={regionCalendars}
            activeId={activeRegionCalendarId}
            isCompanyRow={false}
            externalCompanyNames={externalCompanyNames}
            onSelect={handleSelectRegion}
            onEditCalendar={onEditCalendar ? handleEdit : undefined}
          />

          <CalendarListSection
            title="업체별"
            calendars={companyCalendars}
            activeId={activeCompanyCalendarId}
            isCompanyRow
            externalCompanyNames={externalCompanyNames}
            onSelect={handleSelectCompany}
            onEditCalendar={onEditCalendar ? handleEdit : undefined}
          />
        </div>

        <div className="shrink-0 border-t border-slate-100 bg-slate-50/80 px-2.5 py-2 space-y-1">
          {(activeRegionCalendarId || activeCompanyCalendarId) && (
            <button
              type="button"
              onClick={handleClearAll}
              className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-[10px] font-medium text-slate-700 hover:bg-slate-50 min-h-[32px] touch-manipulation leading-tight"
            >
              필터 모두 해제
            </button>
          )}
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
