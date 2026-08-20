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
  type CrmIntakeSubmitResult,
} from './crmIntakeSubmit';
import { crmIntakePermissionLabel } from './crmIntakeValidation';
import { crmFieldCompactClass } from '../crmUi';
import { CrmRequestMemoField } from './CrmRequestMemoField';
import { InquiryLeadSourceSelect } from '../../inquiry/InquiryLeadSourceSelect';
import { CollaborationMarketerSelect } from '../../inquiry/CollaborationMarketerSelect';
import { useCollaborationMarketerOptions } from '../../../hooks/useCollaborationMarketerOptions';
import { useAdminStaffSession } from '../../../hooks/useAdminStaffSession';

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
}) {
  const [customerName, setCustomerName] = useState('');
  const [nickname, setNickname] = useState('');
  const [preferredMoveInCleanYmd, setPreferredMoveInCleanYmd] = useState('');
  const [address, setAddress] = useState('');
  const [requestMemo, setRequestMemo] = useState('');
  const [roomCount, setRoomCount] = useState('');
  const [bathroomCount, setBathroomCount] = useState('');
  const [balconyCount, setBalconyCount] = useState('');
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
    setKind('absent');
    setGoldDb(false);
    setLeadSource('');
    setCollaborationMarketerId('');
    setExtractPlatform(undefined);
    setShowMore(false);
    setMsg(null);
    setErr(null);
    appliedDraftRef.current = 0;
  }, [formResetKey]);

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
          kind,
          goldDb,
          leadSource,
          collaborationMarketerId: collaborationMarketerId.trim() || undefined,
          extractPlatform,
        },
        pyeong,
        { operatingCompanyId, quotePayload, incrementDefer },
      );
      const freshStart = incrementDefer || !keepForm;
      onSaved(result, { freshStart });
      setMsg(incrementDefer ? '저장했습니다. 부재+1 반영' : '저장했습니다.');
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
    <div className="space-y-2.5">
      {soomgoHiredOther ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] leading-snug text-amber-950">
          <span className="font-semibold text-amber-900">다른 고수 고용</span>
          {' '}
          — 숨고 채팅 목록에 「다른 고수를 고용함」이 표시됩니다. 재연락·통화를 권장하지 않습니다.
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-2">
        <label className="block min-w-0 space-y-0.5">
          <span className="text-[11px] font-medium text-slate-600">닉네임 · 호칭</span>
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="어머님, 관리실"
            className={`${crmFieldCompactClass} ${soomgoImportFlashKey > 0 && nickname.trim() ? flashRing : ''}`}
            disabled={saving}
          />
        </label>
        <label className="block min-w-0 space-y-0.5">
          <span className="flex flex-wrap items-center gap-1.5 text-[11px] font-medium text-slate-600">
            <span>고객명</span>
            {soomgoHiredOther ? (
              <span className="rounded border border-amber-200 bg-amber-100 px-1.5 py-0 text-[10px] font-semibold text-amber-900">
                다른 고수 고용
              </span>
            ) : null}
          </span>
          <input
            type="text"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="확인 후 입력"
            className={`${crmFieldCompactClass} ${soomgoImportFlashKey > 0 && customerName.trim() ? flashRing : ''}`}
            disabled={saving}
          />
        </label>
      </div>
      <p className="text-[10px] leading-snug text-slate-500">
        최초 통화는 닉네임만으로 저장 가능합니다. 고객명은 통화·발주서 확인 후 입력하세요.
      </p>

      <fieldset>
        <legend className="mb-1 text-[11px] font-semibold text-slate-700">처리 구분</legend>
        <div className="flex flex-wrap gap-1">
          {KIND_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              title={opt.hint}
              onClick={() => setKind(opt.value)}
              disabled={saving}
              className={`rounded-md border px-2 py-1 text-[11px] font-semibold whitespace-nowrap transition-colors ${
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
        labelClassName="text-[11px] font-medium text-slate-600"
        className={`${crmFieldCompactClass} ${soomgoImportFlashKey > 0 ? '' : ''}`}
        showHelp
      />

      <label className="block space-y-0.5">
        <span className="text-[11px] font-medium text-slate-600">유입 경로 *</span>
        <InquiryLeadSourceSelect
          value={leadSource}
          onChange={setLeadSource}
          required
          disabled={saving}
          className={`${crmFieldCompactClass} ${soomgoImportFlashKey > 0 && leadSource.trim() ? flashRing : ''}`}
        />
      </label>

      {kind === 'received' ? (
        <label className="block space-y-0.5">
          <span className="text-[11px] font-medium text-slate-600">주소 * (예약완료)</span>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="실 주소를 입력해 주세요"
            className={crmFieldCompactClass}
            disabled={saving}
          />
        </label>
      ) : null}

      <button
        type="button"
        onClick={() => setShowMore((v) => !v)}
        className="text-[11px] font-medium text-sky-700 hover:underline"
      >
        {showMore ? '추가 필드 접기' : kind === 'received' ? '평수·희망일 등 추가' : '주소·희망일 등 추가'}
      </button>

      {showMore ? (
        <div className="space-y-2 rounded-lg border border-emerald-100/80 bg-emerald-50/30 p-2.5">
          <label className="block space-y-0.5">
            <span className="text-[11px] font-medium text-slate-600">평수</span>
            <input
              type="text"
              inputMode="decimal"
              value={pyeong}
              onChange={(e) => onPyeongChange(e.target.value)}
              placeholder="예: 33"
              className={`${crmFieldCompactClass} tabular-nums ${soomgoImportFlashKey > 0 && pyeong.trim() ? flashRing : ''}`}
              disabled={saving}
            />
          </label>
          <div className="grid grid-cols-3 gap-2">
            <label className="block min-w-0 space-y-0.5">
              <span className="text-[11px] font-medium text-slate-600">방</span>
              <input
                type="text"
                inputMode="numeric"
                value={roomCount}
                onChange={(e) => setRoomCount(e.target.value)}
                placeholder="개수"
                className={`${crmFieldCompactClass} tabular-nums ${soomgoImportFlashKey > 0 && roomCount.trim() ? flashRing : ''}`}
                disabled={saving}
              />
            </label>
            <label className="block min-w-0 space-y-0.5">
              <span className="text-[11px] font-medium text-slate-600">화장실</span>
              <input
                type="text"
                inputMode="numeric"
                value={bathroomCount}
                onChange={(e) => setBathroomCount(e.target.value)}
                placeholder="개수"
                className={`${crmFieldCompactClass} tabular-nums ${soomgoImportFlashKey > 0 && bathroomCount.trim() ? flashRing : ''}`}
                disabled={saving}
              />
            </label>
            <label className="block min-w-0 space-y-0.5">
              <span className="text-[11px] font-medium text-slate-600">베란다</span>
              <input
                type="text"
                inputMode="numeric"
                value={balconyCount}
                onChange={(e) => setBalconyCount(e.target.value)}
                placeholder="개수"
                className={`${crmFieldCompactClass} tabular-nums ${soomgoImportFlashKey > 0 && balconyCount.trim() ? flashRing : ''}`}
                disabled={saving}
              />
            </label>
          </div>
          {kind !== 'received' ? (
            <label className="block space-y-0.5">
              <span className="text-[11px] font-medium text-slate-600">주소</span>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className={`${crmFieldCompactClass} ${soomgoImportFlashKey > 0 && address.trim() ? flashRing : ''}`}
                disabled={saving}
              />
            </label>
          ) : null}
          <label className="block space-y-0.5">
            <span className="text-[11px] font-medium text-slate-600">입주청소 희망일</span>
            <input
              type="date"
              value={preferredMoveInCleanYmd}
              onChange={(e) => setPreferredMoveInCleanYmd(e.target.value)}
              className={`${crmFieldCompactClass} ${soomgoImportFlashKey > 0 && preferredMoveInCleanYmd ? flashRing : ''}`}
              disabled={saving}
            />
          </label>
          <CrmRequestMemoField
            value={requestMemo}
            onChange={setRequestMemo}
            disabled={saving}
            highlight={soomgoImportFlashKey > 0 && requestMemo.trim().length > 0}
          />
          <label className="flex items-center gap-1.5 text-[11px] text-slate-700">
            <input
              type="checkbox"
              checked={goldDb}
              onChange={(e) => setGoldDb(e.target.checked)}
              disabled={saving}
              className="rounded border-slate-300"
            />
            골드DB
          </label>
        </div>
      ) : null}

      {!permissionsLoading && !canSave ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-900">
          <strong>{crmIntakePermissionLabel(kind)}</strong> 권한이 필요합니다.
        </p>
      ) : null}

      {msg ? <p className="text-[11px] text-green-700">{msg}</p> : null}
      {err ? <p className="text-[11px] text-red-600">{err}</p> : null}

      <div className="flex flex-wrap gap-1.5 border-t border-slate-100 pt-2">
        <button
          type="button"
          disabled={saving || permissionsLoading || !canSave}
          onClick={() => void submit({ keepForm: false })}
          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {saving ? '저장 중…' : '저장'}
        </button>
        {canDeferIncrement ? (
          <button
            type="button"
            disabled={saving || permissionsLoading || !canSave}
            onClick={() => void submit({ keepForm: false, incrementDefer: true })}
            title="저장 후 부재 횟수 +1"
            className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-[11px] font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-50"
          >
            {saving ? '저장 중…' : '부재+1'}
          </button>
        ) : null}
        <button
          type="button"
          disabled={saving || permissionsLoading || !canSave}
          onClick={() => void submit({ keepForm: true })}
          className="rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-[11px] font-medium text-emerald-900 hover:bg-emerald-50 disabled:opacity-50"
        >
          저장 후 계속
        </button>
        {onOpenOrderIssue ? (
          <button
            type="button"
            onClick={() => onOpenOrderIssue(lastInquiryId)}
            className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-[11px] font-medium text-sky-900 hover:bg-sky-100"
          >
            발주서
          </button>
        ) : null}
      </div>
    </div>
  );
}
