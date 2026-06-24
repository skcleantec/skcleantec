import { useCallback, useMemo, useState } from 'react';
import type { InspectionChecklistDto } from '../../api/inquiryInspection';
import {
  buildInspectionCompareSlides,
  InspectionPhotoCompareLightbox,
  openCompareIndices,
  type ComparePhotoInitial,
} from './InspectionPhotoCompareLightbox';

export function useInspectionCompareLightbox(checklist: InspectionChecklistDto | null | undefined) {
  const slides = useMemo(
    () => (checklist ? buildInspectionCompareSlides(checklist) : []),
    [checklist],
  );
  const [open, setOpen] = useState(false);
  const [slideIndex, setSlideIndex] = useState(0);
  const [initial, setInitial] = useState<ComparePhotoInitial | undefined>();

  const openCompare = useCallback(
    (itemId: string, phase: 'BEFORE' | 'AFTER', photoIndex: number) => {
      const idx = slides.findIndex((s) => s.itemId === itemId);
      if (idx < 0) return;
      const slide = slides[idx]!;
      setInitial(
        openCompareIndices(
          phase,
          photoIndex,
          slide.beforePhotos.length,
          slide.afterPhotos.length,
        ),
      );
      setSlideIndex(idx);
      setOpen(true);
    },
    [slides],
  );

  const lightbox =
    slides.length > 0 ? (
      <InspectionPhotoCompareLightbox
        open={open}
        onClose={() => setOpen(false)}
        slides={slides}
        slideIndex={slideIndex}
        onSlideIndexChange={setSlideIndex}
        initial={initial}
      />
    ) : null;

  return { openCompare, lightbox };
}
