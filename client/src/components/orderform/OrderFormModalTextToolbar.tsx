import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  applyBgColorInEditor,
  applyBoldInEditor,
  applyFontSizeInEditor,
  applyTextColorInEditor,
  insertTextInEditor,
} from '../../utils/orderFormModalVisualEditor';
import { ORDER_FORM_MODAL_COLOR_SWATCHES } from '../../constants/orderFormModalColorSwatches';
import {
  ORDER_FORM_MODAL_EMOJI_GROUPS,
  ORDER_FORM_MODAL_SPECIAL_CHARS,
} from '../../constants/orderFormModalEmojis';

const PANEL_Z = 9999;
const VIEWPORT_PAD = 8;

type PanelPos = { top: number; left: number; width: number };

type PopoverKind = 'size' | 'textColor' | 'bgColor' | 'emoji' | 'special' | null;

const SIZE_OPTIONS = [
  { key: 'sm', label: '작게' },
  { key: 'base', label: '보통' },
  { key: 'lg', label: '크게' },
  { key: 'xl', label: '더크게' },
  { key: '2xl', label: '제목' },
] as const;

function computePanelPos(anchor: DOMRect, width: number, maxHeight: number): PanelPos {
  const gap = 4;
  let left = anchor.left;
  if (left + width > window.innerWidth - VIEWPORT_PAD) {
    left = anchor.right - width;
  }
  left = Math.max(VIEWPORT_PAD, Math.min(left, window.innerWidth - width - VIEWPORT_PAD));
  let top = anchor.bottom + gap;
  if (top + maxHeight > window.innerHeight - VIEWPORT_PAD) {
    top = anchor.top - gap - maxHeight;
  }
  top = Math.max(VIEWPORT_PAD, Math.min(top, window.innerHeight - VIEWPORT_PAD));
  return { top, left, width };
}

function ToolBtn({
  title,
  onClick,
  active,
  children,
  btnRef,
  className = '',
}: {
  title: string;
  onClick: () => void;
  active?: boolean;
  children: ReactNode;
  btnRef?: (el: HTMLButtonElement | null) => void;
  className?: string;
}) {
  return (
    <button
      ref={btnRef}
      type="button"
      title={title}
      aria-label={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={(e) => {
        e.preventDefault();
        onClick();
      }}
      className={`inline-flex h-7 min-w-[1.75rem] items-center justify-center rounded border px-1.5 text-fluid-xs leading-none transition ${
        active
          ? 'border-slate-700 bg-slate-800 text-white'
          : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-100'
      } ${className}`}
    >
      {children}
    </button>
  );
}

function ColorSwatchGrid({
  onPick,
  showCustom,
}: {
  onPick: (hex: string) => void;
  showCustom?: boolean;
}) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-5 gap-1.5">
        {ORDER_FORM_MODAL_COLOR_SWATCHES.map((hex) => (
          <button
            key={hex}
            type="button"
            title={hex}
            aria-label={`색상 ${hex}`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onPick(hex)}
            className={`h-6 w-6 rounded border ${
              hex.toLowerCase() === '#ffffff' ? 'border-gray-300' : 'border-white shadow-sm'
            }`}
            style={{ backgroundColor: hex }}
          />
        ))}
      </div>
      {showCustom ? (
        <label className="flex items-center gap-2 text-fluid-2xs text-gray-600">
          <span className="shrink-0">직접 선택</span>
          <input
            type="color"
            defaultValue="#dc2626"
            className="h-7 w-10 cursor-pointer rounded border border-gray-300 bg-white p-0.5"
            onMouseDown={(e) => e.stopPropagation()}
            onChange={(e) => onPick(e.target.value)}
          />
        </label>
      ) : null}
    </div>
  );
}

export function OrderFormModalTextToolbar({
  editorRef,
  onEdited,
  onSave,
  saving = false,
}: {
  editorRef: React.RefObject<HTMLDivElement | null>;
  onEdited: () => void;
  onSave?: () => void;
  saving?: boolean;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const anchorRefs = useRef<Partial<Record<Exclude<PopoverKind, null>, HTMLButtonElement | null>>>({});
  const [openPanel, setOpenPanel] = useState<PopoverKind>(null);
  const [panelPos, setPanelPos] = useState<PanelPos | null>(null);

  const withEditor = useCallback(
    (fn: (root: HTMLDivElement) => void) => {
      const el = editorRef.current;
      if (!el) return;
      fn(el);
      onEdited();
    },
    [editorRef, onEdited],
  );

  const applyInsert = useCallback(
    (snippet: string) => {
      withEditor((root) => insertTextInEditor(root, snippet));
    },
    [withEditor],
  );

  const applyColor = useCallback(
    (hex: string, kind: 'text' | 'bg') => {
      withEditor((root) => {
        if (kind === 'text') applyTextColorInEditor(root, hex);
        else applyBgColorInEditor(root, hex);
      });
      setOpenPanel(null);
    },
    [withEditor],
  );

  const updatePanelPos = useCallback((kind: Exclude<PopoverKind, null>) => {
    const btn = anchorRefs.current[kind];
    if (!btn) return;
    const widths: Record<Exclude<PopoverKind, null>, number> = {
      size: 132,
      textColor: 168,
      bgColor: 168,
      emoji: 280,
      special: 220,
    };
    const heights: Record<Exclude<PopoverKind, null>, number> = {
      size: 180,
      textColor: 220,
      bgColor: 220,
      emoji: 320,
      special: 180,
    };
    setPanelPos(computePanelPos(btn.getBoundingClientRect(), widths[kind], heights[kind]));
  }, []);

  const togglePanel = (kind: Exclude<PopoverKind, null>) => {
    setOpenPanel((prev) => {
      const next = prev === kind ? null : kind;
      if (next) updatePanelPos(next);
      return next;
    });
  };

  useLayoutEffect(() => {
    if (!openPanel) setPanelPos(null);
  }, [openPanel]);

  useEffect(() => {
    if (!openPanel) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (rootRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpenPanel(null);
    };
    const onReposition = () => {
      if (openPanel) updatePanelPos(openPanel);
    };
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('resize', onReposition);
    window.addEventListener('scroll', onReposition, true);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('resize', onReposition);
      window.removeEventListener('scroll', onReposition, true);
    };
  }, [openPanel, updatePanelPos]);

  const setAnchor = (kind: Exclude<PopoverKind, null>) => (el: HTMLButtonElement | null) => {
    anchorRefs.current[kind] = el;
  };

  const panelContent = (() => {
    if (!openPanel) return null;
    if (openPanel === 'size') {
      return (
        <div className="space-y-0.5">
          {SIZE_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                withEditor((root) => applyFontSizeInEditor(root, opt.key));
                setOpenPanel(null);
              }}
              className="block w-full rounded px-2 py-1.5 text-left text-fluid-xs text-gray-800 hover:bg-gray-100"
            >
              {opt.label}
            </button>
          ))}
        </div>
      );
    }
    if (openPanel === 'textColor') {
      return (
        <div>
          <p className="mb-2 text-fluid-2xs font-medium text-gray-600">글자색</p>
          <ColorSwatchGrid showCustom onPick={(hex) => applyColor(hex, 'text')} />
        </div>
      );
    }
    if (openPanel === 'bgColor') {
      return (
        <div>
          <p className="mb-2 text-fluid-2xs font-medium text-gray-600">배경색</p>
          <ColorSwatchGrid showCustom onPick={(hex) => applyColor(hex, 'bg')} />
        </div>
      );
    }
    if (openPanel === 'emoji') {
      return (
        <div className="max-h-[300px] space-y-2 overflow-y-auto overscroll-contain pr-0.5">
          {ORDER_FORM_MODAL_EMOJI_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="mb-1 text-fluid-2xs font-medium text-gray-500">{group.label}</p>
              <div className="grid grid-cols-8 gap-0.5">
                {group.items.map((em) => (
                  <button
                    key={`${group.label}-${em}`}
                    type="button"
                    title={em}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      applyInsert(em);
                      setOpenPanel(null);
                    }}
                    className="h-8 rounded text-lg hover:bg-gray-100"
                  >
                    {em}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      );
    }
    return (
      <div>
        <p className="mb-2 text-fluid-2xs font-medium text-gray-600">특수문자</p>
        <div className="grid grid-cols-6 gap-1">
          {ORDER_FORM_MODAL_SPECIAL_CHARS.map((ch) => (
            <button
              key={ch}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                applyInsert(ch);
                setOpenPanel(null);
              }}
              className="h-8 rounded border border-gray-200 bg-white text-fluid-sm hover:bg-gray-100"
            >
              {ch}
            </button>
          ))}
        </div>
      </div>
    );
  })();

  const panel =
    openPanel && panelPos
      ? createPortal(
          <div
            ref={panelRef}
            className="fixed rounded-lg border border-gray-200 bg-white p-2 shadow-lg"
            style={{
              top: panelPos.top,
              left: panelPos.left,
              width: panelPos.width,
              zIndex: PANEL_Z,
            }}
          >
            {panelContent}
          </div>,
          document.body,
        )
      : null;

  return (
    <div ref={rootRef} className="rounded-t-lg border border-b-0 border-gray-300 bg-gray-50 px-1 py-1">
      <div className="flex w-full flex-wrap items-center gap-0.5">
        <ToolBtn title="두껍게 · 굵게 (B)" onClick={() => withEditor(applyBoldInEditor)}>
          <span className="font-bold">B</span>
        </ToolBtn>
        <ToolBtn
          title="글자 크기 (T)"
          active={openPanel === 'size'}
          btnRef={setAnchor('size')}
          onClick={() => togglePanel('size')}
          className="gap-0.5 px-1"
        >
          <span className="font-semibold">T</span>
          <span className="text-[10px] opacity-70">▼</span>
        </ToolBtn>
        <ToolBtn
          title="글자색"
          active={openPanel === 'textColor'}
          btnRef={setAnchor('textColor')}
          onClick={() => togglePanel('textColor')}
          className="min-w-[2rem] flex-col gap-0 py-0.5"
        >
          <span className="font-semibold leading-none">A</span>
          <span className="h-0.5 w-3.5 rounded-sm bg-red-600" />
        </ToolBtn>
        <ToolBtn
          title="배경색"
          active={openPanel === 'bgColor'}
          btnRef={setAnchor('bgColor')}
          onClick={() => togglePanel('bgColor')}
        >
          <span className="rounded-sm bg-amber-200 px-1 text-fluid-2xs font-semibold leading-tight text-amber-950">
            A
          </span>
        </ToolBtn>
        <ToolBtn
          title="이모지"
          active={openPanel === 'emoji'}
          btnRef={setAnchor('emoji')}
          onClick={() => togglePanel('emoji')}
          className="text-base"
        >
          😀
        </ToolBtn>
        <ToolBtn
          title="특수문자 (Ω)"
          active={openPanel === 'special'}
          btnRef={setAnchor('special')}
          onClick={() => togglePanel('special')}
          className="font-serif"
        >
          Ω
        </ToolBtn>
        {onSave ? (
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="ml-auto inline-flex h-7 shrink-0 items-center justify-center rounded border border-slate-800 bg-slate-900 px-2.5 text-fluid-2xs font-medium text-white disabled:opacity-50"
          >
            {saving ? '저장 중…' : '저장'}
          </button>
        ) : null}
      </div>
      {panel}
    </div>
  );
}
