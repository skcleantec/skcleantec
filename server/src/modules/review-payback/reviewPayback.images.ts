export type ReviewPaybackImageItem = {
  url: string;
  publicId?: string | null;
};

export function normalizeReviewPaybackImagesInput(raw: unknown): ReviewPaybackImageItem[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const out: ReviewPaybackImageItem[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const url = typeof o.url === 'string' ? o.url.trim() : '';
    if (!url) continue;
    const publicId = typeof o.publicId === 'string' ? o.publicId.trim() || null : null;
    out.push({ url, publicId });
  }
  return out.length > 0 ? out : null;
}

export function parseReviewImagesFromDb(
  reviewImages: unknown,
  fallbackUrl: string,
  fallbackPublicId: string | null,
): ReviewPaybackImageItem[] {
  const parsed = normalizeReviewPaybackImagesInput(reviewImages);
  if (parsed) return parsed;
  const url = fallbackUrl?.trim();
  if (!url) return [];
  return [{ url, publicId: fallbackPublicId }];
}
