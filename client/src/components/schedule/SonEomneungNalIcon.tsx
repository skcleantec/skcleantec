import { SON_EOMNEUNG_NAL_HELP } from '../../utils/sonEomneungNal';

export const SON_EOMNEUNG_NAL_ICON_SRC = '/assets/calendar/son-eomneung-nal.png';

/** 손없는날 캘린더 마크 — 뷰포트에 맞춰 크기 자동 조절 */
export function SonEomneungNalIcon({
  className = '',
  title = SON_EOMNEUNG_NAL_HELP,
}: {
  className?: string;
  title?: string;
}) {
  return (
    <img
      src={SON_EOMNEUNG_NAL_ICON_SRC}
      alt=""
      title={title}
      aria-hidden
      className={`inline-block shrink-0 object-contain align-middle h-[clamp(0.625rem,0.12rem+2.2vmin,0.875rem)] w-[clamp(0.625rem,0.12rem+2.2vmin,0.875rem)] sm:h-[clamp(0.6875rem,0.18rem+2.5vmin,0.9375rem)] sm:w-[clamp(0.6875rem,0.18rem+2.5vmin,0.9375rem)] ${className}`}
    />
  );
}
