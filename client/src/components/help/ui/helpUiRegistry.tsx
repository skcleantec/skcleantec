import type { ReactNode } from 'react';
import type { HelpUiTokenId } from '@shared/helpUiTokens';
import { DbMarketplaceTabBar } from '../../db-marketplace/DbMarketplaceListUi';
import {
  DbMarketplaceBuyBulkButton,
  DbMarketplaceCartAddButton,
  DbMarketplaceConfirmBulkButton,
  DbMarketplaceDeclineBulkButton,
  DbMarketplacePublishBulkButton,
  DbMarketplaceRevertBulkButton,
  DbMarketplaceRevertToCartButton,
  DbMarketplaceStatusBadge,
} from '../../db-marketplace/marketplaceUiParts';
import { InquiryDbMarketplaceBadge } from '../../admin/InquiryDbMarketplaceBadge';
import {
  ScheduleCloseDayButton,
  ScheduleReleaseDayButton,
  ScheduleSlotBadge,
  ScheduleUnassignedChip,
  scheduleLeaderAdjustButtonClass,
  scheduleMapButtonClass,
  scheduleStaffAdjustButtonClass,
  ScheduleToolbarButton,
} from '../../schedule/scheduleUiParts';
import { adminScheduleMapIconUrl } from '../../../utils/scheduleMapIcon';
import {
  DashboardAdSettleButton,
  DashboardHappyOverdueStatPreview,
  DashboardHappyPendingStatPreview,
  DashboardRealtimeBadge,
  DashboardTodayStatPreview,
  DashboardUnassignedStatPreview,
} from '../../dashboard/dashboardUiParts';
import {
  InquiryDatePresetBar,
  InquiryManualIntakeButton,
  InquiryMarketerDailyButton,
  InquiryMobileCallButton,
  InquiryOrderPendingHint,
  InquiryStatusChipPreview,
  InquiryListPinHint,
} from '../../inquiries/inquiriesUiParts';
import {
  MarketerAdminLevelBadge,
  PayrollTabBar,
  TeamLeaderDayOffBulkButton,
  UserRegisterTabBar,
} from '../../team-leaders/teamLeadersUiParts';

const DB_TAB_OPTIONS = [
  { id: 'cart', label: '장바구니' },
  { id: 'browse', label: '구매 가능' },
  { id: 'my_sales', label: '내 판매' },
  { id: 'pending', label: '진행 중' },
  { id: 'confirmed', label: '확정 완료' },
] as const;

function previewProps(disabled = true) {
  return {
    disabled,
    tabIndex: -1,
    'aria-hidden': true as const,
  };
}

function HelpUiShell({ block, children }: { block?: boolean; children: ReactNode }) {
  return (
    <span
      className={
        block
          ? 'my-2 flex flex-wrap items-center gap-2 pointer-events-none select-none'
          : 'inline-flex align-middle mx-0.5 my-0.5 pointer-events-none select-none vertical-align-middle'
      }
      aria-hidden
    >
      {children}
    </span>
  );
}

const MOCK_LISTING = { status: 'DRAFT' as const, listingId: 'help-preview' };

export const HELP_UI_REGISTRY: Record<HelpUiTokenId, () => ReactNode> = {
  'schedule-btn-close': () => (
    <HelpUiShell>
      <ScheduleCloseDayButton {...previewProps()} />
    </HelpUiShell>
  ),
  'schedule-btn-close-release': () => (
    <HelpUiShell>
      <ScheduleReleaseDayButton {...previewProps()} />
    </HelpUiShell>
  ),
  'schedule-btn-staff-adjust': () => (
    <HelpUiShell>
      <ScheduleToolbarButton className={scheduleStaffAdjustButtonClass} {...previewProps()}>
        인원조정
      </ScheduleToolbarButton>
    </HelpUiShell>
  ),
  'schedule-btn-leader-adjust': () => (
    <HelpUiShell>
      <ScheduleToolbarButton className={scheduleLeaderAdjustButtonClass} {...previewProps()}>
        팀장조정
      </ScheduleToolbarButton>
    </HelpUiShell>
  ),
  'schedule-btn-map': () => (
    <HelpUiShell>
      <ScheduleToolbarButton className={scheduleMapButtonClass} {...previewProps()} title="접수건 위치 검색">
        <img
          src={adminScheduleMapIconUrl}
          alt=""
          className="pointer-events-none h-[clamp(1.25rem,3.2vmin,1.5rem)] w-[clamp(1.25rem,3.2vmin,1.5rem)] select-none object-contain sm:h-6 sm:w-6"
          loading="lazy"
          decoding="async"
        />
      </ScheduleToolbarButton>
    </HelpUiShell>
  ),
  'schedule-badge-am': () => (
    <HelpUiShell>
      <ScheduleSlotBadge label="오전" bucket="morning" />
    </HelpUiShell>
  ),
  'schedule-badge-pm': () => (
    <HelpUiShell>
      <ScheduleSlotBadge label="오후" bucket="afternoon" />
    </HelpUiShell>
  ),
  'schedule-badge-side': () => (
    <HelpUiShell>
      <ScheduleSlotBadge label="사이" isSide />
    </HelpUiShell>
  ),
  'schedule-badge-unassigned': () => (
    <HelpUiShell>
      <ScheduleUnassignedChip />
    </HelpUiShell>
  ),
  'schedule-marketplace-cart': () => (
    <HelpUiShell>
      <InquiryDbMarketplaceBadge dbListing={MOCK_LISTING} iconOnly />
    </HelpUiShell>
  ),
  'db-tabs': () => (
    <HelpUiShell block>
      <div className="w-full max-w-xl">
        <DbMarketplaceTabBar options={[...DB_TAB_OPTIONS]} active="cart" onChange={() => {}} />
      </div>
    </HelpUiShell>
  ),
  'db-status-cart': () => (
    <HelpUiShell>
      <DbMarketplaceStatusBadge status="DRAFT" />
    </HelpUiShell>
  ),
  'db-status-open': () => (
    <HelpUiShell>
      <DbMarketplaceStatusBadge status="OPEN" />
    </HelpUiShell>
  ),
  'db-status-pending': () => (
    <HelpUiShell>
      <DbMarketplaceStatusBadge status="PENDING_SELLER" />
    </HelpUiShell>
  ),
  'db-status-confirmed': () => (
    <HelpUiShell>
      <DbMarketplaceStatusBadge status="CONFIRMED" />
    </HelpUiShell>
  ),
  'db-btn-cart-add': () => (
    <HelpUiShell>
      <DbMarketplaceCartAddButton {...previewProps()} />
    </HelpUiShell>
  ),
  'db-btn-publish': () => (
    <HelpUiShell>
      <DbMarketplacePublishBulkButton {...previewProps()} />
    </HelpUiShell>
  ),
  'db-btn-revert': () => (
    <HelpUiShell>
      <DbMarketplaceRevertBulkButton {...previewProps()} />
    </HelpUiShell>
  ),
  'db-btn-buy': () => (
    <HelpUiShell>
      <DbMarketplaceBuyBulkButton {...previewProps()} />
    </HelpUiShell>
  ),
  'db-btn-confirm': () => (
    <HelpUiShell>
      <DbMarketplaceConfirmBulkButton {...previewProps()} />
    </HelpUiShell>
  ),
  'db-btn-decline': () => (
    <HelpUiShell>
      <DbMarketplaceDeclineBulkButton {...previewProps()} />
    </HelpUiShell>
  ),
  'db-btn-revert-to-cart': () => (
    <HelpUiShell>
      <DbMarketplaceRevertToCartButton {...previewProps()} />
    </HelpUiShell>
  ),
  'dash-stat-today': () => (
    <HelpUiShell block>
      <div className="max-w-xs">
        <DashboardTodayStatPreview />
      </div>
    </HelpUiShell>
  ),
  'dash-stat-unassigned': () => (
    <HelpUiShell>
      <DashboardUnassignedStatPreview />
    </HelpUiShell>
  ),
  'dash-stat-happy-overdue': () => (
    <HelpUiShell>
      <DashboardHappyOverdueStatPreview />
    </HelpUiShell>
  ),
  'dash-stat-happy-pending': () => (
    <HelpUiShell>
      <DashboardHappyPendingStatPreview />
    </HelpUiShell>
  ),
  'dash-badge-realtime': () => (
    <HelpUiShell>
      <DashboardRealtimeBadge />
    </HelpUiShell>
  ),
  'dash-btn-ad-settle': () => (
    <HelpUiShell>
      <DashboardAdSettleButton {...previewProps()} />
    </HelpUiShell>
  ),
  'inq-date-preset': () => (
    <HelpUiShell block>
      <InquiryDatePresetBar active="today" />
    </HelpUiShell>
  ),
  'inq-btn-manual': () => (
    <HelpUiShell>
      <InquiryManualIntakeButton {...previewProps()} />
    </HelpUiShell>
  ),
  'inq-btn-marketer-daily': () => (
    <HelpUiShell>
      <InquiryMarketerDailyButton {...previewProps()} />
    </HelpUiShell>
  ),
  'inq-status-received': () => (
    <HelpUiShell>
      <InquiryStatusChipPreview status="RECEIVED" />
    </HelpUiShell>
  ),
  'inq-status-pending': () => (
    <HelpUiShell>
      <InquiryStatusChipPreview status="PENDING" />
    </HelpUiShell>
  ),
  'inq-status-unsubmitted': () => (
    <HelpUiShell>
      <InquiryStatusChipPreview status="ORDER_FORM_PENDING" />
    </HelpUiShell>
  ),
  'inq-btn-call': () => (
    <HelpUiShell>
      <InquiryMobileCallButton {...previewProps()} />
    </HelpUiShell>
  ),
  'inq-hint-order-pending': () => (
    <HelpUiShell>
      <InquiryOrderPendingHint />
    </HelpUiShell>
  ),
  'inq-hint-pin-pending': () => (
    <HelpUiShell>
      <InquiryListPinHint>미제출 · 목록 맨 위 고정</InquiryListPinHint>
    </HelpUiShell>
  ),
  'tl-tabs-user-register': () => (
    <HelpUiShell block>
      <UserRegisterTabBar active="leader" />
    </HelpUiShell>
  ),
  'tl-tabs-payroll': () => (
    <HelpUiShell block>
      <PayrollTabBar active="leader" />
    </HelpUiShell>
  ),
  'tl-badge-marketer-limited': () => (
    <HelpUiShell>
      <MarketerAdminLevelBadge level="LIMITED" />
    </HelpUiShell>
  ),
  'tl-badge-marketer-full': () => (
    <HelpUiShell>
      <MarketerAdminLevelBadge level="FULL" />
    </HelpUiShell>
  ),
  'tl-btn-dayoff-allow': () => (
    <HelpUiShell>
      <TeamLeaderDayOffBulkButton variant="allow" {...previewProps()} />
    </HelpUiShell>
  ),
  'tl-btn-dayoff-deny': () => (
    <HelpUiShell>
      <TeamLeaderDayOffBulkButton variant="deny" {...previewProps()} />
    </HelpUiShell>
  ),
};

export function HelpUiEmbed({ tokenId }: { tokenId: string }) {
  const render = HELP_UI_REGISTRY[tokenId as HelpUiTokenId];
  if (!render) {
    return (
      <span className="inline-flex rounded border border-dashed border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-800">
        UI:{tokenId}
      </span>
    );
  }
  return <>{render()}</>;
}
