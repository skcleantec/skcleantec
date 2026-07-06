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
    <div className="shrink-0 border-b border-amber-200/80 bg-amber-50/90 px-2 py-1.5 text-[10px] text-amber-950">
      <p className="font-semibold">
        저장된 견적 · {fmtWhen(quote.updatedAt)}
        {who ? ` · ${who}` : ''}
        {total != null ? ` · ${formatTelecrmQuoteWon(total)}` : ''}
        {quote.status === 'QUOTED' ? ' · 확정' : ''}
      </p>
      <div className="mt-1 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onLoad}
          className="rounded-md bg-amber-600 px-2 py-0.5 font-semibold text-white hover:bg-amber-700"
        >
          불러오기
        </button>
        <button
          type="button"
          onClick={onStartFresh}
          className="rounded-md border border-amber-300 bg-white px-2 py-0.5 font-semibold hover:bg-amber-100/80"
        >
          새 견적
        </button>
        <button type="button" onClick={onDismiss} className="text-amber-800/70 underline hover:text-amber-900">
          무시
        </button>
      </div>
    </div>
  );
}
