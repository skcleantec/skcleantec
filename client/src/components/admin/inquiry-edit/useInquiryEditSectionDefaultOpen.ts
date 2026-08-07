import { useMemo } from 'react';
import type { InquiryChangeLogEntry } from '../../../api/schedule';

/** 7~11번 섹션 — 동기 데이터만으로 defaultOpen 판단 (스크롤 버벅임 방지용, API prefetch 없음) */
export function useInquiryEditSectionDefaultOpen(
  consultationMemo: string | null | undefined,
  historyLogs: InquiryChangeLogEntry[],
  historyLogsLoading: boolean,
  orderFormPhotoCount?: number | null,
) {
  return useMemo(
    () => ({
      consultationPhotos: Boolean(consultationMemo?.trim()),
      orderPhotos: (orderFormPhotoCount ?? 0) > 0,
      inspection: false,
      sitePhotos: false,
      history: !historyLogsLoading && historyLogs.length > 0,
    }),
    [consultationMemo, historyLogs, historyLogsLoading, orderFormPhotoCount],
  );
}
