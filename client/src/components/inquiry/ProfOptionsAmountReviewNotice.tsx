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

export function ProfOptionsAmountReviewBanner(props: {
  applying?: boolean;
  onApply?: () => void;
}) {
  const { applying, onApply } = props;
  return (
    <div className="rounded-xl border border-amber-200/90 bg-amber-50/90 px-4 py-3 text-fluid-sm text-amber-950 shadow-sm">
      <p className="font-semibold">추가 시공 옵션 — 금액 설정 필요</p>
      <p className="mt-1.5 text-fluid-xs leading-relaxed text-amber-900/90">
        고객이 전문 시공 유료옵션을 선택해 제출했습니다. 단가가 있는 항목은 아래 버튼으로{' '}
        <span className="font-medium">결제 금액 내역(추가 청소)</span>에 반영하고, 단가가 없는
        항목은 <span className="font-medium">총액·예약금·잔금</span> 또는 추가결재를 직접 입력한 뒤
        저장해 주세요.
      </p>
      {onApply ? (
        <button
          type="button"
          disabled={applying}
          onClick={onApply}
          className="mt-3 rounded-lg bg-amber-800 px-3.5 py-2 text-fluid-xs font-semibold text-white hover:bg-amber-900 disabled:opacity-50"
        >
          {applying ? '반영 중…' : '옵션 단가 → 추가 금액 반영'}
        </button>
      ) : null}
    </div>
  );
}
