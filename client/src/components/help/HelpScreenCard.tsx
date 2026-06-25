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
  const embedUrl = entry.embedUrl?.trim() || '';
  const isEmbeddedGuide = Boolean(embedUrl);

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

  const handleImageUpload = async (file: File, insertIntoMarkdown = false) => {
    if (!canEdit) return;
    setUploadingImage(true);
    try {
      const result = await uploadHelpScreenshot(file);
      
      if (insertIntoMarkdown) {
        // 마크다운에 이미지 문법 삽입
        const imageMarkdown = `\n\n![${file.name.replace(/\.[^/.]+$/, '')}](${result.filename})\n\n`;
        const newMarkdown = editMarkdown + imageMarkdown;
        setEditMarkdown(newMarkdown);
        alert('이미지가 마크다운에 삽입되었습니다!');
      } else {
        // 대표 스크린샷으로 설정
        await updateHelpContent(entry.role, entry.path, { screenshotFile: result.filename });
        alert('대표 스크린샷 업로드 완료!');
        onUpdated?.();
      }
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
          {canEdit && !isEmbeddedGuide ? (
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
              {!editing ? (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingImage}
                  className="rounded-lg bg-green-500 px-3 py-1.5 text-fluid-2xs font-medium text-white hover:bg-green-600 disabled:opacity-50"
                >
                  📷 대표 {uploadingImage ? '...' : ''}
                </button>
              ) : null}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImageUpload(file, false);
                  e.target.value = '';
                }}
              />
            </div>
          ) : null}
        </div>
      </div>

      {!isEmbeddedGuide ? <HelpScreenshot entry={entry} /> : null}

      {isEmbeddedGuide ? (
        <div className="border-t border-slate-100 bg-slate-50 p-2 sm:p-3">
          <p className="mb-2 px-1 text-fluid-2xs text-slate-500">
            아래 가이드는 스크롤·확대하여 볼 수 있습니다. 새 창:{' '}
            <a
              href={embedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-sky-600 underline hover:text-sky-700"
            >
              전체 화면으로 열기
            </a>
          </p>
          <iframe
            src={embedUrl}
            title={entry.title}
            className="block w-full min-h-[70vh] rounded-xl border border-slate-200 bg-white sm:min-h-[80vh]"
            loading="lazy"
          />
        </div>
      ) : null}

      {editing ? (
        <div className="border-t border-slate-100 px-4 py-4 sm:px-6 sm:py-5 bg-slate-50">
          <div className="flex items-center justify-between mb-2">
            <label className="block text-fluid-sm font-semibold text-slate-700">
              마크다운 편집
            </label>
            <button
              type="button"
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*';
                input.onchange = (e) => {
                  const file = (e.target as HTMLInputElement).files?.[0];
                  if (file) handleImageUpload(file, true);
                };
                input.click();
              }}
              disabled={uploadingImage}
              className="rounded-lg bg-green-500 px-3 py-1.5 text-fluid-2xs font-medium text-white hover:bg-green-600 disabled:opacity-50"
            >
              📷 이미지 삽입 {uploadingImage ? '...' : ''}
            </button>
          </div>
          <textarea
            value={editMarkdown}
            onChange={(e) => setEditMarkdown(e.target.value)}
            rows={20}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-fluid-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="마크다운 문법을 사용하세요. 이미지: ![설명](파일명.png)"
          />
          <div className="mt-2 text-fluid-xs text-slate-500">
            💡 이미지 삽입 버튼을 누르면 자동으로 <code className="bg-slate-200 px-1 rounded">![](파일명.png)</code> 문법이 추가됩니다.
          </div>
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
      ) : !isEmbeddedGuide && entry.markdown ? (
        <div className="px-4 py-4 sm:px-6 sm:py-5">
          <SimpleMarkdown source={entry.markdown} />
        </div>
      ) : null}
    </article>
  );
}
