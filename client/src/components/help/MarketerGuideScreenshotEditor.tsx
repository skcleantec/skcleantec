import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  checkMarketerGuideScreenshotEditPermission,
  fetchMarketerGuideScreenshotCatalog,
  uploadMarketerGuideScreenshot,
  type MarketerGuideScreenshotItem,
} from '../../api/help';

type MarketerGuideScreenshotEditorProps = {
  activeChapter: string | null;
  onScreenshotUpdated: () => void;
};

function screenshotPreviewUrl(filename: string, version: number): string {
  return `/help/screenshots/${filename}?v=${version}`;
}

export function MarketerGuideScreenshotEditor({
  activeChapter,
  onScreenshotUpdated,
}: MarketerGuideScreenshotEditorProps) {
  const [canEdit, setCanEdit] = useState(false);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<MarketerGuideScreenshotItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingFilename, setUploadingFilename] = useState<string | null>(null);
  const [previewVersion, setPreviewVersion] = useState(() => Date.now());
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

  const sortedItems = useMemo(() => {
    if (!activeChapter) return items;
    const inChapter = items.filter((item) => item.chapterIds.includes(activeChapter));
    const rest = items.filter((item) => !item.chapterIds.includes(activeChapter));
    return [...inChapter, ...rest];
  }, [items, activeChapter]);

  const handleUpload = async (filename: string, file: File) => {
    setUploadingFilename(filename);
    try {
      await uploadMarketerGuideScreenshot(filename, file);
      setPreviewVersion(Date.now());
      onScreenshotUpdated();
      alert(`${filename} 교체 완료`);
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setUploadingFilename(null);
      const input = fileInputRefs.current[filename];
      if (input) input.value = '';
    }
  };

  if (!canEdit) return null;

  return (
    <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50/80">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left sm:px-4"
        aria-expanded={open}
      >
        <span className="text-fluid-xs font-semibold text-amber-900">
          스크린샷 교체 (개발자)
        </span>
        <span className="text-fluid-2xs text-amber-700">{open ? '접기' : '펼치기'}</span>
      </button>

      {open ? (
        <div className="space-y-3 border-t border-amber-200 px-3 pb-3 pt-2 sm:px-4 sm:pb-4">
          <p className="text-fluid-2xs text-amber-800">
            PNG·JPG 등 이미지를 선택하면 가이드 HTML에 연결된 동일 파일명으로 덮어씁니다. 현재
            장({activeChapter ?? '—'})에 쓰인 항목이 위에 표시됩니다.
          </p>

          {loading ? (
            <p className="text-fluid-2xs text-slate-600">목록 불러오는 중…</p>
          ) : (
            <ul className="space-y-2">
              {sortedItems.map((item) => {
                const isCurrentChapter =
                  activeChapter != null && item.chapterIds.includes(activeChapter);
                const isUploading = uploadingFilename === item.filename;

                return (
                  <li
                    key={item.filename}
                    className={`rounded-lg border bg-white p-2 sm:p-3 ${
                      isCurrentChapter ? 'border-sky-300 ring-1 ring-sky-100' : 'border-slate-200'
                    }`}
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <div className="min-w-0 flex-1">
                        <p className="text-fluid-xs font-medium text-slate-800">{item.label}</p>
                        <p className="truncate text-fluid-2xs text-slate-500" title={item.filename}>
                          {item.filename}
                          {isCurrentChapter ? (
                            <span className="ml-1.5 text-sky-600">· 이 장</span>
                          ) : null}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <img
                          src={screenshotPreviewUrl(item.filename, previewVersion)}
                          alt=""
                          className="h-10 w-16 rounded border border-slate-200 object-cover object-left-top"
                        />
                        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-1.5 text-fluid-2xs font-medium text-slate-700 hover:bg-slate-100">
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
                          {isUploading ? '업로드 중…' : '교체'}
                        </label>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
