import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import {
  checkMarketerGuideScreenshotEditPermission,
  uploadMarketerGuideScreenshot,
} from '../../api/help';

type MarketerGuideScreenshotEditorProps = {
  activeChapter: string | null;
  iframeRef: RefObject<HTMLIFrameElement | null>;
};

const UPLOAD_FILE_MESSAGE_TYPE = 'marketer-guide-upload-file';
const UPLOAD_BUFFER_MESSAGE_TYPE = 'marketer-guide-upload-buffer';

function parseScreenshotFilename(src: string): string | null {
  const match = src.match(/screenshots\/([^/?#]+)/i);
  return match?.[1] ?? null;
}

function refreshIframeScreenshotSrc(
  iframe: HTMLIFrameElement,
  filename: string | null,
  previewVersion: number,
) {
  const doc = iframe.contentDocument;
  if (!doc) return;
  doc.querySelectorAll('img[src*="screenshots/"]').forEach((node) => {
    const img = node as HTMLImageElement;
    const imgFile = parseScreenshotFilename(img.getAttribute('src') ?? img.src ?? '');
    if (!imgFile) return;
    if (filename && imgFile !== filename) return;
    img.src = `./screenshots/${imgFile}?v=${previewVersion}`;
  });
}

function openIframeFilePicker(doc: Document, filename: string) {
  const input = doc.createElement('input');
  input.type = 'file';
  input.accept = 'image/png,image/jpeg,image/webp,image/gif';
  input.style.display = 'none';
  doc.body.appendChild(input);
  input.addEventListener(
    'change',
    () => {
      const file = input.files?.[0];
      if (file) {
        void file.arrayBuffer().then((buffer) => {
          window.parent.postMessage(
            {
              type: UPLOAD_BUFFER_MESSAGE_TYPE,
              filename,
              buffer,
              mimeType: file.type || 'image/png',
            },
            window.location.origin,
          );
        });
      }
      input.remove();
    },
    { once: true },
  );
  input.click();
}

/** 장당 1회 — previewVersion 변경 시 전체 재주입하지 않음(2번째 교체 실패 방지) */
function injectIframeScreenshotOverlays(
  iframe: HTMLIFrameElement,
  chapterId: string,
  previewVersion: number,
) {
  const doc = iframe.contentDocument;
  if (!doc) return;

  const slide = doc.getElementById(`slide-${chapterId}`);
  if (!slide) return;

  if (slide.dataset.guideScreenshotEditBound === chapterId) {
    refreshIframeScreenshotSrc(iframe, null, previewVersion);
    return;
  }

  slide.dataset.guideScreenshotEditBound = chapterId;
  doc.querySelectorAll('[data-guide-screenshot-edit-bound]').forEach((el) => {
    if (el !== slide) delete (el as HTMLElement).dataset.guideScreenshotEditBound;
  });

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

    img.src = `./screenshots/${filename}?v=${previewVersion}`;
  });

  slide.setAttribute('data-guide-screenshot-edit-bound', chapterId);
}

function isArrayBuffer(value: unknown): value is ArrayBuffer {
  return value instanceof ArrayBuffer;
}

function isUploadFile(value: unknown): value is Blob {
  return (
    value != null &&
    typeof value === 'object' &&
    'arrayBuffer' in value &&
    typeof (value as Blob).arrayBuffer === 'function'
  );
}

/** iframe 오버레이만 — UI 박스 없음 */
export function MarketerGuideScreenshotEditor({
  activeChapter,
  iframeRef,
}: MarketerGuideScreenshotEditorProps) {
  const [canEdit, setCanEdit] = useState(false);
  const previewVersionRef = useRef(Date.now());
  const uploadingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    checkMarketerGuideScreenshotEditPermission().then((perm) => {
      if (!cancelled) setCanEdit(perm.canEdit);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleUpload = useCallback(
    async (filename: string, file: Blob) => {
      if (uploadingRef.current) return;
      uploadingRef.current = true;
      try {
        const uploadFile =
          file instanceof File
            ? file
            : new File([file], filename, { type: file.type || 'image/png' });
        await uploadMarketerGuideScreenshot(filename, uploadFile);
        const version = Date.now();
        previewVersionRef.current = version;
        const iframe = iframeRef.current;
        if (iframe) {
          refreshIframeScreenshotSrc(iframe, filename, version);
        }
      } catch (err) {
        alert((err as Error).message);
      } finally {
        uploadingRef.current = false;
      }
    },
    [iframeRef],
  );

  useEffect(() => {
    if (!canEdit) return;
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data as {
        type?: string;
        filename?: string;
        file?: unknown;
        buffer?: unknown;
        mimeType?: string;
      };
      if (!data?.filename) return;

      if (data.type === UPLOAD_BUFFER_MESSAGE_TYPE && isArrayBuffer(data.buffer)) {
        const mime = typeof data.mimeType === 'string' ? data.mimeType : 'image/png';
        void handleUpload(data.filename, new File([data.buffer], data.filename, { type: mime }));
        return;
      }

      if (data.type === UPLOAD_FILE_MESSAGE_TYPE && isUploadFile(data.file)) {
        void handleUpload(data.filename, data.file);
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [canEdit, handleUpload]);

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
