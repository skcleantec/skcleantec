import type { DbMarketplaceListTab } from '../api/dbMarketplace';
import type { TeamDbMarketplaceListTab } from '../api/dbMarketplace';

export type MarketplaceSide = 'share' | 'receive';

export type MarketplaceShareUiTab = 'draft' | 'open' | 'pending' | 'done';
export type MarketplaceReceiveUiTab = 'browse' | 'pending' | 'done';
export type MarketplaceAdminUiTab = MarketplaceShareUiTab | MarketplaceReceiveUiTab;

export type MarketplaceTabOption<T extends string = string> = {
  id: T;
  shortLabel: string;
  longLabel: string;
};

export const MARKETPLACE_SIDE_OPTIONS: MarketplaceTabOption<MarketplaceSide>[] = [
  { id: 'share', shortLabel: '공유', longLabel: '내가 공유하는 접수' },
  { id: 'receive', shortLabel: '받기', longLabel: '받을 수 있는 접수' },
];

export const MARKETPLACE_SHARE_TAB_OPTIONS: MarketplaceTabOption<MarketplaceShareUiTab>[] = [
  { id: 'draft', shortLabel: '준비', longLabel: '공유 준비' },
  { id: 'open', shortLabel: '공유중', longLabel: '공유 중' },
  { id: 'pending', shortLabel: '대기', longLabel: '인계 대기' },
  { id: 'done', shortLabel: '완료', longLabel: '인계 완료' },
];

export const MARKETPLACE_RECEIVE_TAB_OPTIONS: MarketplaceTabOption<MarketplaceReceiveUiTab>[] = [
  { id: 'browse', shortLabel: '목록', longLabel: '받을 목록' },
  { id: 'pending', shortLabel: '진행', longLabel: '인수 진행' },
  { id: 'done', shortLabel: '완료', longLabel: '인수 완료' },
];

export const MARKETPLACE_TEAM_TAB_OPTIONS: MarketplaceTabOption<TeamDbMarketplaceListTab>[] = [
  { id: 'browse', shortLabel: '목록', longLabel: '받을 목록' },
  { id: 'pending', shortLabel: '진행', longLabel: '인수 진행' },
  { id: 'done', shortLabel: '완료', longLabel: '인수 완료' },
];

/** 정보공유 화면 제목 아래 고정 — 회원약관 제4조·플랫폼 비당사자와 정합 */
export const MARKETPLACE_LEGAL_NOTICE =
  '협력 업체 간 접수·일정 정보를 공유·인계하는 기능입니다. 청소비서는 거래 당사자·개인정보 매매 중개자가 아니며, 인계 확정 전에는 연락처 등 일부 정보만 제한적으로 표시됩니다. 정보주체 동의 등 관련 법령 준수는 각 회원사 책임입니다.';

/** 팀장(인수 측) 화면 — receive 전용 축약 */
export const MARKETPLACE_LEGAL_NOTICE_TEAM =
  '협력 업체가 공유한 접수를 인수·확인하는 화면입니다. 인계 확정 전에는 연락처 등 일부 정보만 제한적으로 표시되며, 개인정보 이전·동의 등 관련 법령 준수는 각 회원사 책임입니다.';

const LEGACY_ADMIN_TABS = new Set(['cart', 'available', 'my_sales', 'pending', 'confirmed']);

export function parseMarketplaceSide(raw: string | null): MarketplaceSide {
  return raw === 'receive' ? 'receive' : 'share';
}

export function parseMarketplaceAdminUiTab(
  side: MarketplaceSide,
  raw: string | null,
): MarketplaceAdminUiTab {
  if (side === 'receive') {
    if (raw === 'pending' || raw === 'done') return raw;
    return 'browse';
  }
  if (raw === 'open' || raw === 'pending' || raw === 'done') return raw;
  return 'draft';
}

export function adminUiTabToApiTab(
  side: MarketplaceSide,
  uiTab: MarketplaceAdminUiTab,
): DbMarketplaceListTab {
  if (side === 'share') {
    switch (uiTab as MarketplaceShareUiTab) {
      case 'draft':
        return 'cart';
      case 'open':
        return 'share_open';
      case 'pending':
        return 'pending_out';
      case 'done':
        return 'confirmed_share';
      default:
        return 'cart';
    }
  }
  switch (uiTab as MarketplaceReceiveUiTab) {
    case 'browse':
      return 'available';
    case 'pending':
      return 'pending_in';
    case 'done':
      return 'confirmed_receive';
    default:
      return 'available';
  }
}

export function teamUiTabToApiTab(tab: TeamDbMarketplaceListTab): DbMarketplaceListTab {
  switch (tab) {
    case 'browse':
      return 'available';
    case 'pending':
      return 'pending_in';
    case 'done':
      return 'confirmed_receive';
  }
}

/** 레거시 ?tab=cart 등 → side + uiTab */
export function legacyAdminTabToNav(
  legacyTab: string | null,
): { side: MarketplaceSide; uiTab: MarketplaceAdminUiTab } | null {
  if (!legacyTab || !LEGACY_ADMIN_TABS.has(legacyTab)) return null;
  switch (legacyTab) {
    case 'cart':
      return { side: 'share', uiTab: 'draft' };
    case 'my_sales':
      return { side: 'share', uiTab: 'open' };
    case 'available':
      return { side: 'receive', uiTab: 'browse' };
    case 'pending':
      return { side: 'share', uiTab: 'pending' };
    case 'confirmed':
      return { side: 'share', uiTab: 'done' };
    default:
      return null;
  }
}

export function marketplaceAdminTabsForSide(
  side: MarketplaceSide,
): MarketplaceTabOption<MarketplaceAdminUiTab>[] {
  return side === 'share'
    ? MARKETPLACE_SHARE_TAB_OPTIONS
    : MARKETPLACE_RECEIVE_TAB_OPTIONS;
}

export function marketplaceHintForAdminTab(
  side: MarketplaceSide,
  uiTab: MarketplaceAdminUiTab,
): string {
  if (side === 'share') {
    switch (uiTab as MarketplaceShareUiTab) {
      case 'draft':
        return '공유 등록 후 노출 업체를 지정해 게시합니다.';
      case 'open':
        return '다른 업체에 공개 중인 접수입니다.';
      case 'pending':
        return '인수 신청을 받았습니다. 인계 확정 시 연락처가 공개됩니다.';
      default:
        return '인계가 완료된 접수입니다.';
    }
  }
  switch (uiTab as MarketplaceReceiveUiTab) {
    case 'browse':
      return '인수 신청 전에는 지역·일정·표시금액만 보입니다.';
    case 'pending':
      return '인수 신청 후 상대 업체의 인계 확정을 기다립니다.';
    default:
      return '인수가 완료되어 연락처 등 상세 정보를 볼 수 있습니다.';
  }
}

export function marketplaceEmptyTitle(
  side: MarketplaceSide,
  uiTab: MarketplaceAdminUiTab,
): string {
  if (side === 'share' && uiTab === 'draft') return '공유 준비 중인 접수가 없습니다';
  if (side === 'receive' && uiTab === 'browse') return '받을 수 있는 접수가 없습니다';
  const tabOpt = marketplaceAdminTabsForSide(side).find((t) => t.id === uiTab);
  return `${tabOpt?.longLabel ?? '항목'}이 없습니다`;
}

export function adminTabUsesListFilters(apiTab: DbMarketplaceListTab): boolean {
  return apiTab === 'cart' || apiTab === 'share_open' || apiTab === 'confirmed_share';
}

export function teamTabUsesListFilters(_tab: TeamDbMarketplaceListTab): boolean {
  return false;
}

export function parseTeamUiTab(raw: string | null): TeamDbMarketplaceListTab {
  if (raw === 'pending' || raw === 'done') return raw;
  if (raw === 'browse' || raw === 'available') return 'browse';
  if (raw === 'confirmed') return 'done';
  return 'browse';
}

/** 레거시 ?tab=available|confirmed → browse|done */
export function legacyTeamTabRedirect(raw: string | null): TeamDbMarketplaceListTab | null {
  if (raw === 'available') return 'browse';
  if (raw === 'confirmed') return 'done';
  return null;
}

export function marketplaceHintForTeamTab(tab: TeamDbMarketplaceListTab): string {
  return marketplaceHintForAdminTab('receive', tab);
}

export function marketplaceEmptyTitleForTeam(tab: TeamDbMarketplaceListTab): string {
  if (tab === 'browse') return '받을 수 있는 접수가 없습니다';
  const tabOpt = MARKETPLACE_TEAM_TAB_OPTIONS.find((t) => t.id === tab);
  return `${tabOpt?.longLabel ?? '항목'}이 없습니다`;
}
