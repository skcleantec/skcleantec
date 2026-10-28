import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchCashbillSettings } from '../../api/cashbill';
import { PageTitleWithFavorite } from '../../components/layout/NavFavoritePageTitle';

function brandLinked(member: { status: string; barobillUserId: string } | null): boolean {
  return member?.status === 'ACTIVE' && Boolean(member.barobillUserId.trim());
}

export function AdminTaxInvoicePlaceholderPage() {
  const [linked, setLinked] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchCashbillSettings()
      .then((settings) => {
        if (cancelled) return;
        setLinked(settings.brands.some((brand) => brandLinked(brand.member)));
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : '계산서 연결을 불러오지 못했습니다.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex min-w-0 w-full max-w-full flex-col gap-2 sm:gap-4">
      <PageTitleWithFavorite label="세금계산서" path="/admin/inquiries/receipts/taxinvoice">
        <h1 className="text-fluid-lg font-semibold text-slate-900">세금계산서</h1>
      </PageTitleWithFavorite>
      {error ? <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-fluid-xs text-red-800">{error}</p> : null}
      {linked === null && !error ? <p className="p-8 text-center text-fluid-sm text-slate-500">불러오는 중…</p> : null}
      {linked === false ? (
        <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-fluid-sm text-amber-950">
          <p>계산서 연결을 먼저 해주세요.</p>
          <Link
            to="/admin/team-leaders/cashbill"
            className="inline-flex min-h-10 items-center rounded-lg bg-slate-900 px-3 text-fluid-xs font-medium text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
          >
            계산서 연결로 가기
          </Link>
        </div>
      ) : null}
      {linked ? (
        <p className="rounded-xl border border-slate-200 bg-white px-3 py-6 text-center text-fluid-sm text-slate-600">준비 중</p>
      ) : null}
    </div>
  );
}
