import type { InspectionListSummary } from '../api/inquiryInspection';
import { kstTodayYmd } from './dateFormat';

export type TeamInspectionDisplayTone =
  | 'na'
  | 'complete'
  | 'missed'
  | 'void'
  | 'overdue'
  | 'dueToday'
  | 'pending';

export function isTeamInspectionTrackingEligible(item: {
  status: string;
  preferredDate: string | null | undefined;
  assignments?: unknown[];
}): boolean {
  if (!item.preferredDate?.trim()) return false;
  if (!item.assignments?.length) return false;
  if (item.status === 'CANCELLED' || item.status === 'ON_HOLD') return false;
  return true;
}

export function resolveTeamInspectionDisplay(params: {
  status: string;
  preferredDate: string | null | undefined;
  assignments?: unknown[];
  inspectionSummary?: InspectionListSummary | null;
  now?: Date;
}): { tone: TeamInspectionDisplayTone; label: string; title: string } {
  if (!isTeamInspectionTrackingEligible(params)) {
    return { tone: 'na', label: '—', title: '검수 대상 아님' };
  }

  const summary = params.inspectionSummary;
  if (summary?.status === 'COMPLETED') {
    return { tone: 'complete', label: '검수완료', title: '현장 검수 완료' };
  }
  if (summary?.status === 'MISSED') {
    return { tone: 'missed', label: '검수누락', title: '현장 검수 누락 처리됨' };
  }
  if (summary?.status === 'VOID') {
    return { tone: 'void', label: '검수무효', title: '현장 검수 무효' };
  }

  const pd = params.preferredDate!.slice(0, 10);
  const today = kstTodayYmd();
  if (pd < today) {
    return { tone: 'overdue', label: '검수미완', title: '예약일 경과 · 현장 검수 미완료' };
  }
  if (pd === today) {
    return { tone: 'dueToday', label: '검수필요', title: '오늘 현장 · 검수 필요' };
  }
  return { tone: 'pending', label: '검수대기', title: '예약일 전 · 검수 대기' };
}

const TEAM_FOOTER_BTN_BASE =
  'flex min-h-[32px] w-full items-center justify-center rounded-lg px-2 py-1 text-fluid-2xs font-semibold touch-manipulation sm:min-h-[34px] sm:text-fluid-xs';

const TEAM_FOOTER_BTN_SECONDARY =
  'flex min-h-[32px] w-full items-center justify-center rounded-lg border px-2 py-1 text-fluid-2xs font-medium touch-manipulation sm:min-h-[34px] sm:text-fluid-xs';

/** 상세 모달 푸터 — 현장 검수 · 청소완료 (상태별 라벨·색) */
export function teamInspectionFooterButton(item: {
  status: string;
  preferredDate: string | null | undefined;
  assignments?: unknown[];
  inspectionSummary?: InspectionListSummary | null;
}): { label: string; className: string } {
  const display = resolveTeamInspectionDisplay(item);
  switch (display.tone) {
    case 'complete':
      return {
        label: '검수완료 · 현장검수',
        className: `${TEAM_FOOTER_BTN_BASE} border border-emerald-800 bg-emerald-700 text-white hover:bg-emerald-800`,
      };
    case 'missed':
      return {
        label: '검수누락 · 재진행',
        className: `${TEAM_FOOTER_BTN_BASE} border border-red-700 bg-red-600 text-white hover:bg-red-700`,
      };
    case 'overdue':
      return {
        label: '검수미완 · 현장검수',
        className: `${TEAM_FOOTER_BTN_BASE} border border-red-700 bg-red-600 text-white hover:bg-red-700`,
      };
    case 'dueToday':
      return {
        label: '검수필요 · 현장검수',
        className: `${TEAM_FOOTER_BTN_BASE} border border-orange-600 bg-orange-600 text-white hover:bg-orange-700`,
      };
    case 'void':
      return {
        label: '검수무효 · 현장검수',
        className: `${TEAM_FOOTER_BTN_BASE} border border-rose-600 bg-rose-600 text-white hover:bg-rose-700`,
      };
    default:
      return {
        label: '현장 검수 · 청소완료',
        className: `${TEAM_FOOTER_BTN_BASE} border border-gray-800 bg-gray-900 text-white hover:bg-gray-950`,
      };
  }
}

export const teamFooterPhotoBeforeClass = `${TEAM_FOOTER_BTN_SECONDARY} border-sky-700 bg-sky-600 text-white hover:bg-sky-700`;
export const teamFooterPhotoAfterClass = `${TEAM_FOOTER_BTN_SECONDARY} border-emerald-800 bg-emerald-700 text-white hover:bg-emerald-800`;
export const teamFooterActionSecondaryClass = `${TEAM_FOOTER_BTN_SECONDARY} border-gray-300 bg-white text-gray-800 hover:bg-gray-50 active:bg-gray-100`;
export const teamFooterActionPrimaryClass = `${TEAM_FOOTER_BTN_SECONDARY} border-emerald-600 bg-emerald-50 text-emerald-900 hover:bg-emerald-100 active:bg-emerald-200/80`;
export const teamFooterHappyCallClass = `${TEAM_FOOTER_BTN_BASE} bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50`;

export function teamInspectionBadgeClass(tone: TeamInspectionDisplayTone, variant: 'default' | 'list'): string {
  if (tone === 'na') {
    return variant === 'list' ? 'text-fluid-xs text-gray-400 tabular-nums' : '';
  }
  if (tone === 'complete') {
    return variant === 'list'
      ? 'text-fluid-xs font-semibold text-emerald-700'
      : 'bg-emerald-50 text-emerald-900 border-emerald-300';
  }
  if (tone === 'missed') {
    return variant === 'list'
      ? 'text-fluid-xs font-semibold text-red-700'
      : 'bg-red-50 text-red-900 border-red-300';
  }
  if (tone === 'void') {
    return variant === 'list'
      ? 'text-fluid-xs font-semibold text-rose-700'
      : 'bg-rose-50 text-rose-900 border-rose-300';
  }
  if (tone === 'overdue') {
    return variant === 'list'
      ? 'text-fluid-xs font-semibold text-red-700'
      : 'bg-red-50 text-red-900 border-red-400';
  }
  if (tone === 'dueToday') {
    return variant === 'list'
      ? 'text-fluid-xs font-semibold text-orange-700'
      : 'bg-orange-50 text-orange-950 border-orange-300';
  }
  return variant === 'list'
    ? 'text-fluid-xs font-medium text-amber-800'
    : 'bg-amber-50 text-amber-900 border-amber-200';
}
