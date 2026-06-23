import type { ReactNode } from 'react';

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const re = /\*\*(.+?)\*\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let i = 0;

  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    parts.push(
      <strong key={`${keyPrefix}-b-${i}`} className="font-semibold text-slate-900">
        {match[1]}
      </strong>
    );
    lastIndex = match.index + match[0].length;
    i += 1;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length ? parts : [text];
}

/** 경량 markdown — ## 헤더, **볼드**, - 리스트, 빈 줄 단락, 1. 숫자 리스트, ![이미지](파일명) */
export function SimpleMarkdown({ source }: { source: string }) {
  if (!source || typeof source !== 'string') {
    return <div className="text-fluid-sm text-slate-500">내용이 없습니다.</div>;
  }

  const normalized = source.replace(/\r\n/g, '\n').trim();
  if (!normalized) {
    return <div className="text-fluid-sm text-slate-500">내용이 없습니다.</div>;
  }

  const blocks = normalized.split(/\n\n+/);

  return (
    <div className="space-y-4 text-fluid-sm text-slate-700 leading-relaxed">
      {blocks.map((block, blockIdx) => {
        const trimmed = block.trim();
        if (!trimmed) return null;

        const lines = trimmed.split('\n').map((line) => line.trim()).filter((line) => line !== '');
        if (lines.length === 0) return null;

        const first = lines[0] ?? '';

        // ![이미지](파일명) — 단독 줄
        const imageMatch = first.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
        if (imageMatch && lines.length === 1) {
          const [, alt, filename] = imageMatch;
          const imageUrl = filename.startsWith('http') 
            ? filename 
            : `/help/screenshots/${encodeURIComponent(filename)}`;
          
          return (
            <figure key={`img-${blockIdx}`} className="my-6">
              <img
                src={imageUrl}
                alt={alt || '스크린샷'}
                className="max-w-full rounded-lg border border-slate-200 shadow-sm"
                loading="lazy"
              />
              {alt ? (
                <figcaption className="mt-2 text-center text-fluid-xs text-slate-500">
                  {alt}
                </figcaption>
              ) : null}
            </figure>
          );
        }

        // ## 헤더
        if (first.startsWith('## ')) {
          return (
            <h3
              key={`h-${blockIdx}`}
              className="text-fluid-base font-semibold text-slate-900 pt-2 first:pt-0"
            >
              {renderInline(first.slice(3), `h-${blockIdx}`)}
            </h3>
          );
        }

        // ### 서브 헤더
        if (first.startsWith('### ')) {
          return (
            <h4
              key={`h4-${blockIdx}`}
              className="text-fluid-sm font-semibold text-slate-800 pt-1 first:pt-0"
            >
              {renderInline(first.slice(4), `h4-${blockIdx}`)}
            </h4>
          );
        }

        // - 리스트
        if (lines.every((line) => line.startsWith('- '))) {
          return (
            <ul key={`ul-${blockIdx}`} className="list-disc space-y-1.5 pl-6 marker:text-slate-400">
              {lines.map((line, lineIdx) => (
                <li key={`li-${blockIdx}-${lineIdx}`} className="pl-1">
                  {renderInline(line.slice(2), `li-${blockIdx}-${lineIdx}`)}
                </li>
              ))}
            </ul>
          );
        }

        // 1. 숫자 리스트
        if (lines.every((line) => /^\d+\.\s/.test(line))) {
          return (
            <ol key={`ol-${blockIdx}`} className="list-decimal space-y-1.5 pl-6 marker:text-slate-400">
              {lines.map((line, lineIdx) => {
                const content = line.replace(/^\d+\.\s*/, '');
                return (
                  <li key={`oli-${blockIdx}-${lineIdx}`} className="pl-1">
                    {renderInline(content, `oli-${blockIdx}-${lineIdx}`)}
                  </li>
                );
              })}
            </ol>
          );
        }

        // 일반 단락
        return (
          <div key={`p-${blockIdx}`} className="space-y-1">
            {lines.map((line, lineIdx) => (
              <p key={`pl-${blockIdx}-${lineIdx}`}>
                {renderInline(line, `pl-${blockIdx}-${lineIdx}`)}
              </p>
            ))}
          </div>
        );
      })}
    </div>
  );
}
