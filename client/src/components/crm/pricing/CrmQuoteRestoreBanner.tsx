import type { TelecrmConsultationQuoteDto } from '../../../api/telecrmConsultationQuote';
import { formatTelecrmQuoteWon } from '@shared/telecrmConsultationQuote';

function fmtWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString('ko-KR', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function CrmQuoteRestoreBanner({
  quote,
  onLoad,
  onDismiss,
  onStartFresh,
}: {
  quote: TelecrmConsultationQuoteDto;
  onLoad: () => void;
  onDismiss: () => void;
  onStartFresh: () => void;
}) {
  const total = quote.payload.grandTotalWon;
  const who = quote.updatedByName ?? quote.createdByName ?? '마케터';
  return (
    <div className="flex shrink-0 flex-nowrap items-center gap-1.5 border-b border-amber-200/80 bg-amber-50/90 px-2 py-1 text-fluid-2xs text-amber-950">
      <p
        className="min-w-0 flex-1 truncate whitespace-nowrap font-semibold"
        title={`편집 중 견적(미전송) · ${fmtWhen(quote.updatedAt)}${who ? ` · ${who}` : ''}${total != null ? ` · ${formatTelecrmQuoteWon(total)}` : ''}`}
      >
        편집 중 견적(미전송) · {fmtWhen(quote.updatedAt)}
        {who ? ` · ${who}` : ''}
        {total != null ? ` · ${formatTelecrmQuoteWon(total)}` : ''}
      </p>
      <div className="flex shrink-0 flex-nowrap items-center gap-1">
        <button
          type="button"
          onClick={onLoad}
          className="inline-flex h-6 items-center whitespace-nowrap rounded-lg bg-amber-600 px-2 font-semibold text-white hover:bg-amber-700"
        >
          불러오기
        </button>
        <button
          type="button"
          onClick={onStartFresh}
          className="inline-flex h-6 items-center whitespace-nowrap rounded-lg border border-amber-300 bg-white px-2 font-semibold hover:bg-amber-100/80"
        >
          새 견적
        </button>
        <button type="button" onClick={onDismiss} className="whitespace-nowrap px-0.5 text-amber-800/70 underline hover:text-amber-900">
          무시
        </button>
      </div>
    </div>
  );
}
