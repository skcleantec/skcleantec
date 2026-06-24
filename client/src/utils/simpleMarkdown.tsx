import type { ReactNode } from 'react';
import { HelpUiEmbed } from '../components/help/ui/helpUiRegistry';
import { isHelpUiTokenId } from '@shared/helpUiTokens';

const UI_TOKEN_RE = /\{\{ui:([^}|]+)(?:\|([^}]+))?\}\}/g;
const BOLD_RE = /\*\*(.+?)\*\*/g;

function renderTextWithBold(text: string, keyPrefix: string): ReactNode[] {
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let i = 0;

  while ((match = BOLD_RE.exec(text)) !== null) {
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

/** **볼드** + {{ui:token}} 혼합 인라인 */
export function renderHelpInline(text: string, keyPrefix: string): ReactNode[] {
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let i = 0;

  UI_TOKEN_RE.lastIndex = 0;
  while ((match = UI_TOKEN_RE.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(...renderTextWithBold(text.slice(lastIndex, match.index), `${keyPrefix}-t-${i}`));
    }
    const tokenId = match[1]?.trim() ?? '';
    if (isHelpUiTokenId(tokenId)) {
      parts.push(<HelpUiEmbed key={`${keyPrefix}-ui-${i}`} tokenId={tokenId} />);
    } else {
      parts.push(
        <span
          key={`${keyPrefix}-ui-bad-${i}`}
          className="text-[10px] text-amber-700"
          title="알 수 없는 UI 토큰"
        >
          {match[0]}
        </span>
      );
    }
    lastIndex = match.index + match[0].length;
    i += 1;
  }

  if (lastIndex < text.length) {
    parts.push(...renderTextWithBold(text.slice(lastIndex), `${keyPrefix}-tail`));
  }

  return parts.length ? parts : renderTextWithBold(text, keyPrefix);
}

function isTableRow(line: string): boolean {
  return line.includes('|') && line.trim().startsWith('|');
}

function isTableSeparator(line: string): boolean {
  return /^\|[\s\-:|]+\|$/.test(line.trim());
}

function parseTableCells(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

/** 경량 markdown — ## 헤더, **볼드**, {{ui:…}}, - 리스트, 표, ![이미지](파일명) */
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

        // {{ui:token}} — 단독 블록
        const uiBlockMatch = first.match(/^\{\{ui:([^}|]+)(?:\|([^}]+))?\}\}$/);
        if (uiBlockMatch && lines.length === 1) {
          const tokenId = uiBlockMatch[1]?.trim() ?? '';
          return (
            <div key={`ui-block-${blockIdx}`} className="my-3">
              <HelpUiEmbed tokenId={tokenId} />
            </div>
          );
        }

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

        // markdown 표
        if (lines.length >= 2 && isTableRow(first) && isTableSeparator(lines[1] ?? '')) {
          const headerCells = parseTableCells(first);
          const bodyLines = lines.slice(2).filter(isTableRow);
          return (
            <div
              key={`table-${blockIdx}`}
              className="overflow-x-auto overscroll-x-contain -mx-1 px-1 sm:mx-0 sm:px-0"
            >
              <table className="w-full min-w-[280px] border-collapse text-fluid-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    {headerCells.map((cell, ci) => (
                      <th
                        key={`th-${blockIdx}-${ci}`}
                        className="px-3 py-2 text-center font-semibold text-slate-800"
                      >
                        {renderHelpInline(cell, `th-${blockIdx}-${ci}`)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {bodyLines.map((rowLine, ri) => {
                    const cells = parseTableCells(rowLine);
                    return (
                      <tr key={`tr-${blockIdx}-${ri}`} className="border-b border-slate-100">
                        {cells.map((cell, ci) => (
                          <td
                            key={`td-${blockIdx}-${ri}-${ci}`}
                            className="px-3 py-2 text-center text-slate-700 align-middle"
                          >
                            {renderHelpInline(cell, `td-${blockIdx}-${ri}-${ci}`)}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        }

        // ## 헤더
        if (first.startsWith('## ')) {
          return (
            <h3
              key={`h-${blockIdx}`}
              className="text-fluid-base font-semibold text-slate-900 pt-2 first:pt-0"
            >
              {renderHelpInline(first.slice(3), `h-${blockIdx}`)}
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
              {renderHelpInline(first.slice(4), `h4-${blockIdx}`)}
            </h4>
          );
        }

        // - 리스트
        if (lines.every((line) => line.startsWith('- '))) {
          return (
            <ul key={`ul-${blockIdx}`} className="list-disc space-y-1.5 pl-6 marker:text-slate-400">
              {lines.map((line, lineIdx) => (
                <li key={`li-${blockIdx}-${lineIdx}`} className="pl-1">
                  {renderHelpInline(line.slice(2), `li-${blockIdx}-${lineIdx}`)}
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
                    {renderHelpInline(content, `oli-${blockIdx}-${lineIdx}`)}
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
                {renderHelpInline(line, `pl-${blockIdx}-${lineIdx}`)}
              </p>
            ))}
          </div>
        );
      })}
    </div>
  );
}
