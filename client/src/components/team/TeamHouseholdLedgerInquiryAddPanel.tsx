import { useCallback, useEffect, useState } from 'react';
import {
  createTeamHouseholdLedgerEntry,
  getTeamHouseholdLedgerPrefill,
  type HouseholdLedgerPrefillOption,
} from '../../api/teamHouseholdLedger';
import { TeamHouseholdLedgerEntryModal, type HouseholdLedgerModalInitial } from './TeamHouseholdLedgerEntryModal';
import type { HouseholdLedgerCategoriesResponse } from '../../api/teamHouseholdLedger';
import { getTeamHouseholdLedgerCategories } from '../../api/teamHouseholdLedger';

type Props = {
  token: string;
  inquiryId: string;
  inquiryNumber?: string | null;
  customerName?: string;
  compact?: boolean;
  hideHeader?: boolean;
};

function won(n: number): string {
  return `${n.toLocaleString('ko-KR')}원`;
}

export function TeamHouseholdLedgerInquiryAddPanel({
  token,
  inquiryId,
  inquiryNumber,
  customerName,
  compact,
  hideHeader,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<HouseholdLedgerPrefillOption[]>([]);
  const [categories, setCategories] = useState<HouseholdLedgerCategoriesResponse | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalInitial, setModalInitial] = useState<HouseholdLedgerModalInitial | null>(null);
  const [saving, setSaving] = useState(false);
  const [addingKind, setAddingKind] = useState<string | null>(null);
  const [suggestedOccurredOn, setSuggestedOccurredOn] = useState<string | undefined>(undefined);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [prefill, cats] = await Promise.all([
        getTeamHouseholdLedgerPrefill(token, inquiryId),
        getTeamHouseholdLedgerCategories(token),
      ]);
      setItems(prefill.items);
      setSuggestedOccurredOn(prefill.suggestedOccurredOn);
      setCategories(cats);
    } catch (e) {
      setError(e instanceof Error ? e.message : '금액 정보를 불러올 수 없습니다.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [token, inquiryId]);

  useEffect(() => {
    void load();
  }, [load]);

  const openWithOption = (opt: HouseholdLedgerPrefillOption) => {
    setModalInitial({
      direction: opt.direction,
      category: opt.category,
      amount: opt.amount,
      memo: opt.memoHint ?? undefined,
      inquiryId,
      prefillKind: opt.kind,
      inquiryNumber,
      customerName,
    });
    setModalOpen(true);
  };

  const quickAdd = async (opt: HouseholdLedgerPrefillOption) => {
    setAddingKind(opt.kind);
    try {
      await createTeamHouseholdLedgerEntry(token, {
        direction: opt.direction,
        category: opt.category,
        amount: opt.amount,
        memo: opt.memoHint,
        inquiryId,
        prefillKind: opt.kind,
        occurredOn: suggestedOccurredOn,
      });
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : '추가에 실패했습니다.');
    } finally {
      setAddingKind(null);
    }
  };

  const sectionTitle = compact ? 'text-fluid-2xs' : 'text-fluid-xs';

  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      {!hideHeader ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className={`font-semibold text-gray-600 ${sectionTitle}`}>가계부</span>
          <button
            type="button"
            onClick={() => {
              setModalInitial({
                inquiryId,
                inquiryNumber,
                customerName,
                prefillKind: 'manual',
              });
              setModalOpen(true);
            }}
            className="rounded-lg border border-slate-200 px-2 py-1 text-fluid-2xs font-semibold text-slate-700"
          >
            직접 입력
          </button>
        </div>
      ) : (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => {
              setModalInitial({
                inquiryId,
                inquiryNumber,
                customerName,
                prefillKind: 'manual',
              });
              setModalOpen(true);
            }}
            className="rounded-lg border border-slate-200 px-2 py-1 text-fluid-2xs font-semibold text-slate-700"
          >
            직접 입력
          </button>
        </div>
      )}

      {loading ? <p className="text-fluid-2xs text-slate-500">금액 불러오는 중…</p> : null}
      {error ? <p className="text-fluid-2xs text-red-600">{error}</p> : null}

      {!loading && !error && items.length === 0 ? (
        <p className="text-fluid-2xs text-slate-500">불러올 금액이 없습니다. 직접 입력해 주세요.</p>
      ) : null}

      {items.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          {items.map((opt) => (
            <div
              key={opt.kind}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50/80 px-2.5 py-2"
            >
              <div className="min-w-0">
                <p className="text-fluid-2xs font-semibold text-slate-900">{opt.label}</p>
                <p className="text-fluid-2xs text-slate-500">{opt.category}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <span
                  className={`text-fluid-xs font-bold tabular-nums ${
                    opt.direction === 'INCOME' ? 'text-emerald-800' : 'text-rose-800'
                  }`}
                >
                  {opt.direction === 'EXPENSE' ? '-' : ''}
                  {won(opt.amount)}
                </span>
                <button
                  type="button"
                  disabled={addingKind === opt.kind}
                  onClick={() => void quickAdd(opt)}
                  className="rounded-md bg-slate-900 px-2 py-1 text-fluid-2xs font-semibold text-white disabled:opacity-60"
                >
                  {addingKind === opt.kind ? '…' : '추가'}
                </button>
                <button
                  type="button"
                  onClick={() => openWithOption(opt)}
                  className="rounded-md border border-slate-200 px-2 py-1 text-fluid-2xs font-semibold text-slate-700"
                >
                  수정
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <TeamHouseholdLedgerEntryModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setModalInitial(null);
        }}
        categories={categories}
        initial={modalInitial}
        saving={saving}
        onSubmit={async (payload) => {
          setSaving(true);
          try {
            await createTeamHouseholdLedgerEntry(token, payload);
            await load();
          } finally {
            setSaving(false);
          }
        }}
      />
    </div>
  );
}
