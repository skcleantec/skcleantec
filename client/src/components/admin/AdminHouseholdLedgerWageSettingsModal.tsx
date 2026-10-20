import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import {
  TEAM_LEADER_HOUSEHOLD_DAILY_PAY_BASIS_LABELS,
  TEAM_LEADER_HOUSEHOLD_WAGE_MODE_LABELS,
  type TeamLeaderHouseholdDailyPayBasis,
  type TeamLeaderHouseholdWageMode,
} from '@shared/teamLeaderHouseholdLedger';
import {
  getAdminHouseholdWageSettings,
  saveAdminHouseholdWagePolicy,
  saveAdminHouseholdWageSetting,
  type AdminHouseholdWageOverview,
} from '../../api/adminHouseholdLedger';
import type { HouseholdWageSetting } from '../../api/teamHouseholdLedger';
import { useModalScrollKeyboardAvoidance } from '../../hooks/useMobileInputVisibility';
import { ModalCloseButton } from './ModalCloseButton';
import { LineMdIcon } from '../ui/LineMdIcon';

const MODES: TeamLeaderHouseholdWageMode[] = ['BALANCE_PCT', 'DAILY', 'MONTHLY'];
const BASES: TeamLeaderHouseholdDailyPayBasis[] = ['PER_INQUIRY', 'PER_DAY'];

function parseWon(raw: string): number | null {
  const s = raw.trim().replace(/[,\s원]/g, '');
  if (!s || !/^\d+$/.test(s)) return null;
  const n = Number(s);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function leaderName(leader: { name: string | null; email: string | null; id: string }): string {
  return leader.name?.trim() || leader.email?.trim() || leader.id.slice(0, 8);
}

function amountLabel(setting: HouseholdWageSetting): string {
  if (setting.wageMode === 'BALANCE_PCT') return `${setting.balanceSharePercent}%`;
  if (setting.wageMode === 'DAILY' && setting.dailyAmountWon != null) {
    return `${setting.dailyAmountWon.toLocaleString('ko-KR')}원`;
  }
  if (setting.wageMode === 'MONTHLY' && setting.monthlyAmountWon != null) {
    return `${setting.monthlyAmountWon.toLocaleString('ko-KR')}원`;
  }
  return '—';
}

type Props = {
  open: boolean;
  token: string | null;
  onClose: () => void;
};

export function AdminHouseholdLedgerWageSettingsModal({ open, token, onClose }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { onFieldFocus } = useModalScrollKeyboardAvoidance(scrollRef, open);
  const [overview, setOverview] = useState<AdminHouseholdWageOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [leaderId, setLeaderId] = useState('');
  const [wageMode, setWageMode] = useState<TeamLeaderHouseholdWageMode>('BALANCE_PCT');
  const [dailyPayBasis, setDailyPayBasis] = useState<TeamLeaderHouseholdDailyPayBasis>('PER_DAY');
  const [percentRaw, setPercentRaw] = useState('100');
  const [dailyRaw, setDailyRaw] = useState('');
  const [monthlyRaw, setMonthlyRaw] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [policySaving, setPolicySaving] = useState(false);

  const applySetting = (setting: HouseholdWageSetting) => {
    setWageMode(setting.wageMode);
    setDailyPayBasis(setting.dailyPayBasis ?? 'PER_DAY');
    setPercentRaw(String(setting.balanceSharePercent ?? 100));
    setDailyRaw(setting.dailyAmountWon != null ? String(setting.dailyAmountWon) : '');
    setMonthlyRaw(setting.monthlyAmountWon != null ? String(setting.monthlyAmountWon) : '');
  };

  useEffect(() => {
    if (!open || !token) return;
    setLoading(true);
    setLoadError(null);
    setError(null);
    void getAdminHouseholdWageSettings(token)
      .then((res) => {
        setOverview(res);
        const first = res.items[0];
        if (first) {
          setLeaderId(first.teamLeader.id);
          applySetting(first.setting);
        } else {
          setLeaderId('');
        }
      })
      .catch((e) => setLoadError(e instanceof Error ? e.message : '임금 설정을 불러올 수 없습니다.'))
      .finally(() => setLoading(false));
  }, [open, token]);

  const selected = useMemo(
    () => overview?.items.find((row) => row.teamLeader.id === leaderId) ?? null,
    [overview, leaderId],
  );

  if (!open) return null;

  const selectLeader = (id: string) => {
    setLeaderId(id);
    setError(null);
    const row = overview?.items.find((item) => item.teamLeader.id === id);
    if (row) applySetting(row.setting);
  };

  const togglePolicy = async () => {
    if (!token || !overview || policySaving) return;
    const next = !overview.leaderCanEdit;
    setPolicySaving(true);
    setError(null);
    try {
      const saved = await saveAdminHouseholdWagePolicy(token, next);
      setOverview({ ...overview, leaderCanEdit: saved.leaderCanEdit });
    } catch (e) {
      setError(e instanceof Error ? e.message : '스위치를 저장하지 못했습니다.');
    } finally {
      setPolicySaving(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token || !leaderId) {
      setError('팀장을 선택해 주세요.');
      return;
    }
    setError(null);
    const percent = Number(percentRaw);
    if (wageMode === 'BALANCE_PCT' && (!Number.isInteger(percent) || percent < 1 || percent > 100)) {
      setError('잔금 비율은 1~100%로 입력해 주세요.');
      return;
    }
    const dailyAmountWon = parseWon(dailyRaw);
    const monthlyAmountWon = parseWon(monthlyRaw);
    if (wageMode === 'DAILY' && dailyAmountWon == null) {
      setError('일급을 1원 이상 입력해 주세요.');
      return;
    }
    if (wageMode === 'MONTHLY' && monthlyAmountWon == null) {
      setError('월급을 1원 이상 입력해 주세요.');
      return;
    }
    const payload: HouseholdWageSetting = {
      wageMode,
      balanceSharePercent: Number.isInteger(percent) && percent >= 1 && percent <= 100 ? percent : 100,
      dailyAmountWon,
      monthlyAmountWon,
      dailyPayBasis,
    };
    setSaving(true);
    try {
      const saved = await saveAdminHouseholdWageSetting(token, { teamLeaderId: leaderId, ...payload });
      setOverview((prev) =>
        prev
          ? {
              ...prev,
              items: prev.items.map((row) =>
                row.teamLeader.id === saved.teamLeaderId ? { ...row, setting: saved.setting } : row,
              ),
            }
          : prev,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const segBtn = (on: boolean, label: string, onClick: () => void) => (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-3 py-1.5 text-fluid-2xs font-semibold hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${
        on ? 'bg-slate-900 text-white hover:bg-slate-800' : 'text-slate-600'
      }`}
    >
      {label}
    </button>
  );

  return createPortal(
    <div className="modal-mobile-safe-overlay fixed inset-0 z-[80] flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="닫기" onClick={onClose} />
      <div
        className="modal-mobile-fullscreen-panel relative flex max-h-[min(100dvh,44rem)] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl lg:max-h-[min(90vh,44rem)] lg:rounded-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-household-wage-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative shrink-0 border-b border-slate-200 px-4 py-3 pr-12">
          <h2 id="admin-household-wage-title" className="text-fluid-sm font-semibold text-slate-900">
            임금 설정
          </h2>
          <ModalCloseButton onClick={onClose} />
        </div>
        <form onSubmit={(e) => void handleSubmit(e)} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div
            ref={scrollRef}
            onFocusCapture={onFieldFocus}
            className="modal-form-scroll-surface min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-y-contain p-3 sm:p-4"
          >
            {loading ? <p className="text-fluid-xs text-slate-500">불러오는 중…</p> : null}
            {loadError ? <p className="text-fluid-xs text-red-600">{loadError}</p> : null}
            {overview ? (
              <>
                <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-fluid-xs font-semibold text-slate-900">팀장이 임금 설정을 바꿀 수 있음</p>
                    <p className="text-fluid-2xs text-slate-500">끄면 팀장 가계부의 설정이 잠깁니다.</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={overview.leaderCanEdit}
                    aria-label="팀장이 임금 설정을 바꿀 수 있음"
                    disabled={policySaving}
                    onClick={() => void togglePolicy()}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${
                      overview.leaderCanEdit ? 'bg-slate-900' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                        overview.leaderCanEdit ? 'translate-x-[1.375rem]' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                </div>

                <div className="space-y-3 rounded-xl border border-slate-200 p-3">
                  <label className="block">
                    <span className="mb-1 block text-fluid-2xs font-medium text-slate-600">팀장</span>
                    <select
                      value={leaderId}
                      onChange={(e) => selectLeader(e.target.value)}
                      className="min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-fluid-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                    >
                      {overview.items.length === 0 ? <option value="">팀장 없음</option> : null}
                      {overview.items.map((row) => (
                        <option key={row.teamLeader.id} value={row.teamLeader.id}>
                          {leaderName(row.teamLeader)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div>
                    <p className="mb-1.5 text-fluid-2xs font-medium text-slate-600">임금 방식</p>
                    <div className="inline-flex flex-wrap gap-0.5 rounded-lg border border-slate-200 p-0.5">
                      {MODES.map((mode) => (
                        <span key={mode}>{segBtn(wageMode === mode, TEAM_LEADER_HOUSEHOLD_WAGE_MODE_LABELS[mode], () => setWageMode(mode))}</span>
                      ))}
                    </div>
                  </div>
                  {wageMode === 'BALANCE_PCT' ? (
                    <label className="block">
                      <span className="mb-1 block text-fluid-2xs font-medium text-slate-600">잔금에서 가져가는 비율</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={percentRaw}
                        onChange={(e) => setPercentRaw(e.target.value)}
                        className="login-field-input min-h-10 w-full rounded-lg border border-slate-200 px-3 text-fluid-xs tabular-nums"
                        placeholder="예: 40"
                      />
                    </label>
                  ) : null}
                  {wageMode === 'DAILY' ? (
                    <>
                      <div>
                        <p className="mb-1.5 text-fluid-2xs font-medium text-slate-600">일당 묶음</p>
                        <div className="inline-flex flex-wrap gap-0.5 rounded-lg border border-slate-200 p-0.5">
                          {BASES.map((basis) => (
                            <span key={basis}>
                              {segBtn(
                                dailyPayBasis === basis,
                                TEAM_LEADER_HOUSEHOLD_DAILY_PAY_BASIS_LABELS[basis],
                                () => setDailyPayBasis(basis),
                              )}
                            </span>
                          ))}
                        </div>
                        <p className="mt-1 text-fluid-2xs text-slate-500">
                          {dailyPayBasis === 'PER_INQUIRY'
                            ? '배정된 현장마다 일당 1줄입니다.'
                            : '같은 날 현장이 여러 곳이어도 일당은 1줄입니다.'}
                        </p>
                      </div>
                      <label className="block">
                        <span className="mb-1 block text-fluid-2xs font-medium text-slate-600">일급</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={dailyRaw}
                          onChange={(e) => setDailyRaw(e.target.value)}
                          className="login-field-input min-h-10 w-full rounded-lg border border-slate-200 px-3 text-fluid-xs tabular-nums"
                          placeholder="예: 150000"
                        />
                      </label>
                    </>
                  ) : null}
                  {wageMode === 'MONTHLY' ? (
                    <label className="block">
                      <span className="mb-1 block text-fluid-2xs font-medium text-slate-600">월급</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={monthlyRaw}
                        onChange={(e) => setMonthlyRaw(e.target.value)}
                        className="login-field-input min-h-10 w-full rounded-lg border border-slate-200 px-3 text-fluid-xs tabular-nums"
                        placeholder="예: 3000000"
                      />
                    </label>
                  ) : null}
                  <button
                    type="submit"
                    disabled={saving || !leaderId}
                    className="min-h-10 w-full rounded-lg bg-slate-900 text-fluid-xs font-semibold text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
                  >
                    {saving ? '저장 중…' : `${selected ? leaderName(selected.teamLeader) : '팀장'} 저장`}
                  </button>
                </div>

                <div className="overflow-hidden rounded-xl border border-slate-200">
                  <p className="border-b border-slate-200 bg-slate-50 px-3 py-1.5 text-fluid-2xs font-medium text-slate-600">
                    팀장별 현재 설정
                  </p>
                  <div className="hidden lg:block">
                    <table className="w-full table-fixed border-collapse text-fluid-xs">
                      <colgroup>
                        <col />
                        <col className="w-[72px]" />
                        <col className="w-[120px]" />
                        <col className="w-[88px]" />
                      </colgroup>
                      <thead>
                        <tr className="bg-gray-100 text-fluid-2xs text-gray-700">
                          <th className="px-2 py-1.5 text-center">팀장</th>
                          <th className="px-2 py-1.5 text-center">방식</th>
                          <th className="px-2 py-1.5 text-center">금액·비율</th>
                          <th className="px-2 py-1.5 text-center">일당</th>
                        </tr>
                      </thead>
                      <tbody>
                        {overview.items.map((row) => (
                          <tr
                            key={row.teamLeader.id}
                            className={`cursor-pointer border-t border-gray-100 hover:bg-slate-50 ${
                              row.teamLeader.id === leaderId ? 'bg-slate-50' : ''
                            }`}
                            onClick={() => selectLeader(row.teamLeader.id)}
                          >
                            <td className="truncate px-2 py-1.5 text-center" title={leaderName(row.teamLeader)}>
                              {leaderName(row.teamLeader)}
                            </td>
                            <td className="px-2 py-1.5 text-center">
                              {TEAM_LEADER_HOUSEHOLD_WAGE_MODE_LABELS[row.setting.wageMode]}
                            </td>
                            <td className="px-2 py-1.5 text-right tabular-nums">{amountLabel(row.setting)}</td>
                            <td className="px-2 py-1.5 text-center">
                              {row.setting.wageMode === 'DAILY'
                                ? TEAM_LEADER_HOUSEHOLD_DAILY_PAY_BASIS_LABELS[row.setting.dailyPayBasis]
                                : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <ul className="divide-y divide-slate-100 lg:hidden">
                    {overview.items.map((row) => (
                      <li key={row.teamLeader.id}>
                        <button
                          type="button"
                          onClick={() => selectLeader(row.teamLeader.id)}
                          className={`flex w-full min-h-10 items-center gap-2 px-3 py-2 text-left hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-400 ${
                            row.teamLeader.id === leaderId ? 'bg-slate-50' : ''
                          }`}
                        >
                          <span className="min-w-0 flex-1 truncate text-fluid-xs font-medium text-slate-900">
                            {leaderName(row.teamLeader)}
                          </span>
                          <span className="shrink-0 text-fluid-2xs text-slate-600">
                            {TEAM_LEADER_HOUSEHOLD_WAGE_MODE_LABELS[row.setting.wageMode]}
                            {row.setting.wageMode === 'DAILY'
                              ? ` · ${TEAM_LEADER_HOUSEHOLD_DAILY_PAY_BASIS_LABELS[row.setting.dailyPayBasis]}`
                              : ''}
                            {' · '}
                            {amountLabel(row.setting)}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                  {overview.items.length === 0 ? (
                    <p className="px-3 py-4 text-center text-fluid-xs text-slate-500">등록된 팀장이 없습니다.</p>
                  ) : null}
                </div>
              </>
            ) : null}
            {error ? <p className="text-fluid-2xs text-red-600">{error}</p> : null}
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}

export function AdminHouseholdWageGearButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 text-fluid-xs font-semibold text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
    >
      <LineMdIcon name="cog" className="size-4 text-slate-700" />
      임금 설정
    </button>
  );
}
