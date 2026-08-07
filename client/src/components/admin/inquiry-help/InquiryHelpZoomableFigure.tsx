import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ScheduleHelpAnnotatedPanel } from '../schedule-help/ScheduleHelpAnnotatedPanel';
import type { ScheduleHelpCalloutDef } from '../schedule-help/ScheduleHelpAnnotatedPanel';

type Props = {
  caption?: string;
  callouts?: readonly ScheduleHelpCalloutDef[];
  zoomImageSrc?: string;
  zoomImageAlt?: string;
  zoomContent?: ReactNode;
  children: ReactNode;
  contentClassName?: string;
};

function InquiryHelpLightboxShell({
  onClose,
  ariaLabel,
  children,
}: {
  onClose: () => void;
  ariaLabel: string;
  children: ReactNode;
}) {
  return createPortal(
    <div
      className="fixed inset-0 z-[680] flex flex-col items-center justify-start overflow-y-auto bg-slate-950/88 p-3 sm:p-6"
      role="dialog"
      aria-modal
      aria-label={ariaLabel}
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="sticky top-2 z-10 mb-3 self-end rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-fluid-xs font-medium text-white hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        닫기 (Esc)
      </button>
      <div className="w-full max-w-[min(96vw,56rem)]" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>,
    document.body,
  );
}

/** 주석 패널 + 크게 보기 */
export function InquiryHelpZoomableFigure({
  caption,
  callouts = [],
  zoomImageSrc,
  zoomImageAlt = '접수 목록 예시',
  zoomContent,
  children,
  contentClassName = '',
}: Props) {
  const [zoomOpen, setZoomOpen] = useState(false);
  const canZoom = Boolean(zoomImageSrc || zoomContent);

  useEffect(() => {
    if (!zoomOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setZoomOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [zoomOpen]);

  return (
    <figure className="space-y-2">
      {callouts.length > 0 ? (
        <ScheduleHelpAnnotatedPanel callouts={callouts} contentClassName={contentClassName}>
          {children}
        </ScheduleHelpAnnotatedPanel>
      ) : (
        <div className={`overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm ${contentClassName}`}>
          {children}
        </div>
      )}
      {caption ? <figcaption className="text-fluid-2xs text-slate-500 leading-snug">{caption}</figcaption> : null}
      {canZoom ? (
        <button
          type="button"
          onClick={() => setZoomOpen(true)}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-fluid-2xs font-medium text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          크게 보기
        </button>
      ) : null}
      {zoomOpen && zoomImageSrc ? (
        <InquiryHelpLightboxShell ariaLabel="스크린샷 확대" onClose={() => setZoomOpen(false)}>
          <img
            src={zoomImageSrc}
            alt={zoomImageAlt}
            className="w-full rounded-xl border border-white/10 bg-white object-contain shadow-2xl"
          />
        </InquiryHelpLightboxShell>
      ) : null}
      {zoomOpen && !zoomImageSrc && zoomContent ? (
        <InquiryHelpLightboxShell ariaLabel="목록 예시 확대" onClose={() => setZoomOpen(false)}>
          {zoomContent}
        </InquiryHelpLightboxShell>
      ) : null}
    </figure>
  );
}
