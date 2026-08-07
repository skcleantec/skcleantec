import { InquiryHelpZoomableFigure } from '../inquiry-help/InquiryHelpZoomableFigure';
import { QuotationHelpEditorLivePreview } from './QuotationHelpEditorLivePreview';
import { QUOTATION_HELP_CAPTION } from './quotationHelpShared';

export function QuotationHelpEditorPreviewInner({ enlarged = false }: { enlarged?: boolean }) {
  return <QuotationHelpEditorLivePreview enlarged={enlarged} />;
}

export function QuotationHelpEditorFigure({ caption = QUOTATION_HELP_CAPTION }: { caption?: string }) {
  return (
    <InquiryHelpZoomableFigure
      caption={caption}
      contentClassName="p-0 bg-transparent border-0 shadow-none"
      zoomContent={<QuotationHelpEditorPreviewInner enlarged />}
    >
      <QuotationHelpEditorPreviewInner />
    </InquiryHelpZoomableFigure>
  );
}
