import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ModalCloseButton } from '../admin/ModalCloseButton';
import { getOrderFormCustomerSubmission } from '../../api/orderform';
import { formatDateCompactWithWeekday } from '../../utils/dateFormat';
import {
  isOrderFormSubmissionSnapshotV1,
  OrderFormSubmissionSnapshotContent,
} from './orderFormSubmissionSnapshot';

export function CustomerOrderSubmissionSnapshotModal(props: {
  open: boolean;
  onClose: () => void;
  authToken: string | null;
  orderFormId: string | null;
  customerName: string;
}) {
  const { open, onClose, authToken, orderFormId, customerName } = props;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<unknown | null>(null);

  useEffect(() => {
    if (!open || !authToken || !orderFormId) {
      setLoading(false);
      setError(null);
      setSubmittedAt(null);
      setSnapshot(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSubmittedAt(null);
    setSnapshot(null);
    void getOrderFormCustomerSubmission(authToken, orderFormId)
      .then((r) => {
        if (cancelled) return;
        setSubmittedAt(r.submittedAt);
        setSnapshot(r.snapshot);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : '불러오지 못했습니다.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, authToken, orderFormId]);

  if (!open || typeof document === 'undefined') return null;

  const root = document.body;

  return createPortal(
    <div
      className="fixed inset-0 z-[260] flex items-center justify-center p-4 bg-black/45"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[min(92vh,44rem)] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl sm:max-w-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="order-submission-snapshot-title"
        onClick={(e) => e.stopPropagation()}
      >
        <ModalCloseButton onClick={onClose} />
        <div className="shrink-0 border-b border-gray-100 px-4 pb-3 pt-4 pr-14">
          <h2 id="order-submission-snapshot-title" className="text-base font-semibold text-gray-900">
            고객 제출 발주서 원본
          </h2>
          <p className="mt-1 text-fluid-xs text-gray-600">{customerName}</p>
          {submittedAt ? (
            <p className="mt-0.5 text-fluid-2xs text-gray-500 tabular-nums">
              제출 시각 {formatDateCompactWithWeekday(submittedAt)}
            </p>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {!authToken ? (
            <p className="text-fluid-sm text-gray-600">로그인이 필요합니다.</p>
          ) : loading ? (
            <p className="text-fluid-sm text-gray-500">불러오는 중…</p>
          ) : error ? (
            <p className="text-fluid-sm text-red-600">{error}</p>
          ) : !submittedAt ? (
            <p className="text-fluid-sm text-gray-600">아직 제출되지 않은 발주서입니다.</p>
          ) : snapshot == null ? (
            <p className="text-fluid-sm text-gray-600">
              저장된 제출 원본이 없습니다. 과거에 제출된 건이거나 DB 마이그레이션 이전 데이터일 수 있습니다. 접수
              상세의 입력값을 참고해 주세요.
            </p>
          ) : isOrderFormSubmissionSnapshotV1(snapshot) ? (
            <OrderFormSubmissionSnapshotContent snapshot={snapshot} submittedAt={submittedAt} />
          ) : (
            <OrderFormSubmissionSnapshotContent snapshot={snapshot} submittedAt={submittedAt} />
          )}
        </div>

        <div className="shrink-0 border-t border-gray-100 bg-gray-50 px-4 py-3">
          <p className="text-fluid-2xs leading-snug text-gray-600">
            이 내용은 고객이 「제출」을 눌렀을 때 서버에 저장된 확정값입니다. 고객은 발주서 링크에서 동일 내용을
            확인할 수 있습니다.
          </p>
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-fluid-sm font-medium text-gray-800 hover:bg-gray-50"
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    </div>,
    root
  );
}
