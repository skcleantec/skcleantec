import { useCallback, useEffect, useState } from 'react';
import { getToken } from '../../stores/auth';
import { listDbMarketplaceAudienceOptions, type DbMarketplaceAudienceInput } from '../../api/dbMarketplace';
import { ModalCloseButton } from './ModalCloseButton';

const EMPTY_ID_LIST: string[] = [];

export type DbMarketplaceAudiencePickerValue = {
  visibility: 'ALL' | 'SELECTED';
  audiences: DbMarketplaceAudienceInput[];
};

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: (value: DbMarketplaceAudiencePickerValue) => void | Promise<void>;
  confirmLabel?: string;
  busy?: boolean;
  title?: string;
  description?: string;
  initialVisibility?: 'ALL' | 'SELECTED';
  initialPartnerIds?: string[];
  initialExternalIds?: string[];
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
  initialPartnerIds = EMPTY_ID_LIST,
  initialExternalIds = EMPTY_ID_LIST,
}: Props) {
  const token = getToken();
  const [visibility, setVisibility] = useState<'ALL' | 'SELECTED'>(initialVisibility);
  const [selectedPartnerIds, setSelectedPartnerIds] = useState<string[]>(initialPartnerIds);
  const [selectedExternalIds, setSelectedExternalIds] = useState<string[]>(initialExternalIds);
  const [partnerOptions, setPartnerOptions] = useState<{ id: string; name: string }[]>([]);
  const [externalCompanies, setExternalCompanies] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // open 시 1회만 초기값 반영 — 기본 [] 참조·내부 state 변경마다 reset 되면 세그먼트(업체 선택)가 안 먹음
  useEffect(() => {
    if (!open) return;
    setVisibility(initialVisibility);
    setSelectedPartnerIds(initialPartnerIds);
    setSelectedExternalIds(initialExternalIds);
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

  const buildAudiences = useCallback((): DbMarketplaceAudienceInput[] => {
    const out: DbMarketplaceAudienceInput[] = [];
    for (const id of selectedPartnerIds) {
      out.push({ audienceKind: 'PARTNER_TENANT', partnerTenantId: id });
    }
    for (const id of selectedExternalIds) {
      out.push({ audienceKind: 'EXTERNAL_COMPANY', externalCompanyId: id });
    }
    return out;
  }, [selectedPartnerIds, selectedExternalIds]);

  const handleConfirm = () => {
    if (visibility === 'SELECTED' && selectedPartnerIds.length + selectedExternalIds.length === 0) {
      alert('노출할 업체를 1곳 이상 선택해 주세요.');
      return;
    }
    void onConfirm({ visibility, audiences: buildAudiences() });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
      <div className="flex w-full max-w-md max-h-[min(90vh,100dvh)] flex-col rounded-t-2xl sm:rounded-2xl bg-white shadow-xl">
        <div className="sticky top-0 z-10 relative flex shrink-0 items-center justify-between border-b border-gray-100 bg-white px-4 py-3 pr-12">
          <h2 className="min-w-0 text-fluid-sm font-semibold text-slate-900">{title}</h2>
          <ModalCloseButton onClick={onClose} />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain p-4 space-y-3" style={{ WebkitOverflowScrolling: 'touch' }}>
          {description ? <p className="text-[11px] text-gray-600 leading-relaxed">{description}</p> : null}
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
            <div className="max-h-[min(40vh,16rem)] overflow-y-auto space-y-2 text-[11px]">
              {!loading && partnerOptions.length === 0 && externalCompanies.length === 0 ? (
                <p className="text-gray-500">연결된 파트너·등록 타업체가 없습니다. 「연결된 전체」를 사용하세요.</p>
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
