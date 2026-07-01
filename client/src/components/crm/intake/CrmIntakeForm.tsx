import { useEffect, useRef, useState } from 'react';
import { getToken } from '../../../stores/auth';
import { ORDER_FOLLOWUP_STATUS_LABEL } from '../../../constants/orderFollowupStatus';
import { INQUIRY_STATUS_LABELS } from '../../inquiries/inquiriesUiParts';
import type { CrmIntakeFormSnapshot } from '../../../utils/crmIntakeDraft';
import {
  submitCrmIntake,
  type CrmIntakeFormValues,
  type CrmIntakeKind,
  type CrmIntakeSubmitResult,
} from './crmIntakeSubmit';
import { crmIntakePermissionLabel } from './crmIntakeValidation';
import { crmFieldClass } from '../crmUi';

const KIND_OPTIONS: { value: CrmIntakeKind; label: string; hint: string }[] = [
  { value: 'absent', label: ORDER_FOLLOWUP_STATUS_LABEL.ABSENT, hint: '부재현황' },
  { value: 'hold', label: ORDER_FOLLOWUP_STATUS_LABEL.ON_HOLD, hint: '부재현황' },
  { value: 'requested', label: ORDER_FOLLOWUP_STATUS_LABEL.REQUESTED, hint: '부재현황' },
  { value: 'deposit', label: ORDER_FOLLOWUP_STATUS_LABEL.DEPOSIT_PENDING, hint: '접수·부재 연동' },
  { value: 'reserved', label: ORDER_FOLLOWUP_STATUS_LABEL.RESERVED, hint: '접수·부재 연동' },
  { value: 'received', label: INQUIRY_STATUS_LABELS.RECEIVED, hint: '예약완료 접수' },
];

export function CrmIntakeForm({
  seed,
  initialFormDraft,
  phone,
  pyeong,
  onPyeongChange,
  onFormChange,
  onSaved,
  lastInquiryId,
  onOpenOrderIssue,
  canSubmitKind,
  permissionsLoading,
}: {
  seed: Partial<CrmIntakeFormValues> & { pyeong?: string };
  initialFormDraft?: Partial<CrmIntakeFormSnapshot> | null;
  phone: string;
  pyeong: string;
  onPyeongChange: (v: string) => void;
  onFormChange?: (snapshot: CrmIntakeFormSnapshot) => void;
  onSaved: (result: CrmIntakeSubmitResult) => void;
  lastInquiryId: string | null;
  onOpenOrderIssue?: (inquiryId: string | null) => void;
  canSubmitKind: (kind: CrmIntakeKind) => boolean;
  permissionsLoading?: boolean;
}) {
  const [customerName, setCustomerName] = useState('');
  const [nickname, setNickname] = useState('');
  const [memo, setMemo] = useState('');
  const [preferredMoveInCleanYmd, setPreferredMoveInCleanYmd] = useState('');
  const [address, setAddress] = useState('');
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
    setMemo(seed.memo ?? '');
    setAddress(seed.address ?? '');
  }, [seed.customerName, seed.nickname, seed.memo, seed.address]);

  const appliedDraftRef = useRef(false);

  useEffect(() => {
    if (appliedDraftRef.current || !initialFormDraft) return;
    appliedDraftRef.current = true;
    if (initialFormDraft.customerName != null) setCustomerName(initialFormDraft.customerName);
    if (initialFormDraft.nickname != null) setNickname(initialFormDraft.nickname);
    if (initialFormDraft.memo != null) setMemo(initialFormDraft.memo);
    if (initialFormDraft.address != null) setAddress(initialFormDraft.address);
    if (initialFormDraft.preferredMoveInCleanYmd != null) {
      setPreferredMoveInCleanYmd(initialFormDraft.preferredMoveInCleanYmd);
    }
    if (initialFormDraft.kind != null) setKind(initialFormDraft.kind);
    if (initialFormDraft.goldDb != null) setGoldDb(initialFormDraft.goldDb);
    if (initialFormDraft.address || initialFormDraft.preferredMoveInCleanYmd) setShowMore(true);
  }, [initialFormDraft]);

  useEffect(() => {
    if (kind === 'received') setShowMore(true);
  }, [kind]);

  useEffect(() => {
    if (!onFormChange) return;
    const t = window.setTimeout(() => {
      onFormChange({
        customerName,
        nickname,
        memo,
        address,
        preferredMoveInCleanYmd,
        kind,
        goldDb,
      });
    }, 400);
    return () => window.clearTimeout(t);
  }, [customerName, nickname, memo, address, preferredMoveInCleanYmd, kind, goldDb, onFormChange]);

  const submit = async (keepForm: boolean) => {
    const token = getToken();
    if (!token) return;
    if (!canSubmitKind(kind)) {
      setErr(`${crmIntakePermissionLabel(kind)} 권한이 필요합니다.`);
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
          phone,
          memo,
          preferredMoveInCleanYmd,
          address,
          kind,
          goldDb,
        },
        pyeong,
      );
      onSaved(result);
      setMsg('저장했습니다.');
      if (!keepForm) {
        setMemo('');
        setPreferredMoveInCleanYmd('');
        if (kind === 'received') setAddress('');
      }
      window.setTimeout(() => setMsg(null), 2500);
    } catch (e) {
      setErr(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <label className="block space-y-1">
        <span className="text-fluid-xs font-medium text-gray-700">고객명 *</span>
        <input
          type="text"
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
          className={crmFieldClass}
          disabled={saving}
        />
      </label>
      <label className="block space-y-1">
        <span className="text-fluid-xs font-medium text-gray-700">닉네임</span>
        <input
          type="text"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          className={crmFieldClass}
          disabled={saving}
        />
      </label>

      <fieldset>
        <legend className="mb-1.5 text-fluid-xs font-medium text-gray-700">처리 구분</legend>
        <div className="grid grid-cols-2 gap-1.5">
          {KIND_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setKind(opt.value)}
              disabled={saving}
              className={`rounded-xl border px-2 py-2 text-left text-fluid-xs transition-all ${
                kind === opt.value
                  ? 'border-emerald-600 bg-gradient-to-br from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-200/50'
                  : 'border-emerald-100 bg-emerald-50/60 text-emerald-950 hover:bg-emerald-100'
              }`}
            >
              <span className="block font-medium">{opt.label}</span>
              <span className={`block text-[10px] mt-0.5 ${kind === opt.value ? 'text-white/80' : 'text-gray-500'}`}>
                {opt.hint}
              </span>
            </button>
          ))}
        </div>
      </fieldset>

      {kind === 'received' ? (
        <label className="block space-y-1">
          <span className="text-fluid-xs font-medium text-gray-700">주소 * (예약완료)</span>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="실 주소를 입력해 주세요"
            className={crmFieldClass}
            disabled={saving}
          />
        </label>
      ) : null}

      {kind !== 'received' ? (
        <button
          type="button"
          onClick={() => setShowMore((v) => !v)}
          className="text-fluid-xs text-sky-700 hover:underline"
        >
          {showMore ? '추가 필드 접기' : '주소·희망일 등 추가'}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setShowMore((v) => !v)}
          className="text-fluid-xs text-sky-700 hover:underline"
        >
          {showMore ? '추가 필드 접기' : '평수·희망일 등 추가'}
        </button>
      )}

      {showMore ? (
        <div className="space-y-3 rounded-xl border border-emerald-100 bg-emerald-50/40 p-3">
          <label className="block space-y-1">
            <span className="text-fluid-xs font-medium text-gray-700">평수</span>
            <input
              type="text"
              inputMode="decimal"
              value={pyeong}
              onChange={(e) => onPyeongChange(e.target.value)}
              placeholder="예: 33"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-fluid-sm tabular-nums"
              disabled={saving}
            />
            <span className="text-[10px] text-gray-500">스크립트·가격 계산기와 연동·접수에 저장됩니다.</span>
          </label>
          {kind !== 'received' ? (
            <label className="block space-y-1">
              <span className="text-fluid-xs font-medium text-gray-700">주소</span>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className={crmFieldClass}
                disabled={saving}
              />
            </label>
          ) : null}
          <label className="block space-y-1">
            <span className="text-fluid-xs font-medium text-gray-700">입주청소 희망일</span>
            <input
              type="date"
              value={preferredMoveInCleanYmd}
              onChange={(e) => setPreferredMoveInCleanYmd(e.target.value)}
              className={crmFieldClass}
              disabled={saving}
            />
            <span className="text-[10px] text-gray-500">
              부재·입금 연동 시 부재현황에, 예약완료 시 접수 희망일에 반영됩니다.
            </span>
          </label>
          <label className="flex items-start gap-2 text-fluid-xs text-gray-700">
            <input
              type="checkbox"
              checked={goldDb}
              onChange={(e) => setGoldDb(e.target.checked)}
              disabled={saving}
              className="mt-0.5"
            />
            골드DB (부재현황 강조)
          </label>
        </div>
      ) : null}

      <label className="block space-y-1">
        <span className="text-fluid-xs font-medium text-gray-700">메모</span>
        <textarea
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          rows={3}
          className={crmFieldClass}
          disabled={saving}
        />
      </label>

      {!permissionsLoading && !canSave ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-fluid-xs text-amber-900">
          선택한 처리 구분을 저장하려면 <strong>{crmIntakePermissionLabel(kind)}</strong> 권한이 필요합니다.
        </p>
      ) : null}

      {msg ? <p className="text-fluid-xs text-green-700">{msg}</p> : null}
      {err ? <p className="text-fluid-xs text-red-600">{err}</p> : null}

      <div className="flex flex-col gap-2">
        <button
          type="button"
          disabled={saving || permissionsLoading || !canSave}
          onClick={() => void submit(false)}
          className="w-full rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 py-2.5 text-fluid-sm font-semibold text-white shadow-md shadow-emerald-200/40 disabled:opacity-50"
        >
          {saving ? '저장 중…' : '저장'}
        </button>
        <button
          type="button"
          disabled={saving || permissionsLoading || !canSave}
          onClick={() => void submit(true)}
          className="w-full rounded-xl border border-emerald-200 bg-white py-2 text-fluid-sm font-medium text-emerald-900 hover:bg-emerald-50 disabled:opacity-50"
        >
          저장 후 계속
        </button>
        {onOpenOrderIssue ? (
          <button
            type="button"
            onClick={() => onOpenOrderIssue(lastInquiryId)}
            className="w-full rounded-xl border border-sky-200 bg-gradient-to-r from-sky-50 to-indigo-50/50 py-2 text-fluid-sm font-medium text-sky-900 hover:border-sky-300 hover:shadow-sm"
          >
            발주서 발급
          </button>
        ) : null}
      </div>
    </div>
  );
}
