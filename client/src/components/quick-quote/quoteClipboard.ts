/** 견적 문구 복사. 누르는 순간 클립보드에 넣고, 막히면 숨은 입력칸으로 다시 시도한다. */
export async function copyQuoteText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return fallbackCopy(text);
  }
}

function fallbackCopy(text: string): boolean {
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.top = '0';
  area.style.left = '-9999px';
  document.body.appendChild(area);
  area.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  area.remove();
  return ok;
}

type ImageBridge = {
  shareImage?: (url: string) => void;
  saveImage?: (url: string) => void;
};

/** 사진 단계. 앱 브릿지 → 휴대폰 공유 → 새 탭(길게 눌러 저장). */
export async function saveQuoteImages(urls: string[]): Promise<'shared' | 'opened' | 'cancelled' | 'empty'> {
  const list = urls.map((u) => u.trim()).filter(Boolean);
  const first = list[0];
  if (!first) return 'empty';

  const app = window.CbiseoApp as (NonNullable<Window['CbiseoApp']> & ImageBridge) | undefined;
  if (app?.shareImage || app?.saveImage) {
    try {
      if (app.shareImage) app.shareImage(first);
      else app.saveImage?.(first);
      return 'shared';
    } catch {
      /* 공유 창으로 이어감 */
    }
  }

  try {
    const files: File[] = [];
    for (const url of list) {
      const res = await fetch(url);
      if (!res.ok) continue;
      const blob = await res.blob();
      const ext = blob.type.includes('png') ? 'png' : 'jpg';
      files.push(new File([blob], `quote-${files.length + 1}.${ext}`, { type: blob.type || 'image/jpeg' }));
    }
    if (files.length > 0 && typeof navigator.canShare === 'function' && navigator.canShare({ files })) {
      await navigator.share({ files });
      return 'shared';
    }
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled';
  }

  window.open(first, '_blank', 'noopener,noreferrer');
  return 'opened';
}
