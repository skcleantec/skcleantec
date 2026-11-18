import { useCallback, useEffect, useState } from 'react';
import {
  fetchCrmQuickSchedule,
  type CrmQuickScheduleItem,
  type CrmQuickScheduleList,
} from '../../../api/crmQuickSchedule';
import { ORDER_FOLLOWUP_STATUS_LABEL, type OrderFollowupStatus } from '../../../constants/orderFollowupStatus';
import { getToken } from '../../../stores/auth';
import { subscribeCrmQuickSchedule } from '../../../utils/crmQuickScheduleChannel';
import { formatFetchedAt, formatKstClock, quickWhenBadge } from './quickScheduleDateLabel';

export type CrmQuickScheduleTab = 'all' | 'asap' | 'week';

const BADGE = {
  orange: 'bg-orange-50 text-orange-800',
  rose: 'bg-rose-50 text-rose-800',
  amber: 'bg-amber-50 text-amber-900',
  slate: 'bg-slate-100 text-slate-700',
} as const;

function statusLabel(status: string): string {
  if (status in ORDER_FOLLOWUP_STATUS_LABEL) return ORDER_FOLLOWUP_STATUS_LABEL[status as OrderFollowupStatus];
  return '-';
}

function areaText(row: CrmQuickScheduleItem): string {
  const place = row.address?.trim() || '';
  const pyeong = row.areaPyeong != null ? `${row.areaPyeong}평` : '';
  return [place, pyeong].filter(Boolean).join(' · ') || '-';
}

export function CrmQuickScheduleBody({
  variant,
  enabled,
  operatingCompanyId,
  tab,
  onTabChange,
  onLoad,
  onCall,
}: {
  variant: 'drawer' | 'window';
  enabled: boolean;
  operatingCompanyId: string | null;
  tab: CrmQuickScheduleTab;
  onTabChange: (tab: CrmQuickScheduleTab) => void;
  onLoad: (row: CrmQuickScheduleItem) => Promise<void> | void;
  onCall: (row: CrmQuickScheduleItem) => Promise<void> | void;
}) {
  const [data, setData] = useState<CrmQuickScheduleList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  /** 마지막으로 누른(선택한) 행 — 새로고침 뒤에도 같은 고객이면 계속 표시 */
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    const token = getToken();
    if (!token || !operatingCompanyId) return;
    setLoading(true);
    setError(null);
    try {
      setData(await fetchCrmQuickSchedule(token, operatingCompanyId));
      setRefreshedAt(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : '빠른일정을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [operatingCompanyId]);

  useEffect(() => {
    if (!enabled) return;
    void load();
  }, [enabled, load]);

  useEffect(() => {
    if (!enabled) return;
    const timer = window.setInterval(() => void load(), 60_000);
    const onRefresh = () => void load();
    window.addEventListener('crm-quick-schedule-refresh', onRefresh);
    const unsubscribe = subscribeCrmQuickSchedule((message) => {
      if (message.type === 'refresh') onRefresh();
    });
    const onFocus = () => {
      if (variant === 'window') void load();
    };
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('crm-quick-schedule-refresh', onRefresh);
      window.removeEventListener('focus', onFocus);
      unsubscribe();
    };
  }, [enabled, load, variant]);

  async function run(row: CrmQuickScheduleItem, action: (row: CrmQuickScheduleItem) => Promise<void> | void) {
    setBusyId(row.id);
    setError(null);
    try {
      await action(row);
    } catch (e) {
      setError(e instanceof Error ? e.message : '처리하지 못했습니다.');
    } finally {
      setBusyId(null);
    }
  }

  const today = data?.todayYmd ?? '';
  const counts = data?.counts ?? { all: 0, asap: 0, week: 0 };
  const rows = (data?.items ?? []).filter((row) =>
    tab === 'asap' ? row.preferredKind === 'ASAP' : tab === 'week' ? row.preferredKind !== 'ASAP' : true,
  );
  const todayLabel = today ? `${Number(today.slice(5, 7))}/${Number(today.slice(8, 10))}` : '';

  return (
    <div className="flex min-h-0 flex-col gap-3">
      {variant === 'window' ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[13px] font-semibold text-slate-900">
            빠른일정
            <span className="ml-2 font-normal text-slate-500">
              오늘({todayLabel || '—'}) 기준 · 예약 끝난 고객 제외
            </span>
          </p>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400">마지막 갱신 {refreshedAt ? formatKstClock(refreshedAt) : '—'}</span>
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex h-7 items-center rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
            >
              새로고침
            </button>
          </div>
        </div>
      ) : null}
      <p className="text-[12px] text-slate-500">
        빈 일정을 급하게 채울 때 먼저 연락할 고객이에요. 오늘({todayLabel || '—'}) 기준 · 예약 끝난 고객 제외
      </p>
      <div className="flex flex-wrap gap-1.5">
        {(
          [
            ['all', `전체 ${counts.all}`],
            ['asap', `가장 빠른 ${counts.asap}`],
            ['week', `7일 이내 ${counts.week}`],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => onTabChange(id)}
            className={`inline-flex h-7 items-center rounded-lg px-2.5 text-[12px] font-medium ${
              tab === id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-[12px] text-red-700">{error}</p> : null}
      {loading && !data ? (
        <p className="py-8 text-center text-[12px] text-slate-500">불러오는 중…</p>
      ) : rows.length === 0 ? (
        <p className="py-8 text-center text-[12px] text-slate-500">지금 빠른일정 고객이 없어요.</p>
      ) : (
        <div className="overflow-x-auto overscroll-x-contain">
          <table className="w-full min-w-[1000px] table-fixed border-collapse text-center text-[12px]">
            <thead>
              <tr className="border-b border-slate-200/60 bg-slate-50">
                {['고객', '연락처', '유입', '원하는 날', '고객 답변', '서비스', '지역·평수', '상태', '부재', '담당', '가져온 시각', ''].map(
                  (label) => (
                    <th key={label || 'act'} className="px-1.5 py-2 font-semibold text-slate-500">
                      {label}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => {
                const badge = quickWhenBadge(row.preferredKind, row.preferredYmd, today);
                const selected = selectedId === row.id;
                const rowTone = selected
                  ? 'bg-sky-50 hover:bg-sky-100/70'
                  : idx % 2 === 1
                    ? 'bg-slate-50/70 hover:bg-slate-100'
                    : 'bg-white hover:bg-slate-100';
                return (
                  <tr
                    key={row.id}
                    onClick={() => setSelectedId(row.id)}
                    aria-selected={selected}
                    className={`cursor-pointer border-b border-slate-200/70 transition-colors ${rowTone}`}
                  >
                    <td
                      className={`px-1.5 py-2 text-left ${
                        selected ? 'shadow-[inset_3px_0_0_0_#0284c7]' : ''
                      }`}
                    >
                      <p className={`truncate font-medium ${selected ? 'text-sky-900' : 'text-slate-900'}`}>
                        {row.customerName}
                      </p>
                      {row.nickname ? <p className="truncate text-[11px] text-slate-500">{row.nickname}</p> : null}
                    </td>
                    <td className="truncate px-1.5 py-2 text-slate-800">{row.customerPhone}</td>
                    <td className="px-1.5 py-2">
                      <span
                        className={`inline-flex rounded-full px-1.5 py-0.5 text-[11px] font-medium ${
                          row.leadSource === '미소' ? 'bg-violet-50 text-violet-700' : 'bg-sky-50 text-sky-700'
                        }`}
                      >
                        {row.leadSource}
                      </span>
                    </td>
                    <td className="px-1.5 py-2">
                      <span className={`inline-flex rounded-full px-1.5 py-0.5 text-[11px] font-medium ${BADGE[badge.tone]}`}>
                        {badge.text}
                      </span>
                    </td>
                    <td className="truncate px-1.5 py-2 text-left text-slate-600" title={row.preferredAnswerRaw}>
                      {row.preferredAnswerRaw ? `“${row.preferredAnswerRaw}”` : '-'}
                    </td>
                    <td className="truncate px-1.5 py-2 text-slate-700">{row.serviceType?.trim() || '-'}</td>
                    <td className="truncate px-1.5 py-2 text-slate-700" title={areaText(row)}>
                      {areaText(row)}
                    </td>
                    <td className="px-1.5 py-2 text-slate-700">{row.followup ? statusLabel(row.followup.status) : '-'}</td>
                    <td className="px-1.5 py-2 text-slate-700">{row.followup ? `${row.followup.deferCount}회` : '-'}</td>
                    <td className="truncate px-1.5 py-2 text-slate-700">{row.followup?.handlerName || '-'}</td>
                    <td className="whitespace-nowrap px-1.5 py-2 text-slate-500">{formatFetchedAt(row.fetchedAt)}</td>
                    <td className="px-1.5 py-2">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          disabled={busyId === row.id}
                          onClick={() => void run(row, onCall)}
                          className="inline-flex h-7 items-center rounded-lg border border-emerald-300 bg-white px-2 text-[11px] font-medium text-emerald-800 hover:bg-emerald-50 disabled:opacity-50"
                        >
                          전화
                        </button>
                        <button
                          type="button"
                          disabled={busyId === row.id}
                          onClick={() => void run(row, onLoad)}
                          className="inline-flex h-7 items-center rounded-lg bg-slate-900 px-2 text-[11px] font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                        >
                          불러오기
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[11px] text-slate-400">
        「정보 가져오기」의 「서비스를 받고 싶은 날이 언제인가요?」 답변으로 골라요. 협의 가능·상관없음은 빠져요.
      </p>
    </div>
  );
}
