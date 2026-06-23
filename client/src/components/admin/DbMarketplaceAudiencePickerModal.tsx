import { useCallback, useEffect, useState } from 'react';
import { getToken } from '../../stores/auth';
import { listExternalCompanies } from '../../api/externalCompanies';
import { listTenantPartnerships } from '../../api/tenantPartners';
import type { DbMarketplaceAudienceInput } from '../../api/dbMarketplace';
import { ModalCloseButton } from './ModalCloseButton';

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
  initialPartnerIds = [],
  initialExternalIds = [],
}: Props) {
  const token = getToken();
  const [visibility, setVisibility] = useState<'ALL' | 'SELECTED'>(initialVisibility);
  const [selectedPartnerIds, setSelectedPartnerIds] = useState<string[]>(initialPartnerIds);
  const [selectedExternalIds, setSelectedExternalIds] = useState<string[]>(initialExternalIds);
  const [partnerOptions, setPartnerOptions] = useState<{ id: string; name: string }[]>([]);
  const [externalCompanies, setExternalCompanies] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setVisibility(initialVisibility);
    setSelectedPartnerIds(initialPartnerIds);
    setSelectedExternalIds(initialExternalIds);
  }, [open, initialVisibility, initialPartnerIds, initialExternalIds]);

  useEffect(() => {
    if (!open || !token) return;
    setLoading(true);
    void Promise.all([listTenantPartnerships(token), listExternalCompanies(token)])
      .then(([partnerRes, extRes]) => {
        setPartnerOptions(
          partnerRes.items.filter((p) => p.status === 'ACTIVE').map((p) => ({ id: p.partner.id, name: p.partner.name })),
        );
        setExternalCompanies(extRes.items.map((e) => ({ id: e.id, name: e.name })));
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
      <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white shadow-xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white px-4 py-3">
          <h2 className="text-fluid-sm font-semibold text-slate-900">{title}</h2>
          <ModalCloseButton onClick={onClose} />
        </div>
        <div className="p-4 space-y-3">
          {description ? <p className="text-[11px] text-gray-600 leading-relaxed">{description}</p> : null}
          {loading ? <p className="text-[11px] text-gray-500">업체 목록 불러오는 중…</p> : null}
          <div className="flex gap-2">
            {(['ALL', 'SELECTED'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setVisibility(v)}
                className={`rounded-lg px-3 py-1.5 text-[11px] font-medium ${
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
            <div className="max-h-48 overflow-y-auto space-y-2 text-[11px]">
              {partnerOptions.length > 0 ? (
                <div>
                  <p className="font-medium text-gray-700 mb-1">파트너</p>
                  {partnerOptions.map((p) => (
                    <label key={p.id} className="flex items-center gap-2 py-0.5">
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
                    <label key={e.id} className="flex items-center gap-2 py-0.5">
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
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              className="rounded-lg px-3 py-1.5 text-[11px] text-gray-600"
              onClick={onClose}
            >
              취소
            </button>
            <button
              type="button"
              disabled={busy || loading}
              className="rounded-lg bg-violet-700 px-3 py-1.5 text-[11px] font-medium text-white disabled:opacity-50"
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
