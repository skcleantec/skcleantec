import { useEffect, useRef, useState } from 'react';
import { getToken } from '../../../stores/auth';
import { ORDER_FOLLOWUP_STATUS_LABEL } from '../../../constants/orderFollowupStatus';
import { INQUIRY_STATUS_LABELS } from '../../inquiries/inquiriesUiParts';
import type { TelecrmConsultationQuotePayload } from '@shared/telecrmConsultationQuote';
import type { CrmIntakeFormSnapshot } from '../../../utils/crmIntakeDraft';
import {
  CRM_INTAKE_FOLLOWUP_DEFER_KINDS,
  submitCrmIntake,
  type CrmIntakeFormValues,
  type CrmIntakeKind,
  type CrmIntakeExistingInquiry,
  type CrmIntakeSubmitResult,
} from './crmIntakeSubmit';
import { saveOrderFollowupHotMark, type OrderFollowupHotMark } from '../../../api/orderFollowups';
import { FollowupHotIntakeSlot } from '../followup/FollowupHotIntakeSlot';
import type { HotMarkDraft } from '../followup/FollowupHotMarkPopover';
import { toast } from '../../ui/Toast';
import { crmIntakePermissionLabel } from './crmIntakeValidation';
import { crmFieldCompactClass } from '../crmUi';
import { HelpTooltip } from '../../ui/HelpTooltip';

/** 접수란 입력 칸 — 높이 36px 통일 */
const crmIntakeFieldClass = `${crmFieldCompactClass} h-9`;
/** 접수란 칸 이름 */
const crmIntakeLabelClass = 'mb-1 block whitespace-nowrap text-fluid-2xs font-semibold text-slate-700';
import { CrmRequestMemoField } from './CrmRequestMemoField';
import { InquiryLeadSourceSelect } from '../../inquiry/InquiryLeadSourceSelect';
import { CollaborationMarketerSelect } from '../../inquiry/CollaborationMarketerSelect';
import { useCollaborationMarketerOptions } from '../../../hooks/useCollaborationMarketerOptions';
import { useAdminStaffSession } from '../../../hooks/useAdminStaffSession';
import { useCrmPropertyChoiceOptions } from './useCrmPropertyChoiceOptions';
import type { TelecrmPropertyChoiceOption } from '@shared/telecrmQuoteCrewLearning';

/** 저장값이 지금 선택지에 없으면(예전 글) 그 글을 그대로 보여 줌 — 영문 코드는 「이전 선택」으로 */
function choiceListWithCurrent(
  options: TelecrmPropertyChoiceOption[],
  current: string,
): TelecrmPropertyChoiceOption[] {
  const v = current.trim();
  if (!v || options.some((o) => o.value === v)) return options;
  const label = /[가-힣]/.test(v) ? v : '이전 선택';
  return [...options, { value: v, label }];
}

const KIND_OPTIONS: { value: CrmIntakeKind; label: string; hint: string }[] = [
  { value: 'absent', label: ORDER_FOLLOWUP_STATUS_LABEL.ABSENT, hint: '부재현황' },
  { value: 'hold', label: ORDER_FOLLOWUP_STATUS_LABEL.ON_HOLD, hint: '부재현황' },
  { value: 'requested', label: ORDER_FOLLOWUP_STATUS_LABEL.REQUESTED, hint: '부재현황' },
  { value: 'deposit', label: ORDER_FOLLOWUP_STATUS_LABEL.DEPOSIT_PENDING, hint: '접수·부재 연동' },
  { value: 'reserved', label: ORDER_FOLLOWUP_STATUS_LABEL.RESERVED, hint: '접수·부재 연동' },
  { value: 'received', label: INQUIRY_STATUS_LABELS.RECEIVED, hint: '예약완료 접수' },
];

export type CrmIntakeSavedMeta = {
  /** true — 「저장」: 접수란·견적 초기화 (「저장 후 계속」은 false) */
  freshStart?: boolean;
};

export function CrmIntakeForm({
  seed,
  initialFormDraft,
  contactPhone,
  safePhone,
  contactUnknown,
  pyeong,
  onPyeongChange,
  onFormChange,
  onSaved,
  lastInquiryId,
  onOpenOrderIssue,
  canSubmitKind,
  permissionsLoading,
  formResetKey = 0,
  quotePayload = null,
  soomgoImportFlashKey = 0,
  soomgoHiredOther = false,
  lookupImportKey = 0,
  seedSyncDisabled = false,
  operatingCompanyId = null,
  existingInquiry = null,
  linkedFollowupId = null,
  linkedHotMark = null,
  hotEditable = true,
  hotLinkKey = 0,
}: {
  seed: Partial<CrmIntakeFormValues> & { pyeong?: string };
  initialFormDraft?: Partial<CrmIntakeFormSnapshot> | null;
  lookupImportKey?: number;
  seedSyncDisabled?: boolean;
  contactPhone: string;
  safePhone: string;
  contactUnknown: boolean;
  pyeong: string;
  onPyeongChange: (v: string) => void;
  onFormChange?: (snapshot: CrmIntakeFormSnapshot) => void;
  onSaved: (result: CrmIntakeSubmitResult, meta?: CrmIntakeSavedMeta) => void;
  lastInquiryId: string | null;
  operatingCompanyId?: string | null;
  onOpenOrderIssue?: (inquiryId: string | null) => void;
  canSubmitKind: (kind: CrmIntakeKind) => boolean;
  permissionsLoading?: boolean;
  formResetKey?: number;
  quotePayload?: TelecrmConsultationQuotePayload | null;
  soomgoImportFlashKey?: number;
  soomgoHiredOther?: boolean;
  /** 기존 고객 — 진행 중 접수에 이어서 저장 */
  existingInquiry?: CrmIntakeExistingInquiry | null;
  /** 부재·보류에서 가져온 건. 있으면 가망 표시를 그 건에 바로 저장 */
  linkedFollowupId?: string | null;
  linkedHotMark?: OrderFollowupHotMark | null;
  hotEditable?: boolean;
  hotLinkKey?: number;
}) {
  const [customerName, setCustomerName] = useState('');
  const [nickname, setNickname] = useState('');
  const [preferredMoveInCleanYmd, setPreferredMoveInCleanYmd] = useState('');
  const [address, setAddress] = useState('');
  const [requestMemo, setRequestMemo] = useState('');
  const [roomCount, setRoomCount] = useState('');
  const [bathroomCount, setBathroomCount] = useState('');
  const [balconyCount, setBalconyCount] = useState('');
  const [propertyType, setPropertyType] = useState('');
  const [buildingType, setBuildingType] = useState('');
  const [isOneRoom, setIsOneRoom] = useState(false);
  const propertyChoices = useCrmPropertyChoiceOptions();
  const [kind, setKind] = useState<CrmIntakeKind>('absent');
  const [goldDb, setGoldDb] = useState(false);
  const [leadSource, setLeadSource] = useState('');
  const [collaborationMarketerId, setCollaborationMarketerId] = useState('');
  const [extractPlatform, setExtractPlatform] = useState<'miso' | 'soomgo' | undefined>(undefined);
  const collaborationMarketerOptions = useCollaborationMarketerOptions(getToken());
  const { userId: crmUserId, userName: crmUserName, role: crmUserRole } = useAdminStaffSession();
  const [showMore, setShowMore] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pendingHot, setPendingHot] = useState<HotMarkDraft | null>(null);
  const [hotSession, setHotSession] = useState<{
    followupId: string;
    mark: OrderFollowupHotMark | null;
  } | null>(null);

  const canSave = canSubmitKind(kind);

  useEffect(() => {
    if (seedSyncDisabled) return;
    setCustomerName(seed.customerName ?? '');
    setNickname(seed.nickname ?? '');
    setAddress(seed.address ?? '');
  }, [seed.customerName, seed.nickname, seed.address, seedSyncDisabled]);

  const appliedDraftRef = useRef(0);

  useEffect(() => {
    setCustomerName('');
    setNickname('');
    setPreferredMoveInCleanYmd('');
    setAddress('');
    setRequestMemo('');
    setRoomCount('');
    setBathroomCount('');
    setBalconyCount('');
    setPropertyType('');
    setBuildingType('');
    setIsOneRoom(false);
    setKind('absent');
    setGoldDb(false);
    setLeadSource('');
    setCollaborationMarketerId('');
    setExtractPlatform(undefined);
    setShowMore(false);
    setMsg(null);
    setErr(null);
    setPendingHot(null);
    setHotSession(null);
    appliedDraftRef.current = 0;
  }, [formResetKey]);

  useEffect(() => {
    setPendingHot(null);
    setHotSession(null);
  }, [hotLinkKey]);

  useEffect(() => {
    if (!initialFormDraft) return;
    if (initialFormDraft.customerName != null) setCustomerName(initialFormDraft.customerName);
    if (initialFormDraft.nickname != null) setNickname(initialFormDraft.nickname);
    if (initialFormDraft.address != null) setAddress(initialFormDraft.address);
    if (initialFormDraft.preferredMoveInCleanYmd != null) {
      setPreferredMoveInCleanYmd(initialFormDraft.preferredMoveInCleanYmd);
    }
    if (initialFormDraft.requestMemo != null) setRequestMemo(initialFormDraft.requestMemo);
    if (initialFormDraft.roomCount != null) setRoomCount(initialFormDraft.roomCount);
    if (initialFormDraft.bathroomCount != null) setBathroomCount(initialFormDraft.bathroomCount);
    if (initialFormDraft.balconyCount != null) setBalconyCount(initialFormDraft.balconyCount);
    if (initialFormDraft.propertyType != null) setPropertyType(initialFormDraft.propertyType);
    if (initialFormDraft.buildingType != null) setBuildingType(initialFormDraft.buildingType);
    if (initialFormDraft.isOneRoom != null) setIsOneRoom(initialFormDraft.isOneRoom);
    if (initialFormDraft.kind != null) setKind(initialFormDraft.kind);
    if (initialFormDraft.goldDb != null) setGoldDb(initialFormDraft.goldDb);
    if (initialFormDraft.leadSource != null) setLeadSource(initialFormDraft.leadSource);
    if (initialFormDraft.extractPlatform != null) setExtractPlatform(initialFormDraft.extractPlatform);
    if (
      initialFormDraft.extractPlatform === 'soomgo' ||
      initialFormDraft.extractPlatform === 'miso' ||
      initialFormDraft.leadSource?.trim() ||
      initialFormDraft.address ||
      initialFormDraft.preferredMoveInCleanYmd ||
      initialFormDraft.requestMemo ||
      initialFormDraft.roomCount?.trim() ||
      initialFormDraft.bathroomCount?.trim() ||
      initialFormDraft.balconyCount?.trim() ||
      initialFormDraft.propertyType?.trim() ||
      initialFormDraft.buildingType?.trim() ||
      initialFormDraft.isOneRoom ||
      pyeong.trim()
    ) {
      setShowMore(true);
    }
    appliedDraftRef.current = soomgoImportFlashKey;
  }, [initialFormDraft, soomgoImportFlashKey, lookupImportKey, pyeong, formResetKey]);

  useEffect(() => {
    if (kind === 'received') setShowMore(true);
  }, [kind]);

  useEffect(() => {
    if (!onFormChange) return;
    const t = window.setTimeout(() => {
      onFormChange({
        customerName,
        nickname,
        address,
        preferredMoveInCleanYmd,
        requestMemo,
        roomCount,
        bathroomCount,
        balconyCount,
        propertyType,
        buildingType,
        isOneRoom,
        kind,
        goldDb,
        leadSource,
        extractPlatform,
      });
    }, 400);
    return () => window.clearTimeout(t);
  }, [
    customerName,
    nickname,
    address,
    preferredMoveInCleanYmd,
    requestMemo,
    roomCount,
    bathroomCount,
    balconyCount,
    propertyType,
    buildingType,
    isOneRoom,
    kind,
    goldDb,
    leadSource,
    extractPlatform,
    onFormChange,
  ]);

  const submit = async (opts: { keepForm: boolean; incrementDefer?: boolean }) => {
    const { keepForm, incrementDefer = false } = opts;
    const token = getToken();
    if (!token) return;
    if (!canSubmitKind(kind)) {
      setErr(`${crmIntakePermissionLabel(kind)} 권한이 필요합니다.`);
      return;
    }
    if (!operatingCompanyId) {
      setErr('작업 브랜드가 선택되지 않았습니다. 상단에서 브랜드를 선택해 주세요.');
      return;
    }
    if (incrementDefer && !CRM_INTAKE_FOLLOWUP_DEFER_KINDS.has(kind)) {
      setErr('부재+1은 요청·부재·보류 처리 구분에서만 사용할 수 있습니다.');
      return;
    }
    setSaving(true);
    setErr(null);
    setMsg(null);
    try {
      const result = await submitCrmIntake(
        token,
        {
          customerName,
          nickname,
          contactPhone,
          safePhone,
          contactUnknown,
          requestMemo,
          preferredMoveInCleanYmd,
          address,
          roomCount,
          bathroomCount,
          balconyCount,
          propertyType,
          buildingType,
          isOneRoom,
          kind,
          goldDb,
          leadSource,
          collaborationMarketerId: collaborationMarketerId.trim() || undefined,
          extractPlatform,
        },
        pyeong,
        { operatingCompanyId, quotePayload, incrementDefer, existingInquiry },
      );
      const freshStart = incrementDefer || !keepForm;
      if (result.kind === 'followup' && result.followupId && pendingHot) {
        const saved = await saveOrderFollowupHotMark(token, result.followupId, pendingHot);
        window.dispatchEvent(new Event('crm-hot-summary-refresh'));
        if (!freshStart) {
          setHotSession({ followupId: result.followupId, mark: saved.myHotMark });
          setPendingHot(null);
        }
      }
      onSaved(result, { freshStart });
      if (result.kind === 'inquiry' && result.continued === 'appended') {
        toast.success('이미 진행 중인 접수에 내용을 더했어요');
        setMsg('이미 진행 중인 접수에 내용을 더했어요.');
      } else if (result.kind === 'inquiry' && result.continued === 'merged') {
        toast.success('기존 접수에 이어서 저장했어요');
        setMsg('기존 접수에 이어서 저장했어요.');
      } else if (result.kind === 'inquiry') {
        toast.success('새 접수로 저장했어요');
        setMsg('새 접수로 저장했어요.');
      } else {
        setMsg(incrementDefer ? '저장했습니다. 부재+1 반영' : '저장했습니다.');
      }
      if (!freshStart) {
        window.setTimeout(() => setMsg(null), 2500);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setSaving(false);
    }
  };

  const canDeferIncrement = CRM_INTAKE_FOLLOWUP_DEFER_KINDS.has(kind);

  const flashRing =
    soomgoImportFlashKey > 0
      ? 'ring-2 ring-sky-400/80 ring-offset-1 transition-shadow duration-500'
      : '';

  return (
    <div className="space-y-3">
      {soomgoHiredOther ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-fluid-2xs leading-snug text-amber-950">
          <span className="font-semibold text-amber-900">다른 고수 고용</span>
          {' '}
          — 숨고 채팅 목록에 「다른 고수를 고용함」이 표시됩니다. 재연락·통화를 권장하지 않습니다.
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-2">
        <div className="block min-w-0">
          <span className="mb-1 flex items-center gap-1 whitespace-nowrap text-fluid-2xs font-semibold text-slate-700">
            <label htmlFor="crm-intake-nickname">닉네임 · 호칭</label>
            <HelpTooltip
              text="최초 통화는 닉네임만으로 저장 가능합니다. 고객명은 통화·발주서 확인 후 입력하세요."
              className="[&>div]:-left-20 [&>div]:w-64 [&>div]:font-normal"
            />
          </span>
          <input
            id="crm-intake-nickname"
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="어머님, 관리실"
            className={`${crmIntakeFieldClass} ${soomgoImportFlashKey > 0 && nickname.trim() ? flashRing : ''}`}
            disabled={saving}
          />
        </div>
        <label className="block min-w-0">
          <span className="mb-1 flex flex-nowrap items-center gap-1.5 whitespace-nowrap text-fluid-2xs font-semibold text-slate-700">
            <span>고객명</span>
            {soomgoHiredOther ? (
              <span className="rounded-lg border border-amber-200 bg-amber-100 px-1.5 py-0 text-fluid-2xs font-semibold text-amber-900">
                다른 고수 고용
              </span>
            ) : null}
          </span>
          <input
            type="text"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="확인 후 입력"
            className={`${crmIntakeFieldClass} ${soomgoImportFlashKey > 0 && customerName.trim() ? flashRing : ''}`}
            disabled={saving}
          />
        </label>
      </div>
      <FollowupHotIntakeSlot
        followupId={hotSession?.followupId ?? linkedFollowupId}
        mark={hotSession ? hotSession.mark : (linkedHotMark ?? null)}
        editable={hotEditable}
        pending={pendingHot}
        onPendingChange={setPendingHot}
        onServerMark={(mark) => {
          if (!linkedFollowupId) return;
          setHotSession({ followupId: linkedFollowupId, mark });
          setPendingHot(null);
        }}
        disabled={saving}
      />
      <fieldset>
        <legend className="mb-1 text-fluid-2xs font-semibold text-slate-700">처리 구분</legend>
        <div className="flex flex-wrap gap-1">
          {KIND_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              title={opt.hint}
              onClick={() => setKind(opt.value)}
              disabled={saving}
              className={`inline-flex h-7 items-center rounded-lg border px-2 text-fluid-2xs font-semibold whitespace-nowrap transition-colors ${
                kind === opt.value
                  ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-200 hover:bg-emerald-50/80'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="grid grid-cols-2 gap-2">
      <div className="min-w-0">
      <CollaborationMarketerSelect
        value={collaborationMarketerId}
        onChange={setCollaborationMarketerId}
        marketerOptions={collaborationMarketerOptions}
        excludeMarketerId={crmUserId}
        meUser={
          crmUserId && crmUserName
            ? { id: crmUserId, name: crmUserName, role: crmUserRole ?? undefined }
            : null
        }
        disabled={saving}
        labelClassName="mb-1 whitespace-nowrap text-fluid-2xs font-semibold text-slate-700"
        className={`${crmIntakeFieldClass} ${soomgoImportFlashKey > 0 ? '' : ''}`}
        showHelp
      />
      </div>

      <label className="block min-w-0">
        <span className={crmIntakeLabelClass}>유입 경로 *</span>
        <InquiryLeadSourceSelect
          value={leadSource}
          onChange={setLeadSource}
          required
          disabled={saving}
          className={`${crmIntakeFieldClass} ${soomgoImportFlashKey > 0 && leadSource.trim() ? flashRing : ''}`}
        />
      </label>
      </div>

      {kind === 'received' ? (
        <label className="block">
          <span className={crmIntakeLabelClass}>주소 * (예약완료)</span>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="실 주소를 입력해 주세요"
            className={crmIntakeFieldClass}
            disabled={saving}
          />
        </label>
      ) : null}

      <button
        type="button"
        onClick={() => setShowMore((v) => !v)}
        className="text-fluid-2xs font-medium text-sky-700 hover:underline"
      >
        {showMore ? '추가 필드 접기' : kind === 'received' ? '평수·희망일 등 추가' : '주소·희망일 등 추가'}
      </button>

      {showMore ? (
        <div className="space-y-3 rounded-lg border border-emerald-100/80 bg-emerald-50/30 p-2.5">
          <label className="block">
            <span className={crmIntakeLabelClass}>평수</span>
            <input
              type="text"
              inputMode="decimal"
              value={pyeong}
              onChange={(e) => onPyeongChange(e.target.value)}
              placeholder="예: 33"
              className={`${crmIntakeFieldClass} tabular-nums ${soomgoImportFlashKey > 0 && pyeong.trim() ? flashRing : ''}`}
              disabled={saving}
            />
          </label>
          <div className="grid grid-cols-3 gap-2">
            <label className="block min-w-0">
              <span className={crmIntakeLabelClass}>방</span>
              <input
                type="text"
                inputMode="numeric"
                value={roomCount}
                onChange={(e) => setRoomCount(e.target.value)}
                placeholder="개수"
                className={`${crmIntakeFieldClass} tabular-nums ${soomgoImportFlashKey > 0 && roomCount.trim() ? flashRing : ''}`}
                disabled={saving}
              />
            </label>
            <label className="block min-w-0">
              <span className={crmIntakeLabelClass}>화장실</span>
              <input
                type="text"
                inputMode="numeric"
                value={bathroomCount}
                onChange={(e) => setBathroomCount(e.target.value)}
                placeholder="개수"
                className={`${crmIntakeFieldClass} tabular-nums ${soomgoImportFlashKey > 0 && bathroomCount.trim() ? flashRing : ''}`}
                disabled={saving}
              />
            </label>
            <label className="block min-w-0">
              <span className={crmIntakeLabelClass}>베란다</span>
              <input
                type="text"
                inputMode="numeric"
                value={balconyCount}
                onChange={(e) => setBalconyCount(e.target.value)}
                placeholder="개수"
                className={`${crmIntakeFieldClass} tabular-nums ${soomgoImportFlashKey > 0 && balconyCount.trim() ? flashRing : ''}`}
                disabled={saving}
              />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="block min-w-0">
              <span className={crmIntakeLabelClass}>건축물 유형</span>
              <select
                value={propertyType}
                onChange={(e) => setPropertyType(e.target.value)}
                className={`${crmIntakeFieldClass} ${soomgoImportFlashKey > 0 && propertyType ? flashRing : ''}`}
                disabled={saving}
              >
                <option value="">선택 안 함</option>
                {choiceListWithCurrent(propertyChoices.propertyTypes, propertyType).map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block min-w-0">
              <span className={crmIntakeLabelClass}>건물 형태</span>
              <select
                value={buildingType}
                onChange={(e) => setBuildingType(e.target.value)}
                className={`${crmIntakeFieldClass} ${soomgoImportFlashKey > 0 && buildingType ? flashRing : ''}`}
                disabled={saving}
              >
                <option value="">선택 안 함</option>
                {choiceListWithCurrent(propertyChoices.buildingTypes, buildingType).map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="flex items-center gap-1.5 text-fluid-2xs text-slate-700">
            <input
              type="checkbox"
              checked={isOneRoom}
              onChange={(e) => setIsOneRoom(e.target.checked)}
              disabled={saving}
              className="border-slate-300"
            />
            원룸
          </label>
          {kind !== 'received' ? (
            <label className="block">
              <span className={crmIntakeLabelClass}>주소</span>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className={`${crmIntakeFieldClass} ${soomgoImportFlashKey > 0 && address.trim() ? flashRing : ''}`}
                disabled={saving}
              />
            </label>
          ) : null}
          <label className="block">
            <span className={crmIntakeLabelClass}>입주청소 희망일</span>
            <input
              type="date"
              value={preferredMoveInCleanYmd}
              onChange={(e) => setPreferredMoveInCleanYmd(e.target.value)}
              className={`${crmIntakeFieldClass} ${soomgoImportFlashKey > 0 && preferredMoveInCleanYmd ? flashRing : ''}`}
              disabled={saving}
            />
          </label>
          <CrmRequestMemoField
            value={requestMemo}
            onChange={setRequestMemo}
            disabled={saving}
            highlight={soomgoImportFlashKey > 0 && requestMemo.trim().length > 0}
          />
          <label className="flex items-center gap-1.5 text-fluid-2xs text-slate-700">
            <input
              type="checkbox"
              checked={goldDb}
              onChange={(e) => setGoldDb(e.target.checked)}
              disabled={saving}
              className="rounded-lg border-slate-300"
            />
            골드DB
          </label>
        </div>
      ) : null}

      {!permissionsLoading && !canSave ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5 text-fluid-2xs text-amber-900">
          <strong>{crmIntakePermissionLabel(kind)}</strong> 권한이 필요합니다.
        </p>
      ) : null}

      {msg ? <p className="text-fluid-2xs text-green-700">{msg}</p> : null}
      {err ? <p className="text-fluid-2xs text-red-600">{err}</p> : null}

      <div className="sticky -bottom-2.5 z-10 -mx-2.5 flex flex-nowrap gap-1.5 border-t border-slate-200 bg-white px-2.5 py-2">
        <button
          type="button"
          disabled={saving || permissionsLoading || !canSave}
          onClick={() => void submit({ keepForm: false })}
          className="inline-flex h-9 items-center whitespace-nowrap rounded-lg border border-emerald-600 bg-emerald-600 px-3 text-fluid-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {saving ? '저장 중…' : '저장'}
        </button>
        {canDeferIncrement ? (
          <button
            type="button"
            disabled={saving || permissionsLoading || !canSave}
            onClick={() => void submit({ keepForm: false, incrementDefer: true })}
            title="저장 후 부재 횟수 +1"
            className="inline-flex h-9 items-center whitespace-nowrap rounded-lg border border-amber-300 bg-amber-50 px-3 text-fluid-xs font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-50"
          >
            {saving ? '저장 중…' : '부재+1'}
          </button>
        ) : null}
        <button
          type="button"
          disabled={saving || permissionsLoading || !canSave}
          onClick={() => void submit({ keepForm: true })}
          className="inline-flex h-9 items-center whitespace-nowrap rounded-lg border border-emerald-200 bg-white px-3 text-fluid-xs font-medium text-emerald-900 hover:bg-emerald-50 disabled:opacity-50"
        >
          저장 후 계속
        </button>
        {onOpenOrderIssue ? (
          <button
            type="button"
            onClick={() => onOpenOrderIssue(lastInquiryId)}
            className="inline-flex h-9 items-center whitespace-nowrap rounded-lg border border-sky-200 bg-sky-50 px-3 text-fluid-xs font-medium text-sky-900 hover:bg-sky-100"
          >
            발주서
          </button>
        ) : null}
      </div>
    </div>
  );
}
