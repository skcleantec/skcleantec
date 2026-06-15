import { copyTextToClipboard } from './clipboard';

export type ShareZipResult = 'shared' | 'downloaded' | 'cancelled';

export type ShareImageItem = {
  url: string;
  filename: string;
};

export type ShareImagesResult = 'shared' | 'clipboard' | 'cancelled';

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function extFromBlob(blob: Blob): string {
  if (blob.type.includes('png')) return '.png';
  if (blob.type.includes('webp')) return '.webp';
  return '.jpg';
}

async function fetchImageFile(
  item: ShareImageItem,
  onProgress?: (done: number, total: number) => void,
  index?: number,
  total?: number,
): Promise<File> {
  const res = await fetch(item.url);
  if (!res.ok) throw new Error('사진을 불러오지 못했습니다.');
  const blob = await res.blob();
  const type = blob.type.startsWith('image/') ? blob.type : 'image/jpeg';
  const filename = item.filename.includes('.') ? item.filename : `${item.filename}${extFromBlob(blob)}`;
  if (onProgress && index != null && total != null) onProgress(index + 1, total);
  return new File([blob], filename, { type });
}

/** 사진 여러 장 — 모바일 Web Share(카톡 등에서 바로 미리보기) 또는 링크 복사 */
export async function shareImageFiles(params: {
  images: ShareImageItem[];
  title: string;
  text: string;
  onProgress?: (done: number, total: number) => void;
}): Promise<ShareImagesResult> {
  const { images, title, text, onProgress } = params;
  if (!images.length) throw new Error('전달할 사진이 없습니다.');

  const files: File[] = [];
  for (let i = 0; i < images.length; i += 1) {
    files.push(await fetchImageFile(images[i]!, onProgress, i, images.length));
  }

  if (typeof navigator.share === 'function') {
    try {
      const withText = { title, text, files };
      if (!navigator.canShare || navigator.canShare(withText)) {
        await navigator.share(withText);
        return 'shared';
      }
      const filesOnly = { files };
      if (!navigator.canShare || navigator.canShare(filesOnly)) {
        await navigator.share(filesOnly);
        return 'shared';
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled';
    }
  }

  const body = [
    text,
    '',
    '아래 링크를 눌러 사진을 확인해 주세요.',
    ...images.map((img, i) => `${i + 1}. ${img.url}`),
  ].join('\n');
  const ok = await copyTextToClipboard(body);
  if (!ok) throw new Error('공유·복사에 실패했습니다. 네트워크 연결을 확인해 주세요.');
  return 'clipboard';
}

/** ZIP 1개 — 모바일 Web Share(카톡 등) 또는 PC 다운로드 */
export async function shareZipBlob(params: {
  blob: Blob;
  filename: string;
  title: string;
  text: string;
}): Promise<ShareZipResult> {
  const file = new File([params.blob], params.filename, { type: 'application/zip' });
  if (typeof navigator.share === 'function') {
    try {
      const payload = { title: params.title, text: params.text, files: [file] };
      if (!navigator.canShare || navigator.canShare(payload)) {
        await navigator.share(payload);
        return 'shared';
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled';
    }
  }
  triggerBlobDownload(params.blob, params.filename);
  return 'downloaded';
}
