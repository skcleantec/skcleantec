import type { InquiryChangeLogEntry } from '../../api/schedule';

function normalizeLines(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === 'string');
}

/** 접수 날짜·금액 변경 이력 (관리자 PATCH 시 서버 기록) */
export function InquiryChangeHistoryBlock({ logs }: { logs: InquiryChangeLogEntry[] | undefined }) {
  const entries =
    logs?.map((log) => ({ ...log, lines: normalizeLines(log.lines) })).filter((e) => e.lines.length > 0) ??
    [];
  if (entries.length === 0) return null;
  return (
    <div className="mb-6 p-4 bg-amber-50/80 border border-amber-100 rounded-lg">
      <h3 className="text-sm font-medium text-amber-900 mb-3">날짜·금액 변경 이력</h3>
      <ul className="space-y-3 text-sm">
        {entries.map((log) => (
          <li key={log.id} className="border-l-2 border-amber-300 pl-3">
            <div className="text-xs text-amber-800/80">
              {new Date(log.createdAt).toLocaleString('ko-KR', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </div>
            <ul className="mt-1 space-y-0.5 text-amber-950">
              {log.lines.map((line, i) => (
                <li key={i} className="text-xs leading-relaxed">
                  {line}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}
