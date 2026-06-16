import { useEffect, useRef, useState } from 'react';
import { CLEANING_PROF_OPTION_EMOJIS } from '../../constants/professionalOptionEmojis';

type Props = {
  value: string;
  onChange: (emoji: string) => void;
  className?: string;
  /** 좁은 편집 행용 */
  compact?: boolean;
};

export function ProfOptionEmojiPicker({ value, onChange, className = '', compact }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const btnCls = compact
    ? 'h-7 min-w-[2rem] px-1 border border-gray-300 rounded text-base leading-none bg-white'
    : 'h-8 min-w-[2.5rem] px-1.5 border border-gray-300 rounded text-lg leading-none bg-white';

  return (
    <div ref={rootRef} className={`relative inline-block ${className}`}>
      <button
        type="button"
        className={`${btnCls} hover:bg-gray-50`}
        onClick={() => setOpen((o) => !o)}
        aria-label="이모지 선택"
        aria-expanded={open}
      >
        {value.trim() || '🙂'}
      </button>
      {open ? (
        <div
          className="absolute z-50 mt-1 left-0 w-[min(16rem,calc(100vw-2rem))] p-2 bg-white border border-gray-200 rounded-lg shadow-lg"
          role="listbox"
          aria-label="청소 관련 이모지"
        >
          <p className="text-[10px] text-gray-500 mb-1.5 px-0.5">청소·시공 관련 이모지</p>
          <div className="grid grid-cols-8 gap-0.5 max-h-40 overflow-y-auto">
            {CLEANING_PROF_OPTION_EMOJIS.map((em) => (
              <button
                key={em}
                type="button"
                role="option"
                aria-selected={value === em}
                className={`h-8 text-lg rounded hover:bg-gray-100 ${
                  value === em ? 'bg-blue-50 ring-1 ring-blue-300' : ''
                }`}
                onClick={() => {
                  onChange(em);
                  setOpen(false);
                }}
              >
                {em}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="mt-1.5 w-full text-[10px] text-gray-500 py-1 hover:text-gray-800"
            onClick={() => {
              onChange('');
              setOpen(false);
            }}
          >
            이모지 없음
          </button>
        </div>
      ) : null}
    </div>
  );
}
