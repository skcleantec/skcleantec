import type { InspectionAreaPhoto, InspectionChecklistDto } from '../api/inquiryInspection';
import type { ShareImageItem } from './shareFiles';
import {
  INSPECTION_CONTAMINATION_ITEM_KEY,
  isContaminationInspectionArea,
} from '@shared/inquiryInspectionContamination';

export type FlaggedBeforePhotoEntry = {
  kind: 'flagged';
  photo: InspectionAreaPhoto;
  itemId: string;
  itemLabel: string;
  areaId: string;
  areaLabel: string;
};

export type ContaminationDirectPhotoEntry = {
  kind: 'direct';
  photo: InspectionAreaPhoto;
  itemId: string;
  areaId: string;
};

export type ContaminationPhotoEntry = FlaggedBeforePhotoEntry | ContaminationDirectPhotoEntry;

function safeNamePart(s: string): string {
  return s.replace(/[\\/:*?"<>|]/g, '_').slice(0, 20);
}

/** 일반 구역 촬영 중 ★ 표시 — 원래 구역 + 오염 섹션 양쪽 표시 */
export function collectFlaggedBeforePhotos(checklist: InspectionChecklistDto): FlaggedBeforePhotoEntry[] {
  const out: FlaggedBeforePhotoEntry[] = [];
  for (const area of checklist.areas) {
    if (area.notApplicable || isContaminationInspectionArea(area.areaKey)) continue;
    for (const item of area.items) {
      if (item.itemKey.startsWith('_') || item.notApplicable) continue;
      for (const photo of item.photos) {
        if (photo.phase !== 'BEFORE' || !photo.flagged) continue;
        out.push({
          kind: 'flagged',
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

/** 오염사진 구역에서만 추가 촬영 — 오염 섹션에만 표시 */
export function collectContaminationDirectPhotos(
  checklist: InspectionChecklistDto,
): ContaminationDirectPhotoEntry[] {
  const area = checklist.areas.find((a) => isContaminationInspectionArea(a.areaKey));
  if (!area || area.notApplicable) return [];
  const item =
    area.items.find((i) => i.itemKey === INSPECTION_CONTAMINATION_ITEM_KEY) ?? area.items[0];
  if (!item) return [];
  return item.photos
    .filter((p) => p.phase === 'BEFORE')
    .map((photo) => ({
      kind: 'direct' as const,
      photo,
      itemId: item.id,
      areaId: area.id,
    }));
}

export function collectContaminationGalleryEntries(
  checklist: InspectionChecklistDto,
): ContaminationPhotoEntry[] {
  return [...collectFlaggedBeforePhotos(checklist), ...collectContaminationDirectPhotos(checklist)];
}

export function findContaminationUploadTarget(
  checklist: InspectionChecklistDto,
): { itemId: string; areaId: string } | null {
  const area = checklist.areas.find((a) => isContaminationInspectionArea(a.areaKey));
  if (!area) return null;
  const item = area.items.find((i) => i.itemKey === INSPECTION_CONTAMINATION_ITEM_KEY) ?? area.items[0];
  if (!item) return null;
  return { itemId: item.id, areaId: area.id };
}

export function contaminationEntriesToShareItems(entries: ContaminationPhotoEntry[]): ShareImageItem[] {
  return entries.map((entry, idx) => {
    if (entry.kind === 'flagged') {
      const areaPart = safeNamePart(entry.areaLabel) || 'area';
      const itemPart = safeNamePart(entry.itemLabel) || 'item';
      return {
        url: entry.photo.secureUrl,
        filename: `${areaPart}_${itemPart}_${String(idx + 1).padStart(2, '0')}`,
      };
    }
    return {
      url: entry.photo.secureUrl,
      filename: `contamination_extra_${String(idx + 1).padStart(2, '0')}`,
    };
  });
}

/** @deprecated collectContaminationGalleryEntries 사용 */
export function flaggedBeforePhotosToShareItems(entries: FlaggedBeforePhotoEntry[]): ShareImageItem[] {
  return contaminationEntriesToShareItems(entries);
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

export function removeChecklistPhoto(
  checklist: InspectionChecklistDto,
  itemId: string,
  photoId: string,
): InspectionChecklistDto {
  return {
    ...checklist,
    areas: checklist.areas.map((area) => ({
      ...area,
      items: area.items.map((item) =>
        item.id === itemId
          ? { ...item, photos: item.photos.filter((p) => p.id !== photoId) }
          : item,
      ),
    })),
  };
}
