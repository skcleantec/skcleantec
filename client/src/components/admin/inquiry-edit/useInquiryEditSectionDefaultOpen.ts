import { useEffect, useMemo, useState } from 'react';
import type { InquiryChangeLogEntry } from '../../../api/schedule';
import { listAdminConsultationPhotos } from '../../../api/inquiryConsultationPhotos';
import { listAdminCleaningPhotos } from '../../../api/inquiryCleaningPhotos';
import { getAdminOrderFormPhotos } from '../../../api/orderform';
import { fetchAdminInspectionChecklist } from '../../../api/inquiryInspection';

type SectionDefaultOpenFlags = {
  consultationPhotos: boolean;
  orderPhotos: boolean;
  inspection: boolean;
  sitePhotos: boolean;
};

const EMPTY_FLAGS: SectionDefaultOpenFlags = {
  consultationPhotos: false,
  orderPhotos: false,
  inspection: false,
  sitePhotos: false,
};

/** 7~10번 섹션 — 사진·검수 등 비동기 데이터 유무로 defaultOpen 판단 */
export function useInquiryEditSectionDefaultOpen(
  token: string | null | undefined,
  inquiryId: string | null | undefined,
  consultationMemo: string | null | undefined,
  orderFormPhotoId: string | null | undefined,
  hasInspectionModule: boolean,
  historyLogs: InquiryChangeLogEntry[],
  historyLogsLoading: boolean,
) {
  const [flags, setFlags] = useState<SectionDefaultOpenFlags>(EMPTY_FLAGS);

  const consultationHasMemo = Boolean(consultationMemo?.trim());

  useEffect(() => {
    if (!token || !inquiryId) {
      setFlags(EMPTY_FLAGS);
      return;
    }
    let cancelled = false;
    void Promise.all([
      listAdminConsultationPhotos(token, inquiryId)
        .then((r) => r.items.length > 0)
        .catch(() => false),
      orderFormPhotoId
        ? getAdminOrderFormPhotos(token, orderFormPhotoId)
            .then((r) => r.items.length > 0)
            .catch(() => false)
        : Promise.resolve(false),
      hasInspectionModule
        ? fetchAdminInspectionChecklist(token, inquiryId)
            .then((r) => r.checklist != null)
            .catch(() => false)
        : Promise.resolve(false),
      listAdminCleaningPhotos(token, inquiryId)
        .then((r) => r.items.length > 0)
        .catch(() => false),
    ]).then(([consultationPhotos, orderPhotos, inspection, sitePhotos]) => {
      if (cancelled) return;
      setFlags({
        consultationPhotos: consultationHasMemo || consultationPhotos,
        orderPhotos,
        inspection,
        sitePhotos,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [token, inquiryId, consultationHasMemo, orderFormPhotoId, hasInspectionModule]);

  return useMemo(
    () => ({
      consultationPhotos: consultationHasMemo || flags.consultationPhotos,
      orderPhotos: flags.orderPhotos,
      inspection: flags.inspection,
      sitePhotos: flags.sitePhotos,
      history: !historyLogsLoading && historyLogs.length > 0,
    }),
    [
      consultationHasMemo,
      flags.consultationPhotos,
      flags.orderPhotos,
      flags.inspection,
      flags.sitePhotos,
      historyLogs,
      historyLogsLoading,
    ],
  );
}
