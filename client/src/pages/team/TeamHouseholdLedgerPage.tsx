import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { isAuthSessionExpiredError } from '../../api/auth';
import {
  createTeamHouseholdLedgerEntry,
  deleteTeamHouseholdLedgerEntry,
  getTeamHouseholdLedgerCategories,
  getTeamHouseholdLedgerEntries,
  syncTeamHouseholdLedgerFromAssignments,
  updateTeamHouseholdLedgerEntry,
  type HouseholdLedgerEntry,
  type HouseholdLedgerListResponse,
} from '../../api/teamHouseholdLedger';
import { clearTeamToken, getTeamToken } from '../../stores/teamAuth';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { YearMonthSelect, YmdSelect } from '../../components/ui/DateQuerySelects';
import { ListPaginationBar } from '../../components/ui/ListPaginationBar';
import {
  parseInquiryListPageSize,
  parseListPage,
  type InquiryListPageSize,
} from '../../utils/listPagination';
import { kstTodayYmd } from '../../utils/dateFormat';
import { TeamHouseholdLedgerEntryModal } from '../../components/team/TeamHouseholdLedgerEntryModal';
import { SyncHorizontalScroll } from '../../components/ui/SyncHorizontalScroll';
import { TeamBiInline } from '../../i18n/team/teamI18n';

type DatePreset = 'today' | 'all' | 'month' | 'day';

function kstMonthKeyNow(): string {
  return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 7);
}

function parseDatePreset(raw: string | null): DatePreset {
  if (raw === 'today' || raw === 'all' || raw === 'month' || raw === 'day') return raw;
  return 'all';
}

function won(n: number): string {
  return `${n.toLocaleString('ko-KR')}원`;
}

function directionLabel(d: HouseholdLedgerEntry['direction']): string {
  return d === 'INCOME' ? '수입' : '지출';
}

export function TeamHouseholdLedgerPage() {
  const token = getTeamToken();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

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

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<HouseholdLedgerListResponse | null>(null);
  const [categories, setCategories] = useState<Awaited<ReturnType<typeof getTeamHouseholdLedgerCategories>> | null>(
    null,
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<HouseholdLedgerEntry | null>(null);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);

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

  const fetchList = useCallback(
    async (silent = false) => {
      if (!token) return;
      if (!silent) setLoading(true);
      setError(null);
      try {
        const offset = (page - 1) * pageSize;
        const res = await getTeamHouseholdLedgerEntries(token, {
          datePreset,
          month: datePreset === 'month' ? monthKey : undefined,
          day: datePreset === 'day' || datePreset === 'today' ? dayKey : undefined,
          limit: pageSize,
          offset,
        });
        setData(res);
      } catch (e) {
        if (isAuthSessionExpiredError(e)) {
          clearTeamToken();
          navigate('/login');
          return;
        }
        setError(e instanceof Error ? e.message : '목록을 불러올 수 없습니다.');
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [token, navigate, datePreset, monthKey, dayKey, page, pageSize],
  );

  useEffect(() => {
    if (!token) return;
    void getTeamHouseholdLedgerCategories(token)
      .then(setCategories)
      .catch(() => setCategories(null));
  }, [token]);

  useEffect(() => {
    void fetchList();
  }, [fetchList]);

  const handleDelete = async (entry: HouseholdLedgerEntry) => {
    if (!token) return;
    if (!window.confirm('이 항목을 삭제할까요?')) return;
    try {
      await deleteTeamHouseholdLedgerEntry(token, entry.id);
      await fetchList(true);
    } catch (e) {
      alert(e instanceof Error ? e.message : '삭제에 실패했습니다.');
    }
  };

  const handleSyncAssignments = async () => {
    if (!token) return;
    if (
      !window.confirm(
        '본인에게 배정된 접수의 예약금·잔금·추가결재·DB 구입비를 가계부에 불러옵니다.\n이미 추가된 항목은 건너뜁니다. 진행할까요?',
      )
    ) {
      return;
    }
    setSyncing(true);
    try {
      const result = await syncTeamHouseholdLedgerFromAssignments(token);
      patchParams((n) => {
        n.set('datePreset', 'all');
        n.set('page', '1');
      });
      const res = await getTeamHouseholdLedgerEntries(token, {
        datePreset: 'all',
        limit: pageSize,
        offset: 0,
      });
      setData(res);
      alert(
        `불러오기 완료\n· 배정 접수 ${result.inquiryCount}건\n· 새로 추가 ${result.created}건\n· 갱신 ${result.updated}건\n· 제거 ${result.removed}건`,
      );
    } catch (e) {
      alert(e instanceof Error ? e.message : '불러오기에 실패했습니다.');
    } finally {
      setSyncing(false);
    }
  };

  const handleSave = async (payload: Parameters<typeof createTeamHouseholdLedgerEntry>[1]) => {
    if (!token) return;
    setSaving(true);
    try {
      if (editing) {
        await updateTeamHouseholdLedgerEntry(token, editing.id, payload);
      } else {
        await createTeamHouseholdLedgerEntry(token, payload);
      }
      setEditing(null);
      await fetchList(true);
    } finally {
      setSaving(false);
    }
  };

  const presetBtn = (preset: DatePreset, label: string) => (
    <button
      type="button"
      onClick={() =>
        patchParams((n) => {
          n.set('datePreset', preset);
          n.set('page', '1');
        })
      }
      className={`rounded-lg px-2.5 py-1.5 text-fluid-2xs font-semibold sm:px-3 sm:text-fluid-xs ${
        datePreset === preset ? 'bg-slate-900 text-white' : 'border border-slate-200 text-slate-700'
      }`}
    >
      {label}
    </button>
  );

  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  return (
    <div className="flex min-w-0 w-full max-w-full flex-col gap-2 sm:gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-fluid-base font-bold text-slate-900 sm:text-lg">
          <TeamBiInline id="team.layout.nav.householdLedger" />
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={syncing}
            onClick={() => void handleSyncAssignments()}
            className="min-h-9 rounded-lg border border-slate-300 bg-white px-3 text-fluid-2xs font-semibold text-slate-800 disabled:opacity-60 sm:min-h-10 sm:px-4 sm:text-fluid-xs"
          >
            {syncing ? '불러오는 중…' : '배정 접수 불러오기'}
          </button>
          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setModalOpen(true);
            }}
            className="min-h-9 rounded-lg bg-slate-900 px-3 text-fluid-2xs font-semibold text-white sm:min-h-10 sm:px-4 sm:text-fluid-xs"
          >
            직접 추가
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-2 sm:rounded-2xl sm:p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-fluid-2xs font-medium text-slate-500 sm:text-fluid-xs">기준일</span>
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
          <div className="mb-3 grid grid-cols-3 gap-2 sm:gap-3">
            <div className="rounded-lg border border-emerald-100 bg-emerald-50/80 p-2 text-center sm:p-3">
              <p className="text-fluid-2xs text-emerald-800">수입</p>
              <p className="text-fluid-xs font-bold tabular-nums text-emerald-900 sm:text-fluid-sm">
                {won(data.summary.incomeTotal)}
              </p>
            </div>
            <div className="rounded-lg border border-rose-100 bg-rose-50/80 p-2 text-center sm:p-3">
              <p className="text-fluid-2xs text-rose-800">지출</p>
              <p className="text-fluid-xs font-bold tabular-nums text-rose-900 sm:text-fluid-sm">
                {won(data.summary.expenseTotal)}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-center sm:p-3">
              <p className="text-fluid-2xs text-slate-600">순수익</p>
              <p className="text-fluid-xs font-bold tabular-nums text-slate-900 sm:text-fluid-sm">
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
            <p className="mb-2 text-fluid-2xs text-slate-500 lg:hidden">표는 좌우로 스크롤할 수 있습니다.</p>
            <SyncHorizontalScroll>
              <div
                className="w-full min-w-0 max-w-full overflow-x-auto overscroll-x-contain -mx-4 px-4 sm:mx-0 sm:px-0"
                style={{ WebkitOverflowScrolling: 'touch' }}
              >
                <table className="w-full min-w-[540px] table-fixed border-collapse text-fluid-2xs sm:text-fluid-xs">
                  <colgroup>
                    <col className="w-[72px] sm:w-[88px]" />
                    <col className="w-[44px] sm:w-[56px]" />
                    <col className="w-[72px] sm:w-[100px]" />
                    <col />
                    <col className="w-[84px] sm:w-[110px]" />
                    <col className="w-[88px] sm:w-[120px]" />
                  </colgroup>
                  <thead>
                    <tr className="bg-gray-100 text-gray-700">
                      <th className="px-1 py-1.5 text-center sm:px-2 sm:py-2">날짜</th>
                      <th className="px-1 py-1.5 text-center sm:px-2 sm:py-2">구분</th>
                      <th className="px-1 py-1.5 text-center sm:px-2 sm:py-2">카테고리</th>
                      <th className="px-1 py-1.5 text-center sm:px-2 sm:py-2">메모·접수</th>
                      <th className="px-1 py-1.5 text-center sm:px-2 sm:py-2">금액</th>
                      <th className="px-1 py-1.5 text-center sm:px-2 sm:py-2">관리</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((row) => (
                      <tr key={row.id} className="border-t border-gray-100 hover:bg-gray-50">
                        <td className="px-1 py-1.5 text-center tabular-nums sm:px-2 sm:py-2" title={row.occurredOn}>
                          <span className="sm:hidden">{row.occurredOn.slice(5)}</span>
                          <span className="hidden sm:inline">{row.occurredOn}</span>
                        </td>
                        <td className="px-1 py-1.5 text-center sm:px-2 sm:py-2">
                          <span
                            className={
                              row.direction === 'INCOME' ? 'text-emerald-700' : 'text-rose-700'
                            }
                          >
                            {directionLabel(row.direction)}
                          </span>
                        </td>
                        <td className="truncate px-1 py-1.5 text-center sm:px-2 sm:py-2" title={row.category}>
                          {row.category}
                        </td>
                        <td className="truncate px-1 py-1.5 text-center text-slate-600 sm:px-2 sm:py-2" title={row.memo?.trim() || [row.inquiryNumber, row.customerName].filter(Boolean).join(' · ') || undefined}>
                          {row.memo?.trim() ||
                            [row.inquiryNumber, row.customerName].filter(Boolean).join(' · ') ||
                            '—'}
                        </td>
                        <td
                          className={`px-1 py-1.5 text-right tabular-nums font-semibold sm:px-2 sm:py-2 ${
                            row.direction === 'INCOME' ? 'text-emerald-800' : 'text-rose-800'
                          }`}
                        >
                          {row.direction === 'EXPENSE' ? '-' : ''}
                          {won(row.amount)}
                        </td>
                        <td className="px-1 py-1.5 text-center sm:px-2 sm:py-2">
                          <div className="flex items-center justify-center gap-0.5 sm:gap-1">
                            <button
                              type="button"
                              className="rounded border border-slate-200 px-1.5 py-0.5 text-fluid-2xs sm:px-2"
                              onClick={() => {
                                setEditing(row);
                                setModalOpen(true);
                              }}
                            >
                              수정
                            </button>
                            <button
                              type="button"
                              className="rounded border border-rose-200 px-1.5 py-0.5 text-fluid-2xs text-rose-700 sm:px-2"
                              onClick={() => void handleDelete(row)}
                            >
                              삭제
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SyncHorizontalScroll>

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
      </div>

      <p className="text-fluid-2xs text-slate-500">
        배정·접수 금액 변경 시 가계부에 자동 반영됩니다. 예약금 포함 여부는 관리자 「사용자 등록 → 가계부
        예약금」에서 정합니다.{' '}
        <strong className="font-semibold text-slate-700">배정 접수 불러오기</strong>는 과거 건을 한 번에
        맞출 때 사용하세요.
      </p>

      <TeamHouseholdLedgerEntryModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        categories={categories}
        editing={editing}
        saving={saving}
        onSubmit={handleSave}
      />
    </div>
  );
}

export function TeamHouseholdLedgerFromInquiryLink({
  inquiryId,
  className,
}: {
  inquiryId: string;
  className?: string;
}) {
  return (
    <Link
      to={`/team/household-ledger?prefillInquiry=${encodeURIComponent(inquiryId)}`}
      className={className ?? 'text-fluid-2xs font-semibold text-sky-700 underline'}
    >
      가계부에서 보기
    </Link>
  );
}
