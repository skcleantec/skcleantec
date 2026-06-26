import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listTeamQuotations, type QuotationDto } from '../../api/teamQuotations';
import { QuotationStatusBadge, qUi } from './quotationUi';

type Props = {
  token: string;
  inquiryId: string;
  inquiryNumber?: string | null;
  customerName?: string | null;
  /** 견적 작성 후 돌아올 팀 경로 (URL 인코딩 전) */
  returnTo?: string;
};

export function TeamQuotationInquiryLinkPanel({
  token,
  inquiryId,
  inquiryNumber,
  customerName,
  returnTo,
}: Props) {
  const [items, setItems] = useState<QuotationDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token || !inquiryId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await listTeamQuotations(token, { inquiryId, limit: 20, datePreset: 'all' });
      setItems(data.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : '견적 목록을 불러올 수 없습니다.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [token, inquiryId]);

  useEffect(() => {
    void load();
  }, [load]);

  const returnQs = returnTo ? `&returnTo=${encodeURIComponent(returnTo)}` : '';
  const newHref = `/team/quotations/new?inquiryId=${encodeURIComponent(inquiryId)}${returnQs}`;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-fluid-xs text-slate-600">
          {inquiryNumber ? (
            <span className="font-medium text-slate-800 tabular-nums">{inquiryNumber}</span>
          ) : null}
          {customerName ? (
            <span className={inquiryNumber ? ' ml-1' : ''}>{customerName}</span>
          ) : null}
          {!inquiryNumber && !customerName ? '이 접수에 연결된 견적서' : ' — 견적서'}
        </p>
        <Link to={newHref} className={`${qUi.btnPrimary} !px-3 !py-1.5 !text-xs shrink-0`}>
          + 견적서 만들기
        </Link>
      </div>

      {error && (
        <p className="text-fluid-xs text-rose-600" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-fluid-xs text-slate-500">견적 목록 불러오는 중…</p>
      ) : items.length === 0 ? (
        <p className="text-fluid-xs text-slate-500">연결된 견적서가 없습니다.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((row) => (
            <li key={row.id}>
              <Link
                to={`/team/quotations/${row.id}${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ''}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200/60 bg-slate-50/50 px-3 py-2.5 text-fluid-xs hover:bg-white hover:shadow-sm transition-all"
              >
                <span className="font-mono font-medium text-slate-800 tabular-nums">{row.quoteNumber}</span>
                <QuotationStatusBadge status={row.status} />
                <span className="tabular-nums font-medium text-slate-700">
                  {row.total.toLocaleString('ko-KR')}원
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
