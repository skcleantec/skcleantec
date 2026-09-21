import { useEffect, useId, useRef, type ReactNode } from 'react';
import { LineMdIcon } from '../../ui/LineMdIcon';
import type { OrderFormSettingsSectionId } from './orderFormSettingsSections';

const BTN =
  'rounded px-1.5 py-0.5 text-fluid-2xs font-medium text-slate-600 underline decoration-slate-300 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50';

export function OrderFormSettingsSection(props: {
  id: OrderFormSettingsSectionId;
  title: string;
  hint?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  badge?: ReactNode;
  children: ReactNode;
}) {
  const headingId = useId();
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!props.open) return;
    const el = bodyRef.current;
    if (!el) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
  }, [props.open]);

  return (
    <section
      id={`order-settings-${props.id}`}
      className="overflow-hidden rounded-xl border border-slate-200 bg-white"
    >
      <button
        type="button"
        aria-expanded={props.open}
        aria-controls={`${headingId}-body`}
        onClick={() => props.onOpenChange(!props.open)}
        className="flex w-full min-h-11 items-center gap-2 px-3 py-2.5 text-left hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-400 disabled:pointer-events-none disabled:opacity-50"
      >
        <LineMdIcon
          name="chevron-down"
          className={`size-4 shrink-0 text-slate-500 transition-transform ${props.open ? '' : '-rotate-90'}`}
        />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-fluid-sm font-semibold text-slate-900">{props.title}</span>
            {props.badge}
          </span>
          {props.hint ? <span className="mt-0.5 block text-fluid-2xs text-slate-500">{props.hint}</span> : null}
        </span>
      </button>
      {props.open ? (
        <div id={`${headingId}-body`} ref={bodyRef} className="border-t border-slate-100 px-3 py-3 sm:px-4 sm:py-4">
          {props.children}
        </div>
      ) : null}
    </section>
  );
}

export function OrderFormSettingsCommonBadge() {
  return (
    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-fluid-2xs font-medium text-slate-600">
      모든 발주서
    </span>
  );
}

export function OrderFormSettingsThisFormBadge() {
  return (
    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-fluid-2xs font-medium text-emerald-800">
      이 발주서
    </span>
  );
}

export function OrderFormSettingsOpenAllButton(props: {
  allOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <button type="button" className={BTN} onClick={props.onToggle}>
      {props.allOpen ? '모두 접기' : '모두 펼치기'}
    </button>
  );
}
