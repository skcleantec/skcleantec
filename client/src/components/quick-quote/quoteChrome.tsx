import type { ReactNode } from 'react';
import { Button } from '../ui/Button';

export const quoteCard = 'rounded-2xl border border-[#e6ebf2] bg-white';

export const quoteBottomButton =
  'w-full shadow-bar disabled:!border-transparent disabled:!bg-[#d5dbe3] disabled:!text-slate-500 disabled:!opacity-100';

export function QuoteBottomBar({ children }: { children: ReactNode }) {
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-[480px] bg-canvas px-3 pt-2"
      style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
    >
      {children}
    </div>
  );
}

export function QuoteChip({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <Button
      variant="quiet"
      size="sm"
      className={
        on
          ? 'shrink-0 !border !border-[#1f4fb8] !bg-[#121828] !text-white'
          : 'shrink-0 !border !border-[#e6ebf2] !bg-white !text-slate-700'
      }
      onClick={onClick}
    >
      {label}
    </Button>
  );
}
