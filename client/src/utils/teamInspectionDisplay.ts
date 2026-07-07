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
