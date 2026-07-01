import { useEffect, useState } from 'react';
import {
  endAdSession,
  getBookingDenominatorPreview,
  type AdChannel,
  type EndAdSessionLine,
} from '../../api/advertising';
import { ModalCloseButton } from '../admin/ModalCloseButton';
import {
  channelNeedsUnifiedBooking,
  parseAmount,
  parseCount,
  previewCountLines,
  settlementModeOf,
  sortedLineItems,
  won,
} from '../../utils/adWorkSessionEndForm';

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
  const [issuedPendingPreview, setIssuedPendingPreview] = useState<number | null>(null);
  const [cancelledBookingPreview, setCancelledBookingPreview] = useState<number | null>(null);
  const [deletedBookingPreview, setDeletedBookingPreview] = useState<number | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setBookingManual(false);
      setBookingManualStr('');
      setAutoBookingPreview(null);
      setIssuedPendingPreview(null);
      setCancelledBookingPreview(null);
      setDeletedBookingPreview(null);
      setPreviewLoading(false);
      setError(null);
      return;
    }
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
  }, [open, channels]);

  useEffect(() => {
    if (!open || !token) return;
    if (!channels.some(channelNeedsUnifiedBooking)) return;
    setPreviewLoading(true);
    setAutoBookingPreview(null);
    setIssuedPendingPreview(null);
    setCancelledBookingPreview(null);
    setDeletedBookingPreview(null);
    void getBookingDenominatorPreview(token)
      .then((p) => {
        setAutoBookingPreview(p.autoCount);
        setIssuedPendingPreview(p.issuedPendingCount);
        setCancelledBookingPreview(p.cancelledCount);
        setDeletedBookingPreview(p.deletedCount);
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
        <p className="text-fluid-xs text-gray-600 mb-3 leading-snug">
          건수 채널은 과목별 건수만 입력합니다. 예약 분모가 있는 채널은 카드 안 한 줄에서 자동/수동을 고릅니다. 자동
          「확정」건수는 직전 종료~지금 구간에서 <strong className="font-medium text-gray-800">고객 제출(submittedAt)</strong>
          완료 건만 세며, 미제출 발급·접수 취소·삭제는 분모에서 제외합니다.
        </p>
        {error ? (
          <div className="mb-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded px-3 py-2">{error}</div>
        ) : null}
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
                            <>
                              자동 {autoBookingPreview}건
                              {issuedPendingPreview != null && issuedPendingPreview > 0 ? (
                                <span className="text-amber-800 ml-1">· 미제출 {issuedPendingPreview}</span>
                              ) : null}
                              {cancelledBookingPreview != null && cancelledBookingPreview > 0 ? (
                                <span className="text-rose-700 ml-1">· 취소 {cancelledBookingPreview}건</span>
                              ) : null}
                              {deletedBookingPreview != null && deletedBookingPreview > 0 ? (
                                <span className="text-gray-600 ml-1">· 삭제 {deletedBookingPreview}건</span>
                              ) : null}
                            </>
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
            ),
          )}
        </div>
        {countChannels.some((c) => sortedLineItems(c).length === 0) ? (
          <p className="mb-3 text-fluid-xs text-amber-800 bg-amber-50 border border-amber-100 rounded px-2 py-2">
            건수 방식으로 된 채널 중 과목이 비어 있는 것이 있습니다. 관리자 「광고비 → 설정」에서 과목을 추가해 주세요.
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="px-3 py-1.5 text-sm text-gray-700 border border-gray-300 rounded hover:bg-gray-50"
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
