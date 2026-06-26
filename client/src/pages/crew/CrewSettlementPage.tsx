import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Navigate, useOutletContext, useSearchParams } from 'react-router-dom';
import type { CrewLayoutContext } from '../../components/layout/CrewLayout';
import { getCrewToken } from '../../stores/crewAuth';
import {
  CrewSettlementGateError,
  getCrewSettlementPayrollSheet,
  getCrewSettlementPoolMemberDetail,
  pingCrewSettlementAccess,
  type CrewPoolMemberPayrollDetailDto,
  type CrewSettlementPayrollSheetRow,
} from '../../api/crew';
import { AuthSessionExpiredError } from '../../api/auth';
import { CrewBiLine, CrewBiInline, useCrewText } from '../../i18n/crew/crewI18n';
import { CrewTeamExpensesTab } from './CrewTeamExpensesTab';

const TAB_EXPENSES = 'expenses';

function sensitivePwdStorageKey(crewGroupId: string): string {
  return `crewSensitivePwd:${crewGroupId}`;
}

function hasStoredSettlementPwd(crewGroupId: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return Boolean(sessionStorage.getItem(sensitivePwdStorageKey(crewGroupId))?.trim());
  } catch {
    return false;
  }
}

function CrewSettlementMenuGate({
  crewGroupId,
  onUnlocked,
}: {
  crewGroupId: string;
  onUnlocked: () => void;
}) {
  const t = useCrewText();
  const [pwd, setPwd] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = () => {
    const token = getCrewToken();
    if (!token || !pwd.trim()) return;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        await pingCrewSettlementAccess(token, { sensitivePassword: pwd });
        try {
          sessionStorage.setItem(sensitivePwdStorageKey(crewGroupId), pwd.trim());
        } catch {
          /* ignore */
        }
        onUnlocked();
      } catch (e) {
        if (e instanceof CrewSettlementGateError) {
          setError(e.message);
          return;
        }
        setError(e instanceof Error ? e.message : t('crew.settlement.menuGateVerifyFail'));
      } finally {
        setLoading(false);
      }
    })();
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3 shadow-sm">
      <p className="text-fluid-xs text-gray-800 font-medium">
        <CrewBiLine id="crew.settlement.menuGateLead" />
      </p>
      <p className="text-fluid-2xs text-gray-500">
        <CrewBiLine id="crew.settlement.passwordHint" />
      </p>
      <input
        type="password"
        autoComplete="current-password"
        value={pwd}
        onChange={(e) => setPwd(e.target.value)}
        className="w-full max-w-sm px-3 py-2 border border-gray-300 rounded text-fluid-sm"
      />
      {error ? (
        <div className="text-fluid-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1.5">{error}</div>
      ) : null}
      <button
        type="button"
        disabled={loading || !pwd.trim()}
        onClick={() => submit()}
        className="px-4 py-2 rounded-lg bg-gray-900 text-white text-fluid-sm font-semibold hover:bg-gray-800 disabled:opacity-50"
      >
        <CrewBiLine id="crew.settlement.passwordSubmit" />
      </button>
    </div>
  );
}

function CrewSettlementIntroHint() {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const t = useCrewText();

  useEffect(() => {
    if (!open) return undefined;
    const onDocMouseDown = (e: MouseEvent) => {
      if (wrapRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div className="relative shrink-0 pt-0.5" ref={wrapRef}>
      <button
        type="button"
        className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-300 bg-white text-fluid-sm font-bold leading-none text-gray-600 hover:bg-gray-50 hover:border-gray-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
        aria-expanded={open}
        aria-controls="crew-settlement-intro-popover"
        aria-label={t('crew.settlement.pageIntroToggleAria')}
        title={t('crew.settlement.pageIntroToggleAria')}
        onClick={() => setOpen((v) => !v)}
      >
        ?
      </button>
      {open ? (
        <div
          id="crew-settlement-intro-popover"
          role="tooltip"
          className="absolute right-0 top-full z-30 mt-1.5 w-[min(calc(100vw-2rem),22rem)] rounded-lg border border-gray-200 bg-white p-3 shadow-lg"
        >
          <p className="text-fluid-2xs text-gray-700">
            <CrewBiLine id="crew.settlement.pageIntro" />
          </p>
        </div>
      ) : null}
    </div>
  );
}

export function CrewSettlementPage() {
  const outlet = useOutletContext<CrewLayoutContext | undefined>();
  const me = outlet?.me ?? null;
  const [searchParams, setSearchParams] = useSearchParams();
  const [, forceMenuRender] = useState(0);

  const canSeePayroll =
    me?.crewViewerRole === 'LEADER' || me?.crewJwtSource === 'preview';

  const needsLeaderMenuPassword =
    me != null && me.crewViewerRole === 'LEADER' && me.crewJwtSource !== 'preview';

  const menuUnlocked =
    !needsLeaderMenuPassword ||
    (me != null && hasStoredSettlementPwd(me.crewGroupId));

  const tabFromUrl = searchParams.get('tab') === TAB_EXPENSES ? TAB_EXPENSES : 'sheet';

  useEffect(() => {
    if (!canSeePayroll && tabFromUrl === 'sheet') {
      setSearchParams({ tab: TAB_EXPENSES }, { replace: true });
    }
  }, [canSeePayroll, tabFromUrl, setSearchParams]);

  const activeTab = !canSeePayroll ? TAB_EXPENSES : tabFromUrl;

  const setTab = (t: typeof TAB_EXPENSES | 'sheet') => {
    if (t === TAB_EXPENSES) {
      setSearchParams({ tab: TAB_EXPENSES }, { replace: true });
    } else {
      setSearchParams({}, { replace: true });
    }
  };

  if (!me) {
    return (
      <p className="text-fluid-sm text-gray-500 py-8 text-center">
        <CrewBiLine id="crew.common.loading" />
      </p>
    );
  }

  return (
    <div className="space-y-4 min-w-0">
      <div className="flex items-start justify-between gap-3 min-w-0">
        <h1 className="text-fluid-lg font-semibold text-gray-900 min-w-0 flex-1">
          <CrewBiLine id="crew.settlement.pageTitle" koClassName="text-fluid-lg font-semibold text-gray-900" />
        </h1>
        <CrewSettlementIntroHint />
      </div>

      {!menuUnlocked && needsLeaderMenuPassword ? (
        <CrewSettlementMenuGate
          crewGroupId={me.crewGroupId}
          onUnlocked={() => forceMenuRender((n) => n + 1)}
        />
      ) : (
        <>
          {canSeePayroll ? (
            <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-2">
              <button
                type="button"
                onClick={() => setTab('sheet')}
                className={`px-3 py-1.5 rounded-md text-fluid-xs font-medium ${
                  activeTab === 'sheet'
                    ? 'bg-gray-900 text-white'
                    : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                }`}
              >
                <CrewBiLine id="crew.settlement.tabSheet" />
              </button>
              <button
                type="button"
                onClick={() => setTab(TAB_EXPENSES)}
                className={`px-3 py-1.5 rounded-md text-fluid-xs font-medium ${
                  activeTab === TAB_EXPENSES
                    ? 'bg-gray-900 text-white'
                    : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                }`}
              >
                <CrewBiLine id="crew.settlement.tabExpenses" />
              </button>
            </div>
          ) : null}

          {activeTab === 'sheet' && canSeePayroll ? (
            <CrewSettlementSheetPanel me={me} />
          ) : (
            <CrewTeamExpensesTab variant="embedded" me={me} />
          )}
        </>
      )}
    </div>
  );
}

function CrewSettlementSheetPanel({ me }: { me: NonNullable<CrewLayoutContext['me']> }) {
  const t = useCrewText();
  const [month, setMonth] = useState(() => kstMonthKeyNow());
  const [rows, setRows] = useState<CrewSettlementPayrollSheetRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pwdGate, setPwdGate] = useState('');
  const [needsPwdUi, setNeedsPwdUi] = useState(false);
  const [detailMemberId, setDetailMemberId] = useState<string | null>(null);

  const preview = me.crewJwtSource === 'preview';

  const readStoredPwd = useCallback(() => {
    try {
      return sessionStorage.getItem(sensitivePwdStorageKey(me.crewGroupId)) ?? '';
    } catch {
      return '';
    }
  }, [me.crewGroupId]);

  const fetchSheet = useCallback(
    async (opts?: { overridePassword?: string }): Promise<void> => {
      const token = getCrewToken();
      if (!token) return;
      setLoading(true);
      setError(null);
      try {
        let sensitive: string | undefined;
        if (!preview) {
          if (opts && 'overridePassword' in opts) {
            sensitive = opts.overridePassword?.trim() || undefined;
          } else {
            const s = readStoredPwd().trim();
            sensitive = s || undefined;
          }
        }
        const data = await getCrewSettlementPayrollSheet(token, month, {
          sensitivePassword: sensitive,
        });
        setRows(data.rows);
        setNeedsPwdUi(false);
        if (!preview && sensitive) {
          try {
            sessionStorage.setItem(sensitivePwdStorageKey(me.crewGroupId), sensitive);
          } catch {
            /* ignore */
          }
        }
      } catch (e) {
        setRows([]);
        if (e instanceof AuthSessionExpiredError) throw e;
        if (e instanceof CrewSettlementGateError) {
          if (e.httpStatus === 401 && e.code === 'CREW_SENSITIVE_PASSWORD_REQUIRED') {
            setNeedsPwdUi(true);
            setError(null);
            try {
              sessionStorage.removeItem(sensitivePwdStorageKey(me.crewGroupId));
            } catch {
              /* ignore */
            }
            return;
          }
          if (e.code === 'CREW_SENSITIVE_PASSWORD_NOT_SET') {
            setNeedsPwdUi(false);
            setError(e.message);
            return;
          }
          setNeedsPwdUi(e.httpStatus === 403);
          setError(e.message);
          return;
        }
        setError(e instanceof Error ? e.message : t('crew.settlement.loadFail'));
      } finally {
        setLoading(false);
      }
    },
    [month, me.crewGroupId, preview, readStoredPwd, t],
  );

  useEffect(() => {
    if (preview) {
      void fetchSheet().catch(() => {});
      return;
    }
    const stored = readStoredPwd().trim();
    if (stored) {
      void fetchSheet().catch(() => {});
    } else {
      setNeedsPwdUi(true);
      setRows([]);
    }
  }, [fetchSheet, preview, readStoredPwd]);

  const submitPwd = () => {
    void fetchSheet({ overridePassword: pwdGate }).catch(() => {});
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-fluid-xs text-gray-600 whitespace-nowrap">
          <CrewBiLine id="crew.expenses.monthLabel" />
        </label>
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="px-2 py-1 border border-gray-300 rounded text-fluid-xs tabular-nums bg-white"
        />
      </div>

      {!preview && needsPwdUi ? (
        <div className="rounded-lg border border-gray-200 bg-white p-3 space-y-2 shadow-sm">
          <p className="text-fluid-sm text-gray-800 font-medium">
            <CrewBiLine id="crew.settlement.passwordPrompt" />
          </p>
          <p className="text-fluid-2xs text-gray-500">
            <CrewBiLine id="crew.settlement.passwordHint" />
          </p>
          <input
            type="password"
            autoComplete="current-password"
            value={pwdGate}
            onChange={(e) => setPwdGate(e.target.value)}
            className="w-full max-w-sm px-2 py-1.5 border border-gray-300 rounded text-fluid-xs"
            placeholder=""
          />
          <button
            type="button"
            disabled={loading || !pwdGate.trim()}
            onClick={() => submitPwd()}
            className="px-3 py-1.5 rounded-lg bg-gray-900 text-white text-fluid-xs font-semibold hover:bg-gray-800 disabled:opacity-50"
          >
            <CrewBiLine id="crew.settlement.passwordSubmit" />
          </button>
        </div>
      ) : null}

      {error ? (
        <div className="text-fluid-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-2 py-1.5">{error}</div>
      ) : null}

      {loading ? (
        <p className="text-fluid-sm text-gray-500 py-6 text-center">
          <CrewBiLine id="crew.common.loading" />
        </p>
      ) : !needsPwdUi || preview ? (
        rows.length === 0 ? (
          <p className="text-fluid-sm text-gray-500 py-6 text-center border border-dashed border-gray-200 rounded-lg bg-gray-50/60">
            <CrewBiLine id="crew.settlement.sheetEmpty" />
          </p>
        ) : (
          <CrewSettlementSheetTable rows={rows} onOpenDetail={(id) => setDetailMemberId(id)} />
        )
      ) : null}

      {detailMemberId ? (
        <CrewSettlementDetailModal
          teamMemberId={detailMemberId}
          month={month}
          preview={preview}
          readSensitivePwd={readStoredPwd}
          onClose={() => setDetailMemberId(null)}
        />
      ) : null}
    </div>
  );
}

function fmtWon(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(Number(n))) return '—';
  return `${Number(n).toLocaleString('ko-KR')}원`;
}

function CrewSettlementSheetTable({
  rows,
  onOpenDetail,
}: {
  rows: CrewSettlementPayrollSheetRow[];
  onOpenDetail: (teamMemberId: string) => void;
}) {
  const t = useCrewText();
  const dash = '—';
  const statsVars = (r: CrewSettlementPayrollSheetRow) => ({
    pay: r.payDateYmd ?? dash,
    n: r.jobCount == null ? dash : String(r.jobCount),
  });

  const settlementBadgeClass = (done: boolean) =>
    done
      ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
      : 'bg-gray-50 text-gray-700 border-gray-200';

  return (
    <div className="space-y-1.5 min-w-0">
      {/* 모바일: 카드 리스트 */}
      <div className="lg:hidden divide-y divide-gray-100 border border-gray-200 rounded-lg bg-white overflow-hidden shadow-sm">
        {rows.map((r) => {
          const settlementLbl = t(
            r.poolSettlementComplete ? 'crew.settlement.sheetSettlementDone' : 'crew.settlement.sheetSettlementPending',
          );
          return (
          <button
            key={r.id}
            type="button"
            onClick={() => onOpenDetail(r.id)}
            className="w-full text-left px-3 py-2 min-w-0 flex items-stretch gap-2 active:bg-gray-50 hover:bg-gray-50/80 transition-colors"
          >
            <div className="min-w-0 flex-1 flex flex-col justify-center gap-0.5">
              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 min-w-0">
                <span className="text-fluid-xs font-semibold text-gray-900 truncate">{r.name}</span>
                <span
                  className={`inline-flex shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold border leading-tight ${settlementBadgeClass(Boolean(r.poolSettlementComplete))}`}
                >
                  {settlementLbl}
                </span>
              </div>
              <span className="text-[10px] text-gray-600 tabular-nums leading-tight block">
                {t('crew.settlement.sheetMobileStats', statsVars(r))}
              </span>
            </div>
            <div className="shrink-0 flex flex-col items-end justify-center gap-0.5 pr-0.5 text-right">
              <span className="text-[9px] text-emerald-900/90 font-medium tabular-nums leading-tight">
                {t('crew.settlement.sheetColNet')}
              </span>
              <span className="text-fluid-sm font-bold tabular-nums text-emerald-900 leading-none mt-0.5">
                {fmtWon(r.amountNet)}
              </span>
              <span className="text-[9px] text-blue-700 mt-1 leading-tight">
                {t('crew.settlement.sheetMobileOpenDetail')}
              </span>
            </div>
            <span className="shrink-0 self-center text-gray-300 text-lg leading-none pl-0.5" aria-hidden>
              ›
            </span>
          </button>
          );
        })}
      </div>

      {/* 데스크톱: 표 */}
      <div className="hidden lg:block w-full min-w-0 max-w-full rounded-lg border border-gray-200 bg-white overflow-hidden">
        <p className="text-fluid-2xs text-gray-500 px-2 py-1.5 border-b border-gray-100 bg-gray-50/80">
          <CrewBiLine id="crew.settlement.nameTapHint" />
        </p>
        <div className="overflow-x-auto overscroll-x-contain">
          <table className="w-full min-w-[600px] table-fixed border-collapse text-fluid-2xs">
            <colgroup>
              <col className="w-[22%]" />
              <col className="w-[14%]" />
              <col className="w-[11%]" />
              <col className="w-[17%]" />
              <col className="w-[36%]" />
            </colgroup>
            <thead>
              <tr className="bg-gray-100 text-gray-700">
                <th className="border-b border-gray-200 px-2 py-1.5 text-center font-medium">
                  <CrewBiInline id="crew.settlement.sheetColName" />
                </th>
                <th className="border-b border-gray-200 px-2 py-1.5 text-center font-medium">
                  <CrewBiInline id="crew.settlement.sheetColPayDay" />
                </th>
                <th className="border-b border-gray-200 px-2 py-1.5 text-center font-medium">
                  <CrewBiInline id="crew.settlement.sheetColDays" />
                </th>
                <th className="border-b border-gray-200 px-2 py-1.5 text-center font-medium">
                  <CrewBiInline id="crew.settlement.sheetColSettlement" />
                </th>
                <th className="border-b border-gray-200 px-2 py-1.5 text-center font-medium">
                  <CrewBiInline id="crew.settlement.sheetColNet" />
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const settlementLbl = t(
                  row.poolSettlementComplete
                    ? 'crew.settlement.sheetSettlementDone'
                    : 'crew.settlement.sheetSettlementPending',
                );
                return (
                <tr key={row.id} className="hover:bg-gray-50">
                  <td className="border-b border-gray-100 px-2 py-1.5 text-center align-middle">
                    <button
                      type="button"
                      onClick={() => onOpenDetail(row.id)}
                      className="max-w-full text-blue-700 hover:text-blue-900 hover:underline font-medium truncate inline-block align-middle"
                      title={row.name}
                    >
                      <span className="truncate block">{row.name}</span>
                    </button>
                  </td>
                  <td className="border-b border-gray-100 px-2 py-1.5 text-center tabular-nums text-gray-700 align-middle">
                    {row.payDateYmd ?? dash}
                  </td>
                  <td className="border-b border-gray-100 px-2 py-1.5 text-center tabular-nums text-gray-800 align-middle">
                    {row.jobCount == null ? dash : `${row.jobCount}`}
                  </td>
                  <td className="border-b border-gray-100 px-2 py-1.5 text-center align-middle">
                    <span
                      className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold border leading-tight ${settlementBadgeClass(Boolean(row.poolSettlementComplete))}`}
                    >
                      {settlementLbl}
                    </span>
                  </td>
                  <td className="border-b border-gray-100 px-2 py-1.5 text-right tabular-nums font-semibold text-emerald-900 align-middle">
                    {fmtWon(row.amountNet)}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-fluid-2xs text-gray-400 px-0.5 lg:hidden">
        <CrewBiLine id="crew.settlement.sheetMobileTapFooter" />
      </p>
    </div>
  );
}

function DetailStatRow({ labelId, value }: { labelId: Parameters<typeof CrewBiLine>[0]['id']; value: string }) {
  const t = useCrewText();
  return (
    <div className="flex justify-between gap-2 text-[11px] min-w-0 leading-snug">
      <span className="text-gray-500 shrink-0">{t(labelId)}</span>
      <span className="text-gray-900 tabular-nums text-right truncate font-medium">{value}</span>
    </div>
  );
}

function CrewSettlementDetailModal({
  teamMemberId,
  month,
  preview,
  readSensitivePwd,
  onClose,
}: {
  teamMemberId: string;
  month: string;
  preview: boolean;
  readSensitivePwd: () => string;
  onClose: () => void;
}) {
  const t = useCrewText();
  const [data, setData] = useState<CrewPoolMemberPayrollDetailDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = getCrewToken();
    if (!token) return undefined;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setData(null);
    void (async () => {
      try {
        const sensitive = preview ? undefined : readSensitivePwd().trim() || undefined;
        const d = await getCrewSettlementPoolMemberDetail(token, teamMemberId, month, {
          sensitivePassword: sensitive,
        });
        if (!cancelled) setData(d);
      } catch (e) {
        if (cancelled) return;
        if (e instanceof AuthSessionExpiredError) throw e;
        if (e instanceof CrewSettlementGateError) {
          setError(e.message);
          return;
        }
        setError(e instanceof Error ? e.message : t('crew.settlement.detailLoadFail'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [teamMemberId, month, preview, readSensitivePwd, t]);

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const heading =
    data?.member.nameTh?.trim() != null && data.member.nameTh!.trim() !== ''
      ? `${data.member.name} (${data.member.nameTh!.trim()})`
      : (data?.member.name ?? '');

  const modalBody = (
    <div
      className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center sm:p-4 bg-black/45"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-t-xl sm:rounded-xl shadow-xl w-full max-w-lg max-h-[min(92vh,720px)] flex flex-col min-h-0 border border-gray-200">
        <div className="shrink-0 flex items-start justify-between gap-2 px-3 py-2 border-b border-gray-100 bg-gray-50 rounded-t-xl sm:rounded-t-xl">
          <div className="min-w-0">
            <div className="text-fluid-xs font-semibold text-gray-900 truncate">{heading}</div>
            <div className="text-[10px] text-gray-500 mt-0.5">
              <CrewBiLine
                id="crew.settlement.detailMonthHeading"
                vars={{ ym: month }}
                koClassName="block"
                thClassName="block text-[10px]"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 px-2 py-1 rounded-md text-fluid-xs font-medium text-gray-700 hover:bg-gray-200 border border-transparent"
          >
            <CrewBiInline id="crew.settlement.detailClose" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2 space-y-3">
          {loading ? (
            <p className="text-fluid-xs text-gray-500 py-6 text-center">
              <CrewBiLine id="crew.settlement.detailLoading" />
            </p>
          ) : error ? (
            <div className="text-fluid-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-2">{error}</div>
          ) : data ? (
            <>
              <section className="rounded-lg border border-gray-100 bg-gray-50/80 p-2 space-y-1.5">
                <DetailStatRow
                  labelId="crew.settlement.detailPeriod"
                  value={
                    data.accrualStartYmd && data.accrualEndYmd
                      ? `${data.accrualStartYmd} ~ ${data.accrualEndYmd}`
                      : '—'
                  }
                />
                <DetailStatRow labelId="crew.settlement.detailPayDayLabel" value={data.payDateYmd ?? '—'} />
                <DetailStatRow labelId="crew.settlement.detailUnit" value={fmtWon(data.unitAmount)} />
                <DetailStatRow
                  labelId="crew.settlement.detailSysDays"
                  value={data.poolSystemDays == null ? '—' : String(data.poolSystemDays)}
                />
                <DetailStatRow
                  labelId="crew.settlement.detailManualDays"
                  value={String(data.poolManualExtraDays ?? 0)}
                />
                <DetailStatRow
                  labelId="crew.settlement.detailJobTotal"
                  value={data.jobCount == null ? '—' : String(data.jobCount)}
                />
                <DetailStatRow labelId="crew.settlement.detailGross" value={fmtWon(data.amount)} />
                <DetailStatRow
                  labelId="crew.settlement.detailExpenseDeduction"
                  value={
                    (data.crewExpenseTotal ?? 0) > 0
                      ? `−${Number(data.crewExpenseTotal).toLocaleString('ko-KR')}원`
                      : '—'
                  }
                />
                <DetailStatRow
                  labelId="crew.settlement.detailLedgerManualDeduction"
                  value={
                    (data.poolLedgerManualDeductionTotal ?? 0) > 0
                      ? `−${Number(data.poolLedgerManualDeductionTotal).toLocaleString('ko-KR')}원`
                      : '—'
                  }
                />
                <DetailStatRow labelId="crew.settlement.detailNet" value={fmtWon(data.amountNet)} />
              </section>

              <section className="space-y-1">
                <h3 className="text-fluid-xs font-semibold text-gray-800">
                  <CrewBiLine id="crew.settlement.detailSectionInquiries" />
                </h3>
                {data.lines.length === 0 ? (
                  <p className="text-fluid-2xs text-gray-500 py-2">
                    <CrewBiLine id="crew.settlement.detailEmptyLines" />
                  </p>
                ) : (
                  <div className="overflow-x-auto rounded border border-gray-200">
                    <table className="w-full min-w-[280px] table-fixed border-collapse text-[10px] sm:text-fluid-2xs">
                      <thead>
                        <tr className="bg-gray-100 text-gray-700">
                          <th className="border-b px-1 py-1 text-center font-medium w-[22%]">
                            <CrewBiInline id="crew.settlement.detailThPrefDate" />
                          </th>
                          <th className="border-b px-1 py-1 text-center font-medium w-[44%]">
                            <CrewBiInline id="crew.settlement.detailThCustomer" />
                          </th>
                          <th className="border-b px-1 py-1 text-center font-medium w-[34%]">
                            <CrewBiInline id="crew.settlement.detailThInquiryNo" />
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.lines.map((ln) => (
                          <tr key={ln.inquiryId} className="hover:bg-gray-50">
                            <td className="border-b border-gray-100 px-1 py-1 text-center tabular-nums truncate">
                              {ln.preferredDateYmd ?? '—'}
                            </td>
                            <td
                              className="border-b border-gray-100 px-1 py-1 text-center truncate"
                              title={ln.customerName}
                            >
                              {ln.customerName}
                            </td>
                            <td className="border-b border-gray-100 px-1 py-1 text-center truncate">
                              {ln.inquiryNumber ?? '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              <section className="space-y-1">
                <h3 className="text-fluid-xs font-semibold text-gray-800">
                  <CrewBiLine id="crew.settlement.detailSectionExpenses" />
                </h3>
                {data.crewExpenseLines.length === 0 ? (
                  <p className="text-fluid-2xs text-gray-500 py-2">
                    <CrewBiLine id="crew.settlement.detailEmptyExpense" />
                  </p>
                ) : (
                  <ul className="rounded border border-gray-200 divide-y divide-gray-100 bg-white">
                    {data.crewExpenseLines.map((ex) => (
                      <li key={ex.id} className="px-2 py-1.5 text-[11px] space-y-0.5">
                        <div className="flex justify-between gap-2 tabular-nums">
                          <span className="font-semibold text-gray-900">{fmtWon(ex.amount)}</span>
                          <span className="text-gray-500 shrink-0">{fmtIsoShort(ex.createdAt)}</span>
                        </div>
                        <div className="text-[10px] text-gray-600 truncate leading-snug">
                          <span className="font-medium text-gray-700">{t('crew.settlement.detailExpenseGroup')}</span>
                          <span>: {ex.crewGroupName}</span>
                          <span className="mx-1 text-gray-300">·</span>
                          <span>
                            {t('crew.settlement.detailAttachments')}{' '}
                            {t('crew.settlement.detailAttachCount', {
                              count: String(ex.attachmentCount),
                            })}
                          </span>
                        </div>
                        {ex.memo?.trim() ? (
                          <div className="text-[10px] text-gray-700 whitespace-pre-wrap break-words">
                            <span className="font-medium text-gray-600">
                              {t('crew.settlement.detailExpenseMemo')}
                            </span>
                            : {ex.memo}
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="space-y-1 rounded-lg border border-gray-100 p-2 bg-white">
                <h3 className="text-fluid-xs font-semibold text-gray-800">
                  <CrewBiLine id="crew.settlement.detailSectionSettlement" />
                </h3>
                {data.settlement ? (
                  <div className="text-[11px] space-y-1">
                    <div className="text-emerald-800 font-medium">
                      <CrewBiLine id="crew.settlement.detailSettled" />
                    </div>
                    <div className="tabular-nums flex flex-wrap items-baseline gap-x-1 gap-y-0">
                      <CrewBiInline id="crew.settlement.detailPaidAmount" className="text-gray-600" />
                      <strong>{fmtWon(data.settlement.amount)}</strong>
                      <span className="text-gray-500 text-[10px]">{fmtIsoShort(data.settlement.settledAt)}</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-[11px] text-amber-900 font-medium">
                    <CrewBiLine id="crew.settlement.detailNotSettled" />
                  </div>
                )}
                <div className="text-[10px] text-gray-600 pt-1 border-t border-gray-100 mt-1 flex flex-wrap gap-x-1 items-baseline">
                  <CrewBiInline id="crew.settlement.detailHistorySum" className="font-medium text-gray-700" />
                  <span className="tabular-nums">{fmtWon(data.paymentHistory.totalPaid)}</span>
                </div>
                {data.paymentHistory.items.length > 0 ? (
                  <ul className="mt-1 max-h-28 overflow-y-auto text-[10px] text-gray-700 space-y-0.5">
                    {data.paymentHistory.items.slice(0, 12).map((it, idx) => (
                      <li key={`${it.monthKey}-${idx}`} className="flex justify-between gap-2 tabular-nums">
                        <span>{it.monthKey}</span>
                        <span>{fmtWon(it.amount)}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </section>

              {data.notes.length > 0 ? (
                <section className="space-y-1">
                  <p className="text-[10px] text-gray-500">
                    <CrewBiLine id="crew.settlement.detailNotesKoNotice" />
                  </p>
                  <ul className="text-[11px] text-gray-800 bg-amber-50/60 border border-amber-100 rounded px-2 py-1.5 space-y-1 list-disc list-inside">
                    {data.notes.map((n, i) => (
                      <li key={i} className="whitespace-pre-wrap">
                        {n}
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(modalBody, document.body);
}

function fmtIsoShort(iso: string): string {
  try {
    return new Date(iso).toLocaleString('ko-KR', {
      timeZone: 'Asia/Seoul',
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function kstMonthKeyNow(): string {
  return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 7);
}

/** @deprecated 라우트 `/crew/expenses` 전용 리다이렉트 */
export function CrewExpensesRedirect() {
  return <Navigate to="/crew/settlement?tab=expenses" replace />;
}
