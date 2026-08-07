import { InquiryHelpZoomableFigure } from '../inquiry-help/InquiryHelpZoomableFigure';
import { CustomerLinkHelpEditorLivePreview } from './CustomerLinkHelpEditorLivePreview';
import { CUSTOMER_LINK_HELP_CAPTION } from './customerLinkHelpShared';

export function CustomerLinkHelpEditorPreviewInner({ enlarged = false }: { enlarged?: boolean }) {
  return <CustomerLinkHelpEditorLivePreview enlarged={enlarged} />;
}

export function CustomerLinkHelpEditorFigure({ caption = CUSTOMER_LINK_HELP_CAPTION }: { caption?: string }) {
  return (
    <InquiryHelpZoomableFigure
      caption={caption}
      contentClassName="p-0 bg-transparent border-0 shadow-none"
      zoomContent={<CustomerLinkHelpEditorPreviewInner enlarged />}
    >
      <CustomerLinkHelpEditorPreviewInner />
    </InquiryHelpZoomableFigure>
  );
}
