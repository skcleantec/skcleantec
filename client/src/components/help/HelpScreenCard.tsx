import { useState } from 'react';
import type { HelpScreenEntry } from '../../types/helpContent';
import { screenshotUrl } from '../../utils/helpContent';
import { SimpleMarkdown } from '../../utils/simpleMarkdown';
import { HelpImageLightbox } from './HelpImageLightbox';

type HelpScreenCardProps = {
  entry: HelpScreenEntry;
};

export function HelpScreenCard({ entry }: HelpScreenCardProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const imgSrc = screenshotUrl(entry.screenshotFile);

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-4 py-4 sm:px-6">
        <h3 className="text-lg font-semibold tracking-tight text-slate-900">{entry.title}</h3>
        {entry.summary ? <p className="mt-1 text-fluid-sm text-slate-600">{entry.summary}</p> : null}
        {entry.path ? (
          <p className="mt-2 font-mono text-fluid-2xs text-slate-400">{entry.path}</p>
        ) : null}
      </div>

      {imgSrc ? (
        <div className="border-b border-slate-100 bg-slate-50 p-3 sm:p-4">
          <button
            type="button"
            onClick={() => setLightboxOpen(true)}
            className="group block w-full overflow-hidden rounded-xl border border-slate-200 bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
            aria-label={`${entry.title} 스크린샷 확대`}
          >
            <img
              src={imgSrc}
              alt={`${entry.title} 화면`}
              loading="lazy"
              className="max-h-72 w-full object-contain object-top transition-transform group-hover:scale-[1.01] sm:max-h-96"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
            <p className="py-2 text-center text-fluid-2xs text-slate-500 group-hover:text-slate-700">
              탭하여 확대
            </p>
          </button>
        </div>
      ) : null}

      {entry.markdown ? (
        <div className="px-4 py-4 sm:px-6 sm:py-5">
          <SimpleMarkdown source={entry.markdown} />
        </div>
      ) : null}

      {lightboxOpen && imgSrc ? (
        <HelpImageLightbox src={imgSrc} alt={`${entry.title} 화면`} onClose={() => setLightboxOpen(false)} />
      ) : null}
    </article>
  );
}
