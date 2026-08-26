const NO_DEPOSIT_ICON_SRC = '/icons/inquiry-no-deposit.png';

type Props = {
  className?: string;
  title?: string;
};

/** 스케줄 등 — 예약금 없음(0원) 내부 표식. 작은 아이콘만, 툴팁으로 의미 전달. */
export function NoDepositIcon({ className = '', title = '예약금 없음' }: Props) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center leading-none ${className}`}
      title={title}
    >
      <img
        src={NO_DEPOSIT_ICON_SRC}
        alt=""
        width={12}
        height={12}
        className="h-3 w-3 shrink-0 object-contain sm:h-3.5 sm:w-3.5"
        draggable={false}
      />
    </span>
  );
}
