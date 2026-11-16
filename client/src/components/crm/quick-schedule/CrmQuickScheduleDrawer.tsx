import { useEffect } from 'react';
import { fetchOrderFollowup, type OrderFollowupItem } from '../../../api/orderFollowups';
import type { CrmQuickScheduleItem } from '../../../api/crmQuickSchedule';
import { getToken } from '../../../stores/auth';
import { resolveCrmOutboundPhone } from '../../../utils/crmContactPhone';
import type { CrmFollowupApplySnapshot } from '../../../utils/crmFollowupApply';
import { runTelecrmCallWithSoomgoAuto } from '../../../utils/soomgoCallAutoSend';
import { CrmRightSlideDrawer } from '../layout/CrmRightSlideDrawer';
import { CrmQuickScheduleBody, type CrmQuickScheduleTab } from './CrmQuickScheduleBody';
import { buildQuickScheduleSnapshot } from './quickScheduleSnapshot';

export function CrmQuickScheduleDrawer({
  open,
  tab,
  onTabChange,
  operatingCompanyId,
  marketerName,
  onClose,
  onApplyFollowup,
  onApplySnapshot,
  onNotice,
}: {
  open: boolean;
  tab: CrmQuickScheduleTab;
  onTabChange: (tab: CrmQuickScheduleTab) => void;
  operatingCompanyId: string | null;
  marketerName?: string | null;
  onClose: () => void;
  onApplyFollowup: (item: OrderFollowupItem) => void;
  onApplySnapshot: (snapshot: CrmFollowupApplySnapshot) => void;
  onNotice: (message: string) => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  async function fill(row: CrmQuickScheduleItem) {
    if (row.followup) {
      const token = getToken();
      if (!token) return;
      const res = await fetchOrderFollowup(token, row.followup.id);
      onApplyFollowup(res.item);
      return;
    }
    onApplySnapshot(buildQuickScheduleSnapshot(row));
  }

  async function handleCall(row: CrmQuickScheduleItem) {
    const token = getToken();
    if (!token) return;
    const dial = resolveCrmOutboundPhone(row.customerPhone, row.followup?.customerPhone2 ?? '');
    if (dial.replace(/\D/g, '').length < 8) {
      throw new Error('통화할 연락처가 없습니다.');
    }
    await fill(row);
    const { autoNotice, callNotice } = await runTelecrmCallWithSoomgoAuto({
      token,
      dialPhone: dial,
      telecrmCallOpts: row.inquiryId
        ? { customerMatch: 'existing', inquiryId: row.inquiryId }
        : { customerMatch: 'new' },
      soomgoCtx: {
        operatingCompanyId,
        customerName: row.customerName,
        nickname: row.nickname ?? '',
        marketerName: marketerName ?? undefined,
      },
    });
    const notice = autoNotice ?? callNotice;
    if (notice) onNotice(notice);
  }

  return (
    <CrmRightSlideDrawer open={open} title="빠른일정" onClose={onClose} widthClass="w-full max-w-[1120px]">
      <CrmQuickScheduleBody
        variant="drawer"
        enabled={open}
        operatingCompanyId={operatingCompanyId}
        tab={tab}
        onTabChange={onTabChange}
        onLoad={fill}
        onCall={handleCall}
      />
    </CrmRightSlideDrawer>
  );
}
