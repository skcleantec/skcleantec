import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DATE_RANGE_PRESET_LABELS,
  computeDateRangeFromPreset,
  type DateRangePresetId,
} from '../../utils/dateRangePresets';
import type { TeamMessageId } from '../../i18n/team/teamMessages';
import { isAuthSessionExpiredError } from '../../api/auth';
import {
  getTeamExternalSettlement,
  getTeamMe,
  type TeamExternalSettlementResponse,
} from '../../api/team';
import { clearTeamToken, getTeamToken } from '../../stores/teamAuth';
import { useLocation, useNavigate } from 'react-router-dom';
import { useInboxRealtime } from '../../hooks/useInboxRealtime';
import { useVisibilityInterval } from '../../hooks/useVisibilityInterval';
import { formatDateCompactWithWeekday } from '../../utils/dateFormat';
import { TeamBiInline, TeamBiLine, teamBiPlain, teamInquiryStatus } from '../../i18n/team/teamI18n';

const TEAM_DATE_PRESET_MSG: Record<DateRangePresetId, TeamMessageId> = {
  custom: 'team.datePreset.custom',
  today: 'team.datePreset.today',
  thisMonth: 'team.datePreset.thisMonth',
  lastMonth: 'team.datePreset.lastMonth',
  thisYear: 'team.datePreset.thisYear',
  lastYear: 'team.datePreset.lastYear',
};

function SettlementRowStatus({ code, cancelled }: { code: string; cancelled: boolean }) {
  if (cancelled) {
    return <TeamBiInline id="team.settlement.badgeCancelledDeduction" />;
  }
  const st = teamInquiryStatus(code);
  return (
    <span className="flex flex-col items-center leading-tight">
      <span>{st.ko}</span>
      <span className="text-[0.6rem] text-gray-500 font-normal">{st.th}</span>
    </span>
  );
}

function won(n: number): string {
  return `${n.toLocaleString('ko-KR')}원`;
}

type SettlementTab = 'summary' | 'history';

export function TeamExternalSettlementPage() {
  const token = getTeamToken();
  const navigate = useNavigate();
  const location = useLocation();
  const initialRange = computeDateRangeFromPreset('thisMonth')!;
  const [from, setFrom] = useState(initialRange.from);
  const [to, setTo] = useState(initialRange.to);
  const [preset, setPreset] = useState<DateRangePresetId>('thisMonth');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<TeamExternalSettlementResponse | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [previewCompanyId, setPreviewCompanyId] = useState('');
  const [previewCompanyName, setPreviewCompanyName] = useState('');
  const [activeTab, setActiveTab] = useState<SettlementTab>('summary');

  useEffect(() => {
    const q = new URLSearchParams(location.search);
    setPreviewMode(q.get('previewRole') === 'external');
    setPreviewCompanyId(q.get('externalCompanyId') ?? '');
    setPreviewCompanyName((q.get('previewExternalName') ?? '').trim());
  }, [location.search]);

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!token) return;
      if (!opts?.silent) {
        setLoading(true);
        setError(null);
      }
      try {
        const me = await getTeamMe(token);
        const viewerRole = me.viewerRole ?? me.role;
        const isPreviewStaff =
          (viewerRole === 'ADMIN' || viewerRole === 'MARKETER') && previewMode;
        if (me.role !== 'EXTERNAL_PARTNER' && !isPreviewStaff) {
          setData(null);
          setError(teamBiPlain('team.settlement.partnerOnly'));
          return;
        }
        const res = await getTeamExternalSettlement(token, {
          from,
          to,
          externalCompanyId: isPreviewStaff && previewCompanyId ? previewCompanyId : undefined,
          externalCompanyName: isPreviewStaff && previewCompanyName ? previewCompanyName : undefined,
        });
        setData(res);
        setError(null);
      } catch (e) {
        if (isAuthSessionExpiredError(e)) {
          clearTeamToken();
          navigate('/login', { replace: true, state: { sessionExpired: true } });
          return;
        }
        setData(null);
        setError(e instanceof Error ? e.message : teamBiPlain('team.settlement.loadFail'));
      } finally {
        if (!opts?.silent) setLoading(false);
      }
    },
    [from, to, navigate, previewCompanyId, previewCompanyName, previewMode, token]
  );

  useEffect(() => {
    void load();
  }, [load]);

  const silentRefresh = useCallback(() => {
    void load({ silent: true });
  }, [load]);

  const { connected } = useInboxRealtime(token, silentRefresh, Boolean(token));
  useVisibilityInterval(silentRefresh, token && !connected ? 20000 : 0);

  const totalPositive = useMemo(
    () => (data?.items ?? []).reduce((s, it) => s + (it.signedFeeAmount > 0 ? it.signedFeeAmount : 0), 0),
    [data?.items]
  );
  const totalNegative = useMemo(
    () => (data?.items ?? []).reduce((s, it) => s + (it.signedFeeAmount < 0 ? Math.abs(it.signedFeeAmount) : 0), 0),
    [data?.items]
  );
  const applyPreset = (id: DateRangePresetId) => {
    setPreset(id);
    if (id === 'custom') return;
    const r = computeDateRangeFromPreset(id);
    if (!r) return;
    setFrom(r.from);
    setTo(r.to);
  };
  const payableAmount = data?.payableAmount ?? 0;
  const remainingAmount = data?.remainingAmount ?? 0;
  const historyDisplay = useMemo(() => {
    if (!data) return [];
    return [...data.payments].sort((a, b) => b.paidAt.localeCompare(a.paidAt));
  }, [data]);

  if (loading) {
    return (
      <div className="py-12 text-center text-gray-500 text-fluid-sm">
        <TeamBiLine id="team.common.loading" koClassName="text-fluid-sm text-gray-500" />
      </div>
    );
  }

  return (
    <div className="flex min-w-0 w-full max-w-full flex-col gap-4 pb-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-800">
            <TeamBiLine id="team.layout.nav.settlement" koClassName="text-xl font-semibold text-gray-800" />
          </h1>
          <div className="mt-1">
            <TeamBiLine id="team.settlement.adminCancelNote" koClassName="text-fluid-xs text-gray-500" />
          </div>
        </div>
        <div className="flex flex-wrap gap-1">
          {DATE_RANGE_PRESET_LABELS.map(({ id }) => (
            <button
              key={id}
              type="button"
              onClick={() => applyPreset(id)}
              className={`rounded px-2.5 py-1.5 text-fluid-xs font-medium border ${
                preset === id ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-700 border-gray-300'
              }`}
            >
              <TeamBiInline id={TEAM_DATE_PRESET_MSG[id]} />
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-white p-3">
        <label className="text-fluid-xs text-gray-600">
          <TeamBiLine id="team.settlement.dateFrom" koClassName="text-fluid-xs text-gray-600" />
          <input
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setPreset('custom');
            }}
            className="mt-1 block rounded border border-gray-300 bg-white px-2 py-2 text-fluid-sm"
          />
        </label>
        <span className="mt-5 text-gray-400">~</span>
        <label className="text-fluid-xs text-gray-600">
          <TeamBiLine id="team.settlement.dateTo" koClassName="text-fluid-xs text-gray-600" />
          <input
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setPreset('custom');
            }}
            className="mt-1 block rounded border border-gray-300 bg-white px-2 py-2 text-fluid-sm"
          />
        </label>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-fluid-sm text-red-900">{error}</div>
      ) : null}

      {data ? (
        <>
          <h2 className="text-fluid-sm font-medium text-gray-800">
            <TeamBiLine id="team.settlement.sectionPeriodBasis" koClassName="text-fluid-sm font-medium text-gray-800" />
          </h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-lg border border-gray-200 bg-white p-3">
              <div className="text-fluid-2xs text-gray-500">
                <TeamBiLine id="team.settlement.cardCompany" koClassName="text-fluid-2xs text-gray-500" />
              </div>
              <p className="mt-1 truncate text-fluid-sm font-semibold text-gray-900" title={data.externalCompanyName ?? '-'}>
                {data.externalCompanyName ?? '-'}
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-3">
              <div className="text-fluid-2xs text-gray-500">
                <TeamBiLine id="team.settlement.cardPeriodTotalFee" koClassName="text-fluid-2xs text-gray-500" />
              </div>
              <p className="mt-1 text-fluid-sm font-semibold text-gray-900 tabular-nums">{won(data.totalFee)}</p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-3">
              <div className="text-fluid-2xs text-gray-500">
                <TeamBiLine id="team.settlement.cardNormalCancelledCounts" koClassName="text-fluid-2xs text-gray-500" />
              </div>
              <p className="mt-1 text-fluid-sm font-semibold text-gray-900 tabular-nums">
                {data.inquiryCount} / {data.cancelledInquiryCount}
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-3">
              <div className="text-fluid-2xs text-gray-500">
                <TeamBiLine id="team.settlement.cardTotalCount" koClassName="text-fluid-2xs text-gray-500" />
              </div>
              <p className="mt-1 text-fluid-sm font-semibold text-gray-900 tabular-nums">{data.totalCount}</p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-3">
              <div className="text-fluid-2xs text-gray-500">
                <TeamBiLine id="team.settlement.cardCarryOver" koClassName="text-fluid-2xs text-gray-500" />
              </div>
              <p className="mt-1 text-fluid-sm font-semibold text-gray-900 tabular-nums">
                {won(data.carryOverAmount)}
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-3">
              <div className="text-fluid-2xs text-gray-500">
                <TeamBiLine id="team.settlement.cardPayable" koClassName="text-fluid-2xs text-gray-500" />
              </div>
              <p className="mt-1 text-fluid-sm font-semibold text-gray-900 tabular-nums">
                {won(data.payableAmount)}
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-3">
              <div className="text-fluid-2xs text-gray-500">
                <TeamBiLine id="team.settlement.cardPeriodPaid" koClassName="text-fluid-2xs text-gray-500" />
              </div>
              <p className="mt-1 text-fluid-sm font-semibold text-emerald-700 tabular-nums">
                {won(data.periodPaidAmount)}
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-3">
              <div className="text-fluid-2xs text-gray-500">
                <TeamBiLine id="team.settlement.cardRemainingPay" koClassName="text-fluid-2xs text-gray-500" />
              </div>
              <p className={`mt-1 text-fluid-sm font-semibold tabular-nums ${remainingAmount > 0 ? 'text-rose-700' : 'text-gray-900'}`}>
                {won(remainingAmount > 0 ? remainingAmount : 0)}
              </p>
            </div>
          </div>

          <div className="mt-4">
            <TeamBiLine
              id="team.settlement.yearHeading"
              vars={{ year: String(data.summaryYear) }}
              koClassName="text-fluid-sm font-medium text-gray-800"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-xl border-2 border-rose-200 bg-rose-50/60 p-4 shadow-sm">
              <div className="text-fluid-2xs font-medium uppercase tracking-wide text-rose-900/80">
                <TeamBiLine id="team.settlement.remainingReceivableTitle" koClassName="text-fluid-2xs font-medium uppercase tracking-wide text-rose-900/80" />
              </div>
              <p
                className={`mt-2 text-2xl font-bold tabular-nums sm:text-3xl ${
                  (data.yearRemainingAmount ?? 0) > 0 ? 'text-rose-800' : 'text-gray-800'
                }`}
              >
                {won((data.yearRemainingAmount ?? 0) > 0 ? data.yearRemainingAmount ?? 0 : 0)}
              </p>
              <div className="mt-2 space-y-1">
                <TeamBiLine id="team.settlement.yearTotalFeeByBooking" koClassName="text-fluid-xs text-gray-600" />
                <p className="font-semibold tabular-nums text-gray-900">{won(data.yearTotalFee ?? 0)}</p>
              </div>
            </div>
            <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50/60 p-4 shadow-sm">
              <div className="text-fluid-2xs font-medium uppercase tracking-wide text-emerald-900/80">
                <TeamBiLine id="team.settlement.recentPaidTitle" koClassName="text-fluid-2xs font-medium uppercase tracking-wide text-emerald-900/80" />
              </div>
              {data.lastSettlementPayment ? (
                <>
                  <p className="mt-2 text-2xl font-bold text-emerald-800 tabular-nums sm:text-3xl">
                    {won(data.lastSettlementPayment.amount)}
                  </p>
                  <p className="mt-1 text-fluid-xs text-gray-600">
                    {formatDateCompactWithWeekday(data.lastSettlementPayment.paidAt)}
                  </p>
                </>
              ) : (
                <div className="mt-3">
                  <TeamBiLine id="team.settlement.noPaidHistoryYet" koClassName="text-fluid-sm text-gray-500" />
                </div>
              )}
              <div className="mt-2 text-fluid-xs text-gray-600 flex flex-wrap items-baseline gap-x-1 gap-y-1">
                <TeamBiLine id="team.settlement.yearPaidAccum" koClassName="text-fluid-xs text-gray-600" />
                <span className="font-semibold tabular-nums text-emerald-900">{won(data.yearPeriodPaidAmount ?? 0)}</span>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-3 text-fluid-xs text-gray-600 flex flex-wrap gap-x-4 gap-y-3 items-start">
            <span className="inline-flex flex-col gap-1">
              <TeamBiInline id="team.settlement.sumPositiveFees" />
              <strong className="text-emerald-700 tabular-nums">{won(totalPositive)}</strong>
            </span>
            <span className="text-gray-300 hidden sm:inline self-center">·</span>
            <span className="inline-flex flex-col gap-1">
              <TeamBiInline id="team.settlement.cancelDeduction" />
              <strong className="text-rose-700 tabular-nums">-{won(totalNegative)}</strong>
            </span>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white">
            <div className="border-b border-gray-100 px-3 py-2.5">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('summary')}
                  className={`rounded px-2.5 py-1 text-fluid-xs font-medium border ${
                    activeTab === 'summary'
                      ? 'bg-gray-800 text-white border-gray-800'
                      : 'bg-white text-gray-700 border-gray-300'
                  }`}
                >
                  <TeamBiInline id="team.settlement.tabLines" />
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('history')}
                  className={`rounded px-2.5 py-1 text-fluid-xs font-medium border ${
                    activeTab === 'history'
                      ? 'bg-gray-800 text-white border-gray-800'
                      : 'bg-white text-gray-700 border-gray-300'
                  }`}
                >
                  <TeamBiInline id="team.settlement.tabPaidHistory" />
                </button>
              </div>
            </div>

            {activeTab === 'history' ? (
              <div className="p-3">
                <div className="rounded border border-gray-200 bg-white">
                  <div className="border-b border-gray-100 bg-gray-50 px-3 py-2 text-fluid-xs text-gray-600">
                    <div className="text-fluid-xs">
                      <TeamBiLine
                        id="team.settlement.historyBanner"
                        vars={{
                          month: data.month,
                          payable: won(payableAmount),
                          paid: won(data.periodPaidAmount),
                          remaining: won(remainingAmount > 0 ? remainingAmount : 0),
                        }}
                        koClassName="text-fluid-xs text-gray-600"
                      />
                    </div>
                    <div className="mt-1.5 text-fluid-2xs text-gray-500">
                      <TeamBiLine id="team.settlement.historyNote" koClassName="text-fluid-2xs text-gray-500" />
                    </div>
                  </div>
                  {historyDisplay.length === 0 ? (
                    <div className="px-3 py-8 text-center">
                      <TeamBiLine id="team.settlement.emptyPaidPeriod" koClassName="text-fluid-sm text-gray-500" />
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[640px] border-collapse text-fluid-sm">
                        <thead>
                          <tr className="border-b border-gray-200 bg-gray-100">
                            <th className="px-3 py-2 text-center font-medium text-gray-700 align-middle">
                              <TeamBiLine id="team.settlement.thPaidDate" koClassName="text-fluid-xs font-medium text-gray-700" />
                            </th>
                            <th className="px-3 py-2 text-center font-medium text-gray-700 align-middle">
                              <TeamBiLine id="team.settlement.thPaidAmount" koClassName="text-fluid-xs font-medium text-gray-700" />
                            </th>
                            <th className="px-3 py-2 text-center font-medium text-gray-700 align-middle">
                              <TeamBiLine id="team.settlement.thActor" koClassName="text-fluid-xs font-medium text-gray-700" />
                            </th>
                            <th className="px-3 py-2 text-center font-medium text-gray-700 align-middle">
                              <TeamBiLine id="team.settlement.thMemo" koClassName="text-fluid-xs font-medium text-gray-700" />
                            </th>
                            <th className="px-3 py-2 text-center font-medium text-gray-700 align-middle">
                              <TeamBiLine id="team.settlement.thBalanceAfterCumulative" koClassName="text-fluid-xs font-medium text-gray-700" />
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {historyDisplay.map((row) => {
                            const after = row.outstandingAfterCumulative ?? 0;
                            return (
                            <tr key={row.id} className="border-b border-gray-100">
                              <td className="px-3 py-2 text-center tabular-nums text-gray-700">
                                {formatDateCompactWithWeekday(row.paidAt)}
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums font-semibold text-emerald-700">
                                {won(row.amount)}
                              </td>
                              <td className="px-3 py-2 text-center text-gray-700">{row.actorName ?? '-'}</td>
                              <td className="px-3 py-2 text-center text-gray-700">{row.memo ?? '-'}</td>
                              <td className="px-3 py-2 text-right tabular-nums font-semibold text-gray-900">
                                {won(after > 0 ? after : 0)}
                              </td>
                            </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>

          {activeTab === 'summary' ? <div className="space-y-3 lg:hidden">
            {data.items.length === 0 ? (
              <div className="rounded-lg border border-gray-200 bg-white px-3 py-10 text-center">
                <TeamBiLine id="team.settlement.emptyLinesPeriod" koClassName="text-gray-500 text-fluid-sm" />
              </div>
            ) : (
              data.items.map((it) => (
                <article
                  key={`${it.inquiryId}-${it.isCancelled ? 'C' : 'N'}`}
                  className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-fluid-sm font-semibold text-gray-900">{it.customerName}</p>
                      <p className="mt-0.5 text-fluid-2xs text-gray-500 tabular-nums">{it.inquiryNumber ?? '-'}</p>
                    </div>
                    <span
                      className={`inline-flex shrink-0 rounded px-2 py-0.5 text-fluid-2xs font-medium ${
                        it.isCancelled ? 'bg-rose-100 text-rose-700' : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      <SettlementRowStatus code={it.status} cancelled={it.isCancelled} />
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2 text-fluid-xs text-gray-600">
                    <span className="min-w-0 text-left tabular-nums">
                      <TeamBiLine
                        id="team.settlement.prefDateLine"
                        vars={{
                          date: it.preferredDate ? formatDateCompactWithWeekday(it.preferredDate) : '-',
                        }}
                        koClassName="text-fluid-xs text-gray-600"
                      />
                    </span>
                    <span
                      className={`tabular-nums font-semibold ${
                        it.signedFeeAmount < 0 ? 'text-rose-700' : 'text-emerald-700'
                      }`}
                    >
                      {it.signedFeeAmount < 0 ? '-' : '+'}
                      {won(Math.abs(it.signedFeeAmount))}
                    </span>
                  </div>
                </article>
              ))
            )}
          </div> : null}

          {activeTab === 'summary' ? <div className="hidden overflow-x-auto rounded-lg border border-gray-200 bg-white lg:block">
            <table className="w-full min-w-[640px] border-collapse text-fluid-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-100">
                  <th className="px-3 py-2 text-center font-medium text-gray-700 align-middle">
                    <TeamBiLine id="team.settlement.thPreferredDate" koClassName="text-fluid-xs font-medium text-gray-700" />
                  </th>
                  <th className="px-3 py-2 text-center font-medium text-gray-700 align-middle">
                    <TeamBiLine id="team.settlement.thInquiryNo" koClassName="text-fluid-xs font-medium text-gray-700" />
                  </th>
                  <th className="px-3 py-2 text-center font-medium text-gray-700 align-middle">
                    <TeamBiLine id="team.settlement.thCustomer" koClassName="text-fluid-xs font-medium text-gray-700" />
                  </th>
                  <th className="px-3 py-2 text-center font-medium text-gray-700 align-middle">
                    <TeamBiLine id="team.settlement.thStatus" koClassName="text-fluid-xs font-medium text-gray-700" />
                  </th>
                  <th className="px-3 py-2 text-center font-medium text-gray-700 align-middle">
                    <TeamBiLine id="team.settlement.thFee" koClassName="text-fluid-xs font-medium text-gray-700" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.items.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-10 text-center">
                      <TeamBiLine id="team.settlement.emptyLinesPeriod" koClassName="text-gray-500 text-fluid-sm" />
                    </td>
                  </tr>
                ) : (
                  data.items.map((it) => (
                    <tr key={`${it.inquiryId}-${it.isCancelled ? 'C' : 'N'}`} className="border-b border-gray-100">
                      <td className="px-3 py-2 text-center text-gray-700 tabular-nums">
                        {it.preferredDate ? formatDateCompactWithWeekday(it.preferredDate) : '-'}
                      </td>
                      <td className="px-3 py-2 text-center text-gray-700 tabular-nums">{it.inquiryNumber ?? '-'}</td>
                      <td className="px-3 py-2 text-center text-gray-900">{it.customerName}</td>
                      <td className="px-3 py-2 text-center align-middle">
                        <span
                          className={`inline-flex min-h-[2.25rem] items-center justify-center rounded px-2 py-0.5 text-fluid-2xs font-medium ${
                            it.isCancelled ? 'bg-rose-100 text-rose-700' : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          <SettlementRowStatus code={it.status} cancelled={it.isCancelled} />
                        </span>
                      </td>
                      <td
                        className={`px-3 py-2 text-right tabular-nums font-semibold ${
                          it.signedFeeAmount < 0 ? 'text-rose-700' : 'text-emerald-700'
                        }`}
                      >
                        {it.signedFeeAmount < 0 ? '-' : '+'}
                        {won(Math.abs(it.signedFeeAmount))}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div> : null}
        </>
      ) : null}
    </div>
  );
}
