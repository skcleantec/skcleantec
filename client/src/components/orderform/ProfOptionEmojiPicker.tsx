import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CLEANING_PROF_OPTION_EMOJIS } from '../../constants/professionalOptionEmojis';

const PANEL_WIDTH = 256;
const PANEL_MAX_HEIGHT = 220;
const VIEWPORT_PAD = 8;

type Props = {
  value: string;
  onChange: (emoji: string) => void;
  className?: string;
  /** 좁은 편집 행용 */
  compact?: boolean;
};

type PanelPos = { top: number; left: number; width: number };

function computePanelPos(btn: DOMRect): PanelPos {
  const width = Math.min(PANEL_WIDTH, window.innerWidth - VIEWPORT_PAD * 2);
  const gap = 4;

  let left = btn.left;
  if (left + width > window.innerWidth - VIEWPORT_PAD) {
    left = btn.right - width;
  }
  left = Math.max(VIEWPORT_PAD, Math.min(left, window.innerWidth - width - VIEWPORT_PAD));

  let top = btn.bottom + gap;
  if (top + PANEL_MAX_HEIGHT > window.innerHeight - VIEWPORT_PAD) {
    top = btn.top - gap - PANEL_MAX_HEIGHT;
  }
  top = Math.max(VIEWPORT_PAD, Math.min(top, window.innerHeight - VIEWPORT_PAD));

  return { top, left, width };
}

export function ProfOptionEmojiPicker({ value, onChange, className = '', compact }: Props) {
  const [open, setOpen] = useState(false);
  const [panelPos, setPanelPos] = useState<PanelPos | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const updatePanelPos = () => {
    if (!btnRef.current) return;
    setPanelPos(computePanelPos(btnRef.current.getBoundingClientRect()));
  };

  useLayoutEffect(() => {
    if (!open) {
      setPanelPos(null);
      return;
    }
    updatePanelPos();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (rootRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onReposition = () => updatePanelPos();
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('resize', onReposition);
    window.addEventListener('scroll', onReposition, true);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('resize', onReposition);
      window.removeEventListener('scroll', onReposition, true);
    };
  }, [open]);

  const btnCls = compact
    ? 'h-7 min-w-[2rem] px-1 border border-gray-300 rounded text-base leading-none bg-white'
    : 'h-8 min-w-[2.5rem] px-1.5 border border-gray-300 rounded text-lg leading-none bg-white';

  const panel =
    open && panelPos
      ? createPortal(
          <div
            ref={panelRef}
            className="fixed z-[9999] p-2 bg-white border border-gray-200 rounded-lg shadow-lg"
            style={{
              top: panelPos.top,
              left: panelPos.left,
              width: panelPos.width,
              maxHeight: PANEL_MAX_HEIGHT,
            }}
            role="listbox"
            aria-label="청소 관련 이모지"
          >
            <p className="text-[10px] text-gray-500 mb-1.5 px-0.5">청소·시공 관련 이모지</p>
            <div className="grid grid-cols-8 gap-0.5 max-h-40 overflow-y-auto overscroll-contain">
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
          </div>,
          document.body,
        )
      : null;

  return (
    <div ref={rootRef} className={`inline-block ${className}`}>
      <button
        ref={btnRef}
        type="button"
        className={`${btnCls} hover:bg-gray-50`}
        onClick={() => setOpen((o) => !o)}
        aria-label="이모지 선택"
        aria-expanded={open}
      >
        {value.trim() || '🙂'}
      </button>
      {panel}
    </div>
  );
}
