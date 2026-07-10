import { CrmDrawerShell } from '../layout/CrmDrawerShell';
import { FollowupInlinePanel } from './FollowupInlinePanel';
import type { OrderFollowupItem } from '../../../api/orderFollowups';

export function CrmFollowupDrawer({
  open,
  followupId,
  operatingCompanyId,
  crmPhone,
  onClose,
  onSelectFollowupId,
  onApplyToCrm,
  onSaved,
}: {
  open: boolean;
  followupId: string | null;
  operatingCompanyId: string | null;
  crmPhone?: string;
  onClose: () => void;
  onSelectFollowupId: (id: string | null) => void;
  onApplyToCrm: (item: OrderFollowupItem) => void;
  onSaved?: () => void;
}) {
  return (
    <CrmDrawerShell
      open={open}
      title="부재 · 보류"
      subtitle="건을 선택해 편집하거나 CRM 접수란으로 가져옵니다."
      onClose={onClose}
      widthClass="w-[min(840px,96vw)]"
    >
      <FollowupInlinePanel
        operatingCompanyId={operatingCompanyId}
        selectedFollowupId={followupId}
        onSelectFollowupId={onSelectFollowupId}
        crmPhone={crmPhone}
        onApplyToCrm={onApplyToCrm}
        onSaved={onSaved}
      />
    </CrmDrawerShell>
  );
}
