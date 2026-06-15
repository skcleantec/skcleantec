import type { InspectionAreaPhoto, InspectionChecklistDto } from '../api/inquiryInspection';
import type { ShareImageItem } from './shareFiles';

export type FlaggedBeforePhotoEntry = {
  photo: InspectionAreaPhoto;
  itemId: string;
  itemLabel: string;
  areaId: string;
  areaLabel: string;
};

function safeNamePart(s: string): string {
  return s.replace(/[\\/:*?"<>|]/g, '_').slice(0, 20);
}

export function collectFlaggedBeforePhotos(checklist: InspectionChecklistDto): FlaggedBeforePhotoEntry[] {
  const out: FlaggedBeforePhotoEntry[] = [];
  for (const area of checklist.areas) {
    if (area.notApplicable) continue;
    for (const item of area.items) {
      if (item.itemKey.startsWith('_') || item.notApplicable) continue;
      for (const photo of item.photos) {
        if (photo.phase !== 'BEFORE' || !photo.flagged) continue;
        out.push({
          photo,
          itemId: item.id,
          itemLabel: item.label,
          areaId: area.id,
          areaLabel: area.label,
        });
      }
    }
  }
  return out;
}

export function flaggedBeforePhotosToShareItems(entries: FlaggedBeforePhotoEntry[]): ShareImageItem[] {
  return entries.map((entry, idx) => {
    const areaPart = safeNamePart(entry.areaLabel) || 'area';
    const itemPart = safeNamePart(entry.itemLabel) || 'item';
    return {
      url: entry.photo.secureUrl,
      filename: `${areaPart}_${itemPart}_${String(idx + 1).padStart(2, '0')}`,
    };
  });
}

export function updateChecklistPhotoFlag(
  checklist: InspectionChecklistDto,
  itemId: string,
  photoId: string,
  flagged: boolean,
): InspectionChecklistDto {
  return {
    ...checklist,
    areas: checklist.areas.map((area) => ({
      ...area,
      items: area.items.map((item) =>
        item.id === itemId
          ? {
              ...item,
              photos: item.photos.map((p) => (p.id === photoId ? { ...p, flagged } : p)),
            }
          : item,
      ),
    })),
  };
}
