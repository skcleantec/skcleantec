import { AiDispatchDraftList } from '../ai-dispatch/AiDispatchDraftList';
import { InquiryHelpZoomableFigure } from '../inquiry-help/InquiryHelpZoomableFigure';
import {
  AI_DISPATCH_HELP_JOBS,
  AI_DISPATCH_HELP_LEADERS,
  AI_DISPATCH_HELP_MANUAL,
  AI_DISPATCH_HELP_PROPOSALS,
} from './aiDispatchHelpDemoData';
import { AI_DISPATCH_HELP_CAPTION } from './aiDispatchHelpShared';

function PreviewInner() {
  return (
    <div className="pointer-events-none select-none bg-slate-50 p-2">
      <AiDispatchDraftList
        proposals={AI_DISPATCH_HELP_PROPOSALS}
        jobs={AI_DISPATCH_HELP_JOBS}
        manualJobs={AI_DISPATCH_HELP_MANUAL}
        leaders={AI_DISPATCH_HELP_LEADERS}
        picked={[]}
        onToggle={() => undefined}
        onLeaderChange={() => undefined}
        onOpenInquiry={() => undefined}
      />
    </div>
  );
}

export function AiDispatchHelpPreview() {
  return (
    <InquiryHelpZoomableFigure
      caption={AI_DISPATCH_HELP_CAPTION}
      contentClassName="p-0 bg-transparent border-0 shadow-none"
      zoomContent={<PreviewInner />}
    >
      <PreviewInner />
    </InquiryHelpZoomableFigure>
  );
}
