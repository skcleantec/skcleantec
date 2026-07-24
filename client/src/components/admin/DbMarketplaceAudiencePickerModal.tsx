import { useCallback, useEffect, useMemo, useState } from 'react';
import { getToken } from '../../stores/auth';
import {
  listDbMarketplaceAudienceOptions,
  type DbMarketplaceAudienceInput,
  type DbMarketplaceOfferMode,
} from '../../api/dbMarketplace';
import { ModalCloseButton } from './ModalCloseButton';

const EMPTY_ID_LIST: string[] = [];

export type DbMarketplaceAudiencePickerValue = {
  visibility: 'ALL' | 'SELECTED';
  offerMode?: DbMarketplaceOfferMode | null;
  audiences: DbMarketplaceAudienceInput[];
};

type AudienceOption = { key: string; label: string; kind: 'PARTNER_TENANT' | 'EXTERNAL_COMPANY'; id: string };

function optionKey(kind: 'PARTNER_TENANT' | 'EXTERNAL_COMPANY', id: string): string {
  return kind === 'PARTNER_TENANT' ? `P:${id}` : `E:${id}`;
}

function parseOptionKey(key: string): AudienceOption | null {
  if (key.startsWith('P:')) {
    return { key, kind: 'PARTNER_TENANT', id: key.slice(2), label: '' };
  }
  if (key.startsWith('E:')) {
    return { key, kind: 'EXTERNAL_COMPANY', id: key.slice(2), label: '' };
  }
  return null;
}

function audienceInputFromKey(key: string, rank?: number): DbMarketplaceAudienceInput | null {
  const parsed = parseOptionKey(key);
  if (!parsed) return null;
  if (parsed.kind === 'PARTNER_TENANT') {
    return {
      audienceKind: 'PARTNER_TENANT',
      partnerTenantId: parsed.id,
      priorityRank: rank,
    };
  }
  return {
    audienceKind: 'EXTERNAL_COMPANY',
    externalCompanyId: parsed.id,
    priorityRank: rank,
  };
}

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: (value: DbMarketplaceAudiencePickerValue) => void | Promise<void>;
  confirmLabel?: string;
  busy?: boolean;
  title?: string;
  description?: string;
  initialVisibility?: 'ALL' | 'SELECTED';
  initialOfferMode?: DbMarketplaceOfferMode | null;
  initialPartnerIds?: string[];
  initialExternalIds?: string[];
  initialPriorityKeys?: Partial<Record<1 | 2 | 3, string>>;
};

export function DbMarketplaceAudiencePickerModal({
  open,
  onClose,
  onConfirm,
  confirmLabel = '확인',
  busy = false,
  title = '노출 대상',
  description,
  initialVisibility = 'ALL',
  initialOfferMode = 'SIMULTANEOUS',
  initialPartnerIds = EMPTY_ID_LIST,
  initialExternalIds = EMPTY_ID_LIST,
  initialPriorityKeys = {},
}: Props) {
  const token = getToken();
  const [visibility, setVisibility] = useState<'ALL' | 'SELECTED'>(initialVisibility);
  const [offerMode, setOfferMode] = useState<DbMarketplaceOfferMode>(
    initialOfferMode === 'PRIORITY' ? 'PRIORITY' : 'SIMULTANEOUS',
  );
  const [selectedPartnerIds, setSelectedPartnerIds] = useState<string[]>(initialPartnerIds);
  const [selectedExternalIds, setSelectedExternalIds] = useState<string[]>(initialExternalIds);
  const [priorityKeys, setPriorityKeys] = useState<Partial<Record<1 | 2 | 3, string>>>(initialPriorityKeys);
  const [partnerOptions, setPartnerOptions] = useState<{ id: string; name: string }[]>([]);
  const [externalCompanies, setExternalCompanies] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setVisibility(initialVisibility);
    setOfferMode(initialOfferMode === 'PRIORITY' ? 'PRIORITY' : 'SIMULTANEOUS');
    setSelectedPartnerIds(initialPartnerIds);
    setSelectedExternalIds(initialExternalIds);
    setPriorityKeys(initialPriorityKeys);
  }, [open]);

  useEffect(() => {
    if (!open || !token) return;
    setLoading(true);
    setLoadError(null);
    void listDbMarketplaceAudienceOptions(token)
      .then(({ partners, externalCompanies: externals }) => {
        setPartnerOptions(partners.map((p) => ({ id: p.id, name: p.name })));
        setExternalCompanies(externals.map((e) => ({ id: e.id, name: e.name })));
      })
      .catch((e) => {
        setPartnerOptions([]);
        setExternalCompanies([]);
        setLoadError(e instanceof Error ? e.message : '업체 목록을 불러올 수 없습니다.');
      })
      .finally(() => setLoading(false));
  }, [open, token]);

  const allOptions: AudienceOption[] = useMemo(() => {
    const out: AudienceOption[] = [];
    for (const p of partnerOptions) {
      out.push({
        key: optionKey('PARTNER_TENANT', p.id),
        label: `[파트너] ${p.name}`,
        kind: 'PARTNER_TENANT',
        id: p.id,
      });
    }
    for (const e of externalCompanies) {
      out.push({
        key: optionKey('EXTERNAL_COMPANY', e.id),
        label: `[타업체] ${e.name}`,
        kind: 'EXTERNAL_COMPANY',
        id: e.id,
      });
    }
    return out.sort((a, b) => a.label.localeCompare(b.label, 'ko'));
  }, [partnerOptions, externalCompanies]);

  const buildAudiences = useCallback((): DbMarketplaceAudienceInput[] => {
    if (offerMode === 'PRIORITY') {
      const out: DbMarketplaceAudienceInput[] = [];
      for (const rank of [1, 2, 3] as const) {
        const key = priorityKeys[rank];
        if (!key) continue;
        const row = audienceInputFromKey(key, rank);
        if (row) out.push(row);
      }
      return out;
    }
    const out: DbMarketplaceAudienceInput[] = [];
    for (const id of selectedPartnerIds) {
      out.push({ audienceKind: 'PARTNER_TENANT', partnerTenantId: id });
    }
    for (const id of selectedExternalIds) {
      out.push({ audienceKind: 'EXTERNAL_COMPANY', externalCompanyId: id });
    }
    return out;
  }, [offerMode, priorityKeys, selectedExternalIds, selectedPartnerIds]);

  const handleConfirm = () => {
    if (visibility === 'SELECTED' && offerMode === 'SIMULTANEOUS') {
      if (selectedPartnerIds.length + selectedExternalIds.length === 0) {
        alert('노출할 업체를 1곳 이상 선택해 주세요.');
        return;
      }
    }
    if (visibility === 'SELECTED' && offerMode === 'PRIORITY') {
      if (!priorityKeys[1]) {
        alert('1순위 구매 후보를 선택해 주세요.');
        return;
      }
    }
    void onConfirm({
      visibility,
      offerMode: visibility === 'SELECTED' ? offerMode : null,
      audiences: buildAudiences(),
    });
  };

  const renderPrioritySelect = (rank: 1 | 2 | 3, required: boolean) => (
    <label key={rank} className="flex flex-col gap-1">
      <span className="text-[11px] font-medium text-gray-700">
        {rank}순위{required ? '' : ' (선택)'}
      </span>
      <select
        value={priorityKeys[rank] ?? ''}
        onChange={(e) => {
          const v = e.target.value;
          setPriorityKeys((prev) => {
            const next = { ...prev };
            if (v) next[rank] = v;
            else delete next[rank];
            return next;
          });
        }}
        className="min-h-[2.5rem] w-full rounded-lg border border-gray-200 px-2 text-[11px] sm:min-h-9"
      >
        <option value="">{required ? '업체 선택' : '—'}</option>
        {allOptions.map((o) => (
          <option key={o.key} value={o.key}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
      <div className="flex w-full max-w-md max-h-[min(90vh,100dvh)] flex-col rounded-t-2xl sm:rounded-2xl bg-white shadow-xl">
        <div className="sticky top-0 z-10 relative flex shrink-0 items-center justify-between border-b border-gray-100 bg-white px-4 py-3 pr-12">
          <h2 className="min-w-0 text-fluid-sm font-semibold text-slate-900">{title}</h2>
          <ModalCloseButton onClick={onClose} />
        </div>
        <div
          className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain p-4 space-y-3"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {description ? (
            <p className="text-[11px] text-gray-600 leading-relaxed">{description}</p>
          ) : null}
          {loading ? <p className="text-[11px] text-gray-500">업체 목록 불러오는 중…</p> : null}
          {loadError ? <p className="text-[11px] text-red-600">{loadError}</p> : null}
          <div className="flex gap-2">
            {(['ALL', 'SELECTED'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setVisibility(v)}
                className={`min-h-[2.5rem] flex-1 rounded-lg px-3 py-2 text-[11px] font-medium sm:min-h-0 sm:flex-none sm:py-1.5 ${
                  visibility === v ? 'bg-slate-900 text-white' : 'border border-gray-200 text-gray-600'
                }`}
              >
                {v === 'ALL' ? '연결된 전체' : '업체 선택'}
              </button>
            ))}
          </div>
          {visibility === 'ALL' ? (
            <p className="text-[11px] text-gray-500">
              ACTIVE 파트너·등록 타업체 전체에 노출됩니다. 연결·등록되지 않은 업체는 볼 수 없습니다.
            </p>
          ) : null}
          {visibility === 'SELECTED' ? (
            <>
              <div className="flex gap-2">
                {(['SIMULTANEOUS', 'PRIORITY'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setOfferMode(m)}
                    className={`min-h-[2.5rem] flex-1 rounded-lg px-2 py-2 text-[11px] font-medium sm:min-h-0 sm:py-1.5 ${
                      offerMode === m ? 'bg-violet-700 text-white' : 'border border-gray-200 text-gray-600'
                    }`}
                  >
                    {m === 'SIMULTANEOUS' ? '동시 노출' : '순위 노출'}
                  </button>
                ))}
              </div>
              {offerMode === 'SIMULTANEOUS' ? (
                <div className="max-h-[min(40vh,16rem)] overflow-y-auto space-y-2 text-[11px]">
                  {!loading && partnerOptions.length === 0 && externalCompanies.length === 0 ? (
                    <p className="text-gray-500">
                      연결된 파트너·등록 타업체가 없습니다. 「연결된 전체」를 사용하세요.
                    </p>
                  ) : null}
                  {partnerOptions.length > 0 ? (
                    <div>
                      <p className="font-medium text-gray-700 mb-1">파트너</p>
                      {partnerOptions.map((p) => (
                        <label key={p.id} className="flex min-h-[2.25rem] items-center gap-2 py-0.5">
                          <input
                            type="checkbox"
                            checked={selectedPartnerIds.includes(p.id)}
                            onChange={(e) => {
                              setSelectedPartnerIds((prev) =>
                                e.target.checked ? [...prev, p.id] : prev.filter((x) => x !== p.id),
                              );
                            }}
                          />
                          {p.name}
                        </label>
                      ))}
                    </div>
                  ) : null}
                  {externalCompanies.length > 0 ? (
                    <div>
                      <p className="font-medium text-gray-700 mb-1">타업체</p>
                      {externalCompanies.map((e) => (
                        <label key={e.id} className="flex min-h-[2.25rem] items-center gap-2 py-0.5">
                          <input
                            type="checkbox"
                            checked={selectedExternalIds.includes(e.id)}
                            onChange={(ev) => {
                              setSelectedExternalIds((prev) =>
                                ev.target.checked ? [...prev, e.id] : prev.filter((x) => x !== e.id),
                              );
                            }}
                          />
                          {e.name}
                        </label>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="space-y-2 text-[11px]">
                  <p className="text-gray-500 leading-relaxed">
                    1순위 업체만 먼저 「구매 가능」에 표시됩니다. 현재 순위 업체가 거절하면 2·3순위로
                    넘어갑니다. 3순위까지 거절되면 장바구니로 돌아갑니다.
                  </p>
                  {renderPrioritySelect(1, true)}
                  {renderPrioritySelect(2, false)}
                  {renderPrioritySelect(3, false)}
                </div>
              )}
            </>
          ) : null}
          <div className="sticky bottom-0 -mx-4 flex flex-col-reverse gap-2 border-t border-gray-100 bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:flex-row sm:justify-end">
            <button
              type="button"
              className="min-h-[2.75rem] w-full rounded-lg px-3 py-2 text-[11px] text-gray-600 sm:min-h-0 sm:w-auto"
              onClick={onClose}
            >
              취소
            </button>
            <button
              type="button"
              disabled={busy || loading}
              className="min-h-[2.75rem] w-full rounded-lg bg-violet-700 px-3 py-2 text-[11px] font-medium text-white disabled:opacity-50 sm:min-h-0 sm:w-auto"
              onClick={handleConfirm}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
