import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getActiveAdSession,
  getAdChannels,
  getBookingDenominatorPreview,
  startAdSession,
  endAdSession,
  type ActiveSession,
  type AdChannel,
  type AdChannelLineItem,
  type EndAdSessionLine,
} from '../../api/advertising';
import { getToken } from '../../stores/auth';
import { ModalCloseButton } from './ModalCloseButton';

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

/** 건수 방식 채널에 합산 제외(평균 분모) 과목이 있으면 예약 건수를 통합해 서버와 동일하게 둔다 */
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

export function TelemarketingSessionBlock() {
  const token = getToken();
  const [session, setSession] = useState<ActiveSession | null>(null);
  const [channels, setChannels] = useState<AdChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  /** channelId → lineItemId → 건수 문자열 */
  const [lineCounts, setLineCounts] = useState<Record<string, Record<string, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [bookingManual, setBookingManual] = useState(false);
  const [bookingManualStr, setBookingManualStr] = useState('');
  const [autoBookingPreview, setAutoBookingPreview] = useState<number | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const autoStartAttempted = useRef(false);
  const prevHadSession = useRef(false);

  const refresh = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [active, chRes] = await Promise.all([getActiveAdSession(token), getAdChannels(token)]);
      setSession(active.session);
      const activeCh = chRes.items.filter((c) => c.isActive);
      setChannels(activeCh);
      const initAmt: Record<string, string> = {};
      const initLc: Record<string, Record<string, string>> = {};
      for (const c of activeCh) {
        initAmt[c.id] = '';
        if (settlementModeOf(c) === 'COUNT_LINES') {
          const inner: Record<string, string> = {};
          for (const li of sortedLineItems(c)) inner[li.id] = '';
          initLc[c.id] = inner;
        }
      }
      setAmounts(initAmt);
      setLineCounts(initLc);
    } catch (e) {
      setError(e instanceof Error ? e.message : '불러오기 실패');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (prevHadSession.current && !session) {
      autoStartAttempted.current = false;
    }
    prevHadSession.current = Boolean(session);
  }, [session]);

  useEffect(() => {
    if (!token || loading || channels.length === 0) return;
    if (session) return;
    if (autoStartAttempted.current) return;
    autoStartAttempted.current = true;
    let cancelled = false;
    (async () => {
      try {
        await startAdSession(token);
      } catch {
        /* 이미 진행 중 등 */
      }
      if (!cancelled) await refresh();
    })();
    return () => {
      cancelled = true;
    };
  }, [token, loading, session, channels.length, refresh]);

  useEffect(() => {
    if (!modalOpen) {
      setBookingManual(false);
      setBookingManualStr('');
      setAutoBookingPreview(null);
      setPreviewLoading(false);
      return;
    }
    if (!token) return;
    if (!channels.some(channelNeedsUnifiedBooking)) return;
    setPreviewLoading(true);
    setAutoBookingPreview(null);
    void getBookingDenominatorPreview(token)
      .then((p) => setAutoBookingPreview(p.autoCount))
      .catch(() => setAutoBookingPreview(null))
      .finally(() => setPreviewLoading(false));
  }, [modalOpen, token, channels]);

  const handleOpenEnd = () => {
    setModalOpen(true);
  };

  const handleEnd = async () => {
    if (!token) return;
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
      setModalOpen(false);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : '종료 실패');
    } finally {
      setSubmitting(false);
    }
  };

  if (!token) return null;

  const countChannels = channels.filter((c) => settlementModeOf(c) === 'COUNT_LINES');
  const needsBookingDenom = channels.some(channelNeedsUnifiedBooking);
  const unifiedChannelCount = channels.filter(channelNeedsUnifiedBooking).length;
  const unifiedPreviewDenom: number | null = bookingManual ? parseCount(bookingManualStr) : autoBookingPreview;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <h2 className="text-base font-medium text-gray-800 mb-2">텔레마케팅 · 광고비</h2>
      <p className="text-sm text-gray-600 mb-4">
        업무 종료 시 채널별로 당일 광고비를 저장합니다. 건수 방식 채널은 관리자 「광고비 → 설정」에서 과목·단가를
        맞춘 뒤 건수만 입력하면 됩니다.
      </p>

      {error && (
        <div className="mb-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded px-3 py-2">{error}</div>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">불러오는 중…</p>
      ) : session ? (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleOpenEnd}
            disabled={submitting || channels.length === 0}
            className="px-4 py-2 bg-gray-800 text-white text-sm font-medium rounded hover:bg-gray-900 disabled:opacity-50"
          >
            작업 종료 및 정산
          </button>
          {channels.length === 0 && (
            <span className="text-xs text-amber-700">
              채널이 없습니다. 관리자가 <strong className="text-gray-800">광고비 → 설정</strong>에서 채널을 추가하세요.
            </span>
          )}
        </div>
      ) : channels.length === 0 ? (
        <p className="text-sm text-gray-500">활성 광고 채널이 없습니다. 관리자가 광고비 메뉴에서 채널을 추가할 수 있습니다.</p>
      ) : (
        <p className="text-sm text-gray-500">세션 준비 중… 잠시 후 새로고침해 주세요.</p>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="relative bg-white rounded-lg shadow-lg max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <ModalCloseButton onClick={() => setModalOpen(false)} disabled={submitting} />
            <h3 className="text-lg font-medium text-gray-900 mb-2 pr-10">당일 광고비 입력</h3>
            <p className="text-fluid-xs text-gray-600 mb-3 leading-snug">
              건수 채널은 과목별 건수만 입력합니다. 예약 분모가 있는 채널은 카드 안 한 줄에서 자동/수동을 고릅니다.
            </p>
            <div className="space-y-2 mb-4">
              {channels.map((c) =>
                settlementModeOf(c) === 'COUNT_LINES' ? (
                  <div
                    key={c.id}
                    className="border border-teal-200 rounded-md px-2 py-1.5 bg-teal-50/40 space-y-1.5 min-w-0"
                  >
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0">
                      <span className="text-sm font-medium text-gray-900 truncate shrink min-w-0">{c.name}</span>
                      {channelNeedsUnifiedBooking(c) ? (
                        <div className="flex flex-wrap items-center gap-1.5 min-w-0 text-fluid-2xs text-gray-700 bg-white/90 border border-gray-200/90 rounded px-1.5 py-0.5">
                          <span className="text-gray-500 shrink-0">수동건수입력</span>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={bookingManual}
                            aria-label="수동 건수 입력 사용"
                            title={bookingManual ? '수동 건수 입력 켜짐' : '자동 집계'}
                            onClick={() => setBookingManual((v) => !v)}
                            disabled={submitting}
                            className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors ${
                              bookingManual ? 'border-teal-600 bg-teal-600' : 'border-gray-300 bg-white'
                            } disabled:opacity-50`}
                          >
                            <span
                              className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                                bookingManual ? 'translate-x-[18px]' : 'translate-x-0.5'
                              }`}
                            />
                          </button>
                          {bookingManual ? (
                            <>
                              <input
                                type="text"
                                inputMode="numeric"
                                className="w-11 shrink-0 rounded border border-gray-300 px-1 py-0.5 text-right tabular-nums text-fluid-xs leading-none"
                                placeholder="0"
                                value={bookingManualStr}
                                onChange={(e) => setBookingManualStr(e.target.value)}
                                disabled={submitting}
                              />
                              <span className="text-gray-400 shrink-0">건</span>
                            </>
                          ) : (
                            <span className="tabular-nums text-gray-800 min-w-0">
                              {previewLoading ? (
                                '…'
                              ) : autoBookingPreview !== null ? (
                                <>자동 {autoBookingPreview}건</>
                              ) : (
                                <span className="text-amber-700">자동 불러오기 실패 · 수동 권장</span>
                              )}
                            </span>
                          )}
                          {unifiedChannelCount > 1 ? (
                            <span className="text-gray-400 shrink-0 hidden sm:inline border-l border-gray-200 pl-1.5 ml-0.5">
                              채널 공통
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-end gap-x-2 gap-y-1">
                      {sortedLineItems(c).map((li) => {
                        const hideDenomInput = channelNeedsUnifiedBooking(c) && !li.countsForSpend;
                        if (hideDenomInput) return null;
                        const unitHint = li.countsForSpend
                          ? `${li.unitAmountWon.toLocaleString('ko-KR')}원/건`
                          : '합산 제외';
                        return (
                          <label
                            key={li.id}
                            className="inline-flex items-center gap-1 min-w-0 max-w-full rounded border border-teal-100/90 bg-white/70 px-1.5 py-0.5"
                          >
                            <span
                              className="truncate text-fluid-xs text-gray-800 shrink min-w-0 max-w-[6.5rem]"
                              title={`${li.label} (${unitHint})`}
                            >
                              {li.label}
                            </span>
                            <span className="text-fluid-2xs text-gray-400 tabular-nums shrink-0">{unitHint}</span>
                            <input
                              type="text"
                              inputMode="numeric"
                              className="w-10 shrink-0 rounded border border-gray-300 px-0.5 py-0.5 text-right tabular-nums text-fluid-xs leading-tight"
                              placeholder="0"
                              value={lineCounts[c.id]?.[li.id] ?? ''}
                              onChange={(e) =>
                                setLineCounts((prev) => ({
                                  ...prev,
                                  [c.id]: {
                                    ...(prev[c.id] ?? {}),
                                    [li.id]: e.target.value,
                                  },
                                }))
                              }
                            />
                          </label>
                        );
                      })}
                    </div>
                    {(() => {
                      const counts = lineCounts[c.id] ?? {};
                      const channelUnified = channelNeedsUnifiedBooking(c);
                      const p = previewCountLines(c, counts, {
                        channelUsesUnifiedDenom: channelUnified,
                        unifiedBookingDenom: channelUnified ? unifiedPreviewDenom : null,
                      });
                      if (!p.hasSpendInput) {
                        return (
                          <p className="text-fluid-2xs text-gray-500 leading-tight">과목 건수 입력 시 합계·평균 표시</p>
                        );
                      }
                      const denomLines = sortedLineItems(c).filter((li) => !li.countsForSpend);
                      const avgBit =
                        denomLines.length > 0 ? (
                          <>
                            {' · '}
                            평균{' '}
                            <strong className="tabular-nums text-teal-900">
                              {p.avgPendingAuto ? (
                                '…'
                              ) : p.avgPerDenom != null ? (
                                won(Math.round(p.avgPerDenom))
                              ) : (
                                '—'
                              )}
                            </strong>
                            {channelUnified ? '' : ` (${denomLines.map((d) => d.label).join('·')})`}
                          </>
                        ) : null;
                      return (
                        <p className="text-fluid-2xs text-gray-700 leading-tight border-t border-teal-200/50 pt-1 truncate">
                          합계 <strong className="tabular-nums text-teal-900">{won(p.spend)}</strong>
                          {avgBit}
                        </p>
                      );
                    })()}
                  </div>
                ) : (
                  <div key={c.id} className="flex items-center gap-2 py-0.5">
                    <label className="flex-1 text-fluid-xs text-gray-800 truncate min-w-0">{c.name}</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      className="w-24 shrink-0 px-1.5 py-0.5 border border-gray-300 rounded text-fluid-xs text-right tabular-nums"
                      placeholder="0"
                      value={amounts[c.id] ?? ''}
                      onChange={(e) => setAmounts((prev) => ({ ...prev, [c.id]: e.target.value }))}
                    />
                    <span className="text-fluid-2xs text-gray-500 shrink-0">원</span>
                  </div>
                )
              )}
            </div>
            {countChannels.some((c) => sortedLineItems(c).length === 0) && (
              <p className="mb-3 text-fluid-xs text-amber-800 bg-amber-50 border border-amber-100 rounded px-2 py-2">
                건수 방식으로 된 채널 중 과목이 비어 있는 것이 있습니다. 관리자 「광고비 → 설정」에서 과목을 추가해 주세요.
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="px-3 py-1.5 text-sm text-gray-700 border border-gray-300 rounded hover:bg-gray-50"
                onClick={() => setModalOpen(false)}
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
      )}
    </div>
  );
}
