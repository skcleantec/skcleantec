import { useEffect, useRef, useState } from 'react';
import { Button } from './Button';

export type RowMenuItem = {
  label: string;
  danger?: boolean;
  onSelect: () => void;
};

export function RowActions({
  action,
  menu,
}: {
  action?: { label: string; onClick: () => void };
  menu?: RowMenuItem[];
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, [open]);

  if (!action && (!menu || menu.length === 0)) return null;

  return (
    <div ref={rootRef} className="flex items-center justify-end gap-1.5">
      {action ? (
        <Button size="sm" variant="secondary" onClick={action.onClick}>
          {action.label}
        </Button>
      ) : null}
      {menu && menu.length > 0 ? (
        <span className="relative inline-block">
          <Button size="sm" variant="secondary" icon aria-label="더 보기" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
            ⋯
          </Button>
          {open ? (
            <span className="absolute right-0 top-8 z-20 grid min-w-[140px] rounded-[10px] border border-[#dde3ea] bg-white p-1 shadow-[0_8px_24px_rgba(0,0,0,0.12)]">
              {menu.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  className={`rounded-md px-2.5 py-2 text-left text-[13px] hover:bg-[#eef2f7] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1f4fb8] ${item.danger ? 'text-[#b42318]' : 'text-[#141b26]'}`}
                  onClick={() => {
                    setOpen(false);
                    item.onSelect();
                  }}
                >
                  {item.label}
                </button>
              ))}
            </span>
          ) : null}
        </span>
      ) : null}
    </div>
  );
}
