import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  getTeamLeaderHouseholdDepositPolicy,
  setTeamLeaderHouseholdDepositPolicy,
} from '../../api/users';

type Props = {
  open: boolean;
  token: string | null;
  onClose: () => void;
  onSaved: () => void;
};

export function TeamLeaderHouseholdDepositPolicyModal({ open, token, onClose, onSaved }: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [asTeamIncome, setAsTeamIncome] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !token) return;
    setLoading(true);
    setError(null);
    void getTeamLeaderHouseholdDepositPolicy(token)
      .then((res) => setAsTeamIncome(res.asTeamIncome))
      .catch((e) => setError(e instanceof Error ? e.message : '설정을 불러올 수 없습니다.'))
      .finally(() => setLoading(false));
  }, [open, token]);

  if (!open) return null;

  const handleSave = async () => {
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      await setTeamLeaderHouseholdDepositPolicy(token, asTeamIncome);
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="household-deposit-policy-title"
        className="flex max-h-[90dvh] w-full max-w-md flex-col rounded-t-2xl bg-white shadow-xl sm:rounded-2xl"
      >
        <div className="border-b border-gray-100 px-4 py-3">
          <h2 id="household-deposit-policy-title" className="text-fluid-sm font-semibold text-gray-900">
            가계부 · 예약금 정책
          </h2>
          <p className="mt-1 text-fluid-2xs text-gray-500">
            팀장 가계부에 예약금을 포함할지 정합니다. 배정·금액 변경 시 자동 반영됩니다.
          </p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {loading ? <p className="text-fluid-xs text-gray-500">불러오는 중…</p> : null}
          {error ? <p className="mb-2 text-fluid-xs text-red-600">{error}</p> : null}
          {!loading ? (
            <div className="space-y-2">
              <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-gray-200 p-3 has-[:checked]:border-slate-900 has-[:checked]:bg-slate-50">
                <input
                  type="radio"
                  name="depositPolicy"
                  className="mt-0.5"
                  checked={!asTeamIncome}
                  onChange={() => setAsTeamIncome(false)}
                />
                <span>
                  <span className="block text-fluid-xs font-semibold text-gray-900">회사 수입 (기본)</span>
                  <span className="block text-fluid-2xs text-gray-500">
                    예약금은 가계부 수입에서 제외합니다. 잔금·추가결재 등만 반영됩니다.
                  </span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-gray-200 p-3 has-[:checked]:border-slate-900 has-[:checked]:bg-slate-50">
                <input
                  type="radio"
                  name="depositPolicy"
                  className="mt-0.5"
                  checked={asTeamIncome}
                  onChange={() => setAsTeamIncome(true)}
                />
                <span>
                  <span className="block text-fluid-xs font-semibold text-gray-900">팀장 수입</span>
                  <span className="block text-fluid-2xs text-gray-500">
                    예약금도 팀장 가계부 수입에 포함합니다.
                  </span>
                </span>
              </label>
            </div>
          ) : null}
        </div>
        <div className="flex gap-2 border-t border-gray-100 px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="min-h-10 flex-1 rounded-lg border border-gray-200 text-fluid-xs font-semibold text-gray-700"
          >
            취소
          </button>
          <button
            type="button"
            disabled={loading || saving}
            onClick={() => void handleSave()}
            className="min-h-10 flex-1 rounded-lg bg-slate-900 text-fluid-xs font-semibold text-white disabled:opacity-60"
          >
            {saving ? '저장 중…' : '저장'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
