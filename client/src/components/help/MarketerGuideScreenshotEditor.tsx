import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import {
  checkMarketerGuideScreenshotEditPermission,
  fetchMarketerGuideScreenshotCatalog,
  uploadMarketerGuideScreenshot,
  type MarketerGuideScreenshotItem,
} from '../../api/help';

type MarketerGuideScreenshotEditorProps = {
  activeChapter: string | null;
  iframeRef: RefObject<HTMLIFrameElement | null>;
};

const REPLACE_MESSAGE_TYPE = 'marketer-guide-replace-screenshot';

function screenshotPreviewUrl(filename: string, version: number): string {
  return `/help/screenshots/${filename}?v=${version}`;
}

function parseScreenshotFilename(src: string): string | null {
  const match = src.match(/screenshots\/([^/?#]+)/i);
  return match?.[1] ?? null;
}

function injectIframeScreenshotOverlays(
  iframe: HTMLIFrameElement,
  chapterId: string,
  previewVersion: number,
) {
  const doc = iframe.contentDocument;
  if (!doc) return;

  doc.querySelectorAll('[data-guide-screenshot-edit]').forEach((el) => el.remove());
  doc.getElementById('guide-screenshot-edit-style')?.remove();

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

  const slide = doc.getElementById(`slide-${chapterId}`);
  if (!slide) return;

  slide.querySelectorAll('img[src*="screenshots/"]').forEach((node) => {
    const img = node as HTMLImageElement;
    const filename = parseScreenshotFilename(img.getAttribute('src') ?? '');
    if (!filename) return;

    let wrap = img.parentElement;
    if (!wrap?.classList.contains('guide-screenshot-edit-wrap')) {
      const newWrap = doc.createElement('div');
      newWrap.className = 'guide-screenshot-edit-wrap';
      img.parentNode?.insertBefore(newWrap, img);
      newWrap.appendChild(img);
      wrap = newWrap;
    }

    const btn = doc.createElement('button');
    btn.type = 'button';
    btn.className = 'guide-screenshot-edit-btn';
    btn.setAttribute('data-guide-screenshot-edit', filename);
    btn.textContent = '📷 사진 교체';
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      window.parent.postMessage({ type: REPLACE_MESSAGE_TYPE, filename }, window.location.origin);
    });
    wrap.appendChild(btn);

    img.src = `./screenshots/${filename}?v=${previewVersion}`;
  });
}

function refreshIframeScreenshotSrc(
  iframe: HTMLIFrameElement,
  chapterId: string,
  previewVersion: number,
) {
  const doc = iframe.contentDocument;
  if (!doc) return;
  const slide = doc.getElementById(`slide-${chapterId}`);
  slide?.querySelectorAll('img[src*="screenshots/"]').forEach((node) => {
    const img = node as HTMLImageElement;
    const filename = parseScreenshotFilename(img.getAttribute('src') ?? '');
    if (filename) img.src = `./screenshots/${filename}?v=${previewVersion}`;
  });
}

export function MarketerGuideScreenshotEditor({
  activeChapter,
  iframeRef,
}: MarketerGuideScreenshotEditorProps) {
  const [canEdit, setCanEdit] = useState(false);
  const [items, setItems] = useState<MarketerGuideScreenshotItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingFilename, setUploadingFilename] = useState<string | null>(null);
  const [previewVersion, setPreviewVersion] = useState(() => Date.now());
  const [successFilename, setSuccessFilename] = useState<string | null>(null);
  const [dragOverFilename, setDragOverFilename] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    let cancelled = false;
    checkMarketerGuideScreenshotEditPermission().then((perm) => {
      if (!cancelled) setCanEdit(perm.canEdit);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    try {
      const catalog = await fetchMarketerGuideScreenshotCatalog();
      setItems(catalog);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!canEdit) return;
    loadCatalog();
  }, [canEdit, loadCatalog]);

  const chapterItems = useMemo(() => {
    if (!activeChapter) return [];
    return items.filter((item) => item.chapterIds.includes(activeChapter));
  }, [items, activeChapter]);

  const handleUpload = useCallback(
    async (filename: string, file: File) => {
      setUploadingFilename(filename);
      setSuccessFilename(null);
      try {
        await uploadMarketerGuideScreenshot(filename, file);
        const version = Date.now();
        setPreviewVersion(version);
        const iframe = iframeRef.current;
        if (iframe && activeChapter) {
          refreshIframeScreenshotSrc(iframe, activeChapter, version);
        }
        setSuccessFilename(filename);
        window.setTimeout(() => setSuccessFilename((prev) => (prev === filename ? null : prev)), 2500);
      } catch (err) {
        alert((err as Error).message);
      } finally {
        setUploadingFilename(null);
        const input = fileInputRefs.current[filename];
        if (input) input.value = '';
      }
    },
    [activeChapter, iframeRef],
  );

  const openFilePicker = useCallback((filename: string) => {
    fileInputRefs.current[filename]?.click();
  }, []);

  useEffect(() => {
    if (!canEdit) return;
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data as { type?: string; filename?: string };
      if (data?.type !== REPLACE_MESSAGE_TYPE || !data.filename) return;
      openFilePicker(data.filename);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [canEdit, openFilePicker]);

  const attachIframeOverlays = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe || !canEdit || !activeChapter) return;
    injectIframeScreenshotOverlays(iframe, activeChapter, previewVersion);
  }, [iframeRef, canEdit, activeChapter, previewVersion]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || !canEdit) return;
    iframe.addEventListener('load', attachIframeOverlays);
    attachIframeOverlays();
    return () => iframe.removeEventListener('load', attachIframeOverlays);
  }, [iframeRef, canEdit, attachIframeOverlays]);

  if (!canEdit || !activeChapter || chapterItems.length === 0) return null;

  return (
    <div className="mt-2 rounded-xl border border-sky-200 bg-sky-50/90 shadow-sm">
      <div className="border-b border-sky-200 px-3 py-2 sm:px-4">
        <p className="text-fluid-xs font-semibold text-sky-950">이 장 스크린샷 교체</p>
        <p className="mt-0.5 text-fluid-2xs text-sky-800">
          아래 카드를 클릭·드래그하거나, 가이드 화면의 이미지 위 <strong>「📷 사진 교체」</strong>를
          누르세요.
        </p>
      </div>

      {loading ? (
        <p className="px-3 py-3 text-fluid-2xs text-slate-600 sm:px-4">불러오는 중…</p>
      ) : (
        <ul className="flex gap-2 overflow-x-auto p-3 sm:gap-3 sm:p-4">
          {chapterItems.map((item) => {
            const isUploading = uploadingFilename === item.filename;
            const isSuccess = successFilename === item.filename;
            const isDragOver = dragOverFilename === item.filename;

            return (
              <li key={item.filename} className="w-[min(100%,11rem)] shrink-0 sm:w-44">
                <label
                  className={`group relative flex cursor-pointer flex-col overflow-hidden rounded-lg border-2 bg-white shadow-sm transition ${
                    isDragOver
                      ? 'border-sky-500 ring-2 ring-sky-200'
                      : isSuccess
                        ? 'border-emerald-400'
                        : 'border-slate-200 hover:border-sky-400'
                  } ${isUploading ? 'pointer-events-none opacity-70' : ''}`}
                  onDragEnter={(e) => {
                    e.preventDefault();
                    setDragOverFilename(item.filename);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOverFilename(item.filename);
                  }}
                  onDragLeave={() => setDragOverFilename(null)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOverFilename(null);
                    const file = e.dataTransfer.files?.[0];
                    if (file?.type.startsWith('image/')) void handleUpload(item.filename, file);
                  }}
                >
                  <input
                    ref={(el) => {
                      fileInputRefs.current[item.filename] = el;
                    }}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    className="sr-only"
                    disabled={isUploading}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void handleUpload(item.filename, file);
                    }}
                  />
                  <div className="relative aspect-[4/3] w-full bg-slate-100">
                    <img
                      src={screenshotPreviewUrl(item.filename, previewVersion)}
                      alt=""
                      className="h-full w-full object-cover object-left-top"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-sky-900/0 transition group-hover:bg-sky-900/35">
                      <span className="rounded-md bg-white/95 px-2 py-1 text-fluid-2xs font-semibold text-sky-800 opacity-100 shadow sm:opacity-0 sm:group-hover:opacity-100">
                        {isUploading ? '업로드 중…' : isSuccess ? '✓ 완료' : '클릭 · 드래그'}
                      </span>
                    </div>
                  </div>
                  <div className="px-2 py-1.5">
                    <p className="truncate text-fluid-2xs font-medium text-slate-800">{item.label}</p>
                  </div>
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
