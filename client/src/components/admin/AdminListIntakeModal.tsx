import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { createOrderFollowup } from '../../api/orderFollowups';
import { createInquiry, updateInquiry } from '../../api/inquiries';
import { ModalCloseButton } from './ModalCloseButton';
import { ORDER_FOLLOWUP_STATUS_LABEL, type OrderFollowupStatus } from '../../constants/orderFollowupStatus';

export type AdminListIntakeResult =
  | { kind: 'absent_or_hold' }
  | { kind: 'updated_inquiry' }
  | { kind: 'created_deposit_reserved'; inquiryStatus: 'DEPOSIT_PENDING' | 'DEPOSIT_COMPLETED' };

type Kind = 'requested' | 'absent' | 'hold' | 'deposit' | 'reserved';

function emptyForm() {
  return {
    name: '',
    nickname: '',
    phone: '',
    memo: '',
    preferredMoveInCleanYmd: '',
    kind: 'deposit' as Kind,
  };
}

/** 접수 목록·부재 보류 「전화·상태별 신규」(및 접수 목록에서의 동일 필드 수정) 공통 모달 */
export function AdminListIntakeModal({
  open,
  token,
  onClose,
  /** false = 신규, true = 접수 행 수정(목록 한정) */
  editMode,
  editInquiryId,
  editSeed,
  /** submit 성공 직후 (부모가 닫기·목록 갱신·접수 필터 처리) */
  onCommitted,
}: {
  open: boolean;
  token: string | null;
  onClose: () => void;
  editMode: boolean;
  editInquiryId: string | null;
  editSeed: { customerName: string; nickname: string; customerPhone: string; memo: string; depositPending: boolean } | null;
  onCommitted: (result: AdminListIntakeResult) => void;
}) {
  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  const [phone, setPhone] = useState('');
  const [memo, setMemo] = useState('');
  const [preferredMoveInCleanYmd, setPreferredMoveInCleanYmd] = useState('');
  const [kind, setKind] = useState<Kind>('deposit');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editMode && editInquiryId && editSeed) {
      setName(editSeed.customerName ?? '');
      setNickname(editSeed.nickname ?? '');
      setPhone(editSeed.customerPhone ?? '');
      setMemo(editSeed.memo ?? '');
      setPreferredMoveInCleanYmd('');
      setKind(editSeed.depositPending ? 'deposit' : 'reserved');
      return;
    }
    const z = emptyForm();
    setName(z.name);
    setNickname(z.nickname);
    setPhone(z.phone);
    setMemo(z.memo);
    setPreferredMoveInCleanYmd(z.preferredMoveInCleanYmd);
    setKind(z.kind);
  }, [open, editMode, editInquiryId, editSeed]);

  const submit = async () => {
    if (!token) return;
    const n = name.trim();
    if (!n) {
      alert('고객명을 입력해 주세요.');
      return;
    }
    setSaving(true);
    try {
      const pmd = preferredMoveInCleanYmd.trim();
      const pmdBody = pmd ? { preferredMoveInCleaningDate: pmd } : {};
      if (kind === 'requested' || kind === 'absent' || kind === 'hold') {
        const status: OrderFollowupStatus =
          kind === 'requested' ? 'REQUESTED' : kind === 'absent' ? 'ABSENT' : 'ON_HOLD';
        await createOrderFollowup(token, {
          customerName: n,
          nickname: nickname.trim() || null,
          customerPhone: phone.trim(),
          status,
          memo: memo.trim() || null,
          ...pmdBody,
        });
        onCommitted({ kind: 'absent_or_hold' });
        onClose();
        return;
      }

      if (editMode && editInquiryId) {
        await updateInquiry(token, editInquiryId, {
          customerName: n,
          nickname: nickname.trim() || null,
          customerPhone: phone.trim() || '',
          memo: memo.trim() || null,
        });
        onCommitted({ kind: 'updated_inquiry' });
        onClose();
        return;
      }

      const inqSt = kind === 'deposit' ? 'DEPOSIT_PENDING' : 'DEPOSIT_COMPLETED';
      const created = (await createInquiry(token, {
        customerName: n,
        nickname: nickname.trim() || null,
        customerPhone: phone.trim() || '',
        address: '',
        addressDetail: null,
        memo: memo.trim() || null,
        source: '전화',
        status: inqSt,
      })) as { id: string };
      const fuSt: OrderFollowupStatus = kind === 'deposit' ? 'DEPOSIT_PENDING' : 'RESERVED';
      await createOrderFollowup(token, {
        customerName: n,
        nickname: nickname.trim() || null,
        customerPhone: phone.trim(),
        status: fuSt,
        memo: memo.trim() || null,
        inquiryId: created.id,
        ...pmdBody,
      });
      onCommitted({
        kind: 'created_deposit_reserved',
        inquiryStatus: inqSt,
      });
      onClose();
    } catch (e) {
      alert(e instanceof Error ? e.message : '등록에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  if (!open || !token) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[580] flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="list-intake-title"
    >
      <div className="absolute inset-0" aria-hidden onClick={() => !saving && onClose()} />
      <div className="relative z-10 flex max-h-[min(92dvh,640px)] w-full max-w-lg flex-col rounded-t-2xl border border-gray-200 bg-white shadow-xl sm:rounded-xl">
        <ModalCloseButton onClick={() => !saving && onClose()} />
        <div className="shrink-0 border-b border-gray-100 px-4 pb-2 pt-4 pr-12">
          <h2 id="list-intake-title" className="text-fluid-base font-semibold text-gray-900">
            {editMode ? '전화·상태 수정' : '전화·상태별 신규'}
          </h2>
          <p className="mt-1 text-fluid-2xs text-gray-500">
            {editMode
              ? '고객명·닉네임·연락처·메모를 수정합니다. 처리 구분은 변경하지 않습니다.'
              : '부재·보류는 부재현황에서만 이어갑니다. 입금대기·입금완료는 서비스접수에 바로 나타납니다.'}
          </p>
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-y-contain px-4 py-3">
          <div>
            <label className="mb-1 block text-fluid-xs font-medium text-gray-700">고객명 *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-fluid-sm"
              autoComplete="name"
              disabled={saving}
            />
          </div>
          <div>
            <label className="mb-1 block text-fluid-xs font-medium text-gray-700">닉네임 (선택)</label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-fluid-sm"
              disabled={saving}
              placeholder="예: 어머님, 관리실"
            />
          </div>
          <div>
            <label className="mb-1 block text-fluid-xs font-medium text-gray-700">연락처</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-fluid-sm tabular-nums"
              inputMode="tel"
              autoComplete="tel"
              disabled={saving}
            />
          </div>
          <div>
            <label className="mb-1 block text-fluid-xs font-medium text-gray-700">
              입주청소 희망날짜 (선택)
            </label>
            <input
              type="date"
              value={preferredMoveInCleanYmd}
              onChange={(e) => setPreferredMoveInCleanYmd(e.target.value)}
              className="w-full max-w-[280px] rounded-lg border border-gray-200 px-3 py-2 text-fluid-sm tabular-nums"
              disabled={saving}
            />
            <p className="mt-1 text-fluid-3xs text-gray-500">
              선택 시 부재현황 목록에 등록일 옆으로 희망일이 함께 표시됩니다.
            </p>
          </div>
          <fieldset>
            <legend className="mb-2 text-fluid-xs font-medium text-gray-700">처리 구분 *</legend>
            <div className={`space-y-2 text-fluid-2xs sm:text-fluid-xs ${editMode ? 'pointer-events-none opacity-60' : ''}`}>
              <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-gray-100 p-2 hover:bg-gray-50">
                <input
                  type="radio"
                  name="listIntakeKind"
                  checked={kind === 'requested'}
                  onChange={() => setKind('requested')}
                  className="mt-0.5"
                  disabled={saving}
                />
                <span>
                  <span className="font-medium text-gray-900">{ORDER_FOLLOWUP_STATUS_LABEL.REQUESTED}</span>
                  <span className="mt-0.5 block text-gray-500">부재현황 상단 상태 · 접수 확정 전 문의 단계에 사용</span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-gray-100 p-2 hover:bg-gray-50">
                <input
                  type="radio"
                  name="listIntakeKind"
                  checked={kind === 'absent'}
                  onChange={() => setKind('absent')}
                  className="mt-0.5"
                  disabled={saving}
                />
                <span>
                  <span className="font-medium text-gray-900">{ORDER_FOLLOWUP_STATUS_LABEL.ABSENT}</span>
                  <span className="mt-0.5 block text-gray-500">부재현황으로 이동 · 서비스접수에는 없음</span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-gray-100 p-2 hover:bg-gray-50">
                <input
                  type="radio"
                  name="listIntakeKind"
                  checked={kind === 'hold'}
                  onChange={() => setKind('hold')}
                  className="mt-0.5"
                  disabled={saving}
                />
                <span>
                  <span className="font-medium text-gray-900">{ORDER_FOLLOWUP_STATUS_LABEL.ON_HOLD}</span>
                  <span className="mt-0.5 block text-gray-500">부재현황으로 이동 · 서비스접수에는 없음</span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-sky-200 bg-sky-50/50 p-2 hover:bg-sky-50">
                <input
                  type="radio"
                  name="listIntakeKind"
                  checked={kind === 'deposit'}
                  onChange={() => setKind('deposit')}
                  className="mt-0.5"
                  disabled={saving}
                />
                <span>
                  <span className="font-medium text-gray-900">{ORDER_FOLLOWUP_STATUS_LABEL.DEPOSIT_PENDING}</span>
                  <span className="mt-0.5 block text-sky-900/80">서비스접수(입금대기) + 부재현황(예약금 대기) 연동</span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-sky-200 bg-sky-50/50 p-2 hover:bg-sky-50">
                <input
                  type="radio"
                  name="listIntakeKind"
                  checked={kind === 'reserved'}
                  onChange={() => setKind('reserved')}
                  className="mt-0.5"
                  disabled={saving}
                />
                <span>
                  <span className="font-medium text-gray-900">{ORDER_FOLLOWUP_STATUS_LABEL.RESERVED}</span>
                  <span className="mt-0.5 block text-sky-900/80">서비스접수(입금완료) + 부재현황(입금 완료) 연동</span>
                </span>
              </label>
            </div>
          </fieldset>
          <div>
            <label className="mb-1 block text-fluid-xs font-medium text-gray-700">메모</label>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-fluid-sm"
              disabled={saving}
            />
          </div>
        </div>
        <div className="shrink-0 border-t border-gray-100 px-4 py-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => onClose()}
              disabled={saving}
              className="order-2 w-full rounded-lg border border-gray-300 py-2.5 text-fluid-sm font-medium text-gray-800 hover:bg-gray-50 sm:order-1 sm:w-auto sm:px-4"
            >
              취소
            </button>
            <button
              type="button"
              onClick={() => void submit()}
              disabled={saving}
              className="order-1 w-full min-h-[44px] touch-manipulation rounded-lg bg-sky-700 py-2.5 text-fluid-sm font-medium text-white hover:bg-sky-800 disabled:opacity-50 sm:order-2 sm:w-auto sm:px-5"
            >
              {saving
                ? '등록 중…'
                : editMode
                  ? '수정 저장'
                  : kind === 'requested' || kind === 'absent' || kind === 'hold'
                    ? '등록 후 부재현황으로'
                    : '등록'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
