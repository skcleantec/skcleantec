import { useState } from 'react';
import type { MarketplaceAdminUiTab } from '../../../utils/dbMarketplaceNav';
import {
  DbMarketplaceHintBanner,
  DbMarketplaceLegalNotice,
  DbMarketplaceSideSegment,
  DbMarketplaceTabBar,
} from '../../db-marketplace/DbMarketplaceListUi';
import { DbMarketplaceStatusBadge } from '../../db-marketplace/marketplaceUiParts';
import { InquiryHelpZoomableFigure } from '../inquiry-help/InquiryHelpZoomableFigure';
import {
  DB_MARKETPLACE_HELP_CAPTION,
  DB_MARKETPLACE_LEGAL_NOTICE,
  DB_MARKETPLACE_RECEIVE_TABS,
  DB_MARKETPLACE_SHARE_TABS,
  DB_MARKETPLACE_SIDE_OPTIONS,
  dbMarketplaceHelpHint,
} from './dbMarketplaceHelpShared';

type Props = {
  side: 'share' | 'receive';
};

function DbMarketplaceHelpPageMock({ side }: Props) {
  const defaultTab: MarketplaceAdminUiTab = side === 'share' ? 'draft' : 'browse';
  const [uiTab, setUiTab] = useState<MarketplaceAdminUiTab>(defaultTab);

  const tabOptions =
    side === 'share'
      ? DB_MARKETPLACE_SHARE_TABS.map((t) => ({
          ...t,
          badge: t.id === 'pending' ? 2 : t.id === 'draft' ? 1 : undefined,
        }))
      : DB_MARKETPLACE_RECEIVE_TABS.map((t) => ({
          ...t,
          badge: t.id === 'browse' ? 5 : undefined,
        }));

  return (
    <div className="space-y-2 bg-[#edf0f5] p-2 sm:p-3">
      <div className="flex min-w-0 items-center gap-1">
        <h2 className="truncate text-fluid-base font-semibold text-slate-900 sm:text-fluid-lg">정보공유</h2>
      </div>
      <DbMarketplaceLegalNotice text={DB_MARKETPLACE_LEGAL_NOTICE} />
      <DbMarketplaceSideSegment
        options={DB_MARKETPLACE_SIDE_OPTIONS.map((o) => ({
          ...o,
          badge: o.id === side ? (side === 'share' ? 3 : 5) : undefined,
        }))}
        active={side}
        onChange={() => {}}
      />
      <DbMarketplaceTabBar options={tabOptions} active={uiTab} onChange={setUiTab} />
      <DbMarketplaceHintBanner text={dbMarketplaceHelpHint(side, uiTab)} />
      <div className="rounded-xl border border-gray-200 bg-white p-2 shadow-sm">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 space-y-0.5">
            <p className="truncate text-fluid-xs font-medium text-slate-900">김○○ · 입주청소</p>
            <p className="text-fluid-2xs text-slate-500">경기 성남 · 2026-03-15 AM</p>
          </div>
          <DbMarketplaceStatusBadge
            status={side === 'share' ? (uiTab === 'pending' ? 'PENDING_SELLER' : 'DRAFT') : 'OPEN'}
            compact
          />
        </div>
        <p className="mt-1.5 text-fluid-2xs text-slate-600">
          {side === 'receive'
            ? '표시 금액 150,000원 · 연락처는 인계 확정 후 공개'
            : '정보공유 수수료 50,000원 · 노출 2개 업체'}
        </p>
      </div>
    </div>
  );
}

/** 정보공유 화면 구조 미리보기 */
export function DbMarketplaceHelpPageFigure({ side }: Props) {
  return (
    <InquiryHelpZoomableFigure
      caption={DB_MARKETPLACE_HELP_CAPTION}
      zoomContent={<DbMarketplaceHelpPageMock side={side} />}
    >
      <DbMarketplaceHelpPageMock side={side} />
    </InquiryHelpZoomableFigure>
  );
}
