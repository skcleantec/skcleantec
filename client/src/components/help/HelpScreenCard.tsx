import { useState, useRef } from 'react';
import type { HelpScreenEntry } from '../../types/helpContent';
import { screenshotUrl } from '../../utils/helpContent';
import { SimpleMarkdown } from '../../utils/simpleMarkdown';
import { HelpImageLightbox } from './HelpImageLightbox';
import { uploadHelpScreenshot, updateHelpContent } from '../../api/help';

type HelpScreenCardProps = {
  entry: HelpScreenEntry;
  canEdit?: boolean;
  onUpdated?: () => void;
};

function HelpScreenshot({ entry }: { entry: HelpScreenEntry }) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [imgOk, setImgOk] = useState<boolean | null>(null);
  const imgSrc = screenshotUrl(entry.screenshotFile);
  const fileLabel = entry.screenshotFile?.trim() || '스크린샷 없음';
  const showPlaceholder = !imgSrc || imgOk === false;

  if (!imgSrc && !entry.screenshotFile?.trim()) return null;

  return (
    <div className="border-b border-slate-100 bg-slate-50 p-3 sm:p-4">
      <button
        type="button"
        onClick={() => {
          if (imgOk) setLightboxOpen(true);
        }}
        disabled={!imgOk}
        className="group block w-full overflow-hidden rounded-xl border border-slate-200 bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 disabled:cursor-default"
        aria-label={imgOk ? `${entry.title} 스크린샷 확대` : `${entry.title} 스크린샷 준비 중`}
      >
        {showPlaceholder ? (
          <div
            className="flex aspect-video w-full flex-col items-center justify-center gap-2 bg-slate-100 px-4 text-center"
            aria-hidden={imgOk === true}
          >
            <span className="text-2xl" aria-hidden>
              📷
            </span>
            <p className="text-fluid-xs font-medium text-slate-600">{fileLabel}</p>
            <p className="text-fluid-2xs text-slate-500">스크린샷 준비 중</p>
          </div>
        ) : null}
        {imgSrc ? (
          <img
            src={imgSrc}
            alt={`${entry.title} 화면`}
            loading="lazy"
            className={`max-h-72 w-full object-contain object-top transition-transform group-hover:scale-[1.01] sm:max-h-96 ${
              showPlaceholder ? 'sr-only' : ''
            }`}
            onLoad={() => setImgOk(true)}
            onError={() => setImgOk(false)}
          />
        ) : null}
        {imgOk ? (
          <p className="py-2 text-center text-fluid-2xs text-slate-500 group-hover:text-slate-700">
            탭하여 확대
          </p>
        ) : null}
      </button>

      {lightboxOpen && imgSrc && imgOk ? (
        <HelpImageLightbox src={imgSrc} alt={`${entry.title} 화면`} onClose={() => setLightboxOpen(false)} />
      ) : null}
    </div>
  );
}

export function HelpScreenCard({ entry, canEdit, onUpdated }: HelpScreenCardProps) {
  const [editing, setEditing] = useState(false);
  const [editMarkdown, setEditMarkdown] = useState(entry.markdown || '');
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSave = async () => {
    if (!canEdit) return;
    setSaving(true);
    try {
      await updateHelpContent(entry.role, entry.path, { markdown: editMarkdown });
      alert('저장 완료!');
      setEditing(false);
      onUpdated?.();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = async (file: File) => {
    if (!canEdit) return;
    setUploadingImage(true);
    try {
      const result = await uploadHelpScreenshot(file);
      await updateHelpContent(entry.role, entry.path, { screenshotFile: result.filename });
      alert('스크린샷 업로드 완료!');
      onUpdated?.();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setUploadingImage(false);
    }
  };

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-4 py-4 sm:px-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold tracking-tight text-slate-900">{entry.title}</h3>
            {entry.summary ? <p className="mt-1 text-fluid-sm text-slate-600">{entry.summary}</p> : null}
            {entry.path ? (
              <p className="mt-2 font-mono text-fluid-2xs text-slate-400">{entry.path}</p>
            ) : null}
          </div>
          {canEdit ? (
            <div className="flex gap-2 shrink-0">
              {!editing ? (
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="rounded-lg bg-blue-500 px-3 py-1.5 text-fluid-2xs font-medium text-white hover:bg-blue-600"
                >
                  ✏️ 편집
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingImage}
                className="rounded-lg bg-green-500 px-3 py-1.5 text-fluid-2xs font-medium text-white hover:bg-green-600 disabled:opacity-50"
              >
                📷 이미지 {uploadingImage ? '...' : ''}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImageUpload(file);
                  e.target.value = '';
                }}
              />
            </div>
          ) : null}
        </div>
      </div>

      <HelpScreenshot entry={entry} />

      {editing ? (
        <div className="border-t border-slate-100 px-4 py-4 sm:px-6 sm:py-5 bg-slate-50">
          <label className="block mb-2 text-fluid-sm font-semibold text-slate-700">
            마크다운 편집
          </label>
          <textarea
            value={editMarkdown}
            onChange={(e) => setEditMarkdown(e.target.value)}
            rows={20}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-fluid-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-blue-500 px-4 py-2 text-fluid-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50"
            >
              {saving ? '저장 중...' : '💾 저장'}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditMarkdown(entry.markdown || '');
                setEditing(false);
              }}
              className="rounded-lg bg-slate-300 px-4 py-2 text-fluid-sm font-medium text-slate-700 hover:bg-slate-400"
            >
              취소
            </button>
          </div>
        </div>
      ) : entry.markdown ? (
        <div className="px-4 py-4 sm:px-6 sm:py-5">
          <SimpleMarkdown source={entry.markdown} />
        </div>
      ) : null}
    </article>
  );
}
