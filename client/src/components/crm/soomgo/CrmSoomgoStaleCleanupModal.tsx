import { useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import type { SoomgoStaleChatScanItem, SoomgoStaleChatScanResult } from '@shared/soomgoBridge';
import {
  isSoomgoBridgeStaleLeaveSupported,
  scanSoomgoStaleChats,
  SOOMGO_BRIDGE_STALE_LEAVE_OUTDATED_MESSAGE,
} from '../../../api/soomgoBridge';
import type { SoomgoBridgeStatus } from '@shared/soomgoBridge';

function reasonLabel(code: string): string {
  if (code === 'preferred_date_passed') return '희망일 만료';
  if (code === 'room_older_than_30d') return '개설 30일 초과';
  return code;
}

function actionLabel(action: SoomgoStaleChatScanItem['action']): string {
  switch (action) {
    case 'would_leave':
      return '나갈 예정';
    case 'left':
      return '나감';
    case 'skip':
      return '유지';
    case 'failed':
      return '실패';
    default:
      return action;
  }
}

export function CrmSoomgoStaleCleanupModal({
  open,
  onClose,
  status,
  busy,
  onStart,
  onFinish,
}: {
  open: boolean;
  onClose: () => void;
  status: SoomgoBridgeStatus | null;
  busy: boolean;
  onStart?: () => void;
  onFinish?: () => void;
}) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<SoomgoStaleChatScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const supported = isSoomgoBridgeStaleLeaveSupported(status);

  const runScan = useCallback(
    async (execute: boolean) => {
      if (!supported) {
        setError(SOOMGO_BRIDGE_STALE_LEAVE_OUTDATED_MESSAGE);
        return;
      }
      if (
        execute &&
        !window.confirm(
          '선택한 조건에 해당하는 채팅방에서 나갑니다. 되돌릴 수 없습니다. 계속할까요?',
        )
      ) {
        return;
      }
      setRunning(true);
      setError(null);
      onStart?.();
      try {
        const res = await scanSoomgoStaleChats({ execute, dryRun: !execute });
        if (!res.ok) {
          setError(res.error || '스캔에 실패했습니다.');
          setResult(null);
        } else {
          setResult(res);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : '스캔에 실패했습니다.');
        setResult(null);
      } finally {
        setRunning(false);
        onFinish?.();
      }
    },
    [onFinish, onStart, supported],
  );

  if (!open) return null;

  const leaveItems =
    result?.items?.filter((i) => i.action === 'would_leave' || i.action === 'left' || i.action === 'leave') ?? [];

  return createPortal(
    <div className="modal-mobile-safe-overlay fixed inset-0 z-[85] flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4">
      <div
        className="modal-mobile-fullscreen-panel flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:max-h-[90vh] sm:rounded-2xl"
        role="dialog"
        aria-labelledby="soomgo-stale-cleanup-title"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-3 py-2 sm:px-4">
          <h2 id="soomgo-stale-cleanup-title" className="text-fluid-sm font-semibold text-slate-900">
            오래된 채팅 정리
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={running || busy}
            className="rounded-lg border border-slate-200 px-2.5 py-1 text-fluid-xs text-slate-600 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none"
          >
            닫기
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
          <p className="text-fluid-xs leading-snug text-slate-600">
            채팅 목록 전체를 검사합니다. 희망일이 지났거나 개설일 기준 30일이 지난 방을 나갑니다. 「내
            고용」「다른 고수 고용」은 제외됩니다. 먼저 미리보기로 확인하세요.
          </p>

          {!supported ? (
            <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-fluid-xs text-amber-900">
              {SOOMGO_BRIDGE_STALE_LEAVE_OUTDATED_MESSAGE}
            </p>
          ) : null}

          {error ? (
            <p className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-2 text-fluid-xs text-rose-800">
              {error}
            </p>
          ) : null}

          {result?.summary ? (
            <div className="mt-3 flex flex-wrap gap-2 text-fluid-2xs">
              <span className="rounded-full bg-slate-100 px-2 py-0.5">
                목록 {result.totalListed ?? 0}건 · 처리 {result.processed ?? 0}건
              </span>
              {result.dryRun ? (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-900">
                  나갈 예정 {result.summary.wouldLeave}건
                </span>
              ) : (
                <span className="rounded-full bg-rose-100 px-2 py-0.5 text-rose-900">
                  나감 {result.summary.left}건
                </span>
              )}
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-900">
                유지 {result.summary.skipped}건
              </span>
              {result.summary.failed > 0 ? (
                <span className="rounded-full bg-rose-100 px-2 py-0.5 text-rose-900">
                  실패 {result.summary.failed}건
                </span>
              ) : null}
            </div>
          ) : null}

          {leaveItems.length > 0 ? (
            <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full min-w-[520px] table-fixed border-collapse text-fluid-2xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-600">
                    <th className="px-2 py-1.5 text-center font-medium">고객</th>
                    <th className="px-2 py-1.5 text-center font-medium">결과</th>
                    <th className="px-2 py-1.5 text-center font-medium">희망일</th>
                    <th className="px-2 py-1.5 text-center font-medium">개설일</th>
                    <th className="px-2 py-1.5 text-center font-medium">사유</th>
                  </tr>
                </thead>
                <tbody>
                  {leaveItems.map((row) => (
                    <tr key={row.chatId} className="border-t border-slate-100">
                      <td className="truncate px-2 py-1.5 text-center" title={row.nickname ?? row.chatId}>
                        {row.nickname ?? row.chatId}
                      </td>
                      <td className="px-2 py-1.5 text-center">{actionLabel(row.action)}</td>
                      <td
                        className="truncate px-2 py-1.5 text-center"
                        title={row.preferredDateRaw ?? undefined}
                      >
                        {row.preferredDateRaw ?? '—'}
                      </td>
                      <td className="px-2 py-1.5 text-center tabular-nums">{row.roomOpenedAt ?? '—'}</td>
                      <td className="truncate px-2 py-1.5 text-center" title={row.preferredReason ?? undefined}>
                        {row.reasons.map(reasonLabel).join(' · ') || row.skipReason || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : result ? (
            <p className="mt-3 text-center text-fluid-xs text-slate-500">정리 대상 채팅방이 없습니다.</p>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-wrap gap-2 border-t border-slate-200 px-3 py-2 sm:px-4">
          <button
            type="button"
            disabled={running || busy || !supported}
            onClick={() => void runScan(false)}
            className="min-h-10 flex-1 rounded-lg bg-slate-900 px-3 py-2 text-fluid-xs font-medium text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none sm:flex-none"
          >
            {running ? '검사 중…' : '미리보기 (dry-run)'}
          </button>
          <button
            type="button"
            disabled={running || busy || !supported}
            onClick={() => void runScan(true)}
            className="min-h-10 flex-1 rounded-lg border border-rose-300 bg-white px-3 py-2 text-fluid-xs font-semibold text-rose-800 hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none sm:flex-none"
          >
            실행 (나가기)
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
