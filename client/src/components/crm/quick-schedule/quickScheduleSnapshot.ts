import type { CrmQuickScheduleItem } from '../../../api/crmQuickSchedule';
import type { CrmFollowupApplySnapshot } from '../../../utils/crmFollowupApply';

export function buildQuickScheduleSnapshot(row: CrmQuickScheduleItem): CrmFollowupApplySnapshot {
  return {
    followupId: '',
    inquiryId: row.inquiryId,
    customerName: row.customerName,
    nickname: row.nickname?.trim() ?? '',
    contactPhone: row.customerPhone,
    safePhone: '',
    requestMemo: row.preferredAnswerRaw ? `희망일 답변: ${row.preferredAnswerRaw}` : '',
    address: row.address?.trim() ?? '',
    pyeong: row.areaPyeong != null ? String(row.areaPyeong) : '',
    roomCount: '',
    bathroomCount: '',
    balconyCount: '',
    kind: 'requested',
    goldDb: false,
    preferredMoveInCleanYmd: row.preferredKind === 'DATE' || row.preferredKind === 'WITHIN_WEEK' ? row.preferredYmd ?? '' : '',
    leadSource: row.leadSource,
  };
}
