import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listQuotations, type QuotationDto } from '../../api/quotations';

const STATUS_LABEL: Record<string, string> = {
  DRAFT: '작성 중',
  FINALIZED: '확정',
  SENT: '발송됨',
};

type Props = {
  token: string;
  inquiryId: string;
  inquiryNumber?: string | null;
  customerName?: string | null;
};

export function QuotationInquiryLinkPanel({
  token,
  inquiryId,
  inquiryNumber,
  customerName,
}: Props) {
  const [items, setItems] = useState<QuotationDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token || !inquiryId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await listQuotations(token, { inquiryId, limit: 20, datePreset: 'all' });
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

  const newHref = `/admin/inquiries/quotations/new?inquiryId=${encodeURIComponent(inquiryId)}`;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-gray-600">
          {inquiryNumber ? (
            <span className="font-medium text-gray-800 tabular-nums">{inquiryNumber}</span>
          ) : null}
          {customerName ? (
            <span className={inquiryNumber ? ' ml-1' : ''}>{customerName}</span>
          ) : null}
          {!inquiryNumber && !customerName ? '이 접수에 연결된 견적서' : ' — 견적서'}
        </p>
        <Link
          to={newHref}
          className="shrink-0 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
        >
          + 견적서 만들기
        </Link>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      {loading ? (
        <p className="text-xs text-gray-500">견적 목록 불러오는 중…</p>
      ) : items.length === 0 ? (
        <p className="text-xs text-gray-500">연결된 견적서가 없습니다.</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((row) => (
            <li key={row.id}>
              <Link
                to={`/admin/inquiries/quotations/${row.id}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-gray-200 bg-gray-50/80 px-3 py-2 text-xs hover:bg-white"
              >
                <span className="font-mono text-gray-800">{row.quoteNumber}</span>
                <span className="text-gray-600">{STATUS_LABEL[row.status] ?? row.status}</span>
                <span className="tabular-nums text-gray-700">
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
