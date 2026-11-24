import type { MessageAttachment } from '../../api/messages';

/** 카카오톡 묶음 사진처럼 줄마다 2~3칸으로 나눈다. 9장을 넘으면 9칸까지만 그리고 나머지는 「+N」. */
const ROWS: Record<number, number[]> = {
  1: [1],
  2: [2],
  3: [3],
  4: [2, 2],
  5: [2, 3],
  6: [3, 3],
  7: [2, 2, 3],
  8: [2, 3, 3],
  9: [3, 3, 3],
};
export const BUNDLE_MAX_CELLS = 9;

export function bundleRows(count: number): number[] {
  return ROWS[Math.min(Math.max(count, 1), BUNDLE_MAX_CELLS)];
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export function splitAttachments(list: MessageAttachment[] | undefined | null) {
  const all = Array.isArray(list) ? list : [];
  return {
    images: all.filter((a) => a.kind === 'image'),
    files: all.filter((a) => a.kind !== 'image'),
  };
}

/** 「사진 7장 · 파일 1개」 */
export function attachmentSummary(imageCount: number, fileCount: number): string {
  const parts: string[] = [];
  if (imageCount > 0) parts.push(`사진 ${imageCount}장`);
  if (fileCount > 0) parts.push(`파일 ${fileCount}개`);
  return parts.join(' · ');
}

export function imageThumb(a: MessageAttachment): string {
  return a.thumbUrl || a.previewUrl || a.originalUrl;
}
export function imagePreview(a: MessageAttachment): string {
  return a.previewUrl || a.originalUrl;
}
