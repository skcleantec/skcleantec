import type { MessageAttachment } from '../../api/messages';
import {
  BUNDLE_MAX_CELLS,
  bundleRows,
  formatFileSize,
  imagePreview,
  imageThumb,
  splitAttachments,
} from './messageAttachments';

type Props = {
  attachments: MessageAttachment[] | undefined | null;
  /** 사진을 눌렀을 때 — 묶음 안에서 몇 번째인지 */
  onOpenImage: (index: number, images: MessageAttachment[]) => void;
  /** 파일을 눌렀을 때 (읽음 처리용). 열기는 이 컴포넌트가 한다. */
  onOpenFile?: (file: MessageAttachment) => void;
  /** 묶음 너비(px). 기본 264 */
  width?: number;
  align?: 'left' | 'right';
};

function PdfIcon() {
  return (
    <span className="flex h-11 w-9 shrink-0 items-center justify-center rounded-md bg-red-100 text-[11px] font-black text-red-700">
      PDF
    </span>
  );
}

/** 말풍선 아래에 붙는 사진 묶음 + 파일 카드 */
export function MessageAttachmentBundle({ attachments, onOpenImage, onOpenFile, width = 264, align = 'left' }: Props) {
  const { images, files } = splitAttachments(attachments);
  if (images.length === 0 && files.length === 0) return null;

  const shown = images.slice(0, BUNDLE_MAX_CELLS);
  const hidden = images.length - shown.length;
  const rows = images.length > 0 ? bundleRows(shown.length) : [];
  const rowStarts = rows.map((_, r) => rows.slice(0, r).reduce((sum, n) => sum + n, 0));

  return (
    <div className={`flex min-w-0 flex-col gap-1.5 ${align === 'right' ? 'items-end' : 'items-start'}`}>
      {images.length > 0 ? (
        <div
          className="flex flex-col gap-0.5 overflow-hidden rounded-2xl bg-white"
          style={{ width, maxWidth: '100%' }}
        >
          {rows.map((cols, rowIndex) => {
            const start = rowStarts[rowIndex];
            const single = shown.length === 1;
            return (
              <div key={rowIndex} className="flex gap-0.5">
                {shown.slice(start, start + cols).map((img, i) => {
                  const index = start + i;
                  const isLast = index === shown.length - 1;
                  return (
                    <button
                      key={img.id}
                      type="button"
                      onClick={() => onOpenImage(index, images)}
                      aria-label={`사진 ${index + 1} 크게 보기`}
                      className="relative min-w-0 flex-1 overflow-hidden bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                      style={{ aspectRatio: single ? '4 / 3' : '1 / 1' }}
                    >
                      <img
                        src={single ? imagePreview(img) : imageThumb(img)}
                        alt={img.fileName}
                        loading="lazy"
                        draggable={false}
                        className="h-full w-full object-cover"
                      />
                      {isLast && hidden > 0 ? (
                        <span className="absolute inset-0 flex items-center justify-center bg-slate-900/55 text-xl font-extrabold text-white">
                          +{hidden}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      ) : null}

      {files.map((f) => (
        <a
          key={f.id}
          href={f.originalUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => onOpenFile?.(f)}
          className="flex items-center gap-2.5 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-left no-underline shadow-sm hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
          style={{ width, maxWidth: '100%' }}
        >
          <PdfIcon />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-bold text-slate-900">{f.fileName}</span>
            <span className="block text-[11.5px] text-slate-500">
              {[f.pageCount ? `${f.pageCount}쪽` : '', formatFileSize(f.sizeBytes)].filter(Boolean).join(' · ')}
            </span>
          </span>
          <span className="shrink-0 rounded-lg border border-violet-200 px-2 py-1 text-[12px] font-bold text-violet-700">
            열기
          </span>
        </a>
      ))}
    </div>
  );
}
