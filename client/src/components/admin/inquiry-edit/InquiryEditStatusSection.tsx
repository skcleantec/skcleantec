import { useState, type Dispatch, type SetStateAction } from 'react';
import { createPortal } from 'react-dom';
import type { ScheduleItem } from '../../../api/schedule';
import type { UserItem } from '../../../api/users';
import { formatAssignableUserLabel } from '../../../api/users';
import { HelpTooltip } from '../../ui/HelpTooltip';
import type { TeamMemberItem } from '../../../api/teams';
import { OperatingCompanyBadge } from '../OperatingCompanyBadge';
import { InquiryCrossSwapActionButtons } from '../InquiryCrossSwapActionButtons';
import { InquiryOrderForceMatchPanel } from '../InquiryOrderForceMatchPanel';
import {
  SOLO_LEADER_CREW_LABEL,
  toggleSoloTeamLeaderId,
} from '../../../utils/inquiryNoCrewMembers';
import {
  applyLeaderCrewSetsToEditForm,
  InquiryLeaderCrewSetsEditor,
} from './InquiryLeaderCrewSetsEditor';
import { AdminScheduleDetailSection } from './AdminScheduleDetailSection';
import { INQUIRY_EDIT_STATUS_LABELS } from './inquiryEditConstants';
import {
  inqEditInput,
} from './inquiryEditFormClasses';
import { isInquiryLinkedOrderFormPendingSubmit } from './inquiryEditHelpers';
import {
  InquiryEditStatusAssignmentHints,
  type InquiryEditAssignmentHint,
} from './InquiryEditStatusAssignmentHints';
import type { InquiryEditFormFields } from './inquiryEditTypes';

type AssignableUser = UserItem;

type OperatingCompanyOption = {
  id: string;
  name: string;
  isDefault?: boolean;
};

type ServiceZoneOption = { id: string; name: string };

export type InquiryEditStatusSectionProps = {
  isCreate: boolean;
  item: ScheduleItem | null | undefined;
  token: string;
  saving: boolean;
  editForm: InquiryEditFormFields;
  setEditForm: Dispatch<SetStateAction<InquiryEditFormFields>>;
  canEditMarketer: boolean;
  meUser: { id: string; name: string } | null | undefined;
  marketerOptions: Array<{ id: string; name: string }> | undefined;
  operatingCompanyOptions: OperatingCompanyOption[];
  statusAssignmentHints: InquiryEditAssignmentHint[];
  teamLeaderAssignmentSurface: string;
  serviceZones: ServiceZoneOption[];
  pinnedServiceZoneId: string | null;
  matchingServiceZones: ServiceZoneOption[];
  manualAssignmentZoneId: string;
  setManualAssignmentZoneId: (v: string) => void;
  teamLeaderZoneBlock: { blocked: boolean; message?: string };
  activeNativePartnerShareSource: boolean;
  resolvedExternalLeadId: string;
  assignableTeamLeaders: AssignableUser[];
  assignableLeaderIdsForSlot: string[] | null | undefined;
  showLeaderPartnerSwapEntry: boolean;
  showCrewPartnerSwapEntry: boolean;
  onLeaderSwap: () => void;
  onCrewSwap: () => void;
  leaderOptionsForRow: (idx: number) => AssignableUser[];
  crewPickOptions: TeamMemberItem[];
  occupiedCrewNamesByDate: Set<string>;
  crewSpacingByMemberName: Record<string, number | null>;
  onInquiryRefresh?: () => void;
};

export function InquiryEditStatusSection({
  isCreate,
  item,
  token,
  saving,
  editForm,
  setEditForm,
  canEditMarketer,
  meUser,
  marketerOptions,
  operatingCompanyOptions,
  statusAssignmentHints,
  teamLeaderAssignmentSurface,
  serviceZones,
  pinnedServiceZoneId,
  matchingServiceZones,
  manualAssignmentZoneId,
  setManualAssignmentZoneId,
  teamLeaderZoneBlock,
  activeNativePartnerShareSource,
  resolvedExternalLeadId,
  assignableTeamLeaders,
  assignableLeaderIdsForSlot,
  showLeaderPartnerSwapEntry,
  showCrewPartnerSwapEntry,
  onLeaderSwap,
  onCrewSwap,
  leaderOptionsForRow,
  crewPickOptions,
  occupiedCrewNamesByDate,
  crewSpacingByMemberName,
  onInquiryRefresh,
}: InquiryEditStatusSectionProps) {
  const [expandedTextarea, setExpandedTextarea] = useState<'specialNotes' | 'memo' | null>(null);

  return (
    <AdminScheduleDetailSection title="상태 · 배정 · 팀원 · 메모" sectionAnchor="status">
      <div className="space-y-4">
        {/* 상태 및 마케터 그룹 */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 sm:p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-3">
            <div>
              <label className="block text-fluid-sm font-semibold text-slate-700 mb-1.5">상태</label>
              {isCreate ? (
                <p className="rounded-md border border-slate-200 bg-slate-100 px-3 py-2 text-fluid-sm text-slate-800">
                  {INQUIRY_EDIT_STATUS_LABELS[editForm.status] ?? editForm.status}
                </p>
              ) : (
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm((p) => ({ ...p, status: e.target.value }))}
                  className="w-full min-w-0 rounded-md border border-slate-300 bg-white px-3 py-2 text-fluid-sm text-slate-900"
                >
                  {Object.entries(INQUIRY_EDIT_STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              )}
            </div>
            {canEditMarketer ? (
              <div>
                <label className="block text-fluid-sm font-semibold text-slate-700 mb-1.5">담당 마케터</label>
                <select
                  value={editForm.createdById}
                  onChange={(e) => setEditForm((p) => ({ ...p, createdById: e.target.value }))}
                  className="w-full min-w-0 rounded-md border border-slate-300 bg-white px-3 py-2 text-fluid-sm text-slate-900"
                >
                  <option value="">미지정</option>
                  {meUser ? <option value={meUser.id}>관리자 ({meUser.name})</option> : null}
                  {(marketerOptions ?? []).map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            {!isCreate ? (
              <div>
                <label className="mb-1.5 inline-flex items-center gap-1 text-fluid-sm font-semibold text-slate-700">
                  추가 마케터
                  <HelpTooltip text="협업 기록용입니다. 광고비·마케터 건수 집계에는 포함되지 않습니다." />
                </label>
                <select
                  value={editForm.collaborationMarketerId}
                  onChange={(e) =>
                    setEditForm((p) => ({ ...p, collaborationMarketerId: e.target.value }))
                  }
                  className="w-full min-w-0 rounded-md border border-slate-300 bg-white px-3 py-2 text-fluid-sm text-slate-900"
                >
                  <option value="">없음</option>
                  {meUser ? <option value={meUser.id}>관리자 ({meUser.name})</option> : null}
                  {(marketerOptions ?? []).map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            {operatingCompanyOptions.length > 0 ? (
              <div>
                <label className="block text-fluid-sm font-semibold text-slate-700 mb-1.5">영업 브랜드</label>
                <div className="flex flex-wrap items-center gap-1.5">
                  <select
                    value={editForm.operatingCompanyId}
                    onChange={(e) =>
                      setEditForm((p) => ({ ...p, operatingCompanyId: e.target.value }))
                    }
                    className="w-full min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-fluid-sm text-slate-900"
                  >
                    {isCreate ? <option value="">(자동 귀속)</option> : null}
                    {operatingCompanyOptions.map((oc) => (
                      <option key={oc.id} value={oc.id}>
                        {oc.name}
                        {oc.isDefault ? ' · 기본' : ''}
                      </option>
                    ))}
                  </select>
                  {item?.operatingCompany ? (
                    <OperatingCompanyBadge company={item.operatingCompany} />
                  ) : null}
                </div>
              </div>
            ) : item?.operatingCompany ? (
              <div>
                <label className="block text-fluid-sm font-semibold text-slate-700 mb-1.5">영업 브랜드</label>
                <OperatingCompanyBadge company={item.operatingCompany} />
              </div>
            ) : null}
            {!isCreate && item && isInquiryLinkedOrderFormPendingSubmit(item) ? (
              <p className="col-span-1 sm:col-span-2 lg:col-span-4 text-[12px] text-slate-500">
                발주서 <span className="font-medium text-slate-600">미제출</span>
                {' — '}
                고객이 제출하면 접수 상태로 바뀝니다.
              </p>
            ) : null}
            {!isCreate && item ? (
              <details className="col-span-1 sm:col-span-2 lg:col-span-4 rounded-md border border-slate-200 bg-white px-3 py-2">
                <summary className="cursor-pointer select-none text-fluid-sm font-medium text-slate-700">
                  발주서 강제 매칭
                </summary>
                <div className="mt-2">
                  <InquiryOrderForceMatchPanel
                    token={token}
                    inquiryId={item.id}
                    customerName={item.customerName}
                    customerPhone={item.customerPhone}
                    disabled={saving}
                    onMatched={() => onInquiryRefresh?.()}
                  />
                </div>
              </details>
            ) : null}
          </div>
        </div>

        <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-3 sm:p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-fluid-sm font-semibold text-slate-700 inline-flex items-center gap-1">
              배정 · 팀원
              {assignableLeaderIdsForSlot != null ? (
                <HelpTooltip text="예약일·희망 시간대 기준으로 그날 해당 슬롯에 배정 가능한 팀장을 우선 표시합니다. 타업체 분배는 「정산 · 옵션」의 《타업체 담당》에서 선택합니다. 현재 선택된 팀장은 목록에 남습니다. 서버에서 허용된 개발용(team-preview) 관리자만 목록에 본인 ADMIN이 포함되며, 그 경우 슬롯 필터와 관계없이 본인을 선택할 수 있습니다." />
              ) : null}
            </span>
            {showLeaderPartnerSwapEntry || showCrewPartnerSwapEntry ? (
              <InquiryCrossSwapActionButtons
                showLeaderSwap={showLeaderPartnerSwapEntry}
                showCrewSwap={showCrewPartnerSwapEntry}
                onLeaderSwap={onLeaderSwap}
                onCrewSwap={onCrewSwap}
              />
            ) : null}
          </div>
          <InquiryEditStatusAssignmentHints hints={statusAssignmentHints} />
          {teamLeaderAssignmentSurface === 'inquiry-list' &&
          serviceZones.length > 0 &&
          !pinnedServiceZoneId &&
          matchingServiceZones.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <label className="shrink-0 text-fluid-2xs text-gray-600">배정 권역</label>
              <select
                value={manualAssignmentZoneId}
                onChange={(e) => setManualAssignmentZoneId(e.target.value)}
                className={`${inqEditInput} max-w-xs flex-1 min-w-[8rem]`}
              >
                <option value="">권역 선택…</option>
                {matchingServiceZones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          {activeNativePartnerShareSource && item?.tenantShare ? (
            <div
              className="rounded-md border border-indigo-200 bg-indigo-50/80 px-2 py-1.5 text-fluid-2xs text-indigo-950"
              role="status"
              title="수수료·연계 취소는 「정산 · 옵션」의 《파트너에 접수 연계》에서 관리하세요."
            >
              <span className="font-medium">파트너 · {item.tenantShare.partnerName} 연계</span>
              <span className="text-indigo-900/90"> — 자사 팀장 없음 · 정산 4번에서 관리</span>
            </div>
          ) : resolvedExternalLeadId ? (
            <div
              className="rounded-md border border-amber-200 bg-amber-50/80 px-2 py-1.5 text-fluid-2xs text-amber-950"
              role="status"
              title="담당 변경은 「정산 · 옵션」의 《타업체 담당》에서 하세요."
            >
              <span className="font-medium">타업체 담당</span>
              <span className="text-amber-900/90"> — 자사 팀장과 함께 지정 불가</span>
              {(() => {
                const u = assignableTeamLeaders.find((t) => t.id === resolvedExternalLeadId);
                return u ? (
                  <span className="mt-1 flex flex-wrap items-center gap-2">
                    <span className="text-amber-900/95">{formatAssignableUserLabel(u)}</span>
                    <label className="inline-flex max-w-[min(100%,14rem)] items-start gap-1.5 text-fluid-2xs text-amber-950">
                      <input
                        type="checkbox"
                        className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-amber-300"
                        checked={editForm.soloTeamLeaderIds.includes(resolvedExternalLeadId)}
                        onChange={(e) =>
                          setEditForm((p) => ({
                            ...p,
                            soloTeamLeaderIds: toggleSoloTeamLeaderId(
                              p.soloTeamLeaderIds,
                              resolvedExternalLeadId,
                              e.target.checked,
                            ),
                          }))
                        }
                      />
                      <span className="leading-snug">{SOLO_LEADER_CREW_LABEL}</span>
                    </label>
                  </span>
                ) : null;
              })()}
            </div>
          ) : (
            <InquiryLeaderCrewSetsEditor
              sets={editForm.leaderCrewSets}
              onSetsChange={(sets) => setEditForm((p) => applyLeaderCrewSetsToEditForm(p, sets))}
              leaderOptionsForRow={leaderOptionsForRow}
              teamLeaderBlocked={teamLeaderZoneBlock.blocked}
              crewPickOptions={crewPickOptions}
              occupiedCrewNamesByDate={occupiedCrewNamesByDate}
              crewSpacingByMemberName={crewSpacingByMemberName}
              showLeaderPartnerSwapEntry={showLeaderPartnerSwapEntry}
              showCrewPartnerSwapEntry={showCrewPartnerSwapEntry}
              onLeaderSwap={onLeaderSwap}
              onCrewSwap={onCrewSwap}
            />
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 sm:p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-fluid-sm font-semibold text-slate-700">특이사항 (관리자·팀장 공유)</label>
                <button
                  type="button"
                  onClick={() => setExpandedTextarea('specialNotes')}
                  className="text-[12px] font-medium text-blue-600 hover:text-blue-800"
                >
                  크게보기 &rarr;
                </button>
              </div>
              <textarea
                value={editForm.specialNotes}
                onChange={(e) => setEditForm((p) => ({ ...p, specialNotes: e.target.value }))}
                className="h-[182px] min-h-[182px] w-full min-w-0 resize-y rounded-md border border-slate-300 bg-white px-3 py-2 text-fluid-sm text-slate-900"
                placeholder="현장·일정 전달, 내부 공유 메모 등 (팀장 화면에도 표시)"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-fluid-sm font-semibold text-slate-700">메모 (발주서 요약·관리자 메모)</label>
                <button
                  type="button"
                  onClick={() => setExpandedTextarea('memo')}
                  className="text-[12px] font-medium text-blue-600 hover:text-blue-800"
                >
                  크게보기 &rarr;
                </button>
              </div>
              <textarea
                value={editForm.memo}
                onChange={(e) => setEditForm((p) => ({ ...p, memo: e.target.value }))}
                className="h-[182px] min-h-[182px] w-full min-w-0 resize-y rounded-md border border-slate-300 bg-white px-3 py-2 text-fluid-sm text-slate-900"
                placeholder="접수 메모"
              />
            </div>
          </div>
        </div>
      </div>

      {expandedTextarea && createPortal(
        <div className="fixed inset-0 z-[600] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white shadow-xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <h3 className="text-fluid-sm font-semibold text-slate-800">
                {expandedTextarea === 'specialNotes' ? '특이사항 크게보기' : '메모 크게보기'}
              </h3>
              <button
                type="button"
                onClick={() => setExpandedTextarea(null)}
                className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus:outline-none"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4 flex-1 min-h-0">
              <textarea
                value={expandedTextarea === 'specialNotes' ? editForm.specialNotes : editForm.memo}
                onChange={(e) => setEditForm((p) => ({ ...p, [expandedTextarea]: e.target.value }))}
                className="h-full min-h-[300px] w-full resize-none rounded-lg border border-slate-300 p-3 text-fluid-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder={expandedTextarea === 'specialNotes' ? "현장·일정 전달, 내부 공유 메모 등 (팀장 화면에도 표시)" : "접수 메모"}
              />
            </div>
            <div className="border-t border-slate-200 px-4 py-3 text-right bg-slate-50 rounded-b-xl">
              <button
                type="button"
                onClick={() => setExpandedTextarea(null)}
                className="rounded-lg bg-slate-900 px-4 py-2 text-fluid-sm font-medium text-white hover:bg-slate-800"
              >
                닫기
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </AdminScheduleDetailSection>
  );
}
