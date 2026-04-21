import { useCallback, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ScheduleItem } from '../../api/schedule';
import { ModalCloseButton } from './ModalCloseButton';
import { weekdayKoFromYmd } from '../../utils/dateFormat';
import { getScheduleTimeBucket, isSideCleaningTime } from '../../utils/scheduleTimeBucket';
import { parseCrewMemberNoteToNames } from '../../utils/crewMemberNote';

function itemSlotLabelKo(item: ScheduleItem): string {
  if (isSideCleaningTime(item.preferredTime)) {
    const bss = item.betweenScheduleSlot?.trim();
    if (bss === '오전') return '오전(사이)';
    if (bss === '오후') return '오후(사이)';
    return '사이(미확정)';
  }
  const b = getScheduleTimeBucket(item);
  if (b === 'morning') return '오전';
  if (b === 'afternoon') return '오후';
  return '기타';
}

function leaderNamesLine(item: ScheduleItem): string {
  if (!item.assignments?.length) return '미배정';
  return item.assignments
    .map((a) => {
      const u = a.teamLeader;
      if (u.role === 'EXTERNAL_PARTNER') {
        return u.externalCompany?.name ? `[타업체] ${u.externalCompany.name}` : `[타업체] ${u.name}`;
      }
      return u.name;
    })
    .join('/');
}

function sortDayItemsForSummary(items: ScheduleItem[]): ScheduleItem[] {
  const ord = (x: ScheduleItem) => {
    const bkt = getScheduleTimeBucket(x);
    return bkt === 'morning' ? 0 : bkt === 'afternoon' ? 1 : 2;
  };
  return [...items].sort((a, b) => {
    const o = ord(a) - ord(b);
    if (o !== 0) return o;
    const ta = a.preferredTime || '';
    const tb = b.preferredTime || '';
    if (ta !== tb) return ta.localeCompare(tb, 'ko');
    return a.customerName.localeCompare(b.customerName, 'ko');
  });
}

export function buildScheduleDayAssignmentSummaryText(ymd: string, items: ScheduleItem[]): string {
  const dateOnly = ymd.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) return '날짜 형식이 올바르지 않습니다.';
  const [ys, ms, ds] = dateOnly.split('-');
  const y = Number(ys);
  const m = Number(ms);
  const d = Number(ds);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return '날짜 형식이 올바르지 않습니다.';
  const w = weekdayKoFromYmd(y, m, d);
  const header = `${y}년 ${m}월 ${d}일 ${w}요일  배정현황`;
  const sorted = sortDayItemsForSummary(items);
  if (sorted.length === 0) return `${header}\n\n(해당일 접수 없음)`;
  const lines = sorted.map((item, idx) => {
    const slot = itemSlotLabelKo(item);
    const leaders = leaderNamesLine(item);
    const crew = parseCrewMemberNoteToNames(item.crewMemberNote).join(', ') || '—';
    return `${idx + 1}. ${slot}  ${item.customerName}  팀장 ${leaders}  팀원 ${crew}`;
  });
  return [header, '', ...lines].join('\n');
}

export function ScheduleDayAssignmentSummaryModal({
  open,
  onClose,
  dateYmd,
  items,
}: {
  open: boolean;
  onClose: () => void;
  dateYmd: string;
  items: ScheduleItem[];
}) {
  const [copyHint, setCopyHint] = useState<string | null>(null);
  const text = useMemo(() => buildScheduleDayAssignmentSummaryText(dateYmd, items), [dateYmd, items]);

  const copy = useCallback(async () => {
    setCopyHint(null);
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopyHint('복사했습니다. 카톡에 붙여넣기 하세요.');
      window.setTimeout(() => setCopyHint(null), 2500);
    } catch {
      setCopyHint('복사에 실패했습니다. 아래 글을 길게 눌러 선택해 주세요.');
    }
  }, [text]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40"
      role="dialog"
      aria-modal
      aria-labelledby="schedule-assignment-summary-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg max-h-[85vh] flex flex-col rounded-t-2xl sm:rounded-2xl bg-white shadow-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-gray-200 shrink-0">
          <h2 id="schedule-assignment-summary-title" className="text-fluid-sm font-semibold text-gray-900 truncate">
            배정현황
          </h2>
          <ModalCloseButton onClick={onClose} />
        </div>
        <div className="px-4 py-3 flex flex-wrap gap-2 shrink-0 border-b border-gray-100">
          <button
            type="button"
            onClick={() => void copy()}
            className="px-3 py-1.5 text-fluid-xs font-medium rounded-md bg-gray-900 text-white hover:bg-gray-800"
          >
            복사하기
          </button>
          {copyHint ? <span className="text-fluid-xs text-green-700 self-center">{copyHint}</span> : null}
        </div>
        <pre className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain px-4 py-3 text-fluid-xs sm:text-fluid-sm text-gray-800 whitespace-pre-wrap font-sans leading-relaxed [-webkit-overflow-scrolling:touch]">
          {text}
        </pre>
      </div>
    </div>,
    document.body
  );
}
