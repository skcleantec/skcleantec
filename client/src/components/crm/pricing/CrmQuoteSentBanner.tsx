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

/** 숨고 견적보내기로 고객에게 실제 전송된 견적 (참고용, 읽기 전용) */
export function CrmQuoteSentBanner({ quote }: { quote: TelecrmConsultationQuoteDto }) {
  const total = quote.payload.grandTotalWon;
  const who = quote.updatedByName ?? quote.createdByName ?? '마케터';
  return (
    <div className="shrink-0 border-b border-sky-200/80 bg-sky-50/90 px-2 py-1.5 text-[10px] text-sky-950">
      <p className="font-semibold">
        보낸 견적 · {fmtWhen(quote.updatedAt)}
        {who ? ` · ${who}` : ''}
        {total != null ? ` · ${formatTelecrmQuoteWon(total)}` : ''}
      </p>
      <p className="mt-0.5 text-sky-800/70">견적보내기로 고객에게 전송한 금액입니다.</p>
    </div>
  );
}
