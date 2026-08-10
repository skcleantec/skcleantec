import {
  MARKETPLACE_LEGAL_NOTICE,
  MARKETPLACE_RECEIVE_TAB_OPTIONS,
  MARKETPLACE_SHARE_TAB_OPTIONS,
  MARKETPLACE_SIDE_OPTIONS,
  marketplaceHintForAdminTab,
} from '../../../utils/dbMarketplaceNav';
import { MARKETPLACE_STATUS_LABEL } from '../../db-marketplace/marketplaceUiParts';

/** 정보공유 도움말 — AdminDbMarketplacePage 공통 */

export type DbMarketplaceHelpTabId = 'receive' | 'share' | 'status';

export const DB_MARKETPLACE_HELP_TABS: ReadonlyArray<{ id: DbMarketplaceHelpTabId; label: string }> = [
  { id: 'receive', label: '① 정보 받기' },
  { id: 'share', label: '② 정보 공유하기' },
  { id: 'status', label: '③ 상태·주의' },
];

export const DB_MARKETPLACE_HELP_PAGE_OVERVIEW =
  '협력 업체 간 접수·일정 정보를 공유·인계하는 화면입니다. 위쪽 「공유」는 내 접수를 내보내는 쪽, 「받기」는 다른 업체 접수를 가져오는 쪽입니다.';

export const DB_MARKETPLACE_HELP_CAPTION =
  '실제 「정보공유」 화면과 같은 구분·탭입니다. 「크게 보기」로 확대할 수 있습니다.';

export const DB_MARKETPLACE_HELP_INQUIRY_DETAIL_CAPTION =
  '접수 상세 「4. 정산 · 옵션」 안 정보공유 블록입니다. 서비스접수·스케줄 접수 수정 화면과 동일합니다.';

export const DB_MARKETPLACE_HELP_SCHEDULE_CAPTION =
  '공유 등록된 접수는 스케줄 하단 「정보공유」 구역에 별도로 모입니다. 팀장 미배정·자사 TO 집계에는 포함되지 않습니다. 「크게 보기」로 확대할 수 있습니다.';

export const DB_MARKETPLACE_LEGAL_NOTICE = MARKETPLACE_LEGAL_NOTICE;

export const DB_MARKETPLACE_SHARE_TABS = MARKETPLACE_SHARE_TAB_OPTIONS;
export const DB_MARKETPLACE_RECEIVE_TABS = MARKETPLACE_RECEIVE_TAB_OPTIONS;
export const DB_MARKETPLACE_SIDE_OPTIONS = MARKETPLACE_SIDE_OPTIONS;

export function dbMarketplaceHelpHint(side: 'share' | 'receive', tab: string): string {
  if (side === 'share') {
    return marketplaceHintForAdminTab('share', tab as 'draft' | 'open' | 'pending' | 'done');
  }
  return marketplaceHintForAdminTab('receive', tab as 'browse' | 'pending' | 'done');
}

export const DB_MARKETPLACE_STATUS_ROWS: ReadonlyArray<{ label: string; meaning: string }> = [
  { label: MARKETPLACE_STATUS_LABEL.DRAFT, meaning: '공유 준비 — 수수료·노출 대상을 정한 뒤 아직 게시하지 않은 상태입니다.' },
  { label: MARKETPLACE_STATUS_LABEL.OPEN, meaning: '공유 중 — 선택한 업체에 접수 요약이 노출됩니다. 연락처는 아직 숨겨집니다.' },
  { label: MARKETPLACE_STATUS_LABEL.PENDING_SELLER, meaning: '인계 대기 — 인수 업체가 신청했습니다. 공유 측에서 인계 확정 또는 신청 거절을 선택합니다.' },
  { label: MARKETPLACE_STATUS_LABEL.CONFIRMED, meaning: '인계·인수 완료 — 연락처 등 상세 정보가 공개되었습니다.' },
  { label: MARKETPLACE_STATUS_LABEL.WITHDRAWN, meaning: '철회 — 공유를 중단한 상태입니다. 다시 공유 준비로 되돌릴 수 있습니다.' },
  { label: MARKETPLACE_STATUS_LABEL.EXPIRED, meaning: '만료 — 기한이 지난 공유입니다. 「다시 공유」로 재게시할 수 있습니다.' },
];

export const DB_MARKETPLACE_CAUTION_ITEMS: readonly string[] = [
  '인계 확정 후에는 취소·환불할 수 없습니다. 인수 신청·인계 확정 전에 수수료·일정을 꼭 확인하세요.',
  '인수 신청 전에는 지역·일정·표시 금액만 보입니다. 연락처·주소 전체는 인계 확정 후에 열립니다.',
  '인수 전 문의에는 전화·이메일·주소를 직접 적지 마세요. 질문·답변만 남기면 됩니다.',
  '순위 노출 설정 시 1순위 업체가 거절하면 다음 순위로 넘어갑니다. 3순위까지 거절되면 공유 준비로 돌아갑니다.',
  '재공유(연쇄 공유) 건은 앞선 공유 수수료가 합산되어 표시됩니다.',
  '청소비서는 거래 당사자·개인정보 매매 중개자가 아닙니다. 정보주체 동의 등 관련 법령 준수는 각 회원사 책임입니다.',
];
