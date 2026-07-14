import type { BillingScheduleItem } from './tenantBilling.schedule.js';
import { kstYmdFromDate } from './tenantBilling.dates.js';
import { kstTodayYmd } from '../inquiries/inquiryListDateRange.js';

export type BillingScheduleDatePreset = 'today' | 'all' | 'month' | 'day';

export type BillingScheduleListQuery = {
  datePreset?: BillingScheduleDatePreset | string;
  month?: string;
  day?: string;
  limit?: number;
  offset?: number;
};

function periodStartYmd(iso: string): string {
  return kstYmdFromDate(new Date(iso));
}

export function filterBillingScheduleItems(
  items: BillingScheduleItem[],
  query: Pick<BillingScheduleListQuery, 'datePreset' | 'month' | 'day'>,
): BillingScheduleItem[] {
  const preset = (query.datePreset ?? 'all') as BillingScheduleDatePreset;
  if (preset === 'all') return items;

  if (preset === 'today') {
    const today = kstTodayYmd();
    return items.filter((i) => periodStartYmd(i.periodStart) === today);
  }

  if (preset === 'month') {
    const monthKey = query.month?.trim();
    if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) return items;
    return items.filter((i) => periodStartYmd(i.periodStart).startsWith(monthKey));
  }

  if (preset === 'day') {
    const dayKey = query.day?.trim();
    if (!dayKey || !/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) return items;
    return items.filter((i) => periodStartYmd(i.periodStart) === dayKey);
  }

  return items;
}

export function paginateBillingScheduleItems(
  items: BillingScheduleItem[],
  limit: number,
  offset: number,
): { items: BillingScheduleItem[]; total: number } {
  const safeLimit = Math.min(Math.max(limit, 1), 100);
  const safeOffset = Math.max(offset, 0);
  const total = items.length;
  return {
    total,
    items: items.slice(safeOffset, safeOffset + safeLimit),
  };
}

export function parseBillingScheduleListQuery(raw: Record<string, unknown>): BillingScheduleListQuery {
  const limitRaw = raw.limit != null ? Number(raw.limit) : 30;
  const offsetRaw = raw.offset != null ? Number(raw.offset) : 0;
  const pageRaw = raw.page != null ? Number(raw.page) : NaN;
  const pageSizeRaw = raw.pageSize != null ? Number(raw.pageSize) : limitRaw;

  const pageSize = Number.isFinite(pageSizeRaw)
    ? Math.min(Math.max(Math.trunc(pageSizeRaw), 1), 100)
    : 30;
  const page = Number.isFinite(pageRaw) ? Math.max(Math.trunc(pageRaw), 1) : 1;
  const offset = Number.isFinite(offsetRaw) && raw.page == null
    ? Math.max(Math.trunc(offsetRaw), 0)
    : (page - 1) * pageSize;

  const preset = String(raw.datePreset ?? 'all');
  const datePreset: BillingScheduleDatePreset =
    preset === 'today' || preset === 'month' || preset === 'day' ? preset : 'all';

  return {
    datePreset,
    month: raw.month != null ? String(raw.month) : undefined,
    day: raw.day != null ? String(raw.day) : undefined,
    limit: pageSize,
    offset,
  };
}
