import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  getDashboardInquiryBreakdown,
  getDashboardOpsHourlyRange,
  getDashboardSalesBreakdown,
  getDashboardSettlementSummary,
  type DashboardInquiryBreakdown,
  type DashboardSalesBreakdown,
  type DashboardSettlementSummary,
  type OpsHourlySummary,
} from '../../../api/dashboard';
import {
  computeDateRangeFromPreset,
  DATE_RANGE_PRESET_LABELS,
  type DateRangePresetId,
} from '../../../utils/dateRangePresets';
import { YearMonthSelect, YmdSelect } from '../../ui/DateQuerySelects';
import { ModalCloseButton } from '../ModalCloseButton';
import { DashboardHorizontalBarChart, DashboardVerticalBarChart } from './DashboardMiniBarChart';
import { DashboardKoreaSidoMap } from './DashboardKoreaSidoMap';
import { DashboardSidoRegionModal } from './DashboardSidoRegionModal';
import { DashboardOpsHourlyDetail } from './DashboardOpsHourlyDetail';
import type { KoreaSidoKey } from '@shared/regionMatch';
import {
  DRILL_KIND_LABELS,
  formatCurrencyKo,
  kstMonthKeyNow,
  kstYmdNow,
  monthTitleKo,
  type DashboardDrillRequest,
} from './dashboardDrilldownTypes';

type SalesTab = 'sales' | 'settlement';

function monthLabelShort(monthKey: string): string {
  return `${parseInt(monthKey.slice(5), 10)}월`;
}

export function DashboardDrilldownModal(props: {
  open: boolean;
  request: DashboardDrillRequest | null;
  onClose: () => void;
  authToken: string | null;
}) {
  const { open, request, onClose, authToken } = props;

  const [monthKey, setMonthKey] = useState(kstMonthKeyNow());
  const [opsFrom, setOpsFrom] = useState('');
  const [opsTo, setOpsTo] = useState('');
  const [opsPreset, setOpsPreset] = useState<DateRangePresetId>('thisMonth');
  const [salesTab, setSalesTab] = useState<SalesTab>('sales');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inquiryData, setInquiryData] = useState<DashboardInquiryBreakdown | null>(null);
  const [salesData, setSalesData] = useState<DashboardSalesBreakdown | null>(null);
  const [settlementData, setSettlementData] = useState<DashboardSettlementSummary | null>(null);
  const [opsData, setOpsData] = useState<OpsHourlySummary | null>(null);

  useEffect(() => {
    if (!open || !request) return;
    setError(null);
    if (request.initialMonth) setMonthKey(request.initialMonth);
    if (request.kind === 'sales') setSalesTab('sales');
    if (request.kind === 'ops-hourly') {
      const from = request.initialFromYmd ?? computeDateRangeFromPreset('thisMonth')?.from ?? '';
      const to = request.initialToYmd ?? computeDateRangeFromPreset('thisMonth')?.to ?? kstYmdNow();
      setOpsFrom(from);
      setOpsTo(to);
      setOpsPreset('thisMonth');
    }
  }, [open, request]);

  const load = useCallback(async () => {
    if (!authToken || !request) return;
    setLoading(true);
    setError(null);
    try {
      switch (request.kind) {
        case 'region': {
          const data = await getDashboardInquiryBreakdown(authToken, monthKey);
          setInquiryData(data);
          break;
        }
        case 'monthly-inquiry': {
          const [inquiry, sales] = await Promise.all([
            getDashboardInquiryBreakdown(authToken, monthKey),
            getDashboardSalesBreakdown(authToken, monthKey),
          ]);
          setInquiryData(inquiry);
          setSalesData(sales);
          break;
        }
        case 'preferred-date': {
          const data = await getDashboardInquiryBreakdown(authToken, monthKey);
          setInquiryData(data);
          break;
        }
        case 'sales': {
          const [sales, settlement] = await Promise.all([
            getDashboardSalesBreakdown(authToken, monthKey),
            getDashboardSettlementSummary(authToken, monthKey),
          ]);
          setSalesData(sales);
          setSettlementData(settlement);
          break;
        }
        case 'ops-hourly': {
          if (!opsFrom || !opsTo) {
            setLoading(false);
            return;
          }
          const data = await getDashboardOpsHourlyRange(authToken, opsFrom, opsTo);
          setOpsData(data);
          break;
        }
        default:
          break;
      }
    } catch (e) {
      setInquiryData(null);
      setSalesData(null);
      setSettlementData(null);
      setOpsData(null);
      setError(e instanceof Error ? e.message : '불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [authToken, request, monthKey, opsFrom, opsTo]);

  useEffect(() => {
    if (!open || !authToken || !request) {
      setInquiryData(null);
      setSalesData(null);
      setSettlementData(null);
      setOpsData(null);
      setLoading(false);
      setError(null);
      return;
    }
    void load();
  }, [open, authToken, request, load]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const applyOpsPreset = (preset: DateRangePresetId) => {
    setOpsPreset(preset);
    if (preset === 'custom') return;
    const range = computeDateRangeFromPreset(preset);
    if (range) {
      setOpsFrom(range.from);
      setOpsTo(range.to);
    }
  };

  if (!open || !request || typeof document === 'undefined') return null;

  const kind = request.kind;
  const title = DRILL_KIND_LABELS[kind];

  return createPortal(
    <div
      className="fixed inset-0 z-[260] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/45"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dashboard-drill-title"
        className="relative flex max-h-[92vh] w-full max-w-3xl flex-col rounded-t-2xl sm:rounded-2xl border border-slate-200 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <ModalCloseButton onClick={onClose} />

        <div className="shrink-0 border-b border-slate-100 px-5 pt-5 pb-4 pr-14">
          <h2 id="dashboard-drill-title" className="text-fluid-base font-semibold text-slate-900">
            {title}
          </h2>
          <p className="mt-1 text-fluid-2xs text-gray-500">
            {kind === 'ops-hourly'
              ? 'KST · 선택 기간 운영 지표'
              : kind === 'sales'
                ? '매출=접수일(KST) · 정산=예약일(KST) 월 기준'
                : kind === 'preferred-date'
                  ? '예약일(preferredDate) KST · 취소·보류 제외'
                  : '접수일(createdAt) KST · 확정 접수'}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {kind === 'ops-hourly' ? (
              <>
                <select
                  value={opsPreset}
                  onChange={(e) => applyOpsPreset(e.target.value as DateRangePresetId)}
                  className="border border-gray-300 rounded-lg px-2 py-1.5 text-fluid-2xs bg-white"
                >
                  {DATE_RANGE_PRESET_LABELS.filter((p) =>
                    ['today', 'thisMonth', 'lastMonth', 'custom'].includes(p.id),
                  ).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
                <YmdSelect value={opsFrom} onChange={setOpsFrom} idPrefix="ops-from" compact />
                <span className="text-fluid-2xs text-gray-400">~</span>
                <YmdSelect value={opsTo} onChange={setOpsTo} idPrefix="ops-to" compact />
                <button
                  type="button"
                  onClick={() => {
                    setOpsPreset('custom');
                    void load();
                  }}
                  className="rounded-lg bg-slate-900 px-3 py-1.5 text-fluid-2xs font-medium text-white hover:bg-slate-800"
                >
                  조회
                </button>
              </>
            ) : (
              <>
                <YearMonthSelect value={monthKey} onChange={setMonthKey} idPrefix="dash-drill" compact />
                <span className="text-fluid-2xs text-gray-500">{monthTitleKo(monthKey)}</span>
              </>
            )}
          </div>

          {kind === 'sales' ? (
            <div className="mt-3 inline-flex rounded-lg border border-slate-200 p-0.5">
              {(['sales', 'settlement'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setSalesTab(tab)}
                  className={`rounded-md px-3 py-1 text-fluid-2xs font-medium transition ${
                    salesTab === tab ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {tab === 'sales' ? '매출' : '정산'}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-5 py-4">
          {error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-fluid-sm text-red-700">{error}</p>
          ) : loading ? (
            <div className="py-16 flex justify-center items-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-500" />
              <span className="ml-2 text-fluid-2xs text-gray-400">불러오는 중…</span>
            </div>
          ) : (
            <>
              {kind === 'region' && inquiryData ? <RegionDrillBody data={inquiryData} /> : null}
              {kind === 'monthly-inquiry' && inquiryData ? (
                <MonthlyInquiryDrillBody data={inquiryData} monthKey={monthKey} sales={salesData} />
              ) : null}
              {kind === 'preferred-date' && inquiryData ? (
                <PreferredDateDrillBody data={inquiryData} />
              ) : null}
              {kind === 'ops-hourly' && opsData ? <DashboardOpsHourlyDetail data={opsData} /> : null}
              {kind === 'sales' && salesTab === 'sales' && salesData ? (
                <SalesDrillBody data={salesData} />
              ) : null}
              {kind === 'sales' && salesTab === 'settlement' && settlementData ? (
                <SettlementDrillBody data={settlementData} />
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function RegionDrillBody({ data }: { data: DashboardInquiryBreakdown }) {
  const [sidoDetailKey, setSidoDetailKey] = useState<KoreaSidoKey | null>(null);
  const sidoDetail =
    sidoDetailKey != null
      ? data.byRegionWithinSido.find((g) => g.sidoKey === sidoDetailKey) ?? null
      : null;

  const regionItems = data.byRegion.map((z) => ({
    key: z.regionKey,
    label: z.label,
    value: z.inquiryCount,
    subLabel: `${z.inquiryCount}건 · ${formatCurrencyKo(z.salesAmount)}`,
  }));

  return (
    <div className="space-y-4">
      {data.bySidoMap.length > 0 ? (
        <div className="rounded-xl border border-slate-100 bg-slate-50/40 p-3">
          <DashboardKoreaSidoMap
            items={data.bySidoMap}
            onSidoClick={(sidoKey) => setSidoDetailKey(sidoKey)}
          />
        </div>
      ) : (
        <p className="py-8 text-center text-fluid-2xs text-gray-500 border border-dashed border-slate-200 rounded-lg">
          해당 월 집계 데이터가 없습니다.
        </p>
      )}
      <DashboardSidoRegionModal
        open={sidoDetailKey != null}
        detail={sidoDetail}
        monthTitle={monthTitleKo(data.monthKey)}
        onClose={() => setSidoDetailKey(null)}
      />
      {regionItems.length > 0 ? (
        <div>
          <h3 className="text-fluid-2xs font-semibold text-gray-700 mb-2">시·군·구 상세</h3>
          <DashboardHorizontalBarChart
            items={regionItems}
            accentClass="bg-red-500"
            formatValue={(n) => `${n}건`}
            ariaLabel="지역별 접수 건수"
          />
        </div>
      ) : null}
      <SummaryRow
        items={[
          { label: '접수 건수', value: `${regionItems.reduce((s, i) => s + i.value, 0)}건` },
          {
            label: '매출 합계',
            value: formatCurrencyKo(data.byRegion.reduce((s, z) => s + z.salesAmount, 0)),
          },
        ]}
      />
    </div>
  );
}

function MonthlyInquiryDrillBody({
  data,
  monthKey,
  sales,
}: {
  data: DashboardInquiryBreakdown;
  monthKey: string;
  sales: DashboardSalesBreakdown | null;
}) {
  const monthRow = data.byMonth.find((m) => m.monthKey === monthKey);
  const monthItems = data.byMonth.map((m) => ({
    key: m.monthKey,
    label: monthLabelShort(m.monthKey),
    value: m.inquiryCount,
    subLabel: `${m.inquiryCount}건 · ${formatCurrencyKo(m.salesAmount)}`,
  }));

  const dailyItems =
    sales?.dailySales
      .filter((d) => d.inquiryCount > 0 || d.amount > 0)
      .map((d) => ({
        key: d.date,
        label: d.date.slice(8),
        value: d.inquiryCount,
        subLabel: `${d.inquiryCount}건 · ${formatCurrencyKo(d.amount)}`,
      })) ?? [];

  const labelEvery = dailyItems.length > 20 ? 5 : dailyItems.length > 12 ? 3 : 2;

  return (
    <div className="space-y-4">
      {monthRow || sales ? (
        <SummaryRow
          items={[
            {
              label: `${monthTitleKo(monthKey)} 접수`,
              value: `${monthRow?.inquiryCount ?? sales?.inquiryCount ?? 0}건`,
            },
            {
              label: '매출',
              value: formatCurrencyKo(monthRow?.salesAmount ?? sales?.totalSales ?? 0),
            },
          ]}
        />
      ) : null}
      {dailyItems.length > 0 ? (
        <div>
          <h3 className="text-fluid-2xs font-semibold text-gray-700 mb-2">일별 접수·매출</h3>
          <DashboardVerticalBarChart
            items={dailyItems}
            accentClass="bg-indigo-400"
            peakAccentClass="bg-indigo-600"
            formatValue={(n) => `${n}건`}
            barAreaClass="h-28"
            labelEvery={labelEvery}
            ariaLabel="일별 접수 건수"
          />
        </div>
      ) : null}
      <div>
        <h3 className="text-fluid-2xs font-semibold text-gray-700 mb-2">최근 6개월 추이</h3>
        <DashboardVerticalBarChart
          items={monthItems}
          accentClass="bg-indigo-400"
          peakAccentClass="bg-indigo-600"
          showValueLabels
          formatValue={(n) => `${n}건`}
          barAreaClass="h-28"
          ariaLabel="월별 접수 건수"
        />
      </div>
    </div>
  );
}

function PreferredDateDrillBody({ data }: { data: DashboardInquiryBreakdown }) {
  const items = data.byPreferredDate.map((d) => ({
    key: d.date,
    label: d.date.slice(8),
    value: d.inquiryCount,
    subLabel: `${d.date.slice(5).replace('-', '/')} · ${d.inquiryCount}건`,
  }));
  const labelEvery = items.length > 20 ? 5 : items.length > 12 ? 3 : 2;
  const total = items.reduce((s, i) => s + i.value, 0);

  return (
    <div className="space-y-4">
      <SummaryRow items={[{ label: '예약 작업 합계', value: `${total}건` }]} />
      {items.every((d) => d.value === 0) ? (
        <p className="py-8 text-center text-fluid-2xs text-gray-500 border border-dashed border-slate-200 rounded-lg">
          해당 월 예약일이 있는 접수가 없습니다.
        </p>
      ) : (
        <DashboardVerticalBarChart
          items={items}
          accentClass="bg-sky-400"
          peakAccentClass="bg-sky-600"
          formatValue={(n) => `${n}건`}
          barAreaClass="h-32"
          labelEvery={labelEvery}
          ariaLabel="예약일별 작업 건수"
        />
      )}
    </div>
  );
}

function SalesDrillBody({ data }: { data: DashboardSalesBreakdown }) {
  const dailyItems = data.dailySales
    .filter((d) => d.amount > 0 || d.inquiryCount > 0)
    .map((d) => ({
      key: d.date,
      label: d.date.slice(8),
      value: d.amount,
      subLabel: formatCurrencyKo(d.amount),
    }));

  return (
    <div className="space-y-4">
      <SummaryRow
        items={[
          { label: '매출 합계', value: formatCurrencyKo(data.totalSales) },
          { label: '접수 건수', value: `${data.inquiryCount}건` },
        ]}
      />
      {dailyItems.length > 0 ? (
        <div>
          <h3 className="text-fluid-2xs font-semibold text-gray-700 mb-2">일별 매출</h3>
          <DashboardVerticalBarChart
            items={dailyItems}
            accentClass="bg-blue-500"
            peakAccentClass="bg-indigo-600"
            formatValue={(n) => formatCurrencyKo(n)}
            barAreaClass="h-28"
            ariaLabel="일별 매출"
          />
        </div>
      ) : null}
      {data.salesByTeamLeader.length > 0 ? (
        <div>
          <h3 className="text-fluid-2xs font-semibold text-gray-700 mb-2">팀장별 매출</h3>
          <div className="overflow-x-auto rounded-xl border border-slate-100">
            <table className="w-full text-fluid-2xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-gray-500">
                  <th className="text-center py-2 px-3 font-semibold">팀장</th>
                  <th className="text-center py-2 px-3 font-semibold">매출</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {data.salesByTeamLeader.map((s) => (
                  <tr key={s.teamLeaderId}>
                    <td className="py-2 px-3 text-center text-gray-800 truncate max-w-[10rem]" title={s.name}>
                      {s.name}
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums font-bold text-gray-900">
                      {formatCurrencyKo(s.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SettlementDrillBody({ data }: { data: DashboardSettlementSummary }) {
  return (
    <div className="space-y-4">
      <SummaryRow
        items={[
          { label: '지급 예정(산출 가능분)', value: formatCurrencyKo(data.totals.settlementDueTotal) },
          { label: '지급 완료', value: formatCurrencyKo(data.totals.paidTotal) },
          { label: '미정산 합계', value: formatCurrencyKo(data.totals.unsettledCombined) },
        ]}
      />
      {data.rows.length === 0 ? (
        <p className="py-8 text-center text-fluid-2xs text-gray-500 border border-dashed border-slate-200 rounded-lg">
          해당 월 정산 대상 팀장이 없습니다.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-100">
          <table className="w-full text-fluid-2xs whitespace-nowrap">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-gray-500">
                <th className="text-center py-2 px-2 font-semibold">팀장</th>
                <th className="text-center py-2 px-2 font-semibold">배정</th>
                <th className="text-center py-2 px-2 font-semibold">예정</th>
                <th className="text-center py-2 px-2 font-semibold">지급</th>
                <th className="text-center py-2 px-2 font-semibold">미정산</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {data.rows.map((r) => (
                <tr key={r.teamLeaderId}>
                  <td className="py-2 px-2 text-center text-gray-800 truncate max-w-[7rem]" title={r.name}>
                    {r.name}
                  </td>
                  <td className="py-2 px-2 text-center tabular-nums">{r.assignedJobCount}건</td>
                  <td className="py-2 px-2 text-right tabular-nums">
                    {r.settlementDueTotal != null ? formatCurrencyKo(r.settlementDueTotal) : '—'}
                  </td>
                  <td className="py-2 px-2 text-right tabular-nums">{formatCurrencyKo(r.paidTotal)}</td>
                  <td className="py-2 px-2 text-right tabular-nums font-semibold">{formatCurrencyKo(r.unsettledCombined)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SummaryRow({ items }: { items: Array<{ label: string; value: string }> }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {items.map((item) => (
        <div key={item.label} className="rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2">
          <p className="text-[10px] text-gray-500">{item.label}</p>
          <p className="text-fluid-sm font-bold text-slate-900 tabular-nums">{item.value}</p>
        </div>
      ))}
    </div>
  );
}
