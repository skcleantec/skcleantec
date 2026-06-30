import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { checkMarketerGuideScreenshotEditPermission } from '../../api/help';

type MarketerGuideScreenshotEditorProps = {
  activeChapter: string | null;
  iframeRef: RefObject<HTMLIFrameElement | null>;
};

const ADMIN_TOKEN_KEY = 'sk_admin_token';

function parseScreenshotFilename(src: string): string | null {
  const match = src.match(/screenshots\/([^/?#]+)/i);
  return match?.[1] ?? null;
}

function readAdminToken(doc: Document): string | null {
  const win = doc.defaultView;
  if (!win) return null;
  try {
    return win.localStorage.getItem(ADMIN_TOKEN_KEY) || win.sessionStorage.getItem(ADMIN_TOKEN_KEY);
  } catch {
    return null;
  }
}

/** iframe 안에서 직접 업로드 — postMessage·ArrayBuffer 없이 연속 교체 보장 */
function uploadScreenshotInIframe(doc: Document, filename: string, file: File): Promise<number> {
  const token = readAdminToken(doc);
  if (!token) {
    return Promise.reject(new Error('로그인이 필요합니다. 다시 로그인한 뒤 시도해 주세요.'));
  }

  const formData = new FormData();
  formData.append('screenshot', file);

  return fetch(`/api/help/marketer-guide/screenshot/${encodeURIComponent(filename)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  })
    .then(async (res) => {
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: '업로드 실패' }));
        throw new Error(typeof err.error === 'string' ? err.error : '업로드 실패');
      }
      return res.json() as Promise<{ url?: string }>;
    })
    .then(() => {
      const version = Date.now();
      doc.querySelectorAll('img[src*="screenshots/"]').forEach((node) => {
        const img = node as HTMLImageElement;
        const imgFile = parseScreenshotFilename(img.getAttribute('src') ?? img.src ?? '');
        if (!imgFile || imgFile !== filename) return;
        img.src = `./screenshots/${imgFile}?v=${version}`;
      });
      return version;
    });
}

function openIframeFilePicker(doc: Document, filename: string) {
  const win = doc.defaultView;
  if (!win) return;

  if (win.document.body.dataset.guideScreenshotUploading === '1') return;

  const input = doc.createElement('input');
  input.type = 'file';
  input.accept = 'image/png,image/jpeg,image/webp,image/gif';
  input.style.display = 'none';
  doc.body.appendChild(input);
  input.addEventListener(
    'change',
    () => {
      const picked = input.files?.[0];
      input.remove();
      if (!picked) return;

      win.document.body.dataset.guideScreenshotUploading = '1';
      void uploadScreenshotInIframe(doc, filename, picked)
        .catch((err: Error) => {
          win.alert(err.message || '업로드 실패');
        })
        .finally(() => {
          delete win.document.body.dataset.guideScreenshotUploading;
        });
    },
    { once: true },
  );
  input.click();
}

function injectIframeScreenshotOverlays(
  iframe: HTMLIFrameElement,
  chapterId: string,
  previewVersion: number,
) {
  const doc = iframe.contentDocument;
  if (!doc) return;

  const slide = doc.getElementById(`slide-${chapterId}`);
  if (!slide) return;

  if (!doc.getElementById('guide-screenshot-edit-style')) {
    const style = doc.createElement('style');
    style.id = 'guide-screenshot-edit-style';
    style.textContent = `
      .guide-screenshot-edit-wrap { position: relative !important; }
      .guide-screenshot-edit-btn {
        position: absolute; inset: 0; z-index: 5; margin: 0; padding: 0;
        display: flex; align-items: center; justify-content: center; gap: 6px;
        background: rgba(2, 132, 199, 0.45);
        border: 2px dashed rgba(255, 255, 255, 0.85);
        color: #fff; font-size: 13px; font-weight: 700; letter-spacing: -0.02em;
        cursor: pointer; opacity: 0.85; transition: background 0.15s, opacity 0.15s;
        font-family: system-ui, sans-serif;
      }
      .guide-screenshot-edit-btn:hover,
      .guide-screenshot-edit-btn:focus-visible {
        background: rgba(2, 132, 199, 0.65); opacity: 1; outline: none;
      }
      @media (hover: hover) {
        .guide-screenshot-edit-btn { opacity: 0; }
        .guide-screenshot-edit-wrap:hover .guide-screenshot-edit-btn,
        .guide-screenshot-edit-wrap:focus-within .guide-screenshot-edit-btn { opacity: 1; }
      }
    `;
    doc.head.appendChild(style);
  }

  slide.querySelectorAll('img[src*="screenshots/"]').forEach((node) => {
    const img = node as HTMLImageElement;
    const filename = parseScreenshotFilename(img.getAttribute('src') ?? img.src ?? '');
    if (!filename) return;

    let wrap = img.parentElement;
    if (!wrap?.classList.contains('guide-screenshot-edit-wrap')) {
      const newWrap = doc.createElement('div');
      newWrap.className = 'guide-screenshot-edit-wrap';
      img.parentNode?.insertBefore(newWrap, img);
      newWrap.appendChild(img);
      wrap = newWrap;
    }

    if (wrap.querySelector('.guide-screenshot-edit-btn')) return;

    const btn = doc.createElement('button');
    btn.type = 'button';
    btn.className = 'guide-screenshot-edit-btn';
    btn.setAttribute('data-guide-screenshot-edit', filename);
    btn.textContent = '📷 사진 교체';
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openIframeFilePicker(doc, filename);
    });
    wrap.appendChild(btn);

    if (!img.src.includes('?v=')) {
      img.src = `./screenshots/${filename}?v=${previewVersion}`;
    }
  });
}

/** iframe 오버레이만 — UI 박스 없음 */
export function MarketerGuideScreenshotEditor({
  activeChapter,
  iframeRef,
}: MarketerGuideScreenshotEditorProps) {
  const [canEdit, setCanEdit] = useState(false);
  const previewVersionRef = useRef(Date.now());

  useEffect(() => {
    let cancelled = false;
    checkMarketerGuideScreenshotEditPermission().then((perm) => {
      if (!cancelled) setCanEdit(perm.canEdit);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const attachIframeOverlays = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe || !canEdit || !activeChapter) return;
    injectIframeScreenshotOverlays(iframe, activeChapter, previewVersionRef.current);
  }, [iframeRef, canEdit, activeChapter]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || !canEdit) return;
    iframe.addEventListener('load', attachIframeOverlays);
    attachIframeOverlays();
    return () => iframe.removeEventListener('load', attachIframeOverlays);
  }, [iframeRef, canEdit, attachIframeOverlays]);

  return null;
}
