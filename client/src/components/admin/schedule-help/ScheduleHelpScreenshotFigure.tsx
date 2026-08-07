import type { ScheduleHelpCalloutDef } from './ScheduleHelpAnnotatedPanel';
import { ScheduleHelpAnnotatedPanel } from './ScheduleHelpAnnotatedPanel';

type Props = {
  src: string;
  alt: string;
  caption: string;
  callouts?: ScheduleHelpCalloutDef[];
};

/** 도움말 모달 — 실제 스크린샷 + 연결선 주석 */
export function ScheduleHelpScreenshotFigure({ src, alt, caption, callouts = [] }: Props) {
  return (
    <figure className="space-y-2">
      {callouts.length > 0 ? (
        <ScheduleHelpAnnotatedPanel callouts={callouts} contentClassName="bg-slate-50">
          <img
            src={src}
            alt={alt}
            className="block w-full h-auto max-h-[min(48vh,20rem)] object-contain object-left-top bg-white"
            loading="lazy"
            decoding="async"
          />
        </ScheduleHelpAnnotatedPanel>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50 shadow-sm">
          <img
            src={src}
            alt={alt}
            className="block w-full h-auto max-h-[min(48vh,20rem)] object-contain object-left-top bg-white"
            loading="lazy"
            decoding="async"
          />
        </div>
      )}
      <figcaption className="text-fluid-2xs text-slate-500 leading-snug">{caption}</figcaption>
    </figure>
  );
}
