import { getSafePhoneExpiry } from '../../utils/safePhoneExpiry';

/** 부재·보류 목록의 연락처 옆 — 0504 안심번호가 48시간을 넘겼는지 알려 준다. */
export function SafePhoneExpiryBadge({
  phones,
  createdAt,
  className = '',
}: {
  phones: Array<string | null | undefined>;
  createdAt: string | null | undefined;
  className?: string;
}) {
  const state = getSafePhoneExpiry(phones, createdAt);
  if (state.kind === 'none') return null;
  if (state.kind === 'expired') {
    return (
      <span
        title={
          state.hasOtherPhone
            ? '안심번호는 48시간이 지나 쓸 수 없어요. 고객 연락처로 걸어 주세요.'
            : '안심번호는 48시간이 지나면 끊기거나 다른 사람에게 넘어가요. 이 번호로 전화하지 마세요.'
        }
        className={`inline-flex items-center gap-0.5 whitespace-nowrap rounded-md border border-rose-300 bg-rose-50 px-1 py-px text-[10.5px] font-bold leading-tight text-rose-700 ${className}`}
      >
        <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" aria-hidden>
          <circle cx="12" cy="12" r="9" />
          <path strokeLinecap="round" d="M6 6l12 12" />
        </svg>
        48시간 초과
      </span>
    );
  }
  return (
    <span
      title="안심번호는 등록하고 48시간까지만 쓸 수 있어요."
      className={`inline-flex items-center whitespace-nowrap rounded-md border border-amber-300 bg-amber-50 px-1 py-px text-[10.5px] font-semibold leading-tight text-amber-800 ${className}`}
    >
      안심 {state.hoursLeft}시간 남음
    </span>
  );
}
