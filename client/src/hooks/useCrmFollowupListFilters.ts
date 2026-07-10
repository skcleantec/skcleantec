import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { OrderFollowupDatePreset } from '../api/orderFollowups';
import type { OrderFollowupStatus } from '../constants/orderFollowupStatus';
import {
  type FollowupBrandScope,
  type FollowupListDateBasis,
  type FollowupListFilterState,
  followupListFilterKey,
} from '../components/order-followup/followupListQuery';
import { kstTodayYmd } from '../utils/dateFormat';
import { usePaginatedListQuery } from './usePaginatedListQuery';

const VALID_STATUS = new Set<OrderFollowupStatus>(['REQUESTED', 'ABSENT', 'ON_HOLD']);

function parseDateBasis(raw: string | null): FollowupListDateBasis {
  return raw === 'preferredMoveIn' ? 'preferredMoveIn' : 'createdAt';
}

function parseDatePreset(raw: string | null): OrderFollowupDatePreset {
  if (raw === 'all' || raw === 'month' || raw === 'day') return raw;
  return 'today';
}

function parseBrandScope(raw: string | null): FollowupBrandScope {
  return raw === 'work' ? 'work' : 'all';
}

function parseStatus(raw: string | null): OrderFollowupStatus | '' {
  if (raw && VALID_STATUS.has(raw as OrderFollowupStatus)) return raw as OrderFollowupStatus;
  return '';
}

export function parseCrmFollowupListFilters(searchParams: URLSearchParams): FollowupListFilterState {
  const today = kstTodayYmd();
  return {
    listDateBasis: parseDateBasis(searchParams.get('fuDateBasis')),
    datePreset: parseDatePreset(searchParams.get('fuDatePreset')),
    dateMonthKey: searchParams.get('fuMonth')?.trim() || today.slice(0, 7),
    dateDayKey: searchParams.get('fuDay')?.trim() || today,
    filterStatus: parseStatus(searchParams.get('fuStatus')),
    filterCustomerName: searchParams.get('fuCustomerName')?.trim() ?? '',
    filterGoldDbOnly: searchParams.get('fuGoldDb') === '1',
    brandScope: parseBrandScope(searchParams.get('fuBrand')),
    phoneLock: searchParams.get('fuPhoneLock') === '1',
  };
}

function writeCrmFollowupListFilters(next: URLSearchParams, filters: FollowupListFilterState) {
  if (filters.listDateBasis === 'createdAt') next.delete('fuDateBasis');
  else next.set('fuDateBasis', filters.listDateBasis);

  if (filters.datePreset === 'today') next.delete('fuDatePreset');
  else next.set('fuDatePreset', filters.datePreset);

  if (filters.datePreset === 'month') next.set('fuMonth', filters.dateMonthKey);
  else next.delete('fuMonth');

  if (filters.datePreset === 'day') next.set('fuDay', filters.dateDayKey);
  else next.delete('fuDay');

  if (filters.filterStatus) next.set('fuStatus', filters.filterStatus);
  else next.delete('fuStatus');

  if (filters.filterCustomerName.trim()) next.set('fuCustomerName', filters.filterCustomerName.trim());
  else next.delete('fuCustomerName');

  if (filters.filterGoldDbOnly) next.set('fuGoldDb', '1');
  else next.delete('fuGoldDb');

  if (filters.brandScope === 'work') next.set('fuBrand', 'work');
  else next.delete('fuBrand');

  if (filters.phoneLock) next.set('fuPhoneLock', '1');
  else next.delete('fuPhoneLock');
}

/** CRM 부재·보류 드로어 — 필터 state ↔ URL (`fu*`) + 페이지네이션 */
export function useCrmFollowupListFilters() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => parseCrmFollowupListFilters(searchParams), [searchParams]);
  const listFilterKey = useMemo(() => followupListFilterKey(filters), [filters]);

  const pagination = usePaginatedListQuery(listFilterKey);

  const patchFilters = useCallback(
    (patch: Partial<FollowupListFilterState>) => {
      const merged = { ...filters, ...patch };
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          writeCrmFollowupListFilters(next, merged);
          next.delete('page');
          return next;
        },
        { replace: true },
      );
    },
    [filters, setSearchParams],
  );

  return {
    filters,
    patchFilters,
    ...pagination,
  };
}
