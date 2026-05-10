import type { AdChannel, AdChannelLineItem } from '@prisma/client';

export type RawAdSessionEndLine = {
  channelId?: string;
  amount?: number;
  /** COUNT_LINES: 과목 id → 건수 */
  lineCounts?: Record<string, unknown>;
};

export type NormalizedAdSpendRow = {
  channelId: string;
  amount: number;
  soomgoReceived: number | null;
  soomgoAuto: number | null;
  soomgoConfirmed: number | null;
  countBreakdown: Array<{
    lineItemId: string;
    label: string;
    unitAmountWon: number;
    count: number;
    countsForSpend: boolean;
    useAsAvgDenominator: boolean;
    lineAmountWon: number;
  }> | null;
};

export type ChannelWithLines = AdChannel & { lineItems: AdChannelLineItem[] };

export function normalizeAdSessionEndLines(
  rawLines: RawAdSessionEndLine[],
  channels: ChannelWithLines[],
): { ok: true; rows: NormalizedAdSpendRow[] } | { ok: false; error: string } {
  const channelById = new Map(channels.map((c) => [c.id, c]));
  const usedChannelIds = new Set<string>();
  const rows: NormalizedAdSpendRow[] = [];

  for (const row of rawLines) {
    if (!row?.channelId || typeof row.channelId !== 'string') continue;
    if (usedChannelIds.has(row.channelId)) continue;

    const ch = channelById.get(row.channelId);
    if (!ch) continue;

    usedChannelIds.add(row.channelId);

    if (ch.settlementMode === 'COUNT_LINES') {
      const items = [...ch.lineItems].sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.getTime() - b.createdAt.getTime());
      if (items.length === 0) {
        return {
          ok: false,
          error: `${ch.name}: 건수 과목이 없습니다. 관리자 「광고비 설정」에서 과목을 추가해 주세요.`,
        };
      }
      const lc = row.lineCounts && typeof row.lineCounts === 'object' && !Array.isArray(row.lineCounts) ? row.lineCounts : null;
      if (!lc) {
        return { ok: false, error: `${ch.name}: 과목별 건수(lineCounts)가 필요합니다.` };
      }

      const breakdown: NormalizedAdSpendRow['countBreakdown'] = [];
      let spendSum = 0;
      for (const li of items) {
        const raw = lc[li.id];
        const cnt = Math.max(0, Math.floor(Number(raw)));
        if (!Number.isFinite(cnt)) {
          return { ok: false, error: `${ch.name} · ${li.label}: 건수는 0 이상 정수로 입력해 주세요.` };
        }
        const lineAmount = li.countsForSpend ? cnt * li.unitAmountWon : 0;
        if (li.countsForSpend) spendSum += lineAmount;
        breakdown!.push({
          lineItemId: li.id,
          label: li.label,
          unitAmountWon: li.unitAmountWon,
          count: cnt,
          countsForSpend: li.countsForSpend,
          useAsAvgDenominator: !li.countsForSpend,
          lineAmountWon: lineAmount,
        });
      }

      if (spendSum <= 0) continue;

      rows.push({
        channelId: ch.id,
        amount: spendSum,
        soomgoReceived: null,
        soomgoAuto: null,
        soomgoConfirmed: null,
        countBreakdown: breakdown,
      });
    } else {
      if (typeof row.amount !== 'number' || !Number.isFinite(row.amount)) continue;
      const amt = Math.max(0, Math.round(row.amount));
      if (amt <= 0) continue;
      rows.push({
        channelId: ch.id,
        amount: amt,
        soomgoReceived: null,
        soomgoAuto: null,
        soomgoConfirmed: null,
        countBreakdown: null,
      });
    }
  }

  return { ok: true, rows };
}
