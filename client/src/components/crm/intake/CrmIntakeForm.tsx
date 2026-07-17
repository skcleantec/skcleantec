import { useEffect, useRef, useState } from 'react';
import { getToken } from '../../../stores/auth';
import { ORDER_FOLLOWUP_STATUS_LABEL } from '../../../constants/orderFollowupStatus';
import { INQUIRY_STATUS_LABELS } from '../../inquiries/inquiriesUiParts';
import type { TelecrmConsultationQuotePayload } from '@shared/telecrmConsultationQuote';
import type { CrmIntakeFormSnapshot } from '../../../utils/crmIntakeDraft';
import {
  submitCrmIntake,
  type CrmIntakeFormValues,
  type CrmIntakeKind,
  type CrmIntakeSubmitResult,
} from './crmIntakeSubmit';
import { crmIntakePermissionLabel } from './crmIntakeValidation';
import { crmFieldCompactClass } from '../crmUi';
import { CrmRequestMemoField } from './CrmRequestMemoField';

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
  operatingCompanyId = null,
}: {
  seed: Partial<CrmIntakeFormValues> & { pyeong?: string };
  initialFormDraft?: Partial<CrmIntakeFormSnapshot> | null;
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
  const [showMore, setShowMore] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const canSave = canSubmitKind(kind);

  useEffect(() => {
    setCustomerName(seed.customerName ?? '');
    setNickname(seed.nickname ?? '');
    setAddress(seed.address ?? '');
  }, [seed.customerName, seed.nickname, seed.address]);

  const appliedDraftRef = useRef(0);

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
    if (
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
  }, [initialFormDraft, soomgoImportFlashKey, pyeong]);

  useEffect(() => {
    if (kind === 'received') setShowMore(true);
  }, [kind]);

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
    setShowMore(false);
    appliedDraftRef.current = 0;
  }, [formResetKey]);

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
    onFormChange,
  ]);

  const submit = async (keepForm: boolean) => {
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
        },
        pyeong,
        { operatingCompanyId, quotePayload },
      );
      onSaved(result, { freshStart: !keepForm });
      setMsg('저장했습니다.');
      window.setTimeout(() => setMsg(null), 2500);
    } catch (e) {
      setErr(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setSaving(false);
    }
  };

  const flashRing =
    soomgoImportFlashKey > 0
      ? 'ring-2 ring-sky-400/80 ring-offset-1 transition-shadow duration-500'
      : '';

  return (
    <div className="space-y-2.5">
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
          <span className="text-[11px] font-medium text-slate-600">고객명</span>
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
          onClick={() => void submit(false)}
          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {saving ? '저장 중…' : '저장'}
        </button>
        <button
          type="button"
          disabled={saving || permissionsLoading || !canSave}
          onClick={() => void submit(true)}
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
