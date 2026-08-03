/**
 * @see shared/orderFormCustomerLinkBlocks.ts — 클라이언트와 동기화 유지
 */
const BLOCK_IDS = [
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

type BlockId = (typeof BLOCK_IDS)[number];

const DEFAULT_ORDER: readonly BlockId[] = [...BLOCK_IDS];
const BLOCK_SET = new Set<string>(BLOCK_IDS);

export function normalizeCustomerLinkBlockOrder(raw: unknown): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const list = Array.isArray(raw) ? raw : [];
  for (const item of list) {
    if (typeof item !== 'string' || !BLOCK_SET.has(item) || seen.has(item)) continue;
    seen.add(item);
    out.push(item);
  }
  for (const id of DEFAULT_ORDER) {
    if (!seen.has(id)) out.push(id);
  }
  return out;
}
