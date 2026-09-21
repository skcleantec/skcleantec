import { useEffect, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import type { TeamLeaderHouseholdWageMode } from '@shared/teamLeaderHouseholdLedger';
import { TEAM_LEADER_HOUSEHOLD_WAGE_MODE_LABELS } from '@shared/teamLeaderHouseholdLedger';
import type { HouseholdWageSetting } from '../../api/teamHouseholdLedger';
import { useModalScrollKeyboardAvoidance } from '../../hooks/useMobileInputVisibility';
import { useSuppressTeamMobileBottomNav } from '../../hooks/useSuppressTeamMobileBottomNav';
import { ModalCloseButton } from '../admin/ModalCloseButton';

type Props = {
  open: boolean;
  saving?: boolean;
  initial: HouseholdWageSetting | null;
  onClose: () => void;
  onSave: (setting: HouseholdWageSetting) => Promise<void>;
};

const MODES: TeamLeaderHouseholdWageMode[] = ['BALANCE_PCT', 'DAILY', 'MONTHLY'];

function parseWon(raw: string): number | null {
  const s = raw.trim().replace(/[,\s원]/g, '');
  if (!s || !/^\d+$/.test(s)) return null;
  const n = Number(s);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export function TeamHouseholdLedgerWageSettingsModal({
  open,
  saving,
  initial,
  onClose,
  onSave,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { onFieldFocus } = useModalScrollKeyboardAvoidance(scrollRef, open);
  const [wageMode, setWageMode] = useState<TeamLeaderHouseholdWageMode>('BALANCE_PCT');
  const [percentRaw, setPercentRaw] = useState('100');
  const [dailyRaw, setDailyRaw] = useState('');
  const [monthlyRaw, setMonthlyRaw] = useState('');
  const [error, setError] = useState<string | null>(null);

  useSuppressTeamMobileBottomNav(open);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setWageMode(initial?.wageMode ?? 'BALANCE_PCT');
    setPercentRaw(String(initial?.balanceSharePercent ?? 100));
    setDailyRaw(initial?.dailyAmountWon != null ? String(initial.dailyAmountWon) : '');
    setMonthlyRaw(initial?.monthlyAmountWon != null ? String(initial.monthlyAmountWon) : '');
  }, [open, initial]);

  if (!open) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
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
    try {
      await onSave({
        wageMode,
        balanceSharePercent: Number.isInteger(percent) && percent >= 1 && percent <= 100 ? percent : 100,
        dailyAmountWon,
        monthlyAmountWon,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장에 실패했습니다.');
    }
  };

  return createPortal(
    <div className="modal-mobile-safe-overlay fixed inset-0 z-[80] flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="닫기" onClick={onClose} />
      <div
        className="modal-mobile-fullscreen-panel relative flex max-h-[min(92dvh,40rem)] w-full max-w-md flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl lg:max-h-[min(90vh,40rem)] lg:rounded-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="household-wage-settings-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative shrink-0 border-b border-slate-200 px-4 py-3 pr-12">
          <h2 id="household-wage-settings-title" className="text-fluid-sm font-semibold text-slate-900">
            임금 설정
          </h2>
          <ModalCloseButton onClick={onClose} />
        </div>
        <form onSubmit={(e) => void handleSubmit(e)} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div
            ref={scrollRef}
            onFocusCapture={onFieldFocus}
            className="modal-form-scroll-surface min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-y-contain p-4"
          >
            <p className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-fluid-2xs leading-snug text-slate-600">
              회사 급여표와 별도로, 가계부에 보이는 본인 임금만 정합니다. 일당·월급을 고르면 잔금 줄은 숨기고 그
              방식으로 표시합니다.
            </p>
            <div>
              <p className="mb-1.5 text-fluid-2xs font-medium text-slate-600">임금 방식</p>
              <div className="inline-flex flex-wrap gap-0.5 rounded-lg border border-slate-200 p-0.5">
                {MODES.map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setWageMode(mode)}
                    className={`rounded-md px-3 py-1.5 text-fluid-2xs font-semibold hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${
                      wageMode === mode ? 'bg-slate-900 text-white hover:bg-slate-800' : 'text-slate-600'
                    }`}
                  >
                    {TEAM_LEADER_HOUSEHOLD_WAGE_MODE_LABELS[mode]}
                  </button>
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
                  className="login-field-input w-full rounded-lg border border-slate-200 px-3 py-2 text-fluid-xs tabular-nums"
                  placeholder="예: 40"
                />
                <span className="mt-1 block text-fluid-2xs text-slate-500">1~100%. 예: 40이면 잔금의 40%가 임금입니다.</span>
              </label>
            ) : null}
            {wageMode === 'DAILY' ? (
              <label className="block">
                <span className="mb-1 block text-fluid-2xs font-medium text-slate-600">일급</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={dailyRaw}
                  onChange={(e) => setDailyRaw(e.target.value)}
                  className="login-field-input w-full rounded-lg border border-slate-200 px-3 py-2 text-fluid-xs tabular-nums"
                  placeholder="예: 150000"
                />
                <span className="mt-1 block text-fluid-2xs text-slate-500">
                  배정된 근무일마다 1줄. 같은 날 현장이 여러 곳이어도 하루입니다.
                </span>
              </label>
            ) : null}
            {wageMode === 'MONTHLY' ? (
              <label className="block">
                <span className="mb-1 block text-fluid-2xs font-medium text-slate-600">월급</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={monthlyRaw}
                  onChange={(e) => setMonthlyRaw(e.target.value)}
                  className="login-field-input w-full rounded-lg border border-slate-200 px-3 py-2 text-fluid-xs tabular-nums"
                  placeholder="예: 3000000"
                />
                <span className="mt-1 block text-fluid-2xs text-slate-500">해당 월에 월급 1줄이 생깁니다.</span>
              </label>
            ) : null}
            {error ? <p className="text-fluid-2xs text-red-600">{error}</p> : null}
          </div>
          <div className="flex shrink-0 gap-2 border-t border-slate-200 bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <button
              type="button"
              onClick={onClose}
              className="min-h-10 flex-1 rounded-lg border border-slate-200 text-fluid-xs font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={saving}
              className="min-h-10 flex-1 rounded-lg bg-slate-900 text-fluid-xs font-semibold text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
            >
              {saving ? '저장 중…' : '저장'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
