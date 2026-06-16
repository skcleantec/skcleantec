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

/** 경량 markdown — ## 헤더, **볼드**, - 리스트, 빈 줄 단락 */
export function SimpleMarkdown({ source }: { source: string }) {
  const blocks = source.replace(/\r\n/g, '\n').split(/\n\n+/);

  return (
    <div className="space-y-3 text-fluid-sm text-slate-700 leading-relaxed">
      {blocks.map((block, blockIdx) => {
        const lines = block.split('\n').filter((line) => line.trim() !== '');
        if (lines.length === 0) return null;

        const first = lines[0] ?? '';
        if (first.startsWith('## ')) {
          return (
            <h3
              key={`h-${blockIdx}`}
              className="text-fluid-base font-semibold text-slate-900 pt-1 first:pt-0"
            >
              {renderInline(first.slice(3), `h-${blockIdx}`)}
            </h3>
          );
        }

        if (lines.every((line) => line.startsWith('- '))) {
          return (
            <ul key={`ul-${blockIdx}`} className="list-disc space-y-1 pl-5 marker:text-slate-400">
              {lines.map((line, lineIdx) => (
                <li key={`li-${blockIdx}-${lineIdx}`}>{renderInline(line.slice(2), `li-${blockIdx}-${lineIdx}`)}</li>
              ))}
            </ul>
          );
        }

        return (
          <p key={`p-${blockIdx}`} className="whitespace-pre-wrap">
            {lines.map((line, lineIdx) => (
              <span key={`pl-${blockIdx}-${lineIdx}`}>
                {lineIdx > 0 ? <br /> : null}
                {renderInline(line, `pl-${blockIdx}-${lineIdx}`)}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}
