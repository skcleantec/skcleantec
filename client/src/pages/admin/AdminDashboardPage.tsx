import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDashboardStats, getDashboardInquiryBreakdown, type DashboardStats, type DashboardInquiryBreakdown } from '../../api/dashboard';
import { getToken } from '../../stores/auth';
import { useAdminStaffSession } from '../../hooks/useAdminStaffSession';
import { runWhenIdle } from '../../utils/deferWhenIdle';
import { DashboardChangeHistory } from '../../components/admin/DashboardChangeHistory';
import { DashboardOpsHourlyStrip } from '../../components/admin/DashboardOpsHourlyStrip';
import { DashboardDrilldownModal } from '../../components/admin/dashboard/DashboardDrilldownModal';
import {
  DashboardAuxBlocksGrid,
  DashboardKpiGrid,
  DashboardSalesAnalyticsGrid,
} from '../../components/admin/dashboard/DashboardPageSections';
import type { DashboardDrillKind, DashboardDrillRequest } from '../../components/admin/dashboard/dashboardDrilldownTypes';
import { kstMonthKeyNow } from '../../components/admin/dashboard/dashboardDrilldownTypes';
import { useTelecrmDashboardVisible } from '../../hooks/useTelecrmDashboardVisible';
import { usePlatformPromos } from '../../hooks/usePlatformPromos';
import { PlatformPromoCarousel, PlatformPromoDashboardCard } from '../../components/platformPromo/PlatformPromoDisplay';

export function AdminDashboardPage() {
  const navigate = useNavigate();
  const token = getToken();
  const { tenantName } = useAdminStaffSession();
  const showTelecrmDashboard = useTelecrmDashboardVisible();
  const { items: promoItems } = usePlatformPromos('admin');
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [breakdown, setBreakdown] = useState<DashboardInquiryBreakdown | null>(null);
  const [loading, setLoading] = useState(true);
  const [breakdownLoading, setBreakdownLoading] = useState(true);
  const [breakdownError, setBreakdownError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [loadBreakdown, setLoadBreakdown] = useState(false);
  const [drillOpen, setDrillOpen] = useState(false);
  const [drillRequest, setDrillRequest] = useState<DashboardDrillRequest | null>(null);

  const openDrill = (kind: DashboardDrillKind, initialMonth?: string, range?: { fromYmd: string; toYmd: string }) => {
    setDrillRequest({
      kind,
      initialMonth: initialMonth ?? kstMonthKeyNow(),
      initialFromYmd: range?.fromYmd,
      initialToYmd: range?.toYmd,
    });
    setDrillOpen(true);
  };

  useEffect(() => {
    if (!token) return;
    return runWhenIdle(() => setLoadBreakdown(true));
  }, [token]);

  useEffect(() => {
    if (!token) return;
    getDashboardStats(token)
      .then((data) => {
        setStats(data);
        setApiError(null);
      })
      .catch((err) => {
        setStats({
          todayCount: 0,
          unassignedCount: 0,
          todaySales: 0,
          monthSales: 0,
          salesByTeamLeader: [],
          dailySales: [],
          happyCallOverdueCount: 0,
          happyCallPendingBeforeDeadlineCount: 0,
          teamLeaderWorkloadThisMonth: [],
          teamLeaderDayOffToday: [],
          teamMembersDailyRosterRestToday: [],
          dailyRosterModeActive: false,
        });
        setApiError(err instanceof Error ? err.message : '서버에 연결할 수 없습니다.');
      })
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    if (!token || !loadBreakdown) {
      if (!token) {
        setBreakdown(null);
        setBreakdownLoading(false);
      }
      return;
    }
    setBreakdownLoading(true);
    getDashboardInquiryBreakdown(token)
      .then((data) => {
        setBreakdown(data);
        setBreakdownError(null);
      })
      .catch((err) => {
        setBreakdown(null);
        setBreakdownError(err instanceof Error ? err.message : '접수 분석을 불러올 수 없습니다.');
      })
      .finally(() => setBreakdownLoading(false));
  }, [token, loadBreakdown]);

  const salesAnalytics = (
    <DashboardSalesAnalyticsGrid
      stats={stats}
      loading={loading}
      breakdown={breakdown}
      breakdownLoading={breakdownLoading}
      breakdownError={breakdownError}
      onOpenDrill={(kind, initialMonth) => openDrill(kind, initialMonth)}
    />
  );

  return (
    <div className="min-w-0 w-full">
      <div className="mb-6 lg:mb-8 flex flex-wrap items-center gap-2 lg:gap-3 min-w-0">
        <h1 className="text-fluid-xl lg:text-fluid-2xl font-extrabold tracking-tight text-slate-900 flex items-baseline gap-2 whitespace-nowrap min-w-0">
          <span className="truncate">{tenantName ? tenantName : 'Dashboard'}</span>
          {tenantName ? <span className="text-fluid-lg font-medium text-slate-400 tracking-normal shrink-0">Dashboard</span> : null}
        </h1>
        <span className="shrink-0 inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-[10px] font-bold text-indigo-600 tracking-widest uppercase ring-1 ring-inset ring-indigo-500/10">
          Workspace
        </span>
        <span className="text-[11px] font-medium text-slate-400 hidden sm:block shrink-0">
          {new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })}
        </span>
      </div>

      {apiError ? (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-fluid-sm">
          {apiError}
        </div>
      ) : null}

      {/* 모바일 — 기존 세로 순서 유지 */}
      <div className="lg:hidden space-y-4">
        {promoItems.length > 0 ? <PlatformPromoCarousel items={promoItems} /> : null}
        <DashboardAuxBlocksGrid showTelecrmDashboard={showTelecrmDashboard} />
        <DashboardOpsHourlyStrip onOpenDetail={(range) => openDrill('ops-hourly', undefined, range)} />
        <DashboardKpiGrid stats={stats} loading={loading} navigate={navigate} compact />
        {salesAnalytics}
        {token ? <DashboardChangeHistory token={token} compact /> : null}
      </div>

      {/* PC — 메인 + 우측 변경 이력 레일 */}
      <div className="hidden lg:grid lg:grid-cols-[minmax(0,1fr)_468px] lg:gap-5 lg:items-start">
        <div className="min-w-0 space-y-5">
          {promoItems.length > 0 ? (
            <div className="hidden lg:block">
              <PlatformPromoDashboardCard items={promoItems} />
            </div>
          ) : null}
          <DashboardKpiGrid stats={stats} loading={loading} navigate={navigate} compact />
          <DashboardOpsHourlyStrip onOpenDetail={(range) => openDrill('ops-hourly', undefined, range)} />
          {salesAnalytics}
        </div>
        <aside className="min-w-0 self-start space-y-5">
          <DashboardAuxBlocksGrid showTelecrmDashboard={showTelecrmDashboard} />
          {token ? <DashboardChangeHistory token={token} variant="sidebar" /> : null}
        </aside>
      </div>

      <DashboardDrilldownModal
        open={drillOpen}
        request={drillRequest}
        onClose={() => setDrillOpen(false)}
        authToken={token}
      />
    </div>
  );
}
