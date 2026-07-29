import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type { TeamLeaderHouseholdLedgerDirection } from '@shared/teamLeaderHouseholdLedger';
import type {
  HouseholdLedgerCategoriesResponse,
  HouseholdLedgerEntry,
  HouseholdLedgerEntryPayload,
} from '../../api/teamHouseholdLedger';
import { ModalCloseButton } from '../admin/ModalCloseButton';
import { kstTodayYmd } from '../../utils/dateFormat';

export type HouseholdLedgerModalInitial = Partial<HouseholdLedgerEntryPayload> & {
  inquiryNumber?: string | null;
  customerName?: string | null;
  memoHint?: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  categories: HouseholdLedgerCategoriesResponse | null;
  initial?: HouseholdLedgerModalInitial | null;
  editing?: HouseholdLedgerEntry | null;
  saving?: boolean;
  onSubmit: (payload: HouseholdLedgerEntryPayload) => Promise<void>;
};

function parseAmountInput(raw: string): number | null {
  const s = raw.trim().replace(/[,\s원]/g, '');
  if (!s || !/^\d+$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function TeamHouseholdLedgerEntryModal({
  open,
  onClose,
  categories,
  initial,
  editing,
  saving,
  onSubmit,
}: Props) {
  const [direction, setDirection] = useState<TeamLeaderHouseholdLedgerDirection>('INCOME');
  const [category, setCategory] = useState('');
  const [amountRaw, setAmountRaw] = useState('');
  const [occurredOn, setOccurredOn] = useState(kstTodayYmd());
  const [memo, setMemo] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (editing) {
      setDirection(editing.direction);
      setCategory(editing.category);
      setAmountRaw(String(editing.amount));
      setOccurredOn(editing.occurredOn);
      setMemo(editing.memo ?? '');
      return;
    }
    setDirection(initial?.direction ?? 'INCOME');
    setCategory(initial?.category ?? '');
    setAmountRaw(initial?.amount != null ? String(initial.amount) : '');
    setOccurredOn(initial?.occurredOn ?? kstTodayYmd());
    setMemo(initial?.memo ?? initial?.memoHint ?? '');
  }, [open, editing, initial]);

  const categoryOptions = useMemo(() => {
    if (!categories) return [];
    return direction === 'INCOME' ? categories.income : categories.expense;
  }, [categories, direction]);

  useEffect(() => {
    if (!open || editing) return;
    if (category && categoryOptions.includes(category)) return;
    if (categoryOptions.length > 0) setCategory(categoryOptions[0] ?? '');
  }, [open, editing, category, categoryOptions]);

  if (!open) return null;

  const inquiryHint =
    initial?.inquiryNumber || initial?.customerName
      ? [initial.inquiryNumber, initial.customerName].filter(Boolean).join(' · ')
      : editing?.inquiryNumber || editing?.customerName
        ? [editing.inquiryNumber, editing.customerName].filter(Boolean).join(' · ')
        : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const amount = parseAmountInput(amountRaw);
    if (!category.trim()) {
      setError('카테고리를 선택해 주세요.');
      return;
    }
    if (amount == null) {
      setError('금액은 1원 이상 정수로 입력해 주세요.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(occurredOn)) {
      setError('날짜 형식을 확인해 주세요.');
      return;
    }
    try {
      await onSubmit({
        direction,
        category: category.trim(),
        amount,
        occurredOn,
        memo: memo.trim() || null,
        inquiryId: editing?.inquiryId ?? initial?.inquiryId ?? null,
        prefillKind: editing?.prefillKind ?? initial?.prefillKind ?? null,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장에 실패했습니다.');
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[85] flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4">
      <div
        className="flex max-h-[92dvh] w-full max-w-md flex-col rounded-t-2xl bg-white shadow-xl sm:max-h-[90vh] sm:rounded-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="household-ledger-modal-title"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 id="household-ledger-modal-title" className="text-fluid-sm font-semibold text-slate-900">
            {editing ? '가계부 수정' : '가계부 추가'}
          </h2>
          <ModalCloseButton onClick={onClose} />
        </div>
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
            {inquiryHint ? (
              <p className="rounded-lg border border-sky-100 bg-sky-50 px-3 py-2 text-fluid-2xs text-sky-900">
                접수 연결 · {inquiryHint}
              </p>
            ) : null}
            <div>
              <p className="mb-1.5 text-fluid-2xs font-medium text-slate-600">구분</p>
              <div className="inline-flex rounded-lg border border-slate-200 p-0.5">
                <button
                  type="button"
                  className={`rounded-md px-3 py-1.5 text-fluid-2xs font-semibold ${
                    direction === 'INCOME' ? 'bg-slate-900 text-white' : 'text-slate-600'
                  }`}
                  onClick={() => setDirection('INCOME')}
                >
                  수입
                </button>
                <button
                  type="button"
                  className={`rounded-md px-3 py-1.5 text-fluid-2xs font-semibold ${
                    direction === 'EXPENSE' ? 'bg-slate-900 text-white' : 'text-slate-600'
                  }`}
                  onClick={() => setDirection('EXPENSE')}
                >
                  지출
                </button>
              </div>
            </div>
            <label className="block">
              <span className="mb-1 block text-fluid-2xs font-medium text-slate-600">카테고리</span>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-fluid-xs"
              >
                {categoryOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-fluid-2xs font-medium text-slate-600">금액</span>
              <input
                type="text"
                inputMode="numeric"
                value={amountRaw}
                onChange={(e) => setAmountRaw(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-fluid-xs tabular-nums"
                placeholder="예: 150000"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-fluid-2xs font-medium text-slate-600">날짜</span>
              <input
                type="date"
                value={occurredOn}
                onChange={(e) => setOccurredOn(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-fluid-xs"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-fluid-2xs font-medium text-slate-600">메모</span>
              <textarea
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-fluid-xs"
                placeholder="선택 입력"
              />
            </label>
            {error ? <p className="text-fluid-2xs text-red-600">{error}</p> : null}
          </div>
          <div className="flex shrink-0 gap-2 border-t border-slate-200 p-4">
            <button
              type="button"
              onClick={onClose}
              className="min-h-10 flex-1 rounded-lg border border-slate-200 text-fluid-xs font-semibold text-slate-700"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={saving}
              className="min-h-10 flex-1 rounded-lg bg-slate-900 text-fluid-xs font-semibold text-white disabled:opacity-60"
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
