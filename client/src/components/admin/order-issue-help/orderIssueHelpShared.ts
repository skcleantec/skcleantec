/** 발주서 발급 도움말 — AdminOrderFormPage · OrderIssueHelpModal 공통 */

export type OrderIssueHelpTabId =
  | 'flow'
  | 'marketer'
  | 'customer'
  | 'after-issue'
  | 'on-submit';

export const ORDER_ISSUE_HELP_TABS: ReadonlyArray<{ id: OrderIssueHelpTabId; label: string }> = [
  { id: 'flow', label: '① 전체 흐름' },
  { id: 'marketer', label: '② 마케터 필수' },
  { id: 'customer', label: '③ 고객 작성' },
  { id: 'after-issue', label: '④ 발급 후' },
  { id: 'on-submit', label: '⑤ 제출 시' },
];

export const ORDER_ISSUE_PAGE_OVERVIEW =
  '발주서는 고객에게 보내는 온라인 확인·작성 폼입니다. 링크만 보내면 접수가 완료되지 않으며, 고객이 제출해야 서비스접수 목록에서 「예약완료」로 이어집니다.';

/** 전체 진행 흐름 — 노드 */
export type OrderIssueFlowNode = {
  id: string;
  title: string;
  subtitle?: string;
  tone: 'slate' | 'sky' | 'amber' | 'emerald' | 'violet';
};

export const ORDER_ISSUE_FLOW_NODES: readonly OrderIssueFlowNode[] = [
  { id: 'intake', title: '유입 · 대기 등록', subtitle: '전화·부재·보류·입금대기', tone: 'slate' },
  { id: 'issue', title: '발주서 발급', subtitle: '양식·금액·링크 생성', tone: 'sky' },
  { id: 'send', title: '고객 발송', subtitle: '카카오·문자 링크', tone: 'sky' },
  { id: 'pending', title: '미제출', subtitle: '목록 상단 고정 · 팔로업', tone: 'amber' },
  { id: 'customer', title: '고객 작성·제출', subtitle: '공개 발주서 폼', tone: 'violet' },
  { id: 'received', title: '예약완료', subtitle: '서비스접수 RECEIVED', tone: 'emerald' },
  { id: 'assign', title: '팀장 배정', subtitle: '분배완료', tone: 'emerald' },
  { id: 'work', title: '현장 · 완료', subtitle: '진행중 → 완료', tone: 'slate' },
];

export const ORDER_ISSUE_HELP_CAPTION =
  '데모 데이터(○○·마스킹) 화면 예시입니다. 「크게 보기」로 확대할 수 있습니다.';
