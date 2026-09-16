const IMAGE_EXT = /\.(jpe?g|png|gif|webp|heic|heif|bmp)$/i;

export function isEditorImageFile(file: File): boolean {
  if (file.type.startsWith('image/')) return true;
  return IMAGE_EXT.test(file.name || '');
}

export function collectEditorImageFiles(list: FileList | File[] | null | undefined): File[] {
  return Array.from(list ?? []).filter(isEditorImageFile);
}

/** Explorer 드래그 중에는 files 가 비어 있고 types 만 Files 인 경우가 많음 */
export function dataTransferLooksLikeFiles(dt: DataTransfer | null | undefined): boolean {
  if (!dt) return false;
  if (collectEditorImageFiles(dt.files).length > 0) return true;
  const types = Array.from(dt.types ?? []);
  if (types.includes('Files')) return true;
  return Array.from(dt.items ?? []).some((item) => item.kind === 'file');
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

/** HTML 글에 로컬 사진이 있으면 그 자리를 올리고, 없으면 맨 아래에 붙인다 */
export function injectUploadedImagesIntoDesignedHtml(
  html: string,
  images: { url: string; alt?: string }[],
): string {
  if (!images.length) return html;
  const queue = [...images];
  const replaced = html.replace(
    /<img\b([^>]*?)\bsrc=(["'])(?!https?:|data:|blob:)[^"']*\2([^>]*)>/gi,
    (full, pre: string, _q: string, post: string) => {
      const item = queue.shift();
      if (!item) return full;
      return `<img${pre}src="${escapeAttr(item.url)}"${post}>`;
    },
  );
  if (!queue.length) return replaced;

  const extras = queue
    .map((item) => `<p><img src="${escapeAttr(item.url)}" alt="${escapeAttr(item.alt ?? '')}"></p>`)
    .join('');
  const close = '</div>';
  const idx = replaced.lastIndexOf(close);
  if (idx >= 0) return replaced.slice(0, idx) + extras + replaced.slice(idx);
  return replaced + extras;
}
