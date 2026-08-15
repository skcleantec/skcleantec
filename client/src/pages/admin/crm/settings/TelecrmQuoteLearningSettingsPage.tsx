import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getToken } from '../../../../stores/auth';
import {
  backfillTelecrmQuoteCrewLearning,
  fetchTelecrmQuoteCrewLearningOverview,
} from '../../../../api/telecrmQuoteCrewLearning';
import type { TelecrmQuoteCrewLearningOverview } from '@shared/telecrmQuoteCrewLearning';
import { SettingsCard } from '../../../../components/crm/settings/DeletePasswordModal';
import { formatWon } from '../../../../components/crm/settings/telecrmSettingsUi';

const READINESS_BAR: Record<TelecrmQuoteCrewLearningOverview['readiness'], number> = {
  insufficient: 15,
  basic: 35,
  good: 65,
  strong: 100,
};

const READINESS_COLOR: Record<TelecrmQuoteCrewLearningOverview['readiness'], string> = {
  insufficient: 'bg-slate-300',
  basic: 'bg-amber-400',
  good: 'bg-sky-500',
  strong: 'bg-emerald-500',
};

function formatWhen(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function TelecrmQuoteLearningSettingsPage() {
  const token = getToken();
  const [overview, setOverview] = useState<TelecrmQuoteCrewLearningOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchTelecrmQuoteCrewLearningOverview(token);
      setOverview(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : '불러오기 실패');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const progressPct = useMemo(
    () => (overview ? READINESS_BAR[overview.readiness] : 0),
    [overview],
  );

  const handleBackfill = async () => {
    if (!token || syncing) return;
    setSyncing(true);
    setSyncMessage(null);
    setError(null);
    try {
      const result = await backfillTelecrmQuoteCrewLearning(token, 500);
      setOverview(result.overview);
      setSyncMessage(
        `동기화 완료 — 반영 ${result.upserted}건 · 제외 ${result.skipped}건 · 학습 데이터 ${result.overview.totalSnapshots}건`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : '동기화 실패');
    } finally {
      setSyncing(false);
    }
  };

  if (loading && !overview) {
    return <p className="text-fluid-sm text-gray-500">학습 현황 불러오는 중…</p>;
  }

  return (
    <div className="space-y-4">
      <SettingsCard title="견적·인원 학습">
        <p className="text-fluid-sm text-gray-600">
          <strong>예약확정(RECEIVED)</strong> 접수에서 평수·건축물·방/화/베·확정 금액·팀장·팀원 수를 자동으로
          모읍니다. 텔레CRM 견적 패널에 유사 사례 힌트로 표시됩니다.
        </p>
        {error ? (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-fluid-xs text-red-700">
            {error}
          </p>
        ) : null}
        {syncMessage ? (
          <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-fluid-xs text-emerald-800">
            {syncMessage}
          </p>
        ) : null}

        {overview ? (
          <>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-gray-200 bg-slate-50 p-3">
                <p className="text-fluid-2xs text-gray-500">학습 데이터</p>
                <p className="mt-1 text-xl font-semibold tabular-nums text-gray-900">
                  {overview.totalSnapshots.toLocaleString('ko-KR')}건
                </p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-slate-50 p-3">
                <p className="text-fluid-2xs text-gray-500">최근 7일 추가</p>
                <p className="mt-1 text-xl font-semibold tabular-nums text-gray-900">
                  +{overview.snapshotsLast7Days.toLocaleString('ko-KR')}건
                </p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-slate-50 p-3">
                <p className="text-fluid-2xs text-gray-500">마지막 반영</p>
                <p className="mt-1 text-fluid-sm font-medium text-gray-800">{formatWhen(overview.lastSnapshotAt)}</p>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-gray-200 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-fluid-sm font-medium text-gray-800">{overview.readinessLabel}</p>
                  <p className="mt-0.5 text-fluid-2xs text-gray-500">{overview.readinessHint}</p>
                </div>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-fluid-2xs text-gray-600">
                  30일 +{overview.snapshotsLast30Days}건
                </span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full transition-all ${READINESS_COLOR[overview.readiness]}`}
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void handleBackfill()}
                disabled={syncing}
                className="rounded-lg bg-slate-900 px-4 py-2 text-fluid-sm font-medium text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none"
              >
                {syncing ? '동기화 중…' : '예약확정 전체 동기화'}
              </button>
              <button
                type="button"
                onClick={() => void load()}
                disabled={loading || syncing}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-fluid-sm text-gray-700 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none"
              >
                새로고침
              </button>
            </div>
          </>
        ) : null}
      </SettingsCard>

      {overview && overview.topClusters.length > 0 ? (
        <SettingsCard title="자주 나온 조건 (상위)">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse text-fluid-xs">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-fluid-2xs text-gray-600">
                  <th className="px-2 py-2 text-center">조건</th>
                  <th className="px-2 py-2 text-center">건수</th>
                  <th className="px-2 py-2 text-center">중간 견적</th>
                  <th className="px-2 py-2 text-center">팀장</th>
                  <th className="px-2 py-2 text-center">팀원</th>
                </tr>
              </thead>
              <tbody>
                {overview.topClusters.map((row) => (
                  <tr key={row.featureKey} className="border-b border-gray-100">
                    <td className="px-2 py-2 text-center">
                      <span className="line-clamp-2" title={row.label}>
                        {row.label}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-center tabular-nums">{row.count}</td>
                    <td className="px-2 py-2 text-center tabular-nums">
                      {row.medianAmountWon != null ? formatWon(row.medianAmountWon) : '—'}
                    </td>
                    <td className="px-2 py-2 text-center tabular-nums">{row.medianTeamLeaderCount}</td>
                    <td className="px-2 py-2 text-center tabular-nums">
                      {row.medianCrewMemberCount ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SettingsCard>
      ) : null}

      {overview ? (
        <SettingsCard title="최근 학습 반영">
          {overview.recent.length === 0 ? (
            <p className="text-fluid-sm text-gray-500">
              아직 학습 데이터가 없습니다. 예약확정 접수를 저장하거나 「전체 동기화」를 실행하세요.
            </p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {overview.recent.map((row) => (
                <li key={row.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-fluid-xs">
                  <span className="font-medium text-gray-800">
                    {row.inquiryNumber ?? row.inquiryId.slice(0, 8)}
                  </span>
                  <span className="text-gray-600">{row.customerName ?? '—'}</span>
                  <span className="text-gray-500">{row.featureLabel}</span>
                  <span className="tabular-nums text-gray-700">
                    {row.serviceTotalAmount != null ? formatWon(row.serviceTotalAmount) : '금액 —'}
                  </span>
                  <span className="text-gray-500">
                    팀장 {row.teamLeaderCount}
                    {row.crewMemberCount != null ? ` · 팀원 ${row.crewMemberCount}` : ''}
                  </span>
                  <span className="ml-auto text-fluid-2xs text-gray-400">{formatWhen(row.updatedAt)}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-fluid-2xs text-gray-500">
            접수·스케줄에서 예약확정 건을 수정·배정할 때마다 자동 반영됩니다.{' '}
            <Link to="/admin/inquiries" className="text-sky-700 underline hover:text-sky-900">
              서비스접수
            </Link>
          </p>
        </SettingsCard>
      ) : null}
    </div>
  );
}
