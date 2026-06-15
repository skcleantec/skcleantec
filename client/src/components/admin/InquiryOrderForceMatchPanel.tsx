import { useEffect, useState } from 'react';
import {
  forceMatchOrderFormToInquiry,
  getForceMatchOrderFormCandidates,
  type ForceMatchOrderFormCandidate,
} from '../../api/orderform';

const STATUS_LABELS: Record<string, string> = {
  RECEIVED: '접수',
  PENDING: '대기',
  DEPOSIT_PENDING: '입금대기',
  DEPOSIT_COMPLETED: '입금완료',
  ORDER_FORM_PENDING: '미제출',
  ON_HOLD: '보류',
  CANCELLED: '취소',
  CANCEL_CONFIRMED: '취소확인',
};

type Props = {
  token: string;
  inquiryId: string;
  customerName: string;
  customerPhone: string;
  disabled?: boolean;
  onMatched: () => void | Promise<void>;
};

export function InquiryOrderForceMatchPanel({
  token,
  inquiryId,
  customerName,
  customerPhone,
  disabled,
  onMatched,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [refreshBump, setRefreshBump] = useState(0);
  const [candidates, setCandidates] = useState<ForceMatchOrderFormCandidate[]>([]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const q = query.trim();
    setLoading(true);
    setError(null);
    void getForceMatchOrderFormCandidates(token, {
      query: q || customerName || customerPhone,
      limit: 30,
    })
      .then((r) => {
        if (!cancelled) setCandidates(r.items);
      })
      .catch((e) => {
        if (!cancelled) {
          setCandidates([]);
          setError(e instanceof Error ? e.message : '강제 매칭 후보를 불러오지 못했습니다.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, query, token, customerName, customerPhone, refreshBump]);

  const handleApply = async (orderFormId: string) => {
    const ok = window.confirm(
      '선택한 제출 완료 발주서를 이 접수에 강제 매칭하고, 발주서 고객 작성 정보를 현재 접수에 반영할까요?'
    );
    if (!ok) return;
    setApplyingId(orderFormId);
    try {
      const out = await forceMatchOrderFormToInquiry(token, orderFormId, inquiryId);
      if (out.sourceInquiryId && out.sourceInquiryId !== inquiryId) {
        alert(
          `강제 매칭이 완료되었습니다.\n기존 발주서 연결 접수(${out.sourceInquiryId})가 별도로 남아 있으니 중복 여부를 확인해 정리해 주세요.`
        );
      } else {
        alert('강제 매칭이 완료되었습니다. 접수 정보와 상태를 새로고침합니다.');
      }
      setOpen(false);
      await onMatched();
    } catch (e) {
      alert(e instanceof Error ? e.message : '강제 매칭에 실패했습니다.');
    } finally {
      setApplyingId(null);
    }
  };

  return (
    <div className="sm:col-span-2 rounded-lg border border-blue-100 bg-blue-50/60 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-fluid-sm font-semibold text-blue-900">제출 완료 발주서 강제 매칭</p>
        <button
          type="button"
          onClick={() => setOpen((p) => !p)}
          className="rounded border border-blue-300 bg-white px-2.5 py-1 text-fluid-xs font-medium text-blue-800 hover:bg-blue-50"
        >
          {open ? '닫기' : '열기'}
        </button>
      </div>
      <p className="mt-1 text-fluid-xs text-blue-900/80">
        고객이 이미 발주서를 제출했는데 접수와 연결이 누락된 경우, 제출 완료 발주서를 선택해 정보를 이 접수에
        강제로 반영합니다.
      </p>
      {open ? (
        <div className="mt-2 space-y-2">
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="고객명/연락처/토큰 검색"
              className="min-w-0 flex-1 rounded border border-blue-200 bg-white px-3 py-2 text-fluid-sm"
            />
            <button
              type="button"
              onClick={() => setRefreshBump((v) => v + 1)}
              className="rounded border border-blue-300 bg-white px-3 py-2 text-fluid-sm font-medium text-blue-800 hover:bg-blue-50"
            >
              새로고침
            </button>
          </div>
          {error ? <p className="text-fluid-xs text-red-600">{error}</p> : null}
          {loading ? (
            <p className="text-fluid-xs text-slate-600">후보를 불러오는 중…</p>
          ) : candidates.length === 0 ? (
            <p className="text-fluid-xs text-slate-600">제출 완료 발주서 후보가 없습니다.</p>
          ) : (
            <div className="max-h-44 overflow-y-auto rounded border border-blue-100 bg-white">
              {candidates.map((cand) => (
                <div
                  key={cand.id}
                  className="flex flex-col gap-2 border-b border-blue-50 px-3 py-2 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate text-fluid-sm font-medium text-slate-900">
                      {cand.customerName} {cand.customerPhone ? `· ${cand.customerPhone}` : ''}
                    </p>
                    <p className="text-fluid-2xs text-slate-600">
                      제출:{' '}
                      {cand.submittedAt ? cand.submittedAt.slice(0, 16).replace('T', ' ') : '-'}
                      {cand.linkedInquiry
                        ? ` · 현재연결: ${STATUS_LABELS[cand.linkedInquiry.status] ?? cand.linkedInquiry.status}${cand.linkedInquiry.inquiryNumber ? ` (#${cand.linkedInquiry.inquiryNumber})` : ''}`
                        : ' · 현재연결: 없음'}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={Boolean(applyingId) || disabled}
                    onClick={() => void handleApply(cand.id)}
                    className="shrink-0 rounded border border-blue-500 bg-blue-600 px-2.5 py-1 text-fluid-xs font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {applyingId === cand.id ? '매칭 중…' : '이 접수에 강제 매칭'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
