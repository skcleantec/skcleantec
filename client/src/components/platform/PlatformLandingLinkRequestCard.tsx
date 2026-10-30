import { useState } from 'react';

export type LandingLinkRequestCardRow = {
  id: string;
  tenantName: string;
  tenantSlug: string;
  requestedCount: number;
  suggestedCount: number;
  status: string;
  statusLabel: string;
  message: string | null;
  adminNote: string | null;
  requestedStamp: string;
  reviewedStamp: string | null;
  requesterName: string | null;
  requesterRoleLabel: string | null;
  reviewerName: string | null;
  activeFree: number;
  freeIncluded: number;
  approvedPaid: number;
  billingPhrase: string;
  unitKrw: number;
};

const primary =
  'inline-flex min-h-10 items-center justify-center rounded-lg bg-[#111a2b] px-4 text-fluid-sm font-bold text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1f4fb8] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 max-sm:w-full';
const ghost =
  'inline-flex min-h-10 items-center justify-center rounded-lg border border-[#dde3ea] bg-transparent px-4 text-fluid-sm font-medium text-[#141b26] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1f4fb8] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 max-sm:w-full';
const danger =
  'inline-flex min-h-10 items-center justify-center rounded-lg border border-[#f3b8b1] bg-transparent px-4 text-fluid-sm font-medium text-[#b42318] hover:bg-[#fdecea] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b42318] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 max-sm:w-full';
const stepBtn =
  'h-[38px] w-9 border-0 bg-transparent text-base text-[#141b26] hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1f4fb8] disabled:pointer-events-none disabled:opacity-40';

function chipClass(status: string): string {
  if (status === 'PENDING') return 'border-[#f0d27a] bg-[#fff6dc] text-[#7a5300]';
  if (status === 'APPROVED') return 'border-[#a9dfc1] bg-[#e3f6ec] text-[#126b3f]';
  if (status === 'REJECTED') return 'border-[#f3b8b1] bg-[#fdecea] text-[#b42318]';
  return 'border-[#dde3ea] bg-white text-[#5d6878]';
}

export function PlatformLandingLinkRequestCard({
  row,
  busy,
  onApprove,
  onReject,
}: {
  row: LandingLinkRequestCardRow;
  busy: boolean;
  onApprove: (count: number) => void;
  onReject: (reason: string) => void;
}) {
  const pending = row.status === 'PENDING';
  const [count, setCount] = useState(Math.min(50, Math.max(1, row.suggestedCount || 1)));
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState('');
  const monthly = count * row.unitKrw;
  const askCount = row.requestedCount > 0 ? row.requestedCount : count;
  const askMonthly = askCount * row.unitKrw;
  const who = row.requesterName
    ? `${row.requesterName}(${row.requesterRoleLabel || '담당'})`
    : '요청자 없음';
  const maxLinks = row.freeIncluded + row.approvedPaid + count;

  return (
    <article className="overflow-hidden rounded-[14px] border border-[#dde3ea] bg-white">
      <div className="flex flex-wrap items-center gap-2 border-b border-[#dde3ea] px-4 py-4 sm:px-5">
        <span className="text-fluid-base font-bold text-[#141b26]">문의 링크 추가 구매</span>
        <span className="text-fluid-sm text-[#5d6878]">
          {row.tenantName} ({row.tenantSlug})
        </span>
        <span className={`ml-auto rounded-full border px-2 py-0.5 text-fluid-2xs ${chipClass(row.status)}`}>{row.statusLabel}</span>
      </div>
      <div className="grid gap-3.5 px-4 py-4 sm:px-5">
        <p className="text-fluid-sm text-[#141b26]">
          문의 링크 <b className="text-lg tabular-nums">{askCount}개</b>를 더 쓰고 싶어요{' '}
          <span className="tabular-nums text-[#5d6878]">· 월 {askMonthly.toLocaleString('ko-KR')}원</span>
        </p>
        <dl className="grid grid-cols-1 gap-0 text-fluid-xs sm:grid-cols-[110px_1fr] sm:gap-x-3.5 sm:gap-y-1.5">
          <dt className="text-[#5d6878]">요청</dt>
          <dd className="mb-2 tabular-nums sm:mb-0">
            {row.requestedStamp} · {who}
          </dd>
          <dt className="text-[#5d6878]">지금 쓰는 링크</dt>
          <dd className="mb-2 sm:mb-0">
            무료 {row.freeIncluded}개 중 {row.activeFree}개 사용 · 구매 {row.approvedPaid}개
          </dd>
          {pending ? (
            <>
              <dt className="text-[#5d6878]">승인하면</dt>
              <dd className="mb-2 flex flex-wrap items-center gap-1.5 sm:mb-0">
                <span>구매 {row.approvedPaid}개</span>
                <span className="text-[#5d6878]">→</span>
                <b className="tabular-nums">구매 {count}개</b>
                <span className="rounded-full border border-[#dde3ea] px-2 py-0.5 text-fluid-2xs text-[#5d6878]">링크 최대 {maxLinks}개</span>
              </dd>
              <dt className="text-[#5d6878]">청구</dt>
              <dd className="tabular-nums">
                개당 월 {row.unitKrw.toLocaleString('ko-KR')}원 × {count} = <b>월 {monthly.toLocaleString('ko-KR')}원</b> · {row.billingPhrase}
              </dd>
            </>
          ) : (
            <>
              <dt className="text-[#5d6878]">처리</dt>
              <dd>
                {row.reviewerName || '운영'}
                {row.reviewedStamp ? ` · ${row.reviewedStamp}` : ''}
              </dd>
            </>
          )}
        </dl>
        {row.message ? (
          <div className="rounded-[10px] border border-[#dde3ea] bg-[#f6f8fb] px-3 py-2.5 text-fluid-xs">
            <b className="block text-fluid-2xs font-medium text-[#5d6878]">업체가 남긴 말</b>
            {row.message}
          </div>
        ) : null}
        {!pending && row.adminNote ? (
          <div className="rounded-[10px] border border-[#dde3ea] bg-[#f6f8fb] px-3 py-2.5 text-fluid-xs">
            <b className="block text-fluid-2xs font-medium text-[#5d6878]">반려 사유</b>
            {row.adminNote}
          </div>
        ) : null}
      </div>
      {pending ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-[#dde3ea] bg-[#f6f8fb] px-4 py-3.5 sm:px-5">
          <span className="text-fluid-2xs text-[#5d6878]">승인할 개수</span>
          <span className="inline-flex items-center overflow-hidden rounded-lg border border-[#dde3ea] bg-white">
            <button type="button" className={stepBtn} aria-label="하나 줄이기" disabled={busy || count <= 1} onClick={() => setCount((n) => Math.max(1, n - 1))}>
              −
            </button>
            <output className="min-w-11 text-center font-bold tabular-nums">{count}</output>
            <button type="button" className={stepBtn} aria-label="하나 늘리기" disabled={busy || count >= 50} onClick={() => setCount((n) => Math.min(50, n + 1))}>
              +
            </button>
          </span>
          <button type="button" className={primary} disabled={busy} onClick={() => onApprove(count)}>
            {count}개 승인 · 월 {monthly.toLocaleString('ko-KR')}원
          </button>
          <button type="button" className={danger} disabled={busy} onClick={() => setRejectOpen((open) => !open)}>
            반려
          </button>
        </div>
      ) : null}
      {pending && rejectOpen ? (
        <div className="grid gap-2 border-t border-[#dde3ea] px-4 py-3.5 sm:px-5">
          <label className="grid gap-1.5 text-fluid-xs text-[#5d6878]" htmlFor={`reason-${row.id}`}>
            반려 사유 <span>(업체에 그대로 보여요)</span>
            <textarea
              id={`reason-${row.id}`}
              rows={2}
              className="w-full rounded-lg border border-[#dde3ea] px-3 py-2 text-fluid-sm text-[#141b26] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1f4fb8] focus-visible:ring-offset-2"
              value={reason}
              disabled={busy}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={danger} disabled={busy || reason.trim().length === 0} onClick={() => onReject(reason.trim())}>
              반려 보내기
            </button>
            <button type="button" className={ghost} disabled={busy} onClick={() => setRejectOpen(false)}>
              취소
            </button>
          </div>
        </div>
      ) : null}
    </article>
  );
}
