import { useState } from 'react';
import type { HelpScreenEntry } from '../../types/helpContent';
import { screenshotUrl } from '../../utils/helpContent';
import { SimpleMarkdown } from '../../utils/simpleMarkdown';
import { HelpImageLightbox } from './HelpImageLightbox';

type HelpScreenCardProps = {
  entry: HelpScreenEntry;
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

export function HelpScreenCard({ entry }: HelpScreenCardProps) {
  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-4 py-4 sm:px-6">
        <h3 className="text-lg font-semibold tracking-tight text-slate-900">{entry.title}</h3>
        {entry.summary ? <p className="mt-1 text-fluid-sm text-slate-600">{entry.summary}</p> : null}
        {entry.path ? (
          <p className="mt-2 font-mono text-fluid-2xs text-slate-400">{entry.path}</p>
        ) : null}
      </div>

      <HelpScreenshot entry={entry} />

      {entry.markdown ? (
        <div className="px-4 py-4 sm:px-6 sm:py-5">
          <SimpleMarkdown source={entry.markdown} />
        </div>
      ) : null}
    </article>
  );
}
