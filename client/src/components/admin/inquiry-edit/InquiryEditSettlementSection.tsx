import type { Dispatch, RefObject, SetStateAction } from 'react';
import type { ScheduleItem } from '../../../api/schedule';
import { formatAssignableUserLabel, type UserItem } from '../../../api/users';
import { HelpTooltip } from '../../ui/HelpTooltip';
import { isActivePartnerShareSource } from '../../../utils/tenantShareSettlement';
import type { DbMarketplaceExchangePrefill } from '../InquiryDbMarketplaceSellPanel';
import { InquiryDbMarketplaceSellPanel } from '../InquiryDbMarketplaceSellPanel';
import { PartnerReceivedBanner } from '../PartnerReceivedBanner';
import { TenantInquiryShareBadge } from '../TenantInquiryShareBadge';
import type { ProfessionalSpecialtyOption } from '../../../constants/professionalSpecialtyOptions';
import { AdminScheduleDetailSection } from './AdminScheduleDetailSection';
import { InquiryEditProfessionalOptionsPanel } from './InquiryEditProfessionalOptionsPanel';
import {
  inqEditAmountRow,
  inqEditInput,
  inqEditLabel,
  inqEditPartnerExternalRow,
} from './inquiryEditFormClasses';
import type { InquiryEditFormFields } from './inquiryEditTypes';

type TenantSharePartnership = {
  id: string;
  partner: { name: string };
};

export type InquiryEditSettlementSectionProps = {
  isCreate: boolean;
  item: ScheduleItem | null | undefined;
  editForm: InquiryEditFormFields;
  setEditForm: Dispatch<SetStateAction<InquiryEditFormFields>>;
  resolvedExternalLeadId: string;
  activeNativePartnerShareSource: boolean;
  externalLegacyShareSource: boolean;
  externalPartnerBlocksShare: boolean;
  assignableTeamLeaders: UserItem[];
  externalPartnerOptions: UserItem[];
  hasTenantExchange: boolean;
  hasDbMarketplace: boolean;
  handleRegisterViaMarketplace: () => void;
  tenantShareEditFee: string;
  setTenantShareEditFee: (v: string) => void;
  tenantShareFeeBusy: boolean;
  handleTenantShareFeeSave: () => void | Promise<void>;
  tenantShareRevokeBusy: boolean;
  handleTenantShareRevoke: () => void | Promise<void>;
  tenantSharePartnerships: TenantSharePartnership[];
  tenantSharePartnershipId: string;
  setTenantSharePartnershipId: (v: string) => void;
  tenantShareTransferFee: string;
  setTenantShareTransferFee: (v: string) => void;
  tenantShareCustomerScheduleOnly: boolean;
  setTenantShareCustomerScheduleOnly: (v: boolean) => void;
  tenantShareBusy: boolean;
  handleTenantShare: () => void | Promise<void>;
  marketplacePanelRef: RefObject<HTMLDivElement | null>;
  marketplaceExchangePrefill: DbMarketplaceExchangePrefill | null | undefined;
  onInquiryRefresh?: () => void;
  professionalCatalog: ProfessionalSpecialtyOption[];
  profCatOpen: Record<string, boolean>;
  setProfCatOpen: Dispatch<SetStateAction<Record<string, boolean>>>;
};

export function InquiryEditSettlementSection({
  isCreate,
  item,
  editForm,
  setEditForm,
  resolvedExternalLeadId,
  activeNativePartnerShareSource,
  externalLegacyShareSource,
  externalPartnerBlocksShare,
  assignableTeamLeaders,
  externalPartnerOptions,
  hasTenantExchange,
  hasDbMarketplace,
  handleRegisterViaMarketplace,
  tenantShareEditFee,
  setTenantShareEditFee,
  tenantShareFeeBusy,
  handleTenantShareFeeSave,
  tenantShareRevokeBusy,
  handleTenantShareRevoke,
  tenantSharePartnerships,
  tenantSharePartnershipId,
  setTenantSharePartnershipId,
  tenantShareTransferFee,
  setTenantShareTransferFee,
  tenantShareCustomerScheduleOnly,
  setTenantShareCustomerScheduleOnly,
  tenantShareBusy,
  handleTenantShare,
  marketplacePanelRef,
  marketplaceExchangePrefill,
  onInquiryRefresh,
  professionalCatalog,
  profCatOpen,
  setProfCatOpen,
}: InquiryEditSettlementSectionProps) {
  return (
    <AdminScheduleDetailSection title="정산 · 옵션" sectionAnchor="settlement">
      <div className="space-y-2">
        <div className={inqEditAmountRow}>
          <div>
            <label className={inqEditLabel}>총액 (원)</label>
            <input
              value={editForm.amountTotal}
              onChange={(e) => setEditForm((p) => ({ ...p, amountTotal: e.target.value }))}
              className={`${inqEditInput} text-right tabular-nums`}
              inputMode="numeric"
              placeholder="0"
            />
          </div>
          <div>
            <label className={inqEditLabel}>예약금 (원)</label>
            <input
              value={editForm.amountDeposit}
              onChange={(e) => setEditForm((p) => ({ ...p, amountDeposit: e.target.value }))}
              className={`${inqEditInput} text-right tabular-nums`}
              inputMode="numeric"
            />
          </div>
          <div>
            <label className={inqEditLabel}>잔금 (원)</label>
            <input
              value={editForm.amountBalance}
              onChange={(e) => setEditForm((p) => ({ ...p, amountBalance: e.target.value }))}
              className={`${inqEditInput} text-right tabular-nums`}
              inputMode="numeric"
            />
          </div>
        </div>
        <div className={inqEditPartnerExternalRow}>
          <div>
            <label className={`${inqEditLabel} inline-flex items-center gap-1`}>
              타업체 담당
              <HelpTooltip
                text={
                  activeNativePartnerShareSource
                    ? '파트너 연계 중에는 타업체 담당을 지정할 수 없습니다. 연계를 취소한 뒤 선택하세요.'
                    : externalLegacyShareSource
                      ? '파트너 DB 이관(타업체 정산 유지) 건입니다. 수수료는 타업체 정산·파트너 수수료에 함께 반영됩니다.'
                      : '타업체를 선택하면 자사 팀장·파트너 연계와 동시에 지정할 수 없습니다. 수수료는 옆 입력란에만 해당합니다.'
                }
              />
            </label>
            <select
              value={resolvedExternalLeadId}
              disabled={activeNativePartnerShareSource}
              onChange={(e) => {
                const v = e.target.value;
                setEditForm((p) => {
                  if (v === '') {
                    const keep = p.teamLeaderIds.filter((id) => {
                      const u = assignableTeamLeaders.find((x) => x.id === id);
                      return id.trim() !== '' && u?.role !== 'EXTERNAL_PARTNER';
                    });
                    return { ...p, teamLeaderIds: keep.length > 0 ? keep : [''] };
                  }
                  return { ...p, teamLeaderIds: [v] };
                });
              }}
              className={inqEditInput}
            >
              <option value="">선택 안 함 (자사 팀장만)</option>
              {externalPartnerOptions.map((u) => (
                <option key={u.id} value={u.id}>
                  {formatAssignableUserLabel(u)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={`${inqEditLabel} inline-flex items-center gap-1`}>
              타업체 수수료 (원)
              <HelpTooltip
                text={
                  activeNativePartnerShareSource
                    ? '파트너 연계 중에는 타업체 수수료를 입력할 수 없습니다.'
                    : externalLegacyShareSource
                      ? '타업체 정산 유지 이관 건 — 수수료 변경 시 파트너 수수료와 동기화됩니다.'
                      : '타업체 담당으로 분배된 건에 대해 받는 수수료 (파트너 연계와 둘 중 하나만 선택)'
                }
              />
            </label>
            <input
              value={editForm.externalTransferFee}
              disabled={activeNativePartnerShareSource}
              onChange={(e) => setEditForm((p) => ({ ...p, externalTransferFee: e.target.value }))}
              className={`${inqEditInput} text-right tabular-nums`}
              inputMode="numeric"
              placeholder="비우면 미입력"
            />
          </div>
        </div>
        {!isCreate && hasTenantExchange && item ? (
          <details className="rounded-lg border border-indigo-200 bg-indigo-50/40 px-2 py-1.5">
            <summary className="cursor-pointer select-none text-fluid-2xs font-semibold text-indigo-900">
              파트너에 접수 연계
            </summary>
            <div className="mt-2 space-y-2">
              <p className="text-fluid-2xs leading-relaxed text-gray-600">
                {externalPartnerBlocksShare
                  ? '타업체 담당이 지정된 접수는 파트너 연계할 수 없습니다. 타업체 담당을 해제한 뒤 이용하세요.'
                  : '연결된 파트너 업체 접수 목록에 같은 건을 복제합니다. 타업체 담당과 둘 중 하나만 선택할 수 있습니다.'}
              </p>
              {hasDbMarketplace &&
              !isActivePartnerShareSource(item.tenantShare) &&
              !externalPartnerBlocksShare ? (
                <div className="space-y-2 rounded-lg border border-violet-200 bg-violet-50/60 p-2.5">
                  <p className="text-fluid-2xs leading-relaxed text-violet-900">
                    특정 파트너 한 곳이 아니라 여러 업체에 공개하려면{' '}
                    <strong>정보공유(마켓)</strong>를 이용하세요. 구매자가 선택한 뒤 양쪽 확정됩니다.
                  </p>
                  <button
                    type="button"
                    onClick={handleRegisterViaMarketplace}
                    className="w-full rounded-lg border border-violet-300 bg-white px-3 py-2 text-fluid-2xs font-medium text-violet-900 hover:bg-violet-50"
                  >
                    정보공유로 등록하기
                  </button>
                </div>
              ) : null}
              {item.tenantShare ? (
                <div className="space-y-2">
                  <TenantInquiryShareBadge share={item.tenantShare} />
                  {item.tenantShare.role === 'TARGET' ? (
                    <PartnerReceivedBanner share={item.tenantShare} />
                  ) : null}
                  {item.tenantShare.role === 'SOURCE' &&
                  item.tenantShare.syncStatus === 'ACTIVE' &&
                  !item.tenantShare.viaMarketplace ? (
                    <>
                      <div>
                        <label className={`${inqEditLabel} inline-flex items-center gap-1`}>
                          파트너 수수료 (원)
                          <HelpTooltip text="파트너 정산·수신 업체 잔금에 반영됩니다. 타업체 담당과 둘 중 하나만 선택할 수 있습니다." />
                        </label>
                        <input
                          value={tenantShareEditFee}
                          onChange={(e) => setTenantShareEditFee(e.target.value)}
                          className={`${inqEditInput} text-right tabular-nums`}
                          inputMode="numeric"
                          placeholder="비우면 미입력"
                        />
                      </div>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <button
                          type="button"
                          disabled={tenantShareFeeBusy}
                          onClick={() => void handleTenantShareFeeSave()}
                          className="flex-1 rounded-lg border border-indigo-300 bg-white px-3 py-2 text-fluid-sm font-medium text-indigo-900 hover:bg-indigo-50 disabled:opacity-50"
                        >
                          {tenantShareFeeBusy ? '저장 중…' : '파트너 수수료 저장'}
                        </button>
                        <button
                          type="button"
                          disabled={tenantShareRevokeBusy}
                          onClick={() => void handleTenantShareRevoke()}
                          className="flex-1 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-fluid-sm font-medium text-rose-900 hover:bg-rose-100 disabled:opacity-50"
                        >
                          {tenantShareRevokeBusy ? '취소 중…' : '접수연계 취소'}
                        </button>
                      </div>
                    </>
                  ) : item.tenantShare.role === 'SOURCE' &&
                    item.tenantShare.syncStatus === 'ACTIVE' &&
                    item.tenantShare.viaMarketplace ? (
                    <p className="text-fluid-2xs text-violet-800">
                      정보공유 인계 건입니다. 회수·환불은 아래 「완전 회수」를 사용해 주세요.
                      {item.tenantShare.transferFee != null ? (
                        <>
                          {' '}
                          (수수료 {item.tenantShare.transferFee.toLocaleString()}원)
                        </>
                      ) : null}
                    </p>
                  ) : item.tenantShare.role === 'SOURCE' && item.tenantShare.transferFee != null ? (
                    <p className="text-fluid-2xs tabular-nums text-gray-600">
                      파트너 수수료: {item.tenantShare.transferFee.toLocaleString()}원
                    </p>
                  ) : null}
                  {item.tenantShare.role === 'TARGET' && item.tenantShare.sourceInquiryNumberSnapshot ? (
                    <p className="text-fluid-2xs text-gray-600">
                      원 송신 접수번호:{' '}
                      <span className="font-mono tabular-nums">
                        {item.tenantShare.sourceInquiryNumberSnapshot}
                      </span>
                    </p>
                  ) : null}
                </div>
              ) : tenantSharePartnerships.length === 0 ? (
                <p className="text-fluid-2xs text-gray-500">
                  연결된 파트너가 없습니다. 관리 → 파트너 연결에서 초대해 주세요.
                </p>
              ) : externalPartnerBlocksShare ? null : (
                <>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div>
                      <label className={inqEditLabel}>파트너 업체</label>
                      <select
                        value={tenantSharePartnershipId}
                        onChange={(e) => setTenantSharePartnershipId(e.target.value)}
                        className={inqEditInput}
                      >
                        <option value="">선택</option>
                        {tenantSharePartnerships.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.partner.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={inqEditLabel}>파트너 수수료 (원)</label>
                      <input
                        value={tenantShareTransferFee}
                        onChange={(e) => setTenantShareTransferFee(e.target.value)}
                        className={`${inqEditInput} text-right tabular-nums`}
                        inputMode="numeric"
                        placeholder="비우면 미입력"
                      />
                    </div>
                  </div>
                  <label className="flex cursor-pointer items-start gap-2 text-fluid-2xs text-gray-700">
                    <input
                      type="checkbox"
                      checked={tenantShareCustomerScheduleOnly}
                      onChange={(e) => setTenantShareCustomerScheduleOnly(e.target.checked)}
                      className="mt-0.5"
                    />
                    <span>
                      고객·일정만 연계 (금액·메모·상담사진 제외)
                      <HelpTooltip text="체크 시 파트너 접수에 고객정보·일정만 복제되며 이후 동기화도 동일 범위입니다. 상담사진은 전체 연계 시에만 공유됩니다." />
                    </span>
                  </label>
                  <button
                    type="button"
                    disabled={tenantShareBusy || !tenantSharePartnershipId.trim()}
                    onClick={() => void handleTenantShare()}
                    className="w-full rounded-lg bg-indigo-600 px-3 py-2 text-fluid-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {tenantShareBusy ? '연계 중…' : '접수 연계'}
                  </button>
                </>
              )}
            </div>
          </details>
        ) : null}
        {!isCreate && hasDbMarketplace && item ? (
          <div ref={marketplacePanelRef}>
            <InquiryDbMarketplaceSellPanel
              inquiryId={item.id}
              serviceBalanceAmount={item.serviceBalanceAmount}
              disabled={isActivePartnerShareSource(item.tenantShare) || externalPartnerBlocksShare}
              exchangePrefill={marketplaceExchangePrefill}
              onListingChange={() => onInquiryRefresh?.()}
            />
          </div>
        ) : null}
        <InquiryEditProfessionalOptionsPanel
          professionalCatalog={professionalCatalog}
          profCatOpen={profCatOpen}
          setProfCatOpen={setProfCatOpen}
          editForm={editForm}
          setEditForm={setEditForm}
        />
      </div>
    </AdminScheduleDetailSection>
  );
}
