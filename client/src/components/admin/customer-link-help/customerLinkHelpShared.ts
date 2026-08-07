/** 고객링크설정 도움말 — AdminOrderFormCustomerLinkSettingsPage 공통 */

export type CustomerLinkHelpTabId = 'edit' | 'placeholders' | 'caution';

export const CUSTOMER_LINK_HELP_TABS: ReadonlyArray<{ id: CustomerLinkHelpTabId; label: string }> = [
  { id: 'edit', label: '① 편집 방법' },
  { id: 'placeholders', label: '② 치환코드' },
  { id: 'caution', label: '③ 주의할 점' },
];

export const CUSTOMER_LINK_HELP_PAGE_OVERVIEW =
  '발주서 발급·목록에서 「메시지 복사」할 때 고객에게 붙여 넣는 안내 문구를, 영업 브랜드별로 한 칸에서 편집합니다.';

export const CUSTOMER_LINK_HELP_CAPTION =
  '실제 「고객링크설정」 화면과 동일한 편집 영역입니다. 「크게 보기」로 확대할 수 있습니다.';

/** 치환코드 설명 — shared/orderFormCustomerLinkPlaceholders.ts 와 동기 */
export const CUSTOMER_LINK_PLACEHOLDER_INTRO =
  '치환코드는 발급·복사할 때 자동으로 바뀌는 값입니다. 「청소일시:」「페이백 신청:」 같은 글자는 치환코드가 아니라 본문에서 직접 수정하세요.';

export const CUSTOMER_LINK_COMPOSITE_WARNING =
  '「통째 치환」은 문장 전체가 한 번에 들어갑니다. 라벨(앞글자)을 바꾸기 어려우므로, 가능하면 {{date}}·{{paybackLink}}처럼 값만 치환하는 방식을 권장합니다.';
