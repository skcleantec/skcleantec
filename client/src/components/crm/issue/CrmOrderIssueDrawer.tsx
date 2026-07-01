import { CrmDrawerShell } from '../layout/CrmDrawerShell';
import { OrderIssueInlinePanel, type CrmOrderIssueSeed } from '../../orderform/OrderIssueInlinePanel';

export function CrmOrderIssueDrawer({
  open,
  pendingInquiryId,
  crmSeed,
  onClose,
  onIssued,
}: {
  open: boolean;
  pendingInquiryId?: string;
  crmSeed?: CrmOrderIssueSeed;
  onClose: () => void;
  onIssued?: () => void;
}) {
  return (
    <CrmDrawerShell
      open={open}
      title="발주서 발급"
      subtitle="CRM 상담 내용을 반영해 링크를 발급합니다."
      onClose={onClose}
      widthClass="w-[min(720px,96vw)]"
    >
      <OrderIssueInlinePanel
        pendingInquiryId={pendingInquiryId}
        crmSeed={crmSeed}
        onIssued={onIssued}
        compact
      />
    </CrmDrawerShell>
  );
}
