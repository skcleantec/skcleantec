import type { ReactNode } from 'react';
import {
  OrderIssueHelpCopyLinkButton,
  OrderIssueHelpCopyMessageButton,
  OrderIssueHelpCreateButton,
  OrderIssueHelpCustomerSubmitButton,
  OrderIssueHelpEmailResendButton,
  OrderIssueHelpFieldLabel,
  OrderIssueHelpFormListStatusBadge,
  OrderIssueHelpInquiryStatusChip,
  OrderIssueHelpListFilterChip,
  OrderIssueHelpNewIssueButton,
  OrderIssueHelpPrefillButton,
  OrderIssueHelpPreviewLinkButton,
  OrderIssueHelpSideNavItem,
} from './OrderIssueHelpUiParts';

export type OrderIssueHelpActionRow = {
  sample: ReactNode;
  meaning: string;
  when?: string;
};

/** 발급 화면 상단 · 편집 영역 */
export const ORDER_ISSUE_SCREEN_ACTIONS: readonly OrderIssueHelpActionRow[] = [
  {
    sample: <OrderIssueHelpFieldLabel>발주서 양식</OrderIssueHelpFieldLabel>,
    meaning: '고객에게 보일 양식을 고릅니다. 「발주서 양식」 메뉴에서 미리 발행해야 합니다.',
  },
  {
    sample: <OrderIssueHelpFieldLabel>대기 접수 연결 (선택)</OrderIssueHelpFieldLabel>,
    meaning: '부재·보류·입금완료 등 기존 접수와 1:1로 연결합니다. 스케줄·접수 상세에서 발급하면 자동 선택됩니다.',
  },
  {
    sample: <OrderIssueHelpFieldLabel>영업 브랜드 *</OrderIssueHelpFieldLabel>,
    meaning: '고객 링크·발송 메시지에 쓰이는 브랜드입니다. 대기 접수 연결 시 접수 브랜드로 고정됩니다.',
  },
  {
    sample: <OrderIssueHelpFieldLabel>유입 경로 *</OrderIssueHelpFieldLabel>,
    meaning: '접수 source·광고 집계에 반영됩니다. 발급 전 반드시 선택합니다.',
  },
  {
    sample: <OrderIssueHelpCreateButton />,
    meaning:
      '상담 내용·금액을 입력한 뒤 누릅니다. 링크가 생성되고, 미리 채운 항목은 고객 화면에서 잠깁니다.',
    when: '발주서 편집 영역 하단',
  },
];

/** 발급 완료 카드 */
export const ORDER_ISSUE_COMPLETE_ACTIONS: readonly OrderIssueHelpActionRow[] = [
  {
    sample: <OrderIssueHelpCopyMessageButton />,
    meaning: '카카오톡·문자에 붙여 넣을 전체 문구를 복사합니다. 「고객링크설정」에서 문구를 바꿀 수 있습니다.',
  },
  {
    sample: <OrderIssueHelpCopyLinkButton />,
    meaning: '공개 발주서 URL만 복사합니다.',
  },
  {
    sample: <OrderIssueHelpPrefillButton />,
    meaning: '고객 대신 공개 폼에 입력합니다. 고객이 아직 제출하지 않았을 때만 사용합니다.',
  },
  {
    sample: <OrderIssueHelpNewIssueButton />,
    meaning: '같은 화면에서 다음 고객 발급을 시작합니다.',
  },
];

/** ② 마케터 필수 체크 — 버튼·UI와 연결 */
export const ORDER_ISSUE_MARKETER_ACTIONS: readonly OrderIssueHelpActionRow[] = [
  {
    sample: <OrderIssueHelpFieldLabel>발주서 양식</OrderIssueHelpFieldLabel>,
    meaning: '양식이 없으면 「발주서 양식」 메뉴에서 먼저 발행합니다.',
    when: '필수',
  },
  {
    sample: (
      <>
        <OrderIssueHelpFieldLabel>유입 경로 *</OrderIssueHelpFieldLabel>
        <OrderIssueHelpFieldLabel>영업 브랜드 *</OrderIssueHelpFieldLabel>
      </>
    ),
    meaning: '집계·브랜드 표시용 — 발급 전 선택 필수.',
    when: '필수',
  },
  {
    sample: <OrderIssueHelpFieldLabel>대기 접수 연결 (선택)</OrderIssueHelpFieldLabel>,
    meaning: '이미 등록한 대기·입금완료 건이 있으면 연결해 같은 줄로 이어갑니다.',
  },
  {
    sample: <OrderIssueHelpCreateButton />,
    meaning: '금액·상담 내용 입력 후 발급. 채운 항목은 고객에게 잠금.',
    when: '필수',
  },
  {
    sample: (
      <>
        <OrderIssueHelpCopyMessageButton />
        <OrderIssueHelpCopyLinkButton />
      </>
    ),
    meaning: '발급 직후 고객에게 링크를 보냅니다.',
    when: '필수',
  },
];

/** ③ 고객 작성 */
export const ORDER_ISSUE_CUSTOMER_ACTIONS: readonly OrderIssueHelpActionRow[] = [
  {
    sample: <OrderIssueHelpFieldLabel>비워 둔 항목</OrderIssueHelpFieldLabel>,
    meaning: '주소·평수·희망일·특이사항 등 마케터가 비운 칸은 고객이 공개 링크에서 직접 입력합니다.',
  },
  {
    sample: <span className="text-fluid-2xs text-slate-500">(잠금 · 회색 표시)</span>,
    meaning: '마케터가 미리 넣은 금액·이름 등은 고객이 수정할 수 없습니다.',
  },
  {
    sample: <OrderIssueHelpCustomerSubmitButton />,
    meaning: '고객이 내용 확인 후 누르면 발주서가 확정되고, 연결된 접수는 「예약완료」로 바뀝니다.',
    when: '고객 공개 화면 하단',
  },
  {
    sample: <OrderIssueHelpPreviewLinkButton>고객화면 미리보기 →</OrderIssueHelpPreviewLinkButton>,
    meaning: '마케터 메뉴 「고객화면 미리보기」에서 실제 고객 화면을 확인할 수 있습니다.',
  },
];

/** ④ 발급 후 */
export const ORDER_ISSUE_AFTER_ISSUE_ACTIONS: readonly OrderIssueHelpActionRow[] = [
  {
    sample: (
      <>
        <OrderIssueHelpCopyMessageButton />
        <OrderIssueHelpCopyLinkButton />
      </>
    ),
    meaning: '1단계 — 발급 완료 카드에서 고객에게 전달합니다.',
  },
  {
    sample: (
      <>
        <OrderIssueHelpSideNavItem label="발주서 목록" active />
        <OrderIssueHelpListFilterChip label="미제출" active />
      </>
    ),
    meaning: '2단계 — 발주서 목록에서 미제출 건을 추적합니다.',
  },
  {
    sample: <OrderIssueHelpInquiryStatusChip status="ORDER_FORM_PENDING" />,
    meaning: '서비스접수 목록 상단에도 「미제출」로 고정되어 팔로업하기 쉽습니다.',
  },
  {
    sample: <OrderIssueHelpPrefillButton />,
    meaning: '3단계 — 고객 연락이 어려우면 마케터가 「미리 작성」으로 대신 입력할 수 있습니다.',
  },
  {
    sample: <OrderIssueHelpInquiryStatusChip status="RECEIVED" />,
    meaning: '4단계 — 고객 제출 후 「예약완료」인지 확인하고 접수 상세에서 배정을 진행합니다.',
  },
];

/** ⑤ 제출 시 */
export const ORDER_ISSUE_ON_SUBMIT_ACTIONS: readonly OrderIssueHelpActionRow[] = [
  {
    sample: <OrderIssueHelpFormListStatusBadge submitted />,
    meaning: '발주서 목록 상태가 「제출완료」로 바뀝니다. 제출 시각이 기록됩니다.',
  },
  {
    sample: (
      <>
        <OrderIssueHelpInquiryStatusChip status="ORDER_FORM_PENDING" />
        <span className="text-fluid-2xs text-slate-400 px-1">→</span>
        <OrderIssueHelpInquiryStatusChip status="RECEIVED" />
      </>
    ),
    meaning: '연결된 접수가 「미제출」에서 「예약완료」로 전환됩니다.',
  },
  {
    sample: <OrderIssueHelpEmailResendButton />,
    meaning: '확인 메일 발송 실패 시 발주서 목록 「관리」에서 재발송합니다.',
    when: '제출완료 · 메일 미발송',
  },
  {
    sample: <OrderIssueHelpInquiryStatusChip status="ASSIGNED" />,
    meaning: '다음 — 접수 상세에서 팀장 배정 후 「분배완료」→ 현장 진행으로 이어집니다.',
  },
];
