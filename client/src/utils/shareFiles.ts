import { copyTextToClipboard } from './clipboard';

export type ShareZipResult = 'shared' | 'downloaded' | 'cancelled';

export type ShareImageItem = {
  url: string;
  filename: string;
};

/** shared: 모바일 OS 공유 · desktop_paste: PC 클립보드 사진 · desktop_files: PC 파일 저장 · clipboard: 링크 복사(모바일 폴백) */
export type ShareImagesResult =
  | 'shared'
  | 'desktop_paste'
  | 'desktop_files'
  | 'clipboard'
  | 'cancelled';

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

/** 모바일·태블릿 — OS 공유 시트로 카톡 등 앱에 바로 전달 가능 */
export function supportsNativeAppShare(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  if (/Android|iPhone|iPod/i.test(ua)) return true;
  if (/iPad/i.test(ua)) return true;
  if (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) return true;
  return false;
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

/** 카톡 PC 붙여넣기 호환 — PNG/JPEG */
async function toClipboardImageBlob(file: File): Promise<Blob> {
  if (file.type === 'image/png' || file.type === 'image/jpeg') return file;
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('image_decode_failed'));
      el.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas_unavailable');
    ctx.drawImage(img, 0, 0);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode_failed'))), 'image/png');
    });
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function copyTextAndImageToClipboard(text: string, file: File): Promise<boolean> {
  if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') return false;
  try {
    const imageBlob = await toClipboardImageBlob(file);
    const mime = imageBlob.type === 'image/jpeg' ? 'image/jpeg' : 'image/png';
    await navigator.clipboard.write([
      new ClipboardItem({
        'text/plain': new Blob([text], { type: 'text/plain' }),
        [mime]: imageBlob,
      }),
    ]);
    return true;
  } catch {
    return false;
  }
}

async function saveImagesToFolder(files: File[]): Promise<boolean> {
  const picker = window.showDirectoryPicker;
  if (!picker) return false;
  try {
    const dir = await picker.call(window, { mode: 'readwrite' });
    for (const file of files) {
      const handle = await dir.getFileHandle(file.name, { create: true });
      const writable = await handle.createWritable();
      await writable.write(file);
      await writable.close();
    }
    return true;
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return false;
    return false;
  }
}

async function downloadImageFiles(files: File[]) {
  for (let i = 0; i < files.length; i += 1) {
    triggerBlobDownload(files[i]!, files[i]!.name);
    if (i < files.length - 1) {
      await new Promise((r) => setTimeout(r, 350));
    }
  }
}

function buildShareLinkFallbackBody(text: string, images: ShareImageItem[]): string {
  return [
    text,
    '',
    '아래 링크를 눌러 사진을 확인해 주세요.',
    ...images.map((img, i) => `${i + 1}. ${img.url}`),
  ].join('\n');
}

/** PC — 클립보드 사진 붙여넣기 또는 파일 저장 (링크 없음) */
async function shareOnDesktop(files: File[], text: string): Promise<'desktop_paste' | 'desktop_files'> {
  if (files.length === 1) {
    const pasted = await copyTextAndImageToClipboard(text, files[0]!);
    if (pasted) return 'desktop_paste';
    await copyTextToClipboard(text);
    triggerBlobDownload(files[0]!, files[0]!.name);
    return 'desktop_files';
  }

  await copyTextToClipboard(text);
  const folderSaved = await saveImagesToFolder(files);
  if (!folderSaved) {
    await downloadImageFiles(files);
  }
  return 'desktop_files';
}

/** 사진 여러 장 — 모바일 Web Share(카톡 등) · PC는 사진 파일/클립보드 */
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

  if (!supportsNativeAppShare()) {
    return shareOnDesktop(files, text);
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

  const body = buildShareLinkFallbackBody(text, images);
  const ok = await copyTextToClipboard(body);
  if (!ok) throw new Error('공유·복사에 실패했습니다. 네트워크 연결을 확인해 주세요.');
  return 'clipboard';
}

export function shareImagesResultHint(result: ShareImagesResult, fileCount = 1): string | null {
  switch (result) {
    case 'desktop_paste':
      return (
        '사진과 안내 문구를 클립보드에 넣었습니다.\n\n' +
        '카카오톡 대화창을 클릭한 뒤 Ctrl+V — 사진이 채팅에 바로 붙습니다.\n' +
        '(텍스트만 보내려면 한 번 더 Ctrl+V 해 보세요.)'
      );
    case 'desktop_files':
      return fileCount <= 1
        ? '안내 문구를 복사하고 사진 파일을 저장했습니다.\n\n카톡 채팅창에 사진 파일을 끌어다 놓으면 모바일처럼 바로 볼 수 있습니다.'
        : `안내 문구를 복사하고 사진 ${fileCount}장을 저장했습니다.\n\n` +
            '저장된 사진을 모두 선택해 카톡 채팅창으로 끌어다 놓으면 모바일처럼 바로 볼 수 있습니다.';
    case 'clipboard':
      return '공유 메뉴를 사용할 수 없어 링크를 복사했습니다. 카톡에 붙여넣으면 사진을 열어볼 수 있습니다.';
    default:
      return null;
  }
}

/** @deprecated shareImagesResultHint 사용 */
export const DESKTOP_SHARE_HINT = shareImagesResultHint('desktop_files', 1)!;

/** @deprecated shareImagesResultHint 사용 */
export const CLIPBOARD_SHARE_HINT = shareImagesResultHint('clipboard')!;

/** ZIP 1개 — 모바일 Web Share(카톡 등) 또는 PC 다운로드 */
export async function shareZipBlob(params: {
  blob: Blob;
  filename: string;
  title: string;
  text: string;
}): Promise<ShareZipResult> {
  const file = new File([params.blob], params.filename, { type: 'application/zip' });
  if (supportsNativeAppShare() && typeof navigator.share === 'function') {
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

declare global {
  interface Window {
    showDirectoryPicker?(options?: { mode?: 'read' | 'readwrite' }): Promise<FileSystemDirectoryHandle>;
  }
}

export {};
