import { useCallback, useEffect, useState } from 'react';
import { getToken } from '../../stores/auth';
import {
  confirmDbMarketplaceSeller,
  getDbListingByInquiry,
  publishDbMarketplaceListing,
  updateDbMarketplaceAudience,
  upsertDbMarketplaceDraft,
  withdrawDbMarketplaceListing,
  type DbMarketplaceAudienceInput,
  type DbMarketplaceSellerListing,
} from '../../api/dbMarketplace';
import { listExternalCompanies } from '../../api/externalCompanies';
import { listTenantPartnerships, type TenantPartnershipItem } from '../../api/tenantPartners';
import { computeMarketplaceDisplayAmount } from '@shared/dbMarketplaceAmount';

type Props = {
  inquiryId: string;
  serviceBalanceAmount: number | null | undefined;
  disabled?: boolean;
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: '장바구니',
  OPEN: '게시 중',
  PENDING_SELLER: '구매자 확정 · 인계 대기',
  CONFIRMED: '확정 완료',
  WITHDRAWN: '철회됨',
};

export function InquiryDbMarketplaceSellPanel({ inquiryId, serviceBalanceAmount, disabled }: Props) {
  const token = getToken();
  const [listing, setListing] = useState<DbMarketplaceSellerListing | null>(null);
  const [listingFeeInput, setListingFeeInput] = useState('');
  const [visibility, setVisibility] = useState<'ALL' | 'SELECTED'>('ALL');
  const [selectedPartnerIds, setSelectedPartnerIds] = useState<string[]>([]);
  const [selectedExternalIds, setSelectedExternalIds] = useState<string[]>([]);
  const [partnerships, setPartnerships] = useState<TenantPartnershipItem[]>([]);
  const [externalCompanies, setExternalCompanies] = useState<{ id: string; name: string }[]>([]);
  const [showAudienceModal, setShowAudienceModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const previewAmount = computeMarketplaceDisplayAmount(
    serviceBalanceAmount,
    Number(listingFeeInput.replace(/,/g, '')) || 0,
  );

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [listingRow, partnerRes, extRes] = await Promise.all([
        getDbListingByInquiry(token, inquiryId),
        listTenantPartnerships(token),
        listExternalCompanies(token),
      ]);
      setListing(listingRow);
      setPartnerships(partnerRes.items.filter((p) => p.status === 'ACTIVE'));
      setExternalCompanies(extRes.items.map((e) => ({ id: e.id, name: e.name })));
      if (listingRow) {
        setListingFeeInput(listingRow.listingFee.toLocaleString('ko-KR'));
        setVisibility(listingRow.visibility);
        setSelectedPartnerIds(
          listingRow.audiences
            .filter((a) => a.audienceKind === 'PARTNER_TENANT' && a.partnerTenantId)
            .map((a) => a.partnerTenantId as string),
        );
        setSelectedExternalIds(
          listingRow.audiences
            .filter((a) => a.audienceKind === 'EXTERNAL_COMPANY' && a.externalCompanyId)
            .map((a) => a.externalCompanyId as string),
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '불러오기 실패');
    } finally {
      setLoading(false);
    }
  }, [token, inquiryId]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveDraft = async () => {
    if (!token) return;
    const fee = Number(listingFeeInput.replace(/,/g, ''));
    if (!Number.isFinite(fee) || fee < 0) {
      alert('수수료를 입력해 주세요.');
      return;
    }
    setBusy(true);
    try {
      const row = await upsertDbMarketplaceDraft(token, inquiryId, fee);
      setListing(row);
      alert('판매 장바구니에 담았습니다.');
    } catch (e) {
      alert(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setBusy(false);
    }
  };

  const buildAudiences = (): DbMarketplaceAudienceInput[] => {
    const out: DbMarketplaceAudienceInput[] = [];
    for (const id of selectedPartnerIds) {
      out.push({ audienceKind: 'PARTNER_TENANT', partnerTenantId: id });
    }
    for (const id of selectedExternalIds) {
      out.push({ audienceKind: 'EXTERNAL_COMPANY', externalCompanyId: id });
    }
    return out;
  };

  const saveAudience = async () => {
    if (!token || !listing) return;
    setBusy(true);
    try {
      const row = await updateDbMarketplaceAudience(token, listing.id, visibility, buildAudiences());
      setListing(row);
      setShowAudienceModal(false);
    } catch (e) {
      alert(e instanceof Error ? e.message : '노출 대상 저장 실패');
    } finally {
      setBusy(false);
    }
  };

  const publish = async () => {
    if (!token || !listing) return;
    if (!window.confirm('정보공유 마켓에 게시할까요?')) return;
    setBusy(true);
    try {
      const row = await publishDbMarketplaceListing(token, listing.id);
      setListing(row);
    } catch (e) {
      alert(e instanceof Error ? e.message : '게시 실패');
    } finally {
      setBusy(false);
    }
  };

  const withdraw = async () => {
    if (!token || !listing) return;
    if (!window.confirm('게시를 철회할까요?')) return;
    setBusy(true);
    try {
      const row = await withdrawDbMarketplaceListing(token, listing.id);
      setListing(row);
    } catch (e) {
      alert(e instanceof Error ? e.message : '철회 실패');
    } finally {
      setBusy(false);
    }
  };

  const sellerConfirm = async () => {
    if (!token || !listing) return;
    if (!window.confirm('구매자에게 DB 인계를 확정할까요? 확정 후 취소·환불할 수 없습니다.')) return;
    setBusy(true);
    try {
      const result = await confirmDbMarketplaceSeller(token, listing.id);
      setListing(result.listing);
      alert('인계가 완료되었습니다.');
    } catch (e) {
      alert(e instanceof Error ? e.message : '인계 확정 실패');
    } finally {
      setBusy(false);
    }
  };

  const partnerOptions = partnerships.map((p) => ({
    id: p.partner.id,
    name: p.partner.name,
  }));

  const canEdit = !disabled && listing?.status !== 'CONFIRMED' && listing?.status !== 'PENDING_SELLER';

  return (
    <div className="rounded-xl border border-violet-200 bg-violet-50/40 p-3 space-y-2">
      <p className="text-xs font-semibold text-violet-900">정보공유(DB 마켓) 판매</p>
      <p className="text-[11px] text-gray-600 leading-relaxed">
        파트너·타업체가 선택해 가져갈 수 있도록 게시합니다. 구매자에게는 표시금액(잔금−수수료)만 보입니다.{' '}
        <strong>파트너 직접 연계와 별도</strong>입니다.
      </p>

      {loading ? <p className="text-[11px] text-gray-500">불러오는 중…</p> : null}
      {error ? <p className="text-[11px] text-red-600">{error}</p> : null}

      {listing ? (
        <p className="text-[11px] font-medium text-violet-800">
          상태: {STATUS_LABEL[listing.status] ?? listing.status}
          {listing.displayAmount != null
            ? ` · 표시금액 ${listing.displayAmount.toLocaleString('ko-KR')}원`
            : ''}
        </p>
      ) : null}

      {listing?.buyerName ? (
        <p className="text-[11px] text-amber-800">
          구매 신청: {listing.buyerName}
          {listing.buyerConfirmedAt ? ' (구매자 확정 완료)' : ''}
        </p>
      ) : null}

      {listing?.status === 'PENDING_SELLER' ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => void sellerConfirm()}
          className="w-full rounded-lg bg-slate-900 px-3 py-2 text-[11px] font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          인계 확정
        </button>
      ) : null}

      {canEdit ? (
        <>
          <div>
            <label className="block text-gray-600 mb-1 text-[11px]">수수료 (원) *</label>
            <input
              value={listingFeeInput}
              onChange={(e) => setListingFeeInput(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-fluid-xs"
              placeholder="0"
              inputMode="numeric"
            />
            <p className="mt-1 text-[11px] text-gray-500">
              구매자 표시금액(잔금−수수료):{' '}
              {previewAmount != null ? `${previewAmount.toLocaleString('ko-KR')}원` : '잔금 확인 필요'}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void saveDraft()}
              className="rounded-lg bg-violet-700 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-violet-800 disabled:opacity-50"
            >
              장바구니 담기
            </button>
            {listing ? (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setShowAudienceModal(true)}
                  className="rounded-lg border border-violet-300 bg-white px-3 py-1.5 text-[11px] font-medium text-violet-900 hover:bg-violet-50 disabled:opacity-50"
                >
                  노출 대상
                </button>
                {(listing.status === 'DRAFT' || listing.status === 'WITHDRAWN') && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void publish()}
                    className="rounded-lg bg-slate-900 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                  >
                    정보공유 게시
                  </button>
                )}
                {listing.status === 'OPEN' && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void withdraw()}
                    className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-[11px] text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    게시 철회
                  </button>
                )}
              </>
            ) : null}
          </div>
        </>
      ) : null}

      {showAudienceModal ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-4 shadow-xl space-y-3">
            <p className="text-fluid-sm font-semibold text-slate-900">노출 대상</p>
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
                  {v === 'ALL' ? '모두' : '업체 선택'}
                </button>
              ))}
            </div>
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
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg px-3 py-1.5 text-[11px] text-gray-600"
                onClick={() => setShowAudienceModal(false)}
              >
                취소
              </button>
              <button
                type="button"
                disabled={busy}
                className="rounded-lg bg-violet-700 px-3 py-1.5 text-[11px] font-medium text-white disabled:opacity-50"
                onClick={() => void saveAudience()}
              >
                저장
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
