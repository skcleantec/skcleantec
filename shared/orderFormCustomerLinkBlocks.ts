/** 고객 링크 안내 메시지 — 조립 블록 (순서 저장·미리보기 편집 공통) */

export const ORDER_FORM_CUSTOMER_LINK_BLOCK_IDS = [
  'title',
  'total',
  'balance',
  'review',
  'schedule',
  'timeDetail',
  'optionNote',
  'order',
  'cs',
  'payback',
  'footer1',
  'footer2',
] as const;

export type OrderFormCustomerLinkBlockId = (typeof ORDER_FORM_CUSTOMER_LINK_BLOCK_IDS)[number];

/** 현재 하드코딩 조립과 동일한 기본 순서 */
export const ORDER_FORM_CUSTOMER_LINK_BLOCK_ORDER_DEFAULT: readonly OrderFormCustomerLinkBlockId[] = [
  'title',
  'total',
  'balance',
  'review',
  'schedule',
  'timeDetail',
  'optionNote',
  'order',
  'cs',
  'payback',
  'footer1',
  'footer2',
];

export type OrderFormCustomerLinkBlockMeta = {
  id: OrderFormCustomerLinkBlockId;
  label: string;
  /** 미리보기에서 문구 편집 가능 */
  editable: boolean;
  /** 줄 단위(\n) vs 섹션(\n\n) */
  spacing: 'line' | 'section';
  hint?: string;
};

export const ORDER_FORM_CUSTOMER_LINK_BLOCK_META: Record<
  OrderFormCustomerLinkBlockId,
  OrderFormCustomerLinkBlockMeta
> = {
  title: {
    id: 'title',
    label: '제목',
    editable: true,
    spacing: 'section',
    hint: '브랜드가 있으면 발송 시 첫 줄이 「브랜드명 발주서」로 보일 수 있습니다.',
  },
  total: { id: 'total', label: '총액 줄', editable: true, spacing: 'line' },
  balance: { id: 'balance', label: '잔금·예약금 줄', editable: true, spacing: 'line' },
  review: {
    id: 'review',
    label: '리뷰 이벤트',
    editable: true,
    spacing: 'line',
    hint: '비우면 메시지에서 숨깁니다.',
  },
  schedule: { id: 'schedule', label: '청소일시 줄', editable: true, spacing: 'line' },
  timeDetail: { id: 'timeDetail', label: '희망 시각 줄', editable: true, spacing: 'line' },
  optionNote: {
    id: 'optionNote',
    label: '옵션·특이사항',
    editable: false,
    spacing: 'line',
    hint: '발급 건에 옵션 메모가 있을 때만 자동으로 들어갑니다.',
  },
  order: {
    id: 'order',
    label: '발주서 링크',
    editable: true,
    spacing: 'section',
    hint: '안내 문구 다음 줄에 발주서 URL이 자동으로 붙습니다.',
  },
  cs: {
    id: 'cs',
    label: 'C/S 신고',
    editable: true,
    spacing: 'section',
    hint: '안내·라벨 다음 줄에 C/S URL이 자동으로 붙습니다.',
  },
  payback: {
    id: 'payback',
    label: '페이백 안내',
    editable: true,
    spacing: 'section',
    hint: '페이백 토큰이 있는 발급 건에만 표시됩니다.',
  },
  footer1: { id: 'footer1', label: '하단 안내 1', editable: true, spacing: 'line' },
  footer2: { id: 'footer2', label: '하단 안내 2', editable: true, spacing: 'line' },
};

const BLOCK_ID_SET = new Set<string>(ORDER_FORM_CUSTOMER_LINK_BLOCK_IDS);

export function isOrderFormCustomerLinkBlockId(v: unknown): v is OrderFormCustomerLinkBlockId {
  return typeof v === 'string' && BLOCK_ID_SET.has(v);
}

/** DB/API 값 → 유효한 전체 순서 (누락·중복 보정, 알 수 없는 id 무시) */
export function normalizeCustomerLinkBlockOrder(
  raw: unknown,
): OrderFormCustomerLinkBlockId[] {
  const seen = new Set<OrderFormCustomerLinkBlockId>();
  const out: OrderFormCustomerLinkBlockId[] = [];
  const list = Array.isArray(raw) ? raw : [];
  for (const item of list) {
    if (!isOrderFormCustomerLinkBlockId(item) || seen.has(item)) continue;
    seen.add(item);
    out.push(item);
  }
  for (const id of ORDER_FORM_CUSTOMER_LINK_BLOCK_ORDER_DEFAULT) {
    if (!seen.has(id)) out.push(id);
  }
  return out;
}

/** 인접 line 블록은 \\n, section·그룹 경계는 \\n\\n */
export function joinCustomerLinkMessageChunks(
  chunks: Array<{ spacing: 'line' | 'section'; text: string }>,
): string {
  if (chunks.length === 0) return '';
  let out = chunks[0]!.text;
  for (let i = 1; i < chunks.length; i++) {
    const prev = chunks[i - 1]!;
    const cur = chunks[i]!;
    const sep = prev.spacing === 'line' && cur.spacing === 'line' ? '\n' : '\n\n';
    out += sep + cur.text;
  }
  return out;
}

export function moveCustomerLinkBlock(
  order: readonly OrderFormCustomerLinkBlockId[],
  index: number,
  direction: -1 | 1,
): OrderFormCustomerLinkBlockId[] {
  const next = [...order];
  const j = index + direction;
  if (index < 0 || index >= next.length || j < 0 || j >= next.length) return next;
  const tmp = next[index]!;
  next[index] = next[j]!;
  next[j] = tmp;
  return next;
}
