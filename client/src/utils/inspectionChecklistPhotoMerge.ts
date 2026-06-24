import type { InspectionAreaPhoto, InspectionChecklistDto } from '../api/inquiryInspection';

export function mergeItemPhotos(
  dto: InspectionChecklistDto,
  itemId: string,
  newPhotos: InspectionAreaPhoto[],
): InspectionChecklistDto {
  return {
    ...dto,
    areas: dto.areas.map((area) => ({
      ...area,
      items: area.items.map((it) =>
        it.id === itemId ? { ...it, photos: [...it.photos, ...newPhotos] } : it,
      ),
    })),
  };
}

export function removeItemPhoto(
  dto: InspectionChecklistDto,
  itemId: string,
  photoId: string,
): InspectionChecklistDto {
  return {
    ...dto,
    areas: dto.areas.map((area) => ({
      ...area,
      items: area.items.map((it) =>
        it.id === itemId ? { ...it, photos: it.photos.filter((p) => p.id !== photoId) } : it,
      ),
    })),
  };
}
