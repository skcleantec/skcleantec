import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { addDaysToKstYmd, kstTodayYmd } from '../inquiries/inquiryListDateRange.js';
import {
  applyHeatmapRows,
  emptyHeatmapGrid,
  heatmapCellLabel,
  KST_WEEKDAY_LABELS,
  peakFromHeatmap,
  sumHeatmap,
  type HeatmapGrid,
} from './kstHeatmapAggregate.js';
import {
  applyHourlyRows,
  emptyHourlyBucket,
  formatKstHourRangeLabel,
  peakFromHourly,
  sumHourly,
  type HourlyBucket,
} from './kstHourlyAggregate.js';
import {
  sqlExcludeDesignerPreviewTokens,
  sqlExtractKstDow,
  sqlExtractKstHour,
} from './kstSql.js';

export type OpsHourlyMetricId =
  | 'order_form_issued'
  | 'order_form_submitted'
  | 'inquiry_received'
  | 'followup_absent'
  | 'followup_on_hold'
  | 'followup_reserved';

export type OpsHourlyMetric = {
  id: OpsHourlyMetricId;
  label: string;
  description: string;
  hourly: HourlyBucket;
  total: number;
  peakHour: number;
  peakCount: number;
  peakLabel: string;
};

export type OpsHeatmapPeak = {
  dow: number;
  hour: number;
  count: number;
  label: string;
};

export type OpsHeatmap = {
  metricId: 'order_form_issued';
  grid: HeatmapGrid;
  weekdayLabels: readonly string[];
  total: number;
  peak: OpsHeatmapPeak;
};

export type OpsOpenBacklog = {
  absent: number;
  onHold: number;
  total: number;
};

export type OpsConversionByHour = {
  /** 시간대별 예약/(부재+보류) 유입 비율 0~1 */
  hourlyRate: number[];
  peakHour: number;
  peakRatePct: number;
};

export type OpsHourlySummary = {
  periodDays: number;
  periodStartYmd: string;
  periodEndYmd: string;
  primaryPeak: { metricId: OpsHourlyMetricId; hour: number; count: number; label: string };
  metrics: OpsHourlyMetric[];
  heatmap: OpsHeatmap;
  openBacklog: OpsOpenBacklog;
  conversionByHour: OpsConversionByHour;
};

const METRIC_DEFS: { id: OpsHourlyMetricId; label: string; description: string }[] = [
  {
    id: 'order_form_issued',
    label: '발주서 발급',
    description: '마케터가 고객 발주서 링크를 발급한 시각(KST)',
  },
  {
    id: 'order_form_submitted',
    label: '발주서 제출',
    description: '고객이 발주서를 제출한 시각(KST)',
  },
  {
    id: 'inquiry_received',
    label: '접수 전환',
    description: '접수(RECEIVED) 상태로 전환된 시각(KST)',
  },
  {
    id: 'followup_absent',
    label: '부재 유입',
    description: '부재현황에 부재(ABSENT)로 등록된 시각(KST)',
  },
  {
    id: 'followup_on_hold',
    label: '보류 유입',
    description: '부재현황에 보류(ON_HOLD)로 등록된 시각(KST)',
  },
  {
    id: 'followup_reserved',
    label: '예약 확정',
    description: '부재현황 예약(RESERVED) 등록 시각(KST)',
  },
];

function parsePeriodDays(raw: unknown): number {
  const n = typeof raw === 'string' ? parseInt(raw, 10) : NaN;
  if (n === 7 || n === 30 || n === 90) return n;
  return 30;
}

function kstPeriodRange(days: number): { gte: Date; lte: Date; startYmd: string; endYmd: string } {
  const endYmd = kstTodayYmd();
  const startYmd = addDaysToKstYmd(endYmd, -(days - 1));
  return {
    gte: new Date(`${startYmd}T00:00:00+09:00`),
    lte: new Date(`${endYmd}T23:59:59.999+09:00`),
    startYmd,
    endYmd,
  };
}

async function queryHourlyFromTable(params: {
  tenantId: string;
  gte: Date;
  lte: Date;
  table: 'order_forms' | 'order_followups' | 'inquiry_status_events';
  timeColumn: 'created_at' | 'submitted_at' | 'occurred_at';
  statusFilter?: string;
}): Promise<{ hour: number; cnt: number }[]> {
  const { tenantId, gte, lte, table, timeColumn, statusFilter } = params;

  if (table === 'order_forms') {
    if (timeColumn === 'submitted_at') {
      const rows = await prisma.$queryRaw<{ hour: number; cnt: bigint }[]>(Prisma.sql`
        SELECT ${sqlExtractKstHour(Prisma.sql`submitted_at`)} AS hour,
               COUNT(*)::bigint AS cnt
        FROM order_forms
        WHERE tenant_id = ${tenantId}
          AND submitted_at IS NOT NULL
          AND submitted_at >= ${gte}
          AND submitted_at <= ${lte}
          AND ${sqlExcludeDesignerPreviewTokens()}
        GROUP BY 1
      `);
      return rows.map((r) => ({ hour: Number(r.hour), cnt: Number(r.cnt) }));
    }
    const rows = await prisma.$queryRaw<{ hour: number; cnt: bigint }[]>(Prisma.sql`
      SELECT ${sqlExtractKstHour(Prisma.sql`created_at`)} AS hour,
             COUNT(*)::bigint AS cnt
      FROM order_forms
      WHERE tenant_id = ${tenantId}
        AND created_at >= ${gte}
        AND created_at <= ${lte}
        AND ${sqlExcludeDesignerPreviewTokens()}
      GROUP BY 1
    `);
    return rows.map((r) => ({ hour: Number(r.hour), cnt: Number(r.cnt) }));
  }

  if (table === 'inquiry_status_events') {
    const rows = await prisma.$queryRaw<{ hour: number; cnt: bigint }[]>(Prisma.sql`
      SELECT ${sqlExtractKstHour(Prisma.sql`occurred_at`)} AS hour,
             COUNT(*)::bigint AS cnt
      FROM inquiry_status_events
      WHERE tenant_id = ${tenantId}
        AND status = ${statusFilter}::"InquiryStatus"
        AND occurred_at >= ${gte}
        AND occurred_at <= ${lte}
      GROUP BY 1
    `);
    return rows.map((r) => ({ hour: Number(r.hour), cnt: Number(r.cnt) }));
  }

  const rows = await prisma.$queryRaw<{ hour: number; cnt: bigint }[]>(Prisma.sql`
    SELECT ${sqlExtractKstHour(Prisma.sql`created_at`)} AS hour,
           COUNT(*)::bigint AS cnt
    FROM order_followups
    WHERE tenant_id = ${tenantId}
      AND status = ${statusFilter}::"OrderFollowupStatus"
      AND created_at >= ${gte}
      AND created_at <= ${lte}
    GROUP BY 1
  `);
  return rows.map((r) => ({ hour: Number(r.hour), cnt: Number(r.cnt) }));
}

async function queryHeatmapOrderFormsIssued(
  tenantId: string,
  gte: Date,
  lte: Date,
): Promise<{ dow: number; hour: number; cnt: number }[]> {
  const rows = await prisma.$queryRaw<{ dow: number; hour: number; cnt: bigint }[]>(Prisma.sql`
    SELECT ${sqlExtractKstDow(Prisma.sql`created_at`)} AS dow,
           ${sqlExtractKstHour(Prisma.sql`created_at`)} AS hour,
           COUNT(*)::bigint AS cnt
    FROM order_forms
    WHERE tenant_id = ${tenantId}
      AND created_at >= ${gte}
      AND created_at <= ${lte}
      AND ${sqlExcludeDesignerPreviewTokens()}
    GROUP BY 1, 2
  `);
  return rows.map((r) => ({ dow: Number(r.dow), hour: Number(r.hour), cnt: Number(r.cnt) }));
}

async function buildMetric(
  def: (typeof METRIC_DEFS)[number],
  tenantId: string,
  gte: Date,
  lte: Date,
): Promise<OpsHourlyMetric> {
  let rows: { hour: number; cnt: number }[] = [];
  switch (def.id) {
    case 'order_form_issued':
      rows = await queryHourlyFromTable({ tenantId, gte, lte, table: 'order_forms', timeColumn: 'created_at' });
      break;
    case 'order_form_submitted':
      rows = await queryHourlyFromTable({
        tenantId,
        gte,
        lte,
        table: 'order_forms',
        timeColumn: 'submitted_at',
      });
      break;
    case 'inquiry_received':
      rows = await queryHourlyFromTable({
        tenantId,
        gte,
        lte,
        table: 'inquiry_status_events',
        timeColumn: 'occurred_at',
        statusFilter: 'RECEIVED',
      });
      break;
    case 'followup_absent':
      rows = await queryHourlyFromTable({
        tenantId,
        gte,
        lte,
        table: 'order_followups',
        timeColumn: 'created_at',
        statusFilter: 'ABSENT',
      });
      break;
    case 'followup_on_hold':
      rows = await queryHourlyFromTable({
        tenantId,
        gte,
        lte,
        table: 'order_followups',
        timeColumn: 'created_at',
        statusFilter: 'ON_HOLD',
      });
      break;
    case 'followup_reserved':
      rows = await queryHourlyFromTable({
        tenantId,
        gte,
        lte,
        table: 'order_followups',
        timeColumn: 'created_at',
        statusFilter: 'RESERVED',
      });
      break;
    default:
      break;
  }

  const hourly = emptyHourlyBucket();
  applyHourlyRows(hourly, rows);
  const peak = peakFromHourly(hourly);
  return {
    id: def.id,
    label: def.label,
    description: def.description,
    hourly,
    total: sumHourly(hourly),
    peakHour: peak.hour,
    peakCount: peak.count,
    peakLabel: peak.count > 0 ? formatKstHourRangeLabel(peak.hour) : '—',
  };
}

async function buildOpenBacklog(tenantId: string): Promise<OpsOpenBacklog> {
  const [absent, onHold] = await Promise.all([
    prisma.orderFollowup.count({ where: { tenantId, status: 'ABSENT' } }),
    prisma.orderFollowup.count({ where: { tenantId, status: 'ON_HOLD' } }),
  ]);
  return { absent, onHold, total: absent + onHold };
}

function buildConversionByHour(
  absent: HourlyBucket,
  onHold: HourlyBucket,
  reserved: HourlyBucket,
): OpsConversionByHour {
  const hourlyRate = emptyHourlyBucket().map((_, h) => {
    const denom = (absent[h] ?? 0) + (onHold[h] ?? 0);
    if (denom <= 0) return 0;
    return (reserved[h] ?? 0) / denom;
  });
  let peakHour = 0;
  let peakRate = 0;
  for (let h = 0; h < 24; h++) {
    const rate = hourlyRate[h] ?? 0;
    if (rate > peakRate) {
      peakRate = rate;
      peakHour = h;
    }
  }
  return {
    hourlyRate,
    peakHour,
    peakRatePct: Math.round(peakRate * 100),
  };
}

export async function buildOpsHourlySummary(
  tenantId: string,
  periodDaysRaw: unknown,
): Promise<OpsHourlySummary> {
  const periodDays = parsePeriodDays(periodDaysRaw);
  const { gte, lte, startYmd, endYmd } = kstPeriodRange(periodDays);

  const [metrics, heatmapRows, openBacklog] = await Promise.all([
    Promise.all(METRIC_DEFS.map((def) => buildMetric(def, tenantId, gte, lte))),
    queryHeatmapOrderFormsIssued(tenantId, gte, lte),
    buildOpenBacklog(tenantId),
  ]);

  const issued = metrics.find((m) => m.id === 'order_form_issued')!;
  const absent = metrics.find((m) => m.id === 'followup_absent')!;
  const onHold = metrics.find((m) => m.id === 'followup_on_hold')!;
  const reserved = metrics.find((m) => m.id === 'followup_reserved')!;

  const grid = emptyHeatmapGrid();
  applyHeatmapRows(grid, heatmapRows);
  const heatPeak = peakFromHeatmap(grid);

  const primaryPeak = {
    metricId: 'order_form_issued' as const,
    hour: issued.peakHour,
    count: issued.peakCount,
    label: issued.peakLabel,
  };

  return {
    periodDays,
    periodStartYmd: startYmd,
    periodEndYmd: endYmd,
    primaryPeak,
    metrics,
    heatmap: {
      metricId: 'order_form_issued',
      grid,
      weekdayLabels: KST_WEEKDAY_LABELS,
      total: sumHeatmap(grid),
      peak: {
        dow: heatPeak.dow,
        hour: heatPeak.hour,
        count: heatPeak.count,
        label: heatPeak.count > 0 ? heatmapCellLabel(heatPeak.dow, heatPeak.hour) : '—',
      },
    },
    openBacklog,
    conversionByHour: buildConversionByHour(absent.hourly, onHold.hourly, reserved.hourly),
  };
}
