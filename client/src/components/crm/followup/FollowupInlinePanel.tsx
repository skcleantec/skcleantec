import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  deferOrderFollowup,
  fetchOrderFollowup,
  listOrderFollowups,
  patchOrderFollowup,
  type OrderFollowupItem,
} from '../../../api/orderFollowups';
import {
  ORDER_FOLLOWUP_STATUS_LABEL,
  ORDER_FOLLOWUP_STATUS_OPTIONS,
  type OrderFollowupStatus,
} from '../../../constants/orderFollowupStatus';
import { FollowupListFilters } from '../../order-followup/FollowupListFilters';
import {
  buildFollowupListQuery,
  followupListQueryKey,
} from '../../order-followup/followupListQuery';
import { ListPaginationBar } from '../../ui/ListPaginationBar';
import { getToken } from '../../../stores/auth';
import { useCrmFollowupListFilters } from '../../../hooks/useCrmFollowupListFilters';
import { crmFollowupApplyFromItem } from '../../../utils/crmFollowupApply';
import { telecrmCall, telecrmDispatchNotice } from '../../../utils/telecrmNativeBridge';
import { resolveCrmOutboundPhone } from '../../../utils/crmContactPhone';
import { formatDateCompactWithWeekday } from '../../../utils/dateFormat';
import { shouldShowListBlockingLoading } from '../../../utils/listRefreshDisplay';

type DetailDraft = {
  customerName: string;
  nickname: string;
  contactPhone: string;
  safePhone: string;
  status: OrderFollowupStatus;
  memo: string;
  preferredMoveInCleanYmd: string;
  goldDb: boolean;
};

function itemToDraft(item: OrderFollowupItem): DetailDraft {
  const { contactPhone, safePhone } = crmFollowupApplyFromItem(item);
  return {
    customerName: item.customerName,
    nickname: item.nickname?.trim() ?? '',
    contactPhone,
    safePhone,
    status: item.status,
    memo: item.memo?.trim() ?? '',
    preferredMoveInCleanYmd: item.preferredMoveInCleaningDate?.trim() ?? '',
    goldDb: item.goldDb,
  };
}

function displayPhone(row: OrderFollowupItem): string {
  const t = row.customerPhone?.trim();
  return t || '—';
}

/** CRM 부재·보류 — 목록 + 상세 편집 (인라인) */
export function FollowupInlinePanel({
  operatingCompanyId,
  selectedFollowupId,
  onSelectFollowupId,
  crmPhone = '',
  onApplyToCrm,
  onSaved,
}: {
  operatingCompanyId: string | null;
  selectedFollowupId: string | null;
  onSelectFollowupId: (id: string | null) => void;
  crmPhone?: string;
  onApplyToCrm: (item: OrderFollowupItem) => void;
  onSaved?: () => void;
}) {
  const token = getToken();
  const {
    filters,
    patchFilters,
    listPage,
    listPageSize,
    total,
    setTotal,
    handleListPageChange,
    handleListPageSizeChange,
  } = useCrmFollowupListFilters();

  const [items, setItems] = useState<OrderFollowupItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<OrderFollowupItem | null>(null);
  const [draft, setDraft] = useState<DetailDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const crmPhoneDigits = useMemo(() => crmPhone.replace(/\D/g, ''), [crmPhone]);
  const crmPhoneAvailable = crmPhoneDigits.length >= 4;

  const listQueryKey = useMemo(
    () => followupListQueryKey(filters, listPage, listPageSize),
    [filters, listPage, listPageSize],
  );

  const loadList = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!token) return;
      const silent = opts?.silent === true;
      if (!silent) setLoading(true);
      setError(null);
      try {
        const res = await listOrderFollowups(
          token,
          buildFollowupListQuery({
            filters,
            operatingCompanyId,
            crmPhone,
            listPage,
            listPageSize,
          }),
        );
        setItems(res.items);
        setTotal(typeof res.total === 'number' ? res.total : res.items.length);
      } catch (e) {
        setError(e instanceof Error ? e.message : '목록을 불러올 수 없습니다.');
        setItems([]);
        setTotal(0);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [token, filters, operatingCompanyId, crmPhone, listPage, listPageSize, setTotal],
  );

  useEffect(() => {
    void loadList();
  }, [listQueryKey, loadList]);

  const loadSelected = useCallback(
    async (id: string) => {
      if (!token) return;
      setBusy(true);
      setError(null);
      try {
        const res = await fetchOrderFollowup(token, id);
        setSelected(res.item);
        setDraft(itemToDraft(res.item));
      } catch (e) {
        setError(e instanceof Error ? e.message : '상세를 불러올 수 없습니다.');
        setSelected(null);
        setDraft(null);
      } finally {
        setBusy(false);
      }
    },
    [token],
  );

  useEffect(() => {
    if (!selectedFollowupId) {
      setSelected(null);
      setDraft(null);
      return;
    }
    void loadSelected(selectedFollowupId);
  }, [selectedFollowupId, loadSelected]);

  const selectRow = (row: OrderFollowupItem) => {
    onSelectFollowupId(row.id);
    setSelected(row);
    setDraft(itemToDraft(row));
  };

  const refreshAfterMutation = useCallback(async () => {
    await loadList({ silent: true });
    onSaved?.();
  }, [loadList, onSaved]);

  const saveDetail = async () => {
    if (!token || !selected || !draft) return;
    if (!draft.customerName.trim()) {
      setError('고객명을 입력해 주세요.');
      return;
    }
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const primary = draft.contactPhone.trim() || draft.safePhone.trim();
      const res = await patchOrderFollowup(token, selected.id, {
        customerName: draft.customerName.trim(),
        nickname: draft.nickname.trim() || null,
        customerPhone: primary,
        customerPhone2:
          draft.contactPhone.trim() && draft.safePhone.trim() ? draft.safePhone.trim() : null,
        status: draft.status,
        memo: draft.memo.trim() || null,
        preferredMoveInCleaningDate: draft.preferredMoveInCleanYmd.trim() || null,
        goldDb: draft.goldDb,
      });
      setSelected(res.item);
      setDraft(itemToDraft(res.item));
      setMsg('저장했습니다.');
      window.setTimeout(() => setMsg(null), 3000);
      await refreshAfterMutation();
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setBusy(false);
    }
  };

  const handleDefer = async () => {
    if (!token || !selected) return;
    setBusy(true);
    setError(null);
    try {
      const res = await deferOrderFollowup(token, selected.id);
      setSelected(res.item);
      setDraft(itemToDraft(res.item));
      setMsg('부재 횟수를 누적했습니다.');
      window.setTimeout(() => setMsg(null), 3000);
      await refreshAfterMutation();
    } catch (e) {
      setError(e instanceof Error ? e.message : '부재+1 실패');
    } finally {
      setBusy(false);
    }
  };

  const handleCall = async () => {
    if (!draft) return;
    const dial = resolveCrmOutboundPhone(draft.contactPhone, draft.safePhone);
    if (dial.replace(/\D/g, '').length < 8) {
      setError('통화할 연락처가 없습니다.');
      return;
    }
    const result = await telecrmCall(dial, {
      customerMatch: 'existing',
      inquiryId: selected?.inquiryId ?? undefined,
    });
    const notice = telecrmDispatchNotice(result, 'call');
    if (notice) setMsg(notice);
  };

  const handleApply = () => {
    if (!selected) return;
    onApplyToCrm(selected);
  };

  const emptyMessage = filters.filterGoldDbOnly
    ? '골드DB 건이 없습니다.'
    : filters.listDateBasis === 'preferredMoveIn' && filters.datePreset !== 'all'
      ? '선택한 희망일 범위에 맞는 건이 없습니다.'
      : filters.phoneLock && crmPhoneAvailable
        ? 'CRM 연락처와 일치하는 부재·보류 건이 없습니다.'
        : '부재·보류 건이 없습니다.';

  return (
    <div className="flex min-h-0 flex-col gap-3">
      {msg ? (
        <p className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-fluid-xs text-green-800">
          {msg}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-fluid-xs text-red-700">
          {error}
        </p>
      ) : null}

      <FollowupListFilters
        compact
        listDateBasis={filters.listDateBasis}
        onListDateBasisChange={(v) => patchFilters({ listDateBasis: v })}
        datePreset={filters.datePreset}
        onDatePresetChange={(v) => patchFilters({ datePreset: v })}
        dateMonthKey={filters.dateMonthKey}
        onDateMonthKeyChange={(v) => patchFilters({ dateMonthKey: v })}
        dateDayKey={filters.dateDayKey}
        onDateDayKeyChange={(v) => patchFilters({ dateDayKey: v })}
        filterStatus={filters.filterStatus}
        onFilterStatusChange={(v) => patchFilters({ filterStatus: v })}
        filterCustomerName={filters.filterCustomerName}
        onFilterCustomerNameChange={(v) => patchFilters({ filterCustomerName: v })}
        filterGoldDbOnly={filters.filterGoldDbOnly}
        onFilterGoldDbOnlyChange={(v) => patchFilters({ filterGoldDbOnly: v })}
        brandScope={filters.brandScope}
        onBrandScopeChange={(v) => patchFilters({ brandScope: v })}
        showBrandScope
        phoneLock={filters.phoneLock}
        onPhoneLockChange={(v) => patchFilters({ phoneLock: v })}
        crmPhoneAvailable={crmPhoneAvailable}
        listPage={listPage}
        listPageSize={listPageSize}
        total={total}
        onPageChange={handleListPageChange}
        onPageSizeChange={handleListPageSizeChange}
      />

      <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-gray-200 bg-white">
        {shouldShowListBlockingLoading(loading, items.length) ? (
          <p className="p-4 text-center text-fluid-xs text-gray-500">불러오는 중…</p>
        ) : items.length === 0 ? (
          <p className="p-4 text-center text-fluid-xs text-gray-500">{emptyMessage}</p>
        ) : (
          <ul className="max-h-48 divide-y divide-gray-100 overflow-y-auto overscroll-contain">
            {items.map((row) => {
              const active = row.id === selectedFollowupId;
              return (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => selectRow(row)}
                    className={`flex w-full items-start gap-2 px-3 py-2 text-left text-fluid-xs hover:bg-amber-50/60 ${
                      active ? 'bg-amber-50 ring-1 ring-inset ring-amber-200' : ''
                    } ${row.goldDb ? 'bg-amber-50/30' : ''}`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="font-semibold text-gray-900">{row.customerName}</span>
                      {row.nickname?.trim() ? (
                        <span className="ml-1 text-gray-500">({row.nickname})</span>
                      ) : null}
                      {row.goldDb ? (
                        <span className="ml-1 rounded bg-amber-200/80 px-1 text-[9px] font-semibold text-amber-900">
                          골드
                        </span>
                      ) : null}
                      <span className="ml-2 tabular-nums text-gray-600">{displayPhone(row)}</span>
                      {row.memo ? (
                        <p className="mt-0.5 line-clamp-1 text-[10px] text-gray-500">{row.memo}</p>
                      ) : null}
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block font-medium text-amber-900">
                        {ORDER_FOLLOWUP_STATUS_LABEL[row.status]}
                      </span>
                      <span className="text-[10px] text-gray-400">
                        {formatDateCompactWithWeekday(row.createdAt)}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {!loading ? (
        <ListPaginationBar
          mode="nav"
          page={listPage}
          pageSize={listPageSize}
          total={total}
          onPageChange={handleListPageChange}
          onPageSizeChange={handleListPageSizeChange}
        />
      ) : null}

      {selected && draft ? (
        <div className="space-y-3 rounded-xl border border-amber-200/80 bg-amber-50/30 p-3">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleApply}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-fluid-xs font-semibold text-white hover:bg-emerald-700"
            >
              CRM 접수란으로 가져오기
            </button>
            <button
              type="button"
              onClick={() => void handleCall()}
              className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-fluid-xs font-semibold text-sky-800 hover:bg-sky-100"
            >
              전화
            </button>
            {selected.status !== 'FULFILLED' ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleDefer()}
                className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-fluid-xs font-semibold text-amber-900 hover:bg-amber-50 disabled:opacity-50"
              >
                부재+1 ({selected.deferCount})
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => void loadList()}
              className="ml-auto rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-fluid-xs text-gray-600 hover:bg-gray-50"
            >
              새로고침
            </button>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <label className="block space-y-0.5 sm:col-span-2">
              <span className="text-[11px] font-medium text-gray-700">고객명</span>
              <input
                type="text"
                value={draft.customerName}
                onChange={(e) => setDraft((d) => (d ? { ...d, customerName: e.target.value } : d))}
                className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-fluid-sm"
              />
            </label>
            <label className="block space-y-0.5">
              <span className="text-[11px] font-medium text-gray-700">닉네임</span>
              <input
                type="text"
                value={draft.nickname}
                onChange={(e) => setDraft((d) => (d ? { ...d, nickname: e.target.value } : d))}
                className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-fluid-sm"
              />
            </label>
            <label className="block space-y-0.5">
              <span className="text-[11px] font-medium text-gray-700">상태</span>
              <select
                value={draft.status}
                onChange={(e) =>
                  setDraft((d) => (d ? { ...d, status: e.target.value as OrderFollowupStatus } : d))
                }
                className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-fluid-sm"
              >
                {ORDER_FOLLOWUP_STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-0.5">
              <span className="text-[11px] font-medium text-gray-700">연락처</span>
              <input
                type="text"
                value={draft.contactPhone}
                onChange={(e) => setDraft((d) => (d ? { ...d, contactPhone: e.target.value } : d))}
                className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-fluid-sm"
              />
            </label>
            <label className="block space-y-0.5">
              <span className="text-[11px] font-medium text-gray-700">안심번호</span>
              <input
                type="text"
                value={draft.safePhone}
                onChange={(e) => setDraft((d) => (d ? { ...d, safePhone: e.target.value } : d))}
                className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-fluid-sm"
              />
            </label>
            <label className="block space-y-0.5 sm:col-span-2">
              <span className="text-[11px] font-medium text-gray-700">입주청소 희망일</span>
              <input
                type="date"
                value={draft.preferredMoveInCleanYmd}
                onChange={(e) =>
                  setDraft((d) => (d ? { ...d, preferredMoveInCleanYmd: e.target.value } : d))
                }
                className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-fluid-sm"
              />
            </label>
            <label className="flex items-center gap-2 sm:col-span-2">
              <input
                type="checkbox"
                checked={draft.goldDb}
                onChange={(e) => setDraft((d) => (d ? { ...d, goldDb: e.target.checked } : d))}
                className="rounded border-gray-300"
              />
              <span className="text-fluid-xs font-medium text-gray-700">골드DB</span>
            </label>
            <label className="block space-y-0.5 sm:col-span-2">
              <span className="text-[11px] font-medium text-gray-700">메모</span>
              <textarea
                value={draft.memo}
                onChange={(e) => setDraft((d) => (d ? { ...d, memo: e.target.value } : d))}
                rows={3}
                className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-fluid-sm"
              />
            </label>
          </div>

          <button
            type="button"
            disabled={busy}
            onClick={() => void saveDetail()}
            className="rounded-lg bg-slate-900 px-4 py-2 text-fluid-sm text-white disabled:opacity-50"
          >
            {busy ? '저장 중…' : '저장'}
          </button>
        </div>
      ) : (
        <p className="text-fluid-xs text-gray-500">목록에서 건을 선택하면 상세·편집할 수 있습니다.</p>
      )}
    </div>
  );
}
