/** 견적서 편집 도움말 — AdminQuotationEditorPage · QuotationHelpModal 공통 */

export type QuotationHelpTabId = 'create' | 'link' | 'receipt' | 'send';

export const QUOTATION_HELP_TABS: ReadonlyArray<{ id: QuotationHelpTabId; label: string }> = [
  { id: 'send', label: '① 고객 발송' },
  { id: 'create', label: '② 견적서 작성' },
  { id: 'link', label: '③ 고객 연결' },
  { id: 'receipt', label: '④ 영수증' },
];

export const QUOTATION_HELP_PAGE_OVERVIEW =
  '견적서·영수증은 A4 양식에 바로 입력합니다. 저장 후 PDF 미리보기·다운로드·이메일(PDF 첨부) 발송이 가능합니다.';

export const QUOTATION_HELP_CAPTION =
  '실제 「새 견적서」 편집 화면과 동일한 A4 양식입니다. 「크게 보기」로 확대할 수 있습니다.';

/** ④ 고객 발송 — 단계 노드 */
export type QuotationSendFlowNode = {
  id: string;
  title: string;
  subtitle?: string;
  tone: 'slate' | 'indigo' | 'emerald' | 'sky';
};

export const QUOTATION_SEND_FLOW_NODES: readonly QuotationSendFlowNode[] = [
  { id: 'edit', title: '양식 입력', subtitle: '고객·품목·금액', tone: 'slate' },
  { id: 'save', title: '저장', subtitle: '견적 번호 생성', tone: 'slate' },
  { id: 'finalize', title: '확정 저장', subtitle: '발송 준비(선택)', tone: 'indigo' },
  { id: 'pdf', title: 'PDF 확인', subtitle: '미리보기·다운로드', tone: 'sky' },
  { id: 'email', title: 'PDF 첨부 발송', subtitle: '고객 이메일', tone: 'emerald' },
  { id: 'sent', title: '발송됨', subtitle: '상태 · 이력', tone: 'emerald' },
];
