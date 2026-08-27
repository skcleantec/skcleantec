import type { ReactNode } from 'react';
import { HelpUiEmbed } from '../../help/ui/helpUiRegistry';
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

export type DbMarketplaceHelpActionRow = {
  sample: ReactNode;
  meaning: string;
  when?: string;
};

/** ① 정보 받기 */
export const DB_MARKETPLACE_RECEIVE_ACTIONS: readonly DbMarketplaceHelpActionRow[] = [
  {
    sample: <span className="rounded-md bg-sky-700 px-2.5 py-1 text-[12px] font-semibold text-white">받기</span>,
    meaning: '화면 상단 구분을 「받기」로 두면 다른 업체가 공유한 접수를 찾습니다.',
    when: '상단 구분',
  },
  {
    sample: <span className="rounded-md border border-gray-200 bg-white px-2 py-1 text-[11px] font-medium">목록</span>,
    meaning: '받을 수 있는 공유 접수 목록입니다. 인수 신청 전에는 지역·일정·표시 금액만 보입니다.',
    when: '받기 · 목록 탭',
  },
  {
    sample: <DbMarketplaceBuyBulkButton disabled />,
    meaning:
      '목록에서 체크 후 「인수 신청」을 누르면 상대 업체에 인수 의사가 전달됩니다. 한 건은 행을 눌러 상세에서도 신청할 수 있습니다.',
    when: '받을 목록 · 일괄 선택',
  },
  {
    sample: <span className="rounded-md border border-gray-200 bg-white px-2 py-1 text-[11px] font-medium">진행</span>,
    meaning: '인수 신청을 보낸 뒤 상대 업체의 「인계 확정」을 기다리는 접수입니다.',
    when: '받기 · 진행 탭',
  },
  {
    sample: <span className="rounded-md border border-gray-200 bg-white px-2 py-1 text-[11px] font-medium">완료</span>,
    meaning: '인수가 완료되어 연락처·주소 등 전체 정보와 연결된 접수를 볼 수 있습니다.',
    when: '받기 · 완료 탭',
  },
  {
    sample: (
      <span className="rounded-lg bg-slate-900 px-2.5 py-1 text-[12px] font-medium text-white pointer-events-none">
        인수 신청
      </span>
    ),
    meaning:
      '상세 화면에서도 동일하게 신청할 수 있습니다. 확인 창에서 「상대 업체가 인계 확정하면 연락처 등 전체 정보가 공개됩니다」 안내를 확인하세요.',
    when: '정보공유 상세',
  },
  {
    sample: (
      <span className="rounded-lg border border-amber-300 px-2.5 py-1 text-[12px] font-medium text-amber-900 pointer-events-none">
        거절하기
      </span>
    ),
    meaning:
      '순위 노출 건에서 내 차례일 때 인수하지 않으려면 거절합니다. 다음 순위 업체에게 넘어갑니다.',
    when: '순위 노출 · 받을 목록',
  },
];

/** 접수 상세 — 정보공유 블록 (4. 정산 · 옵션) */
export const DB_MARKETPLACE_INQUIRY_DETAIL_ACTIONS: readonly DbMarketplaceHelpActionRow[] = [
  {
    sample: (
      <span className="rounded-lg border border-violet-200 bg-violet-50/50 px-2 py-1 text-[11px] font-semibold text-violet-950">
        정보공유 — 공유 등록
      </span>
    ),
    meaning:
      '서비스접수 목록·스케줄에서 접수를 연 뒤 「4. 정산 · 옵션」 아래 보라색 블록입니다. 타업체 담당·파트너 직접 연계와 동시에 쓸 수 없습니다.',
    when: '접수 상세 · 스케줄 접수 수정',
  },
  {
    sample: (
      <span className="rounded-md border border-gray-300 bg-white px-2 py-1 text-[11px] text-slate-800 pointer-events-none">
        수수료 (원)
      </span>
    ),
    meaning:
      '인수 업체에 보이는 정보공유 수수료입니다. 재공유 건은 앞선 공유 수수료가 자동 합산되며, 이번에 추가로 받을 금액만 입력합니다.',
    when: '정보공유 블록',
  },
  {
    sample: <DbMarketplaceCartAddButton disabled />,
    meaning: '수수료 입력 후 누르면 「정보공유」 메뉴 공유·준비 탭에 쌓입니다. 게시 전까지는 상대 업체에 보이지 않습니다.',
    when: '정보공유 블록',
  },
  {
    sample: (
      <span className="rounded-md border border-violet-300 bg-white px-2 py-1 text-[12px] font-medium text-violet-900 pointer-events-none">
        노출 대상
      </span>
    ),
    meaning: '파트너·타업체 중 누구에게 보일지, 전체/선택, 동시/순위 노출을 정합니다.',
    when: '공유 준비 후',
  },
  {
    sample: (
      <span className="rounded-md bg-slate-900 px-2 py-1 text-[12px] font-medium text-white pointer-events-none">
        정보공유 게시
      </span>
    ),
    meaning: '노출 대상에 접수가 공개됩니다. 「정보공유」 메뉴 공유·공유중 탭에서도 확인할 수 있습니다.',
    when: '공유 준비(DRAFT) · 만료(EXPIRED)',
  },
  {
    sample: (
      <span className="rounded-md border border-gray-300 bg-white px-2 py-1 text-[12px] text-gray-700 pointer-events-none">
        공유 철회
      </span>
    ),
    meaning: '공유 중인 접수를 목록에서 내립니다. 이후 공유 준비로 되돌릴 수 있습니다.',
    when: '공유 중(OPEN)',
  },
  {
    sample: (
      <>
        <span className="rounded-md bg-slate-900 px-2 py-1 text-[12px] font-medium text-white pointer-events-none">
          인계 확정
        </span>
        <span className="rounded-md border border-amber-300 bg-white px-2 py-1 text-[12px] text-amber-900 pointer-events-none">
          인수 신청 거절
        </span>
      </>
    ),
    meaning: '인수 신청이 오면 접수 상세·정보공유 대기 탭에서 처리합니다. 확정 후 취소는 불가합니다.',
    when: '인계 대기',
  },
  {
    sample: <HelpUiEmbed tokenId="schedule-marketplace-cart" />,
    meaning:
      '공유 등록 후 접수 헤더·스케줄·목록에 카트 아이콘이 붙습니다. 마우스를 올리면 준비·공유중·인계대기·완료 단계가 표시됩니다.',
    when: '공유 준비 이후',
  },
  {
    sample: (
      <span className="text-[11px] font-medium text-sky-800 underline pointer-events-none">
        스케줄에서 접수 보기
      </span>
    ),
    meaning: '해당 접수가 잡혀 있는 스케줄 날짜로 이동합니다. 정보공유 구역에서 같은 접수를 찾을 수 있습니다.',
    when: '정보공유 블록 · 상세',
  },
];

/** ② 정보 공유하기 */
export const DB_MARKETPLACE_SHARE_ACTIONS: readonly DbMarketplaceHelpActionRow[] = [
  {
    sample: <span className="rounded-md bg-violet-700 px-2.5 py-1 text-[12px] font-semibold text-white">공유</span>,
    meaning: '내가 공유하는 접수를 관리하는 구분입니다.',
    when: '상단 구분',
  },
  {
    sample: <DbMarketplaceCartAddButton disabled />,
    meaning:
      '서비스접수·스케줄 접수 수정 화면 「정보공유」 섹션에서 수수료를 입력하고 「공유 준비」를 누르면 이 탭에 쌓입니다.',
    when: '접수 수정 · 정보공유 섹션',
  },
  {
    sample: (
      <span className="rounded-md border border-violet-300 bg-white px-2 py-1 text-[12px] font-medium text-violet-900 pointer-events-none">
        노출 대상
      </span>
    ),
    meaning:
      '파트너 업체·타업체 중 누구에게 보일지, 전체 공개인지, 동시 노출인지 순위 노출인지 정합니다. 접수 수정·일괄 게시 모두에서 설정합니다.',
    when: '접수 수정 · 공유 준비 탭 · 일괄 게시',
  },
  {
    sample: <DbMarketplacePublishBulkButton disabled />,
    meaning:
      '공유 준비 탭에서 여러 건을 선택한 뒤 노출 대상을 확인하고 게시합니다. 접수 수정에서 「정보공유 게시」로 한 건만 바로 올릴 수도 있습니다.',
    when: '공유 · 준비 탭',
  },
  {
    sample: <DbMarketplaceRevertBulkButton disabled />,
    meaning: '공유 준비에서 빼고 접수를 원래 상태로 되돌립니다. 아직 게시하지 않은 건만 해당됩니다.',
    when: '공유 · 준비 탭',
  },
  {
    sample: <span className="rounded-md border border-gray-200 bg-white px-2 py-1 text-[11px] font-medium">공유중</span>,
    meaning: '다른 업체에 공개 중인 접수입니다. 「공유 준비로」 되돌리거나 「공유 철회」할 수 있습니다.',
    when: '공유 · 공유중 탭',
  },
  {
    sample: <DbMarketplaceRevertToCartButton disabled />,
    meaning: '공유를 중단하고 공유 준비 상태로 되돌립니다. 노출 업체 설정은 유지됩니다.',
    when: '공유 · 공유중 탭',
  },
  {
    sample: <span className="rounded-md border border-gray-200 bg-white px-2 py-1 text-[11px] font-medium">대기</span>,
    meaning: '인수 업체가 신청한 접수입니다. 아래 「인계 확정」 또는 「신청 거절」을 선택합니다.',
    when: '공유 · 대기 탭',
  },
  {
    sample: (
      <>
        <DbMarketplaceConfirmBulkButton disabled />
        <DbMarketplaceDeclineBulkButton disabled />
      </>
    ),
    meaning:
      '「인계 확정」 시 연락처가 공개되고 인수 업체 접수가 생성될 수 있습니다. 확정 후 취소는 불가합니다. 「신청 거절」은 다시 공유 중으로 되돌립니다.',
    when: '공유 · 대기 탭 · 상세',
  },
  {
    sample: <DbMarketplaceStatusBadge status="CONFIRMED" compact />,
    meaning: '인계가 끝난 접수입니다. 공유 접수·인수 접수를 각각 열어 볼 수 있습니다.',
    when: '공유 · 완료 탭',
  },
];
