import type { OrderFollowupBooking } from '../../api/orderFollowups';

const REASON_LABEL: Record<string, string> = {
  phone: '전화번호',
  linked: '접수 연결',
  name: '이름',
  address: '주소',
  building: '건물 유형',
  structure: '평수·구조',
  date: '희망일',
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: '대기',
  RECEIVED: '접수',
  DEPOSIT_PENDING: '입금대기',
  DEPOSIT_COMPLETED: '입금완료',
  ORDER_FORM_PENDING: '미제출',
  ASSIGNED: '분배완료',
  IN_PROGRESS: '진행중',
  COMPLETED: '완료',
  ON_HOLD: '보류',
  CS_PROCESSING: 'C/S 처리중',
};

function shortDate(ymd: string | null | undefined): string {
  if (!ymd) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd);
  return m ? `${Number(m[2])}/${Number(m[3])}` : '';
}

function bookingReasonsText(booking: OrderFollowupBooking): string {
  return booking.reasons.map((r) => REASON_LABEL[r] ?? r).join(' · ');
}

/** 「이미 예약」「예약 의심」「다른 브랜드로 예약됨」 한 줄 글 */
function bookingHeadline(booking: OrderFollowupBooking): string {
  if (booking.level === 'booked') return '이미 예약';
  if (booking.level === 'otherBrand') return `${booking.operatingCompanyName ?? '다른 브랜드'}로 예약됨`;
  if (booking.level === 'past') return '지난 이용 고객';
  return '예약 의심';
}

function bookingDetail(booking: OrderFollowupBooking): string {
  return [
    shortDate(booking.preferredDate),
    booking.level === 'otherBrand' ? '' : booking.operatingCompanyName,
    booking.status ? STATUS_LABEL[booking.status] ?? '' : '',
    booking.marketerName ? `담당 ${booking.marketerName}` : '',
  ]
    .filter(Boolean)
    .join(' · ');
}

const TONE = {
  booked: 'border-rose-300 bg-rose-50 text-rose-800',
  otherBrand: 'border-sky-300 bg-sky-50 text-sky-800',
  suspect: 'border-amber-300 bg-amber-50 text-amber-900',
  past: 'border-slate-300 bg-slate-50 text-slate-700',
} as const;

/** 접수 목록에 이미 있는 고객이면 붙는 표시. 목록 줄에는 작게, 상세에는 banner 로. */
export function FollowupBookingNote({
  booking,
  variant = 'chip',
  className = '',
}: {
  booking?: OrderFollowupBooking | null;
  variant?: 'chip' | 'banner';
  className?: string;
}) {
  if (!booking) return null;
  const head = bookingHeadline(booking);
  const detail = bookingDetail(booking);
  const why = bookingReasonsText(booking);
  const title = [`${head}${detail ? ` · ${detail}` : ''}`, booking.inquiryNumber ? `접수번호 ${booking.inquiryNumber}` : '', why ? `같은 것: ${why}` : '']
    .filter(Boolean)
    .join('\n');

  if (variant === 'chip') {
    return (
      <span
        title={title}
        className={`inline-flex max-w-full items-center truncate whitespace-nowrap rounded-md border px-1 py-px text-[10.5px] font-bold leading-tight ${TONE[booking.level]} ${className}`}
      >
        {head}
        {shortDate(booking.preferredDate) ? ` · ${shortDate(booking.preferredDate)}` : ''}
      </span>
    );
  }

  return (
    <div
      role={booking.level === 'suspect' || booking.level === 'past' ? 'status' : 'alert'}
      className={`rounded-lg border px-3 py-2 text-fluid-xs leading-relaxed ${TONE[booking.level]} ${className}`}
    >
      <b className="font-bold">
        {booking.level === 'booked'
          ? '이미 예약한 고객입니다. 전화하지 마세요.'
          : booking.level === 'otherBrand'
            ? `${booking.operatingCompanyName ?? '다른 브랜드'}로 이미 예약한 고객입니다.`
            : booking.level === 'past'
              ? '예전에 이용한 고객입니다. 다시 문의한 것일 수 있어요.'
              : '이미 예약한 고객일 수 있어요. 전화 전에 접수 목록을 확인하세요.'}
      </b>
      {detail ? <span className="ml-1.5">{detail}</span> : null}
      {booking.inquiryNumber ? <span className="ml-1.5 tabular-nums">접수번호 {booking.inquiryNumber}</span> : null}
      {why ? <span className="mt-0.5 block text-fluid-2xs opacity-80">같은 것: {why}</span> : null}
    </div>
  );
}
