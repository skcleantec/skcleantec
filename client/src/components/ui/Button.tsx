import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'quiet';
export type ButtonSize = 'lg' | 'md' | 'sm';

const SIZE: Record<ButtonSize, string> = {
  lg: 'h-11 rounded-[10px] px-5 text-[15px]',
  md: 'h-9 rounded-lg px-3.5 text-sm',
  sm: 'h-7 rounded-[7px] px-2.5 text-xs',
};

const VARIANT: Record<ButtonVariant, string> = {
  primary: 'border border-transparent bg-[#111a2b] font-bold text-white hover:bg-slate-800',
  secondary: 'border border-[#dde3ea] bg-white font-medium text-[#141b26] hover:bg-[#eef2f7]',
  danger: 'border border-[#f3b8b1] bg-white font-medium text-[#b42318] hover:bg-[#fdecea]',
  quiet: 'border border-transparent bg-transparent font-medium text-[#141b26] hover:bg-[#eef2f7]',
};

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: boolean;
  nowrap?: boolean;
  children?: ReactNode;
};

export function Button({
  variant = 'secondary',
  size = 'md',
  icon = false,
  nowrap = true,
  className = '',
  type = 'button',
  children,
  ...rest
}: Props) {
  const square = icon ? (size === 'lg' ? 'w-11 px-0' : size === 'md' ? 'w-9 px-0' : 'w-7 px-0') : '';
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-1.5 leading-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1f4fb8] disabled:cursor-not-allowed disabled:opacity-45 disabled:pointer-events-none ${nowrap ? 'whitespace-nowrap' : ''} ${SIZE[size]} ${VARIANT[variant]} ${square} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
