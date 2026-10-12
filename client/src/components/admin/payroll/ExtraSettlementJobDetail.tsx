import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { ExtraWorkItem } from '../../../api/extraWork';
import { ModalCloseButton } from '../ModalCloseButton';
import { extraWorkSlotLabel } from './extraWorkSlotLabel';
import { extraWorkPercent, overrideFromText, takeRateText } from './extraSettlementRateText';

function won(n: number) {
  return `${Number(n).toLocaleString('ko-KR')}원`;
}

function dayText(iso: string) {
  const key = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
  const [, month, day] = key.split('-');
  return `${Number(month)}/${Number(day)}`;
}

function kindTag(kind: ExtraWorkItem['settlementKind']) {
  if (kind === 'REFUND') return '환불';
  if (kind === 'COMPANY_SUPPORT') return '회사 지원';
  return '추가 시공';
}

function Row(props: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="shrink-0 text-fluid-2xs text-slate-500">{props.label}</span>
      <span className="min-w-0 break-words text-right text-fluid-xs text-slate-900">{props.value}</span>
    </div>
  );
}

export function ExtraSettlementJobDetail(props: {
  item: ExtraWorkItem | null;
  cellWon: number | null;
  onClose: () => void;
  onEdit: (item: ExtraWorkItem) => void;
  onOpenInquiry: (inquiryId: string) => void;
}) {
  const { item, cellWon, onClose, onEdit, onOpenInquiry } = props;

  useEffect(() => {
    if (!item) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopImmediatePropagation();
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [item, onClose]);

  if (!item) return null;

  const leaders = item.leaderShares.length > 0 ? item.leaderShares.map((share) => `${share.name} ${won(share.amountWon)}`).join(', ') : '팀장 없음';
  const work = item.lines.length > 0
    ? item.lines.map((line) => {
        const place = line.placeLabel ? ` ${line.placeLabel}` : '';
        const qty = line.quantity != null && line.unitLabel ? ` ${line.quantity}${line.unitLabel}` : '';
        return `${line.workLabel}${place}${qty} ${won(line.amountWon)}`;
      }).join(' · ')
    : item.workLabel;

  return createPortal(
    <div className="modal-mobile-safe-overlay fixed inset-0 z-[80] flex items-end justify-center bg-slate-900/40 sm:items-center">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="닫기" onClick={onClose} />
      <div
        className="modal-mobile-fullscreen-panel relative z-10 flex h-[100dvh] w-full max-w-lg flex-col bg-white sm:h-auto sm:max-h-[90vh] sm:rounded-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="extra-job-title"
      >
        <div className="relative flex shrink-0 items-center border-b border-slate-200 px-3 py-2 pr-12">
          <h2 id="extra-job-title" className="truncate text-fluid-sm font-semibold text-slate-900">
            {dayText(item.occurredAt)} {kindTag(item.settlementKind)} {won(cellWon ?? item.amountWon)}
          </h2>
          <ModalCloseButton onClick={onClose} />
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
          <div className="space-y-1.5 rounded-lg border border-slate-200 px-2.5 py-2">
            <Row label="마케터" value={item.marketerName} />
            <Row label="시공" value={work} />
            <Row label="고객" value={item.inquiryNumber ? `${item.customerName} · ${item.inquiryNumber}` : item.customerName} />
            <Row label="시간" value={extraWorkSlotLabel(item.timeSlot) || '없음'} />
            <Row label="팀장" value={leaders} />
            {item.parentMarketerName ? (
              <Row label="오버라이딩" value={`${item.parentMarketerName} ${won(item.parentWon)} · ${overrideFromText(item)}`} />
            ) : null}
          </div>
          <div className="space-y-1.5 rounded-lg border border-slate-200 px-2.5 py-2">
            <Row label="추가금액" value={won(item.amountWon)} />
            <Row label="비율" value={`회사 ${extraWorkPercent(item.companyBps)} · 팀장 ${extraWorkPercent(item.teamLeaderBps)} · 마케터 ${extraWorkPercent(item.marketerBps)}`} />
            <Row label="마케터 수령" value={`${won(item.marketerWon)} · ${takeRateText(item)}`} />
            <Row label="팀장" value={won(item.teamLeaderWon)} />
            <Row label="회사" value={won(item.companyWon)} />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onOpenInquiry(item.inquiryId)}
              className="min-h-10 rounded-lg bg-slate-900 px-3 text-fluid-xs font-medium text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
            >
              접수 수정
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                onEdit(item);
              }}
              className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-fluid-xs font-medium text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
            >
              환불·지원
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
