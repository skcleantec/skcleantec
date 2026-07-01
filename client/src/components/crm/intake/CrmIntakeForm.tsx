import { useEffect, useState } from 'react';
import { getToken } from '../../../stores/auth';
import { ORDER_FOLLOWUP_STATUS_LABEL } from '../../../constants/orderFollowupStatus';
import { INQUIRY_STATUS_LABELS } from '../../inquiries/inquiriesUiParts';
import {
  submitCrmIntake,
  type CrmIntakeFormValues,
  type CrmIntakeKind,
  type CrmIntakeSubmitResult,
} from './crmIntakeSubmit';

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
  pyeong,
  onPyeongChange,
  onSaved,
  lastInquiryId,
  onOpenOrderIssue,
}: {
  seed: Partial<CrmIntakeFormValues> & { pyeong?: string };
  pyeong: string;
  onPyeongChange: (v: string) => void;
  onSaved: (result: CrmIntakeSubmitResult) => void;
  lastInquiryId: string | null;
  onOpenOrderIssue: (inquiryId: string | null) => void;
}) {
  const [customerName, setCustomerName] = useState('');
  const [nickname, setNickname] = useState('');
  const [phone, setPhone] = useState('');
  const [memo, setMemo] = useState('');
  const [preferredMoveInCleanYmd, setPreferredMoveInCleanYmd] = useState('');
  const [address, setAddress] = useState('');
  const [kind, setKind] = useState<CrmIntakeKind>('absent');
  const [goldDb, setGoldDb] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setCustomerName(seed.customerName ?? '');
    setNickname(seed.nickname ?? '');
    setPhone(seed.phone ?? '');
    setMemo(seed.memo ?? '');
    setAddress(seed.address ?? '');
  }, [seed.customerName, seed.nickname, seed.phone, seed.memo, seed.address]);

  const submit = async (keepForm: boolean) => {
    const token = getToken();
    if (!token) return;
    setSaving(true);
    setErr(null);
    setMsg(null);
    try {
      const result = await submitCrmIntake(token, {
        customerName,
        nickname,
        phone,
        memo,
        preferredMoveInCleanYmd,
        address,
        kind,
        goldDb,
      });
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
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-fluid-sm"
          disabled={saving}
        />
      </label>
      <label className="block space-y-1">
        <span className="text-fluid-xs font-medium text-gray-700">닉네임</span>
        <input
          type="text"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-fluid-sm"
          disabled={saving}
        />
      </label>
      <label className="block space-y-1">
        <span className="text-fluid-xs font-medium text-gray-700">연락처</span>
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-fluid-sm tabular-nums"
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
              className={`rounded-lg border px-2 py-2 text-left text-fluid-xs transition-colors ${
                kind === opt.value
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-gray-200 bg-gray-50 text-gray-800 hover:bg-gray-100'
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

      <button
        type="button"
        onClick={() => setShowMore((v) => !v)}
        className="text-fluid-xs text-sky-700 hover:underline"
      >
        {showMore ? '추가 필드 접기' : '주소·희망일 등 추가'}
      </button>

      {showMore ? (
        <div className="space-y-3 rounded-xl border border-gray-100 bg-slate-50/80 p-3">
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
            <span className="text-[10px] text-gray-500">스크립트·가격 계산기와 연동됩니다.</span>
          </label>
          <label className="block space-y-1">
            <span className="text-fluid-xs font-medium text-gray-700">주소 (예약완료 시)</span>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-fluid-sm"
              disabled={saving}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-fluid-xs font-medium text-gray-700">입주청소 희망일</span>
            <input
              type="date"
              value={preferredMoveInCleanYmd}
              onChange={(e) => setPreferredMoveInCleanYmd(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-fluid-sm"
              disabled={saving}
            />
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
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-fluid-sm"
          disabled={saving}
        />
      </label>

      {msg ? <p className="text-fluid-xs text-green-700">{msg}</p> : null}
      {err ? <p className="text-fluid-xs text-red-600">{err}</p> : null}

      <div className="flex flex-col gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={() => void submit(false)}
          className="w-full rounded-lg bg-slate-900 py-2.5 text-fluid-sm font-medium text-white disabled:opacity-50"
        >
          {saving ? '저장 중…' : '저장'}
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => void submit(true)}
          className="w-full rounded-lg border border-gray-300 py-2 text-fluid-sm text-gray-800 hover:bg-gray-50 disabled:opacity-50"
        >
          저장 후 계속
        </button>
        <button
          type="button"
          onClick={() => onOpenOrderIssue(lastInquiryId)}
          className="w-full rounded-lg border border-sky-200 bg-sky-50 py-2 text-fluid-sm text-sky-900 hover:bg-sky-100"
        >
          발주서 발급 화면 열기
        </button>
      </div>
    </div>
  );
}
