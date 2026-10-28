import { useCallback, useEffect, useState } from 'react';
import { ensureInputVisibleAboveKeyboard } from '../../hooks/useMobileInputVisibility';
import { getStaffAppScrollElement } from '../../utils/staffAppScrollRestore';
import { fetchCashbillSettings, type CashbillSettings } from '../../api/cashbill';
import { PageTitleWithFavorite } from '../../components/layout/NavFavoritePageTitle';
import { HelpTooltip } from '../../components/ui/HelpTooltip';
import { CashbillBrandCard } from '../../components/cashbill/CashbillBrandCard';

export function AdminCashbillSettingsPage() {
  const [settings, setSettings] = useState<CashbillSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [cardKey, setCardKey] = useState(0);

  const load = useCallback(async () => {
    setError(null);
    try {
      setSettings(await fetchCashbillSettings());
    } catch (err) {
      setError(err instanceof Error ? err.message : '불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div
      className="flex min-w-0 w-full max-w-full flex-col gap-2 sm:gap-4"
      onFocusCapture={(e) => {
        const target = e.target;
        if (!(target instanceof HTMLElement)) return;
        if (!target.matches('input, textarea, select')) return;
        ensureInputVisibleAboveKeyboard(target, getStaffAppScrollElement(), 'smooth', 28);
      }}
    >
      <PageTitleWithFavorite label="계산서 연결" path="/admin/team-leaders/cashbill">
        <span className="inline-flex items-center gap-1">
          계산서 연결
          <HelpTooltip text="기본 브랜드는 사업자정보로 바로 연결합니다. 추가 브랜드는 사업자등록증을 올리고 검토 요청을 합니다. 승인 전에는 연결하지 않습니다. 공동인증서는 세금계산서를 쓸 때만 필요하고, 만료 30일 전에 관리자에게 알립니다. 인증서가 없어도 현금영수증은 발행할 수 있습니다." />
        </span>
      </PageTitleWithFavorite>

      {settings?.blockReason ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-fluid-2xs leading-snug text-amber-900">
          {settings.blockReason}
        </p>
      ) : null}
      {notice ? (
        <p className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-fluid-2xs leading-snug text-slate-800">
          {notice}
        </p>
      ) : null}
      {error ? <p className="text-fluid-xs text-red-700">{error}</p> : null}
      {loading ? <p className="p-8 text-center text-fluid-sm text-slate-500">불러오는 중…</p> : null}
      {!loading && settings && settings.brands.length === 0 ? (
        <p className="rounded-xl border border-gray-200 bg-white p-4 text-fluid-sm text-slate-600">
          영업브랜드가 없습니다. 관리자 전용 → 영업브랜드에서 먼저 등록해 주세요.
        </p>
      ) : null}
      <div className="space-y-2">
        {settings?.brands.map((brand) => (
          <CashbillBrandCard
            key={`${brand.operatingCompanyId}-${cardKey}`}
            brand={brand}
            prefill={settings.prefill}
            canRegister={settings.canRegister}
            onDone={(message) => {
              setNotice(message);
              setCardKey((n) => n + 1);
              void load();
            }}
          />
        ))}
      </div>
    </div>
  );
}
