const SIZE = {
  lg: 'h-11 rounded-[10px] px-5 text-[15px]',
  md: 'h-9 rounded-lg px-3.5 text-sm',
  sm: 'h-7 rounded-[7px] px-2.5 text-xs',
} as const;

const VARIANT = {
  primary: 'border border-transparent bg-[#111a2b] font-bold text-white hover:bg-slate-800',
  secondary: 'border border-[#dde3ea] bg-white font-medium text-[#141b26] hover:bg-[#eef2f7]',
} as const;

export function PgCardReceiptLink({
  url,
  size = 'md',
  variant = 'secondary',
  className = '',
}: {
  url?: string | null;
  size?: keyof typeof SIZE;
  variant?: keyof typeof VARIANT;
  className?: string;
}) {
  const href = typeof url === 'string' ? url.trim() : '';
  if (!/^https?:\/\//i.test(href)) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener"
      className={`inline-flex items-center justify-center gap-1.5 whitespace-nowrap leading-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1f4fb8] ${SIZE[size]} ${VARIANT[variant]} ${className}`}
    >
      카드 영수증 보기
    </a>
  );
}
