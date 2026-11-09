export type PlatformReceiptStatusFilter = 'ISSUED' | 'CANCELLED' | 'FAILED' | '';

export type PlatformReceiptListQuery = {
  fromYmd: string;
  toYmd: string;
  status: PlatformReceiptStatusFilter;
  q: string;
  limit: number;
  offset: number;
};

function ymd8(raw: unknown): string {
  return String(raw ?? '').replace(/\D/g, '').slice(0, 8);
}

export function parsePlatformReceiptListQuery(query: Record<string, unknown>): PlatformReceiptListQuery {
  const fromYmd = ymd8(query.from);
  const toYmd = ymd8(query.to);
  const statusRaw = String(query.status ?? '').trim().toUpperCase();
  const status: PlatformReceiptStatusFilter =
    statusRaw === 'ISSUED' || statusRaw === 'CANCELLED' || statusRaw === 'FAILED' ? statusRaw : '';
  const q = String(query.q ?? '').trim().slice(0, 80);
  const limit = Math.min(Math.max(Number(query.limit) || 30, 1), 100);
  const offset = Math.max(Number(query.offset) || 0, 0);
  return { fromYmd, toYmd, status, q, limit, offset };
}

/** KST 달력 기준 from~to(YYYYMMDD). to 없으면 from만, 둘 다 없으면 범위 없음. */
export function tradeDateRangeFilter(fromYmd: string, toYmd: string): { gte?: string; lte?: string } | undefined {
  if (fromYmd.length === 8 && toYmd.length === 8) return { gte: fromYmd, lte: toYmd };
  if (fromYmd.length === 8) return { gte: fromYmd };
  if (toYmd.length === 8) return { lte: toYmd };
  return undefined;
}

export function formatCorpNumDisplay(corpNum: string): string {
  const digits = corpNum.replace(/\D/g, '');
  if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
  return corpNum;
}
