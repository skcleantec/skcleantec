import { LineMdIcon } from './LineMdIcon';

type Props = {
  className?: string;
  title?: string;
};

/** 스케줄 목록 — 추가 시공 금액이 있는 접수. 글자 없이 작은 아이콘만. */
export function ExtraWorkAmountIcon({ className = '', title = '추가 시공' }: Props) {
  return (
    <span
      className={`inline-flex size-3.5 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-800 ring-1 ring-amber-200 sm:size-4 ${className}`}
      title={title}
    >
      <LineMdIcon name="plus" className="size-2.5 sm:size-3" />
    </span>
  );
}
