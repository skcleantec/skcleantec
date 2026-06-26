/** html2canvas PDF 캡처 전 — Cloudinary 등 외부 이미지를 data URL로 바꿔 직인·서명 누락을 방지 */
export async function inlineExternalImages(root: ParentNode, win: Window): Promise<void> {
  const imgs = [...root.querySelectorAll('img[src]')] as HTMLImageElement[];
  await Promise.all(
    imgs.map(async (img) => {
      const url = (img.currentSrc || img.src || '').trim();
      if (!url || url.startsWith('data:')) return;

      const dataUrl = (await fetchImageAsDataUrl(url)) ?? (await loadImageViaCanvas(url, win));
      if (dataUrl) {
        img.src = dataUrl;
        img.removeAttribute('crossorigin');
      }
    }),
  );
}

async function fetchImageAsDataUrl(url: string): Promise<string | null> {
  try {
    const resp = await fetch(url, { mode: 'cors', credentials: 'omit', cache: 'no-cache' });
    if (!resp.ok) return null;
    const blob = await resp.blob();
    return await blobToDataUrl(blob);
  } catch {
    return null;
  }
}

function loadImageViaCanvas(url: string, win: Window): Promise<string | null> {
  return new Promise((resolve) => {
    const img = win.document.createElement('img');
    img.crossOrigin = 'anonymous';
    const timer = win.setTimeout(() => resolve(null), 15000);
    img.onload = () => {
      win.clearTimeout(timer);
      try {
        const canvas = win.document.createElement('canvas');
        canvas.width = Math.max(1, img.naturalWidth);
        canvas.height = Math.max(1, img.naturalHeight);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => {
      win.clearTimeout(timer);
      resolve(null);
    };
    img.src = url;
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export function waitForImagesIn(root: ParentNode, timeoutMs = 15000): Promise<void> {
  const imgs = [...root.querySelectorAll('img')];
  if (imgs.length === 0) return Promise.resolve();
  return Promise.all(
    imgs.map(
      (img) =>
        img.complete && img.naturalHeight > 0
          ? Promise.resolve()
          : new Promise<void>((resolve) => {
              img.addEventListener('load', () => resolve(), { once: true });
              img.addEventListener('error', () => resolve(), { once: true });
              setTimeout(resolve, timeoutMs);
            }),
    ),
  ).then(() => undefined);
}
