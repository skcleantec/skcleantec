import { useCallback, useEffect, useState } from 'react';
import {
  fetchCrmQuickSchedule,
  type CrmQuickScheduleItem,
  type CrmQuickScheduleList,
} from '../../../api/crmQuickSchedule';
import { fetchOrderFollowup, type OrderFollowupItem } from '../../../api/orderFollowups';
import { ORDER_FOLLOWUP_STATUS_LABEL, type OrderFollowupStatus } from '../../../constants/orderFollowupStatus';
import { getToken } from '../../../stores/auth';
import { resolveCrmOutboundPhone } from '../../../utils/crmContactPhone';
import type { CrmFollowupApplySnapshot } from '../../../utils/crmFollowupApply';
import { runTelecrmCallWithSoomgoAuto } from '../../../utils/soomgoCallAutoSend';
import { CrmRightSlideDrawer } from '../layout/CrmRightSlideDrawer';
import { formatFetchedAt, quickWhenBadge } from './quickScheduleDateLabel';

type Tab = 'all' | 'asap' | 'week';

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

export function CrmQuickScheduleDrawer({
  open,
  tab,
  onTabChange,
  operatingCompanyId,
  marketerName,
  onClose,
  onApplyFollowup,
  onApplySnapshot,
  onNotice,
}: {
  open: boolean;
  tab: Tab;
  onTabChange: (tab: Tab) => void;
  operatingCompanyId: string | null;
  marketerName?: string | null;
  onClose: () => void;
  onApplyFollowup: (item: OrderFollowupItem) => void;
  onApplySnapshot: (snapshot: CrmFollowupApplySnapshot) => void;
  onNotice: (message: string) => void;
}) {
  const [data, setData] = useState<CrmQuickScheduleList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const token = getToken();
    if (!token || !operatingCompanyId) return;
    setLoading(true);
    setError(null);
    try {
      setData(await fetchCrmQuickSchedule(token, operatingCompanyId));
    } catch (e) {
      setError(e instanceof Error ? e.message : '빠른일정을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [operatingCompanyId]);

  useEffect(() => {
    if (!open) return;
    void load();
  }, [open, load]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const today = data?.todayYmd ?? '';
  const counts = data?.counts ?? { all: 0, asap: 0, week: 0 };
  const rows = (data?.items ?? []).filter((row) => (tab === 'asap' ? row.preferredKind === 'ASAP' : tab === 'week' ? row.preferredKind !== 'ASAP' : true));
  const todayLabel = today ? `${Number(today.slice(5, 7))}/${Number(today.slice(8, 10))}` : '';

  async function fill(row: CrmQuickScheduleItem) {
    if (row.followup) {
      const token = getToken();
      if (!token) return;
      const res = await fetchOrderFollowup(token, row.followup.id);
      onApplyFollowup(res.item);
      return;
    }
    onApplySnapshot({
      followupId: '',
      inquiryId: row.inquiryId,
      customerName: row.customerName,
      nickname: row.nickname?.trim() ?? '',
      contactPhone: row.customerPhone,
      safePhone: '',
      requestMemo: row.preferredAnswerRaw ? `희망일 답변: ${row.preferredAnswerRaw}` : '',
      address: row.address?.trim() ?? '',
      pyeong: row.areaPyeong != null ? String(row.areaPyeong) : '',
      roomCount: '',
      bathroomCount: '',
      balconyCount: '',
      kind: 'requested',
      goldDb: false,
      preferredMoveInCleanYmd: row.preferredKind === 'DATE' || row.preferredKind === 'WITHIN_WEEK' ? row.preferredYmd ?? '' : '',
      leadSource: row.leadSource,
    });
  }

  async function handleLoad(row: CrmQuickScheduleItem) {
    setBusyId(row.id);
    setError(null);
    try {
      await fill(row);
    } catch (e) {
      setError(e instanceof Error ? e.message : '고객을 불러오지 못했습니다.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleCall(row: CrmQuickScheduleItem) {
    const token = getToken();
    if (!token) return;
    const dial = resolveCrmOutboundPhone(row.customerPhone, row.followup?.customerPhone2 ?? '');
    if (dial.replace(/\D/g, '').length < 8) {
      setError('통화할 연락처가 없습니다.');
      return;
    }
    setBusyId(row.id);
    setError(null);
    try {
      await fill(row);
      const { autoNotice, callNotice } = await runTelecrmCallWithSoomgoAuto({
        token,
        dialPhone: dial,
        telecrmCallOpts: row.inquiryId
          ? { customerMatch: 'existing', inquiryId: row.inquiryId }
          : { customerMatch: 'new' },
        soomgoCtx: {
          operatingCompanyId,
          customerName: row.customerName,
          nickname: row.nickname ?? '',
          marketerName: marketerName ?? undefined,
        },
      });
      const notice = autoNotice ?? callNotice;
      if (notice) onNotice(notice);
    } catch (e) {
      setError(e instanceof Error ? e.message : '전화를 연결하지 못했습니다.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <CrmRightSlideDrawer
      open={open}
      title="빠른일정"
      onClose={onClose}
      widthClass="w-full max-w-[1120px]"
    >
      <div className="flex min-h-0 flex-col gap-3">
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
            <table className="w-full min-w-[1040px] table-fixed border-collapse text-center text-[12px]">
              <thead>
                <tr className="border-b border-slate-200/60 bg-slate-50">
                  {['고객', '연락처', '유입', '원하는 날', '고객 답변', '서비스', '지역·평수', '상태', '부재', '담당', '가져온 시각', ''].map((label) => (
                    <th key={label || 'act'} className="px-1.5 py-2 font-semibold text-slate-500">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const badge = quickWhenBadge(row.preferredKind, row.preferredYmd, today);
                  return (
                    <tr key={row.id} className="border-b border-slate-100">
                      <td className="px-1.5 py-2 text-left">
                        <p className="truncate font-medium text-slate-900">{row.customerName}</p>
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
                            onClick={() => void handleCall(row)}
                            className="inline-flex h-7 items-center rounded-lg border border-emerald-300 bg-white px-2 text-[11px] font-medium text-emerald-800 hover:bg-emerald-50 disabled:opacity-50"
                          >
                            전화
                          </button>
                          <button
                            type="button"
                            disabled={busyId === row.id}
                            onClick={() => void handleLoad(row)}
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
    </CrmRightSlideDrawer>
  );
}
