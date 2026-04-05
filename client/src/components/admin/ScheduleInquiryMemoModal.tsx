import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { updateInquiry } from '../../api/inquiries';
import type { ScheduleItem } from '../../api/schedule';
import { ModalCloseButton } from './ModalCloseButton';

type Props = {
  token: string;
  item: ScheduleItem;
  onClose: () => void;
  /** 저장 후 스케줄 재조회 등 — Promise면 끝날 때까지 대기 */
  onSaved: () => void | Promise<void>;
};

export function ScheduleInquiryMemoModal({ token, item, onClose, onSaved }: Props) {
  const [draft, setDraft] = useState(item.scheduleMemo ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(item.scheduleMemo ?? '');
  }, [item.id, item.scheduleMemo]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const trimmed = draft.trim();
      await updateInquiry(token, item.id, {
        scheduleMemo: trimmed ? trimmed : null,
      });
      await onSaved();
      onClose();
    } catch (e) {
      alert(e instanceof Error ? e.message : '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }, [draft, item.id, onClose, onSaved, token]);

  const handleClear = useCallback(async () => {
    if (!draft.trim() && !item.scheduleMemo?.trim()) return;
    if (!window.confirm('메모를 비우시겠습니까?')) return;
    setSaving(true);
    try {
      await updateInquiry(token, item.id, { scheduleMemo: null });
      await onSaved();
      onClose();
    } catch (e) {
      alert(e instanceof Error ? e.message : '삭제에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }, [draft, item.id, item.scheduleMemo, onClose, onSaved, token]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[520] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal
      aria-labelledby="schedule-memo-title"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="닫기"
        onClick={onClose}
      />
      <div
        className="relative w-full max-w-md rounded-lg bg-white shadow-xl border border-gray-200 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <ModalCloseButton onClick={onClose} disabled={saving} />
        <h2 id="schedule-memo-title" className="text-base font-semibold text-gray-900 pr-10 mb-1">
          일정 메모
        </h2>
        <p className="text-[11px] text-gray-500 mb-2 leading-snug">
          스케줄 목록에만 표시됩니다. 특이사항·발주서 메모와는 별도입니다.
        </p>
        <p className="text-xs text-gray-500 mb-3">
          <span className="font-medium text-gray-800">{item.customerName}</span>
          {item.inquiryNumber ? (
            <span className="ml-2 tabular-nums text-gray-400">{item.inquiryNumber}</span>
          ) : null}
        </p>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={5}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400"
          placeholder="예: 엘리베이터 X, 현관 비번"
          disabled={saving}
        />
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSave()}
            className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
          >
            저장
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleClear()}
            className="px-4 py-2 rounded-lg border border-gray-300 text-gray-800 text-sm hover:bg-gray-50 disabled:opacity-50"
          >
            메모 비우기
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-gray-200 text-gray-600 text-sm hover:bg-gray-50"
          >
            닫기
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
