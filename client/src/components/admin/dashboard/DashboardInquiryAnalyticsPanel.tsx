import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import type { DashboardInquiryBreakdown } from '../../../api/dashboard';
import { HelpTooltip } from '../../ui/HelpTooltip';
import {
  DashboardHorizontalBarChart,
  DashboardVerticalBarChart,
} from './DashboardMiniBarChart';
import { DashboardKoreaSidoMap } from './DashboardKoreaSidoMap';
import { DashboardSidoRegionModal } from './DashboardSidoRegionModal';
import type { DashboardDrillKind } from './dashboardDrilldownTypes';
import type { KoreaSidoKey } from '@shared/regionMatch';

function formatCurrency(n: number): string {
  return n.toLocaleString('ko-KR') + '원';
}

function monthLabelKo(monthKey: string): string {
  const m = monthKey.slice(5);
  return `${parseInt(m, 10)}월`;
}

function monthTitleKo(monthKey: string): string {
  const [y, m] = monthKey.split('-');
  return `${y}년 ${parseInt(m, 10)}월`;
}

function ChartCard({
  title,
  accentDotClass,
  helpText,
  children,
  onOpenDrill,
}: {
  title: string;
  accentDotClass: string;
  helpText: string;
  children: ReactNode;
  onOpenDrill?: () => void;
}) {
  const clickable = onOpenDrill != null;
  return (
    <div
      className={`rounded-xl border border-slate-100 bg-slate-50/40 p-4 min-w-0 ${
        clickable ? 'cursor-pointer hover:bg-slate-50/80 transition-colors' : ''
      }`}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={clickable ? onOpenDrill : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onOpenDrill?.();
              }
            }
          : undefined
      }
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <h3 className="text-fluid-2xs font-semibold text-gray-700 flex items-center gap-1.5 min-w-0">
          <span className={`w-1.5 h-3 rounded-full shrink-0 ${accentDotClass}`} />
          <span className="truncate">{title}</span>
        </h3>
        <HelpTooltip text={helpText} />
      </div>
      {children}
    </div>
  );
}

export function DashboardInquiryAnalyticsPanel({
  breakdown,
  loading,
  error,
  onOpenDrill,
}: {
  breakdown: DashboardInquiryBreakdown | null;
  loading: boolean;
  error: string | null;
  onOpenDrill: (kind: DashboardDrillKind, initialMonth?: string) => void;
}) {
  const [regionDetailOpen, setRegionDetailOpen] = useState(false);
  const [sidoDetailKey, setSidoDetailKey] = useState<KoreaSidoKey | null>(null);

  const sidoDetail = useMemo(() => {
    if (!breakdown || !sidoDetailKey) return null;
    return breakdown.byRegionWithinSido.find((g) => g.sidoKey === sidoDetailKey) ?? null;
  }, [breakdown, sidoDetailKey]);

  if (loading) {
    return (
      <section className="min-w-0 rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm shadow-slate-100/50">
        <div className="py-16 flex justify-center items-center">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-violet-500" />
          <span className="ml-2 text-fluid-2xs text-gray-400">분석 불러오는 중…</span>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="min-w-0 rounded-2xl border border-red-200/60 bg-red-50/30 p-5 shadow-sm">
        <p className="text-fluid-sm text-red-700">{error}</p>
      </section>
    );
  }

  if (!breakdown) return null;

  const regionItems = breakdown.byRegion.slice(0, 8).map((z) => ({
    key: z.regionKey,
    label: z.label,
    value: z.inquiryCount,
    subLabel: `${z.inquiryCount}건 · ${formatCurrency(z.salesAmount)}`,
  }));

  const monthItems = breakdown.byMonth.map((m) => ({
    key: m.monthKey,
    label: monthLabelKo(m.monthKey),
    value: m.inquiryCount,
    subLabel: `${m.inquiryCount}건 · ${formatCurrency(m.salesAmount)}`,
  }));

  const preferredItems = breakdown.byPreferredDate.map((d) => ({
    key: d.date,
    label: d.date.slice(8),
    value: d.inquiryCount,
    subLabel: `${d.date.slice(5).replace('-', '/')} · ${d.inquiryCount}건`,
  }));

  const preferredLabelEvery =
    preferredItems.length > 20 ? 5 : preferredItems.length > 12 ? 3 : 2;

  return (
    <section className="min-w-0 rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm shadow-slate-100/50">
      <div className="mb-4 border-b border-slate-100 pb-3 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-fluid-sm font-semibold text-slate-900 flex items-center gap-1.5">
            <svg className="w-4 h-4 text-violet-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
            </svg>
            접수·예약 분석
          </h2>
          <p className="text-fluid-2xs text-gray-500 mt-1 truncate">
            {monthTitleKo(breakdown.monthKey)} · KST
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center rounded-full bg-violet-50 px-2 py-1 text-[10px] font-medium text-violet-700 ring-1 ring-inset ring-violet-700/10">
          그래프
        </span>
      </div>

      <div className="space-y-4">
        <ChartCard
          title="지역별 접수"
          accentDotClass="bg-red-500"
          helpText="접수일(KST) 이번 달 · 확정 접수 · 접수 주소(주소 검색 필드)에서 시·도·시·군·구를 파싱합니다. 서비스 권역명은 사용하지 않습니다. 지도에서 시·도를 클릭하면 구·군·시 상세를 볼 수 있습니다."
          onOpenDrill={() => onOpenDrill('region', breakdown.monthKey)}
        >
          {breakdown.bySidoMap.length > 0 ? (
            <div className="rounded-lg border border-white/80 bg-white/70 p-3">
              <DashboardKoreaSidoMap
                items={breakdown.bySidoMap}
                onSidoClick={(sidoKey) => setSidoDetailKey(sidoKey)}
              />
            </div>
          ) : (
            <p className="py-6 text-center text-fluid-2xs text-gray-500 border border-dashed border-slate-200 rounded-lg bg-white/60">
              이번 달 집계 데이터가 없습니다.
            </p>
          )}
          {regionItems.length > 0 ? (
            <div className="mt-3 border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setRegionDetailOpen((v) => !v);
                }}
                className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-fluid-2xs font-medium text-slate-600 hover:bg-white/80 transition-colors"
                aria-expanded={regionDetailOpen}
              >
                <span>시·군·구 상세</span>
                <span className="inline-flex items-center gap-1 text-slate-400">
                  <span>{regionDetailOpen ? '접기' : '펼치기'}</span>
                  <svg
                    className={`h-3.5 w-3.5 transition-transform ${regionDetailOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    strokeWidth="2"
                    aria-hidden
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </span>
              </button>
              {regionDetailOpen ? (
                <div className="mt-2">
                  <DashboardHorizontalBarChart
                    items={regionItems}
                    accentClass="bg-red-500"
                    formatValue={(n) => `${n}건`}
                    ariaLabel="지역별 이번 달 접수 건수"
                  />
                </div>
              ) : null}
            </div>
          ) : null}
        </ChartCard>

        <DashboardSidoRegionModal
          open={sidoDetailKey != null}
          detail={sidoDetail}
          monthTitle={monthTitleKo(breakdown.monthKey)}
          onClose={() => setSidoDetailKey(null)}
        />

        <ChartCard
          title="월별 접수·매출"
          accentDotClass="bg-indigo-500"
          helpText="접수일(KST) 기준 최근 6개월 · 확정 접수 건수. 클릭하면 기간별 상세 통계를 볼 수 있습니다."
          onOpenDrill={() => onOpenDrill('monthly-inquiry', breakdown.monthKey)}
        >
          <div onClick={(e) => e.stopPropagation()}>
          <DashboardVerticalBarChart
            items={monthItems}
            accentClass="bg-indigo-400"
            peakAccentClass="bg-indigo-600"
            showValueLabels
            formatValue={(n) => `${n}건`}
            barAreaClass="h-24"
            onBarClick={(item) => onOpenDrill('monthly-inquiry', item.key)}
            ariaLabel="최근 6개월 월별 접수 건수"
          />
          </div>
        </ChartCard>

        <ChartCard
          title="예약일별 작업"
          accentDotClass="bg-sky-500"
          helpText="예약일(preferredDate) KST · 이번 달 · 취소·보류 제외. 스케줄 밀도 확인용입니다."
          onOpenDrill={() => onOpenDrill('preferred-date', breakdown.monthKey)}
        >
          <div onClick={(e) => e.stopPropagation()}>
          {preferredItems.every((d) => d.value === 0) ? (
            <p className="py-6 text-center text-fluid-2xs text-gray-500 border border-dashed border-slate-200 rounded-lg bg-white/60">
              이번 달 예약일이 있는 접수가 없습니다.
            </p>
          ) : (
            <DashboardVerticalBarChart
              items={preferredItems}
              accentClass="bg-sky-400"
              peakAccentClass="bg-sky-600"
              formatValue={(n) => `${n}건`}
              barAreaClass="h-20"
              labelEvery={preferredLabelEvery}
              ariaLabel="이번 달 예약일별 작업 건수"
            />
          )}
          </div>
        </ChartCard>
      </div>
    </section>
  );
}
