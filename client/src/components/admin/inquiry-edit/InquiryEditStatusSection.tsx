import type { Dispatch, SetStateAction } from 'react';
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
  inqEditLabel,
  inqEditMemoGrid,
  inqEditOpsGrid,
  inqEditSubCard,
  inqEditSubCardTitle,
  inqEditTextareaSm,
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
  return (
    <AdminScheduleDetailSection title="상태 · 배정 · 팀원 · 메모" sectionAnchor="status">
      <div className="space-y-3">
        <div className={inqEditOpsGrid}>
          <div>
            <label className={inqEditLabel}>상태</label>
            {isCreate ? (
              <p className="rounded border border-gray-200 bg-gray-50 px-2 py-1.5 text-fluid-sm text-gray-800">
                {INQUIRY_EDIT_STATUS_LABELS[editForm.status] ?? editForm.status}
              </p>
            ) : (
              <select
                value={editForm.status}
                onChange={(e) => setEditForm((p) => ({ ...p, status: e.target.value }))}
                className={inqEditInput}
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
              <label className={inqEditLabel}>담당 마케터</label>
              <select
                value={editForm.createdById}
                onChange={(e) => setEditForm((p) => ({ ...p, createdById: e.target.value }))}
                className={inqEditInput}
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
              <label className={`${inqEditLabel} inline-flex items-center gap-1`}>
                추가 마케터
                <HelpTooltip text="협업 기록용입니다. 광고비·마케터 건수 집계에는 포함되지 않습니다." />
              </label>
              <select
                value={editForm.collaborationMarketerId}
                onChange={(e) =>
                  setEditForm((p) => ({ ...p, collaborationMarketerId: e.target.value }))
                }
                className={inqEditInput}
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
              <label className={inqEditLabel}>영업 브랜드</label>
              <div className="flex flex-wrap items-center gap-1.5">
                <select
                  value={editForm.operatingCompanyId}
                  onChange={(e) =>
                    setEditForm((p) => ({ ...p, operatingCompanyId: e.target.value }))
                  }
                  className={`${inqEditInput} min-w-0 flex-1`}
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
              <label className={inqEditLabel}>영업 브랜드</label>
              <OperatingCompanyBadge company={item.operatingCompany} />
            </div>
          ) : null}
          {!isCreate && item && isInquiryLinkedOrderFormPendingSubmit(item) ? (
            <p className="col-span-2 text-fluid-2xs text-slate-500 lg:col-span-4">
              발주서 <span className="font-medium text-slate-600">미제출</span>
              {' — '}
              고객이 제출하면 접수 상태로 바뀝니다.
            </p>
          ) : null}
          {!isCreate && item ? (
            <details className="col-span-2 rounded-md border border-slate-200 bg-white px-2 py-1.5 lg:col-span-4">
              <summary className="cursor-pointer select-none text-fluid-2xs font-medium text-slate-700">
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

        <div className={inqEditSubCard}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className={`${inqEditSubCardTitle} inline-flex items-center gap-1`}>
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
              <label className={inqEditLabel}>담당 팀장</label>
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
            <div className="space-y-1.5 border-t border-gray-200/80 pt-2">
              <div className="flex flex-wrap items-end gap-1.5">
                <div className="shrink-0">
                  <label className={`${inqEditLabel} inline-flex items-center gap-1`}>
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
                    className={`${inqEditInput} min-w-[5rem]`}
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

        <div className={inqEditMemoGrid}>
          <div>
            <label className={inqEditLabel}>특이사항 (관리자·팀장 공유)</label>
            <textarea
              value={editForm.specialNotes}
              onChange={(e) => setEditForm((p) => ({ ...p, specialNotes: e.target.value }))}
              rows={2}
              className={inqEditTextareaSm}
              placeholder="현장·일정 전달, 내부 공유 메모 등 (팀장 화면에도 표시)"
            />
          </div>
          <div>
            <label className={inqEditLabel}>메모 (발주서 요약·관리자 메모)</label>
            <textarea
              value={editForm.memo}
              onChange={(e) => setEditForm((p) => ({ ...p, memo: e.target.value }))}
              rows={2}
              className={inqEditTextareaSm}
              placeholder="접수 메모"
            />
          </div>
        </div>
      </div>
    </AdminScheduleDetailSection>
  );
}
