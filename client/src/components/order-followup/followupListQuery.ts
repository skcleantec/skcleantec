import type { OrderFollowupDatePreset, OrderFollowupItem } from '../../api/orderFollowups';
import { listOrderFollowups } from '../../api/orderFollowups';
import type { OrderFollowupStatus } from '../../constants/orderFollowupStatus';

export type FollowupListDateBasis = 'createdAt' | 'preferredMoveIn';
export type FollowupBrandScope = 'all' | 'work';

export type FollowupListFilterState = {
  listDateBasis: FollowupListDateBasis;
  datePreset: OrderFollowupDatePreset;
  dateMonthKey: string;
  dateDayKey: string;
  filterStatus: OrderFollowupStatus | '';
  filterCustomerName: string;
  filterGoldDbOnly: boolean;
  brandScope: FollowupBrandScope;
  phoneLock: boolean;
};

export type FollowupListQueryOpts = {
  filters: FollowupListFilterState;
  operatingCompanyId?: string | null;
  crmPhone?: string;
  listPage: number;
  listPageSize: number;
};

type ListOrderFollowupsOpts = NonNullable<Parameters<typeof listOrderFollowups>[1]>;

/** 관리 부재·보류 · CRM 드로어 공통 — listOrderFollowups opts */
export function buildFollowupListQuery(opts: FollowupListQueryOpts): ListOrderFollowupsOpts {
  const { filters, operatingCompanyId, crmPhone, listPage, listPageSize } = opts;
  const phoneDigits = (crmPhone ?? '').replace(/\D/g, '');
  const usePhone = filters.phoneLock && phoneDigits.length >= 4;

  const query: ListOrderFollowupsOpts = {
    status: filters.filterStatus || undefined,
    customerName: filters.filterCustomerName.trim() || undefined,
    goldDbOnly: filters.filterGoldDbOnly || undefined,
    limit: listPageSize,
    offset: (listPage - 1) * listPageSize,
  };

  if (filters.brandScope === 'work' && operatingCompanyId?.trim()) {
    query.operatingCompanyId = operatingCompanyId.trim();
  }

  if (usePhone) {
    query.phone = phoneDigits;
    query.datePreset = 'all';
  } else if (filters.datePreset !== 'all') {
    if (filters.listDateBasis === 'preferredMoveIn') {
      query.preferredDatePreset = filters.datePreset;
      if (filters.datePreset === 'month') query.preferredMonth = filters.dateMonthKey;
      if (filters.datePreset === 'day') query.preferredDay = filters.dateDayKey;
    } else {
      query.datePreset = filters.datePreset;
      if (filters.datePreset === 'month') query.month = filters.dateMonthKey;
      if (filters.datePreset === 'day') query.day = filters.dateDayKey;
    }
  }

  return query;
}

export function followupListFilterKey(filters: FollowupListFilterState): string {
  return JSON.stringify(filters);
}

export function followupListQueryKey(
  filters: FollowupListFilterState,
  listPage: number,
  listPageSize: number,
): string {
  return `${followupListFilterKey(filters)}\0${listPage}\0${listPageSize}`;
}

export type FollowupListQueryResult = { items: OrderFollowupItem[]; total: number };
