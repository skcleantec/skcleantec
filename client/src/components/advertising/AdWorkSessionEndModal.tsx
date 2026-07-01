import { useEffect, useState } from 'react';
import {
  endAdSession,
  getBookingDenominatorPreview,
  type AdChannel,
  type AdChannelLineItem,
  type EndAdSessionLine,
} from '../../api/advertising';
import { ModalCloseButton } from '../admin/ModalCloseButton';

function won(n: number): string {
  return `${n.toLocaleString('ko-KR')}원`;
}

function parseCount(raw: string): number {
  return Math.max(0, Math.floor(Number(String(raw).replace(/[^\d]/g, '')) || 0));
}

function parseAmount(raw: string): number {
  return Math.max(0, Math.round(Number(String(raw).replace(/,/g, '')) || 0));
}

function settlementModeOf(c: AdChannel): 'DIRECT_AMOUNT' | 'COUNT_LINES' {
  return c.settlementMode === 'COUNT_LINES' ? 'COUNT_LINES' : 'DIRECT_AMOUNT';
}

function sortedLineItems(c: AdChannel): AdChannelLineItem[] {
  const items = c.lineItems ?? [];
  return [...items].sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label));
}

function channelNeedsUnifiedBooking(c: AdChannel): boolean {
  return settlementModeOf(c) === 'COUNT_LINES' && sortedLineItems(c).some((li) => !li.countsForSpend);
}

function previewCountLines(
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

export function AdWorkSessionEndModal({
  open,
  token,
  channels,
  onClose,
  onEnded,
}: {
  open: boolean;
  token: string;
  channels: AdChannel[];
  onClose: () => void;
  onEnded: () => void;
}) {
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [lineCounts, setLineCounts] = useState<Record<string, Record<string, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bookingManual, setBookingManual] = useState(false);
  const [bookingManualStr, setBookingManualStr] = useState('');
  const [autoBookingPreview, setAutoBookingPreview] = useState<number | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    const initAmt: Record<string, string> = {};
    const initLc: Record<string, Record<string, string>> = {};
    for (const c of channels) {
      initAmt[c.id] = '';
      if (settlementModeOf(c) === 'COUNT_LINES') {
        const inner: Record<string, string> = {};
        for (const li of sortedLineItems(c)) inner[li.id] = '';
        initLc[c.id] = inner;
      }
    }
    setAmounts(initAmt);
    setLineCounts(initLc);
    setBookingManual(false);
    setBookingManualStr('');
    setError(null);
  }, [open, channels]);

  useEffect(() => {
    if (!open || !token) return;
    if (!channels.some(channelNeedsUnifiedBooking)) return;
    setPreviewLoading(true);
    void getBookingDenominatorPreview(token)
      .then((p) => {
        setAutoBookingPreview(p.autoCount);
      })
      .catch(() => setAutoBookingPreview(null))
      .finally(() => setPreviewLoading(false));
  }, [open, token, channels]);

  const handleEnd = async () => {
    const lines: EndAdSessionLine[] = [];
    const needsBookingDenom = channels.some(channelNeedsUnifiedBooking);

    for (const c of channels) {
      if (settlementModeOf(c) === 'COUNT_LINES') {
        const items = sortedLineItems(c);
        if (items.length === 0) continue;
        const unified = channelNeedsUnifiedBooking(c);
        const lc: Record<string, number> = {};
        for (const li of items) {
          if (li.countsForSpend) lc[li.id] = parseCount(lineCounts[c.id]?.[li.id] ?? '');
          else if (unified) lc[li.id] = 0;
          else lc[li.id] = parseCount(lineCounts[c.id]?.[li.id] ?? '');
        }
        let spendSum = 0;
        for (const li of items) {
          if (li.countsForSpend) spendSum += lc[li.id]! * li.unitAmountWon;
        }
        if (spendSum <= 0) continue;
        lines.push({ channelId: c.id, lineCounts: lc });
      } else {
        const amt = parseAmount(amounts[c.id] ?? '');
        if (amt > 0) lines.push({ channelId: c.id, amount: amt });
      }
    }

    setSubmitting(true);
    setError(null);
    try {
      await endAdSession(
        token,
        lines,
        needsBookingDenom
          ? {
              bookingDenominator: bookingManual
                ? { manual: true, manualCount: parseCount(bookingManualStr) }
                : { manual: false },
            }
          : undefined,
      );
      onEnded();
    } catch (e) {
      setError(e instanceof Error ? e.message : '종료 실패');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  const needsBookingDenom = channels.some(channelNeedsUnifiedBooking);
  const unifiedChannelCount = channels.filter(channelNeedsUnifiedBooking).length;
  const unifiedPreviewDenom: number | null = bookingManual ? parseCount(bookingManualStr) : autoBookingPreview;
  const countChannels = channels.filter((c) => settlementModeOf(c) === 'COUNT_LINES');

  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-black/40">
      <div className="relative bg-white rounded-lg shadow-lg max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
        <ModalCloseButton onClick={onClose} disabled={submitting} />
        <h3 className="text-lg font-medium text-gray-900 mb-2 pr-10">당일 광고비 입력</h3>
        {error ? (
          <div className="mb-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded px-3 py-2">{error}</div>
        ) : null}
        <div className="space-y-2 mb-4">
          {channels.map((c) =>
            settlementModeOf(c) === 'COUNT_LINES' ? (
              <div key={c.id} className="border border-teal-200 rounded-md px-2 py-1.5 bg-teal-50/40 space-y-1.5">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-sm font-medium text-gray-900 truncate">{c.name}</span>
                  {channelNeedsUnifiedBooking(c) ? (
                    <div className="flex flex-wrap items-center gap-1.5 text-fluid-2xs text-gray-700 bg-white/90 border border-gray-200/90 rounded px-1.5 py-0.5">
                      <span className="text-gray-500">수동건수</span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={bookingManual}
                        onClick={() => setBookingManual((v) => !v)}
                        disabled={submitting}
                        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border ${
                          bookingManual ? 'border-teal-600 bg-teal-600' : 'border-gray-300 bg-white'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                            bookingManual ? 'translate-x-[18px]' : 'translate-x-0.5'
                          }`}
                        />
                      </button>
                      {bookingManual ? (
                        <input
                          type="text"
                          inputMode="numeric"
                          className="w-11 rounded border border-gray-300 px-1 py-0.5 text-right text-fluid-xs"
                          value={bookingManualStr}
                          onChange={(e) => setBookingManualStr(e.target.value)}
                          disabled={submitting}
                        />
                      ) : (
                        <span className="tabular-nums">
                          {previewLoading ? '…' : autoBookingPreview !== null ? `자동 ${autoBookingPreview}건` : '자동 실패'}
                        </span>
                      )}
                      {unifiedChannelCount > 1 ? <span className="text-gray-400">공통</span> : null}
                    </div>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-end gap-x-2 gap-y-1">
                  {sortedLineItems(c).map((li) => {
                    const hideDenomInput = channelNeedsUnifiedBooking(c) && !li.countsForSpend;
                    if (hideDenomInput) return null;
                    return (
                      <label key={li.id} className="inline-flex items-center gap-1 rounded border border-teal-100/90 bg-white/70 px-1.5 py-0.5">
                        <span className="truncate text-fluid-xs max-w-[6rem]">{li.label}</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          className="w-10 rounded border border-gray-300 px-0.5 py-0.5 text-right text-fluid-xs"
                          value={lineCounts[c.id]?.[li.id] ?? ''}
                          onChange={(e) =>
                            setLineCounts((prev) => ({
                              ...prev,
                              [c.id]: { ...(prev[c.id] ?? {}), [li.id]: e.target.value },
                            }))
                          }
                        />
                      </label>
                    );
                  })}
                </div>
                {(() => {
                  const p = previewCountLines(c, lineCounts[c.id] ?? {}, {
                    channelUsesUnifiedDenom: channelNeedsUnifiedBooking(c),
                    unifiedBookingDenom: channelNeedsUnifiedBooking(c) ? unifiedPreviewDenom : null,
                  });
                  if (!p.hasSpendInput) return null;
                  return (
                    <p className="text-fluid-2xs text-gray-700 border-t border-teal-200/50 pt-1">
                      합계 <strong className="tabular-nums">{won(p.spend)}</strong>
                    </p>
                  );
                })()}
              </div>
            ) : (
              <div key={c.id} className="flex items-center gap-2 py-0.5">
                <label className="flex-1 text-fluid-xs truncate">{c.name}</label>
                <input
                  type="text"
                  inputMode="numeric"
                  className="w-24 px-1.5 py-0.5 border border-gray-300 rounded text-fluid-xs text-right tabular-nums"
                  value={amounts[c.id] ?? ''}
                  onChange={(e) => setAmounts((prev) => ({ ...prev, [c.id]: e.target.value }))}
                />
                <span className="text-fluid-2xs text-gray-500">원</span>
              </div>
            ),
          )}
        </div>
        {countChannels.some((c) => sortedLineItems(c).length === 0) ? (
          <p className="mb-3 text-fluid-xs text-amber-800 bg-amber-50 border border-amber-100 rounded px-2 py-2">
            건수 채널 중 과목이 비어 있습니다. 광고비 설정에서 과목을 추가해 주세요.
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50"
            onClick={onClose}
            disabled={submitting}
          >
            취소
          </button>
          <button
            type="button"
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            onClick={() => void handleEnd()}
            disabled={submitting || (needsBookingDenom && !bookingManual && previewLoading)}
          >
            {submitting ? '처리 중…' : '종료 및 저장'}
          </button>
        </div>
      </div>
    </div>
  );
}
