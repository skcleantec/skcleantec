import type { SelectHTMLAttributes } from 'react';

const chevronClass = 'pointer-events-none absolute inset-y-0 right-2 flex items-center text-gray-500';

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className ?? 'h-4 w-4'}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden
    >
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
        clipRule="evenodd"
      />
    </svg>
  );
}

/** 네이티브 select — 우측 드롭다운 화살표 표시 */
export function SelectWithChevron({
  className = '',
  wrapperClassName = '',
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { wrapperClassName?: string }) {
  return (
    <div className={`relative min-w-0 ${wrapperClassName}`.trim()}>
      <select {...props} className={`w-full appearance-none pr-7 ${className}`.trim()} />
      <span className={chevronClass}>
        <ChevronDownIcon />
      </span>
    </div>
  );
}

export { ChevronDownIcon };
