import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  clampListPage,
  INQUIRY_LIST_DEFAULT_PAGE_SIZE,
  parseInquiryListPageSize,
  parseListPage,
  type InquiryListPageSize,
} from '../utils/listPagination';

/** 목록 API 페이지네이션 + URL `page`/`pageSize` (필터 변경 시 1페이지 리셋) */
export function usePaginatedListQuery(filterKey: string) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [listPage, setListPage] = useState(() => parseListPage(searchParams.get('page')));
  const [listPageSize, setListPageSize] = useState<InquiryListPageSize>(() =>
    parseInquiryListPageSize(searchParams.get('pageSize'))
  );
  const [total, setTotal] = useState(0);

  const patchSearchParams = useCallback(
    (patch: (next: URLSearchParams) => void) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          patch(next);
          next.delete('page');
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  const syncListPaginationUrl = useCallback(
    (page: number, pageSize: InquiryListPageSize) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (page <= 1) next.delete('page');
          else next.set('page', String(page));
          if (pageSize === INQUIRY_LIST_DEFAULT_PAGE_SIZE) next.delete('pageSize');
          else next.set('pageSize', String(pageSize));
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  const handleListPageChange = useCallback(
    (page: number) => {
      setListPage(page);
      syncListPaginationUrl(page, listPageSize);
    },
    [listPageSize, syncListPaginationUrl]
  );

  const handleListPageSizeChange = useCallback(
    (pageSize: InquiryListPageSize) => {
      setListPageSize(pageSize);
      setListPage(1);
      syncListPaginationUrl(1, pageSize);
    },
    [syncListPaginationUrl]
  );

  const prevListFilterKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (prevListFilterKeyRef.current === null) {
      prevListFilterKeyRef.current = filterKey;
      return;
    }
    if (prevListFilterKeyRef.current === filterKey) return;
    prevListFilterKeyRef.current = filterKey;
    setListPage(1);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('page');
        return next;
      },
      { replace: true }
    );
  }, [filterKey, setSearchParams]);

  useEffect(() => {
    setListPage((p) => clampListPage(p, total, listPageSize));
  }, [total, listPageSize]);

  return {
    listPage,
    listPageSize,
    total,
    setTotal,
    handleListPageChange,
    handleListPageSizeChange,
    patchSearchParams,
    searchParams,
    setSearchParams,
  };
}
