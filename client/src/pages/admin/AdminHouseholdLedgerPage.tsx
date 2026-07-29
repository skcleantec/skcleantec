import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageTitleWithFavorite } from '../../components/layout/NavFavoritePageTitle';
import { getToken } from '../../stores/auth';
import {
  getAdminHouseholdLedgerEntries,
  getAdminHouseholdLedgerTeamLeaders,
  type AdminHouseholdLedgerListResponse,
  type AdminHouseholdLedgerTeamLeader,
} from '../../api/adminHouseholdLedger';
import { YearMonthSelect, YmdSelect } from '../../components/ui/DateQuerySelects';
import { ListPaginationBar } from '../../components/ui/ListPaginationBar';
import {
  parseInquiryListPageSize,
  parseListPage,
  type InquiryListPageSize,
} from '../../utils/listPagination';
import { kstTodayYmd } from '../../utils/dateFormat';

type DatePreset = 'today' | 'all' | 'month' | 'day';

function kstMonthKeyNow(): string {
  return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 7);
}

function parseDatePreset(raw: string | null): DatePreset {
  if (raw === 'today' || raw === 'all' || raw === 'month' || raw === 'day') return raw;
  return 'month';
}

function won(n: number): string {
  return `${n.toLocaleString('ko-KR')}원`;
}

function leaderLabel(l: AdminHouseholdLedgerTeamLeader): string {
  return l.name?.trim() || l.email?.trim() || l.id.slice(0, 8);
}

export function AdminHouseholdLedgerPage() {
  const token = getToken();
  const [searchParams, setSearchParams] = useSearchParams();

  const teamLeaderId = searchParams.get('teamLeaderId') ?? '';
  const datePreset = parseDatePreset(searchParams.get('datePreset'));
  const monthKey = useMemo(() => {
    const m = searchParams.get('month');
    if (m && /^\d{4}-\d{2}$/.test(m)) return m;
    return kstMonthKeyNow();
  }, [searchParams]);
  const dayKey = useMemo(() => {
    const d = searchParams.get('day');
    if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
    return kstTodayYmd();
  }, [searchParams]);
  const page = parseListPage(searchParams.get('page'));
  const pageSize = parseInquiryListPageSize(searchParams.get('pageSize'));

  const [leaders, setLeaders] = useState<AdminHouseholdLedgerTeamLeader[]>([]);
  const [loadingLeaders, setLoadingLeaders] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AdminHouseholdLedgerListResponse | null>(null);

  const patchParams = useCallback(
    (patch: (next: URLSearchParams) => void) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          patch(next);
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  useEffect(() => {
    if (!token) return;
    setLoadingLeaders(true);
    void getAdminHouseholdLedgerTeamLeaders(token)
      .then((res) => setLeaders(res.items))
      .catch(() => setLeaders([]))
      .finally(() => setLoadingLeaders(false));
  }, [token]);

  useEffect(() => {
    if (!token || !teamLeaderId) {
      setData(null);
      return;
    }
    setLoading(true);
    setError(null);
    const offset = (page - 1) * pageSize;
    void getAdminHouseholdLedgerEntries(token, {
      teamLeaderId,
      datePreset,
      month: datePreset === 'month' ? monthKey : undefined,
      day: datePreset === 'day' || datePreset === 'today' ? dayKey : undefined,
      limit: pageSize,
      offset,
    })
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : '조회에 실패했습니다.'))
      .finally(() => setLoading(false));
  }, [token, teamLeaderId, datePreset, monthKey, dayKey, page, pageSize]);

  const presetBtn = (preset: DatePreset, label: string) => (
    <button
      type="button"
      onClick={() =>
        patchParams((n) => {
          n.set('datePreset', preset);
          n.set('page', '1');
        })
      }
      className={`rounded-lg px-3 py-1.5 text-fluid-xs font-semibold ${
        datePreset === preset ? 'bg-slate-900 text-white' : 'border border-slate-200 text-slate-700'
      }`}
    >
      {label}
    </button>
  );

  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  return (
    <div className="flex min-w-0 w-full max-w-full flex-col gap-4">
      <PageTitleWithFavorite label="팀장 가계부">
        <h1 className="text-fluid-lg font-semibold text-gray-900">팀장 가계부</h1>
      </PageTitleWithFavorite>

      <p className="text-fluid-sm text-slate-600">
        팀장 개인 가계부를 열람만 할 수 있습니다. 수정·삭제는 팀장 앱에서만 가능합니다.
      </p>

      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        <label className="mb-3 block max-w-md">
          <span className="mb-1 block text-fluid-xs font-medium text-gray-600">팀장</span>
          <select
            value={teamLeaderId}
            disabled={loadingLeaders}
            onChange={(e) =>
              patchParams((n) => {
                n.set('teamLeaderId', e.target.value);
                n.set('page', '1');
              })
            }
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-fluid-sm"
          >
            <option value="">팀장 선택</option>
            {leaders.map((l) => (
              <option key={l.id} value={l.id}>
                {leaderLabel(l)}
                {l.email ? ` (${l.email})` : ''}
              </option>
            ))}
          </select>
        </label>

        {teamLeaderId ? (
          <>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="text-fluid-xs font-medium text-slate-500">기준일</span>
              {presetBtn('today', '당일')}
              {presetBtn('all', '전체')}
              {presetBtn('month', '월별')}
              {presetBtn('day', '날짜')}
              {datePreset === 'month' ? (
                <YearMonthSelect
                  value={monthKey}
                  onChange={(ym) =>
                    patchParams((n) => {
                      n.set('month', ym);
                      n.set('page', '1');
                    })
                  }
                />
              ) : null}
              {datePreset === 'day' ? (
                <YmdSelect
                  value={dayKey}
                  onChange={(ymd) =>
                    patchParams((n) => {
                      n.set('day', ymd);
                      n.set('page', '1');
                    })
                  }
                />
              ) : null}
            </div>

            {data ? (
              <div className="mb-3 grid grid-cols-3 gap-3">
                <div className="rounded-lg border border-emerald-100 bg-emerald-50/80 p-3 text-center">
                  <p className="text-fluid-2xs text-emerald-800">수입</p>
                  <p className="text-fluid-sm font-bold tabular-nums text-emerald-900">
                    {won(data.summary.incomeTotal)}
                  </p>
                </div>
                <div className="rounded-lg border border-rose-100 bg-rose-50/80 p-3 text-center">
                  <p className="text-fluid-2xs text-rose-800">지출</p>
                  <p className="text-fluid-sm font-bold tabular-nums text-rose-900">
                    {won(data.summary.expenseTotal)}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-center">
                  <p className="text-fluid-2xs text-slate-600">순수익</p>
                  <p className="text-fluid-sm font-bold tabular-nums text-slate-900">
                    {won(data.summary.netTotal)}
                  </p>
                </div>
              </div>
            ) : null}

            <ListPaginationBar
              mode="summary"
              page={page}
              pageSize={pageSize}
              total={total}
              onPageChange={(p) => patchParams((n) => n.set('page', String(p)))}
              onPageSizeChange={(s: InquiryListPageSize) =>
                patchParams((n) => {
                  n.set('pageSize', String(s));
                  n.set('page', '1');
                })
              }
            />

            {error ? <p className="py-6 text-center text-fluid-sm text-red-600">{error}</p> : null}
            {loading && items.length === 0 ? (
              <p className="py-8 text-center text-fluid-sm text-slate-500">불러오는 중…</p>
            ) : null}
            {!loading && items.length === 0 && !error ? (
              <p className="py-8 text-center text-fluid-sm text-slate-500">기록이 없습니다.</p>
            ) : null}

            {items.length > 0 ? (
              <>
                <div className="w-full min-w-0 overflow-x-auto">
                  <table className="w-full table-fixed border-collapse text-fluid-xs">
                    <colgroup>
                      <col className="w-[88px]" />
                      <col className="w-[56px]" />
                      <col className="w-[100px]" />
                      <col />
                      <col className="w-[110px]" />
                    </colgroup>
                    <thead>
                      <tr className="bg-gray-100 text-fluid-2xs text-gray-700">
                        <th className="px-2 py-2 text-center">날짜</th>
                        <th className="px-2 py-2 text-center">구분</th>
                        <th className="px-2 py-2 text-center">카테고리</th>
                        <th className="px-2 py-2 text-center">메모·접수</th>
                        <th className="px-2 py-2 text-center">금액</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((row) => (
                        <tr key={row.id} className="border-t border-gray-100">
                          <td className="px-2 py-2 text-center tabular-nums">{row.occurredOn}</td>
                          <td className="px-2 py-2 text-center">
                            {row.direction === 'INCOME' ? '수입' : '지출'}
                          </td>
                          <td className="truncate px-2 py-2 text-center">{row.category}</td>
                          <td className="truncate px-2 py-2 text-center text-fluid-2xs text-slate-600">
                            {row.memo?.trim() ||
                              [row.inquiryNumber, row.customerName].filter(Boolean).join(' · ') ||
                              '—'}
                          </td>
                          <td
                            className={`px-2 py-2 text-right tabular-nums font-semibold ${
                              row.direction === 'INCOME' ? 'text-emerald-800' : 'text-rose-800'
                            }`}
                          >
                            {row.direction === 'EXPENSE' ? '-' : ''}
                            {won(row.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!loading ? (
                  <ListPaginationBar
                    mode="nav"
                    page={page}
                    pageSize={pageSize}
                    total={total}
                    onPageChange={(p) => patchParams((n) => n.set('page', String(p)))}
                    onPageSizeChange={(s: InquiryListPageSize) =>
                      patchParams((n) => {
                        n.set('pageSize', String(s));
                        n.set('page', '1');
                      })
                    }
                  />
                ) : null}
              </>
            ) : null}
          </>
        ) : (
          <p className="py-8 text-center text-fluid-sm text-slate-500">팀장을 선택하면 가계부를 볼 수 있습니다.</p>
        )}
      </div>
    </div>
  );
}
