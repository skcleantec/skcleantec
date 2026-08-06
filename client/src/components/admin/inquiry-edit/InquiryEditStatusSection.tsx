import { useState, type Dispatch, type SetStateAction } from 'react';
import { createPortal } from 'react-dom';
import type { ScheduleItem } from '../../../api/schedule';
import type { UserItem } from '../../../api/users';
import { formatAssignableUserLabel } from '../../../api/users';
import { HelpTooltip } from '../../ui/HelpTooltip';
import { SelectWithChevron } from '../../ui/SelectWithChevron';
import type { TeamMemberItem } from '../../../api/teams';
import { OperatingCompanyBadge } from '../OperatingCompanyBadge';
import { InquiryCrossSwapActionButtons } from '../InquiryCrossSwapActionButtons';
import { InquiryOrderForceMatchPanel } from '../InquiryOrderForceMatchPanel';
import { TeamMemberSearchSelect } from '../TeamMemberSearchSelect';
import {
  SOLO_LEADER_CREW_LABEL,
  toggleSoloTeamLeaderId,
} from '../../../utils/inquiryNoCrewMembers';
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
  hideCrewInputs: boolean;
  effectiveCrewSlots: number;
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
  hideCrewInputs,
  effectiveCrewSlots,
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
                    <label className="inline-flex items-center gap-1 text-amber-950">
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5 rounded border-amber-300"
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
                      <span title={SOLO_LEADER_CREW_LABEL}>단독</span>
                    </label>
                  </span>
                ) : null;
              })()}
            </div>
          ) : (
            <div className="space-y-1.5">
              <label className="block text-fluid-sm font-semibold text-slate-700 mb-1.5">담당 팀장</label>
              {editForm.teamLeaderIds.map((lid, idx) => (
                <div key={idx} className="flex flex-wrap items-center gap-1.5">
                  <SelectWithChevron
                    value={lid}
                    disabled={teamLeaderZoneBlock.blocked}
                    onChange={(e) => {
                      const v = e.target.value;
                      setEditForm((p) => {
                        const prevId = p.teamLeaderIds[idx]?.trim() ?? '';
                        const next = [...p.teamLeaderIds];
                        next[idx] = v;
                        let solo = p.soloTeamLeaderIds;
                        if (prevId && prevId !== v.trim()) {
                          solo = solo.filter((id) => id !== prevId);
                        }
                        return { ...p, teamLeaderIds: next, soloTeamLeaderIds: solo };
                      });
                    }}
                    className={`${inqEditInput} min-w-0 flex-1`}
                    wrapperClassName="min-w-0 flex-1"
                  >
                    <option value="">선택 안 함</option>
                    {leaderOptionsForRow(idx).map((tl) => (
                      <option key={tl.id} value={tl.id}>
                        {formatAssignableUserLabel(tl)}
                      </option>
                    ))}
                  </SelectWithChevron>
                  {lid.trim() ? (
                    <label className="inline-flex shrink-0 items-center gap-1 text-fluid-2xs text-gray-700">
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5 rounded border-gray-300"
                        checked={editForm.soloTeamLeaderIds.includes(lid.trim())}
                        onChange={(e) =>
                          setEditForm((p) => ({
                            ...p,
                            soloTeamLeaderIds: toggleSoloTeamLeaderId(
                              p.soloTeamLeaderIds,
                              lid.trim(),
                              e.target.checked,
                            ),
                          }))
                        }
                      />
                      <span title={SOLO_LEADER_CREW_LABEL}>단독</span>
                    </label>
                  ) : null}
                  {editForm.teamLeaderIds.length > 1 ? (
                    <button
                      type="button"
                      className="shrink-0 rounded border border-gray-200 px-1.5 py-0.5 text-fluid-2xs text-gray-600 hover:bg-gray-50"
                      onClick={() =>
                        setEditForm((p) => ({
                          ...p,
                          teamLeaderIds: p.teamLeaderIds.filter((_, i) => i !== idx),
                          soloTeamLeaderIds: p.soloTeamLeaderIds.filter(
                            (id) => id !== (p.teamLeaderIds[idx]?.trim() ?? ''),
                          ),
                        }))
                      }
                    >
                      제거
                    </button>
                  ) : null}
                </div>
              ))}
              <button
                type="button"
                className="text-fluid-xs text-blue-600 hover:underline disabled:opacity-40 disabled:no-underline"
                disabled={teamLeaderZoneBlock.blocked}
                onClick={() =>
                  setEditForm((p) => ({ ...p, teamLeaderIds: [...p.teamLeaderIds, ''] }))
                }
              >
                + 팀장 추가
              </button>
            </div>
          )}
          {!hideCrewInputs ? (
            <div className="space-y-1.5 border-t border-indigo-200/80 pt-3 mt-3">
              <div className="flex flex-wrap items-end gap-1.5">
                <div className="shrink-0">
                  <label className="mb-1.5 inline-flex items-center gap-1 text-fluid-sm font-semibold text-slate-700">
                    팀원
                    <HelpTooltip text="팀원 인원 수에 맞게 선택칸이 늘어납니다. 검색창에 이름·초성(예: ㄱㅁ)으로 필터링할 수 있습니다. 첫 번째 자사 담당 팀장 기준 +N일은 마지막 함께 투입 후 예약일까지 일수(참고만)입니다. 크루 그룹 집계 모드 사용 시 해당 예약일 가용 팀원만 표시되며, 이미 선택했거나 다른 접수에 배정된 팀원은 선택할 수 없습니다." />
                  </label>
                  <SelectWithChevron
                    value={String(editForm.crewMemberCount)}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setEditForm((prev) => ({
                        ...prev,
                        crewMemberCount: Number.isFinite(v) ? v : 0,
                      }));
                    }}
                    className="w-full min-w-[5rem] rounded-md border border-slate-300 bg-white px-3 py-2 text-fluid-sm text-slate-900"
                    wrapperClassName="min-w-[5rem]"
                  >
                    {Array.from({ length: 21 }, (_, i) => (
                      <option key={i} value={String(i)}>
                        {i}명
                      </option>
                    ))}
                  </SelectWithChevron>
                </div>
                {effectiveCrewSlots > 0
                  ? editForm.crewMemberNames.map((name, idx) => (
                      <div key={`crew-pick-${idx}`} className="min-w-[9rem] flex-1">
                        {(() => {
                          const duplicateSet = new Set(
                            editForm.crewMemberNames
                              .map((x, i) => (i === idx ? '' : x.trim()))
                              .filter(Boolean),
                          );
                          const disabled = new Set<string>([
                            ...occupiedCrewNamesByDate,
                            ...duplicateSet,
                          ]);
                          return (
                            <TeamMemberSearchSelect
                              options={crewPickOptions}
                              value={name}
                              disabledNames={disabled}
                              crewSpacingDaysByMemberName={crewSpacingByMemberName}
                              onChange={(v) =>
                                setEditForm((p) => {
                                  const next = [...p.crewMemberNames];
                                  next[idx] = v;
                                  return { ...p, crewMemberNames: next };
                                })
                              }
                              placeholder={`${idx + 1}번`}
                            />
                          );
                        })()}
                      </div>
                    ))
                  : null}
              </div>
            </div>
          ) : null}
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
                rows={2}
                className="w-full min-w-0 resize-y rounded-md border border-slate-300 bg-white px-3 py-2 text-fluid-sm text-slate-900 min-h-[3.25rem]"
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
                rows={2}
                className="w-full min-w-0 resize-y rounded-md border border-slate-300 bg-white px-3 py-2 text-fluid-sm text-slate-900 min-h-[3.25rem]"
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
