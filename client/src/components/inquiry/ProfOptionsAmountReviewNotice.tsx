import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  applyInquiryProfOptionAmounts,
  getInquiryProfOptionAmountLines,
  type ApplyProfOptionAmountsResult,
  type ProfOptionAmountLinePreview,
} from '../../api/inquiries';

type BadgeProps = { className?: string };

export function ProfOptionsAmountReviewBadge({ className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex shrink-0 rounded-md bg-amber-100 px-2 py-0.5 text-fluid-2xs font-semibold text-amber-900 ring-1 ring-amber-200/80 ${className}`}
      title="고객이 추가 시공 옵션을 선택했습니다. 상세에서 금액·추가결재를 확정해 주세요."
    >
      금액 설정 필요
    </span>
  );
}

export function ProfOptionsAmountReviewCompletedBadge({ className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex shrink-0 rounded-md bg-emerald-100 px-2 py-0.5 text-fluid-2xs font-semibold text-emerald-900 ring-1 ring-emerald-200/80 ${className}`}
      title="전문 시공 옵션 추가 금액이 반영되었거나 계약 금액이 확정되었습니다."
    >
      금액 설정 완료
    </span>
  );
}

function formatWon(n: number): string {
  return `${Number(n).toLocaleString('ko-KR')}원`;
}

function defaultChargeAmount(line: ProfOptionAmountLinePreview): string {
  if (line.standardAmount > 0) return String(line.standardAmount);
  return '';
}

export function ProfOptionsAmountReviewApplyPanel(props: {
  token: string;
  inquiryId: string;
  onApplied?: (result: ApplyProfOptionAmountsResult) => void | Promise<void>;
}) {
  const { token, inquiryId, onApplied } = props;
  const [lines, setLines] = useState<ProfOptionAmountLinePreview[]>([]);
  const [amountDraft, setAmountDraft] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);

  const loadLines = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { lines: fetched } = await getInquiryProfOptionAmountLines(token, inquiryId);
      setLines(fetched);
      const draft: Record<string, string> = {};
      for (const line of fetched) {
        draft[line.optionId] = defaultChargeAmount(line);
      }
      setAmountDraft(draft);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : '옵션 목록을 불러오지 못했습니다.');
      setLines([]);
      setAmountDraft({});
    } finally {
      setLoading(false);
    }
  }, [token, inquiryId]);

  useEffect(() => {
    void loadLines();
  }, [loadLines]);

  const pendingLines = useMemo(
    () => lines.filter((l) => !l.alreadyApplied),
    [lines],
  );

  const handleApply = async () => {
    if (pendingLines.length === 0) return;
    setApplying(true);
    try {
      const payload: Array<{ optionId: string; amount: number }> = [];
      for (const line of pendingLines) {
        const raw = amountDraft[line.optionId] ?? '';
        const trimmed = raw.replace(/,/g, '').trim();
        if (!trimmed) {
          if (line.requiresManualAmount) {
            alert(`「${line.label}」 청구 금액을 입력해 주세요.`);
            return;
          }
          continue;
        }
        const amount = Math.trunc(Number(trimmed));
        if (!Number.isFinite(amount) || amount < 0) {
          alert(`「${line.label}」 금액이 올바르지 않습니다.`);
          return;
        }
        payload.push({ optionId: line.optionId, amount });
      }
      if (payload.length === 0) {
        alert('반영할 옵션의 청구 금액을 입력해 주세요. (추가 금액 없음은 0 입력)');
        return;
      }
      const result = await applyInquiryProfOptionAmounts(token, inquiryId, payload);
      if (result.unpricedLabels.length > 0) {
        alert(
          `단가 미설정 옵션: ${result.unpricedLabels.join(', ')}\n해당 항목은 금액을 입력한 뒤 다시 반영하거나, 총액·추가결재로 처리해 주세요.`,
        );
      } else if (result.createdCount > 0) {
        alert(`전문 시공 옵션 ${result.createdCount}건을 추가결재에 반영했습니다.`);
      } else if (result.skippedCount > 0) {
        alert('이미 반영된 항목만 있거나 새로 추가할 항목이 없습니다.');
      } else if (result.profOptionsAmountReviewCompleted) {
        alert('옵션 금액 확인이 완료되었습니다.');
      }
      await onApplied?.(result);
      await loadLines();
    } catch (e) {
      alert(e instanceof Error ? e.message : '옵션 금액 반영에 실패했습니다.');
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="rounded-xl border border-amber-200/90 bg-amber-50/90 px-4 py-3 text-fluid-sm text-amber-950 shadow-sm">
      <p className="font-semibold">추가 시공 옵션 — 금액 설정 필요</p>
      <p className="mt-1.5 text-fluid-xs leading-relaxed text-amber-900/90">
        발주서·카탈로그 금액은 <span className="font-medium">표준가</span>입니다. 할인·협의가 있으면{' '}
        <span className="font-medium">청구 금액</span>을 수정한 뒤 반영하세요. 반영 위치는 아래{' '}
        <span className="font-medium">결제 금액 내역 → 추가결재</span>입니다.
      </p>

      {loading ? (
        <p className="mt-3 text-fluid-xs text-amber-900/80">옵션 목록 불러오는 중…</p>
      ) : loadError ? (
        <p className="mt-3 text-fluid-xs text-red-700">{loadError}</p>
      ) : lines.length === 0 ? (
        <p className="mt-3 text-fluid-xs text-amber-900/80">
          반영할 전문 시공 옵션이 없습니다. 총액·추가결재를 직접 입력해 주세요.
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto rounded-lg border border-amber-200/80 bg-white">
          <table className="w-full min-w-[20rem] border-collapse text-fluid-xs">
            <thead>
              <tr className="border-b border-amber-100 bg-amber-50/60 text-amber-950">
                <th className="px-3 py-2 text-center font-semibold">옵션</th>
                <th className="px-3 py-2 text-center font-semibold">표준가</th>
                <th className="px-3 py-2 text-center font-semibold">청구 금액</th>
                <th className="px-3 py-2 text-center font-semibold">상태</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.optionId} className="border-b border-amber-50 last:border-0">
                  <td className="px-3 py-2 text-center text-gray-900">
                    {line.label}
                    {line.quantity > 1 ? (
                      <span className="ml-1 text-gray-500">× {line.quantity}</span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-center tabular-nums text-gray-600">
                    {line.standardAmount > 0 ? formatWon(line.standardAmount) : '—'}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {line.alreadyApplied ? (
                      <span className="tabular-nums font-medium text-gray-800">
                        {line.appliedAmount != null ? formatWon(line.appliedAmount) : '—'}
                      </span>
                    ) : (
                      <input
                        type="text"
                        inputMode="numeric"
                        value={amountDraft[line.optionId] ?? ''}
                        onChange={(e) =>
                          setAmountDraft((prev) => ({
                            ...prev,
                            [line.optionId]: e.target.value.replace(/[^\d,]/g, ''),
                          }))
                        }
                        placeholder={line.requiresManualAmount ? '금액 입력' : '0'}
                        className="w-full max-w-[8rem] rounded border border-gray-300 px-2 py-1.5 text-center tabular-nums text-gray-900"
                        aria-label={`${line.label} 청구 금액`}
                      />
                    )}
                  </td>
                  <td className="px-3 py-2 text-center text-fluid-2xs">
                    {line.alreadyApplied ? (
                      <span className="text-emerald-700">반영됨</span>
                    ) : line.requiresManualAmount ? (
                      <span className="text-amber-800">단가 없음</span>
                    ) : (
                      <span className="text-gray-500">대기</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pendingLines.length > 0 ? (
        <button
          type="button"
          disabled={applying || loading}
          onClick={() => void handleApply()}
          className="mt-3 rounded-lg bg-amber-800 px-3.5 py-2 text-fluid-xs font-semibold text-white hover:bg-amber-900 disabled:opacity-50"
        >
          {applying ? '반영 중…' : '입력한 청구 금액 반영'}
        </button>
      ) : null}
    </div>
  );
}
