import type { AdChannel, AdChannelLineItem } from '../api/advertising';

export function won(n: number): string {
  return `${n.toLocaleString('ko-KR')}원`;
}

export function parseCount(raw: string): number {
  return Math.max(0, Math.floor(Number(String(raw).replace(/[^\d]/g, '')) || 0));
}

export function parseAmount(raw: string): number {
  return Math.max(0, Math.round(Number(String(raw).replace(/,/g, '')) || 0));
}

export function settlementModeOf(c: AdChannel): 'DIRECT_AMOUNT' | 'COUNT_LINES' {
  return c.settlementMode === 'COUNT_LINES' ? 'COUNT_LINES' : 'DIRECT_AMOUNT';
}

export function sortedLineItems(c: AdChannel): AdChannelLineItem[] {
  const items = c.lineItems ?? [];
  return [...items].sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label));
}

export function channelNeedsUnifiedBooking(c: AdChannel): boolean {
  return settlementModeOf(c) === 'COUNT_LINES' && sortedLineItems(c).some((li) => !li.countsForSpend);
}

export function previewCountLines(
  c: AdChannel,
  counts: Record<string, string>,
  opts: { channelUsesUnifiedDenom: boolean; unifiedBookingDenom: number | null },
) {
  const items = sortedLineItems(c);
  let spend = 0;
  let denom: number;
  if (opts.channelUsesUnifiedDenom) {
    denom = opts.unifiedBookingDenom ?? 0;
  } else {
    denom = 0;
    for (const li of items) {
      if (!li.countsForSpend) denom += parseCount(counts[li.id] ?? '');
    }
  }
  for (const li of items) {
    if (li.countsForSpend) spend += parseCount(counts[li.id] ?? '') * li.unitAmountWon;
  }
  return {
    spend,
    avgPerDenom: denom > 0 ? spend / denom : (null as number | null),
    hasSpendInput: items.some((li) => li.countsForSpend && parseCount(counts[li.id] ?? '') > 0),
    avgPendingAuto: opts.channelUsesUnifiedDenom && opts.unifiedBookingDenom === null,
  };
}
