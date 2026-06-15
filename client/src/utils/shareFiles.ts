import { copyTextToClipboard } from './clipboard';

export type ShareZipResult = 'shared' | 'downloaded' | 'cancelled';

export type ShareImageItem = {
  url: string;
  filename: string;
};

/** shared: 모바일 OS 공유(카톡 등) · desktop: PC 링크 복사+파일 저장 · clipboard: 링크만 복사 */
export type ShareImagesResult = 'shared' | 'desktop' | 'clipboard' | 'cancelled';

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
  // iPadOS 13+ (데스크톱 UA 위장)
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

function buildShareClipboardBody(text: string, images: ShareImageItem[]): string {
  return [
    text,
    '',
    '아래 링크를 눌러 사진을 확인해 주세요.',
    ...images.map((img, i) => `${i + 1}. ${img.url}`),
  ].join('\n');
}

async function downloadImageFiles(files: File[]) {
  for (let i = 0; i < files.length; i += 1) {
    triggerBlobDownload(files[i]!, files[i]!.name);
    if (i < files.length - 1) {
      await new Promise((r) => setTimeout(r, 350));
    }
  }
}

async function shareViaClipboard(images: ShareImageItem[], text: string): Promise<'desktop' | 'clipboard'> {
  const body = buildShareClipboardBody(text, images);
  const ok = await copyTextToClipboard(body);
  if (!ok) throw new Error('공유·복사에 실패했습니다. 네트워크 연결을 확인해 주세요.');
  return supportsNativeAppShare() ? 'clipboard' : 'desktop';
}

/** 사진 여러 장 — 모바일 Web Share(카톡 등) · PC는 링크 복사+파일 저장 */
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

  // PC·노트북: Windows 공유 창은 뜨지만 카톡 방 선택 불가 → 링크 복사 + 사진 저장
  if (!supportsNativeAppShare()) {
    const mode = await shareViaClipboard(images, text);
    await downloadImageFiles(files);
    return mode;
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

  const mode = await shareViaClipboard(images, text);
  if (mode === 'desktop') {
    await downloadImageFiles(files);
  }
  return mode;
}

export const DESKTOP_SHARE_HINT =
  'PC에서는 카카오톡 방을 공유 창에서 고를 수 없습니다.\n\n' +
  '· 안내 문구와 사진 링크를 클립보드에 복사했습니다 → 카톡 대화창에 붙여넣기(Ctrl+V)\n' +
  '· 사진 파일도 저장했습니다 → 카톡 채팅창에 끌어다 놓거나 파일로 첨부';

export const CLIPBOARD_SHARE_HINT =
  '공유 메뉴를 사용할 수 없어 링크를 복사했습니다. 카톡에 붙여넣으면 사진을 바로 열어볼 수 있습니다.';

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
