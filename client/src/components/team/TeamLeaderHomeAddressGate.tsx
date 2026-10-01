import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AddressSearch } from '../forms/AddressSearch';
import { useModalScrollKeyboardAvoidance } from '../../hooks/useMobileInputVisibility';
import { isAuthSessionExpiredError, updateMyProfile } from '../../api/auth';
import { isCbiseoStaffNativeApp } from '../../utils/cbiseoNativeApp';

export function TeamLeaderHomeAddressGate({
  open,
  token,
  onCompleted,
  onSessionExpired,
}: {
  open: boolean;
  token: string;
  onCompleted: () => void;
  onSessionExpired?: () => void;
}) {
  const [address, setAddress] = useState('');
  const [detail, setDetail] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { onFieldFocus } = useModalScrollKeyboardAvoidance(scrollRef, open);
  const staffNativeApp = isCbiseoStaffNativeApp();

  if (!open) return null;

  const submit = async () => {
    setError(null);
    if (!address.trim()) {
      setError('주소 검색으로 집 주소를 선택해 주세요.');
      return;
    }
    setSaving(true);
    try {
      await updateMyProfile(token, {
        homeAddress: address.trim(),
        homeAddressDetail: detail.trim() ? detail.trim() : null,
      });
      onCompleted();
    } catch (e) {
      if (isAuthSessionExpiredError(e)) {
        onSessionExpired?.();
        return;
      }
      setError(e instanceof Error ? e.message : '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const saveButton = (
    <button
      type="button"
      disabled={saving}
      onClick={() => void submit()}
      className="min-h-11 w-full rounded-lg bg-slate-900 py-2.5 text-fluid-sm font-semibold text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-60"
    >
      {saving ? '저장 중…' : '저장하고 시작하기'}
    </button>
  );

  return createPortal(
    <div
      className={`fixed inset-0 z-[700] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4${
        staffNativeApp ? ' modal-mobile-safe-overlay' : ''
      }`}
      role="dialog"
      aria-modal
      aria-labelledby="team-home-address-title"
    >
      <div className="flex max-h-[min(calc(94dvh-env(safe-area-inset-bottom,0px)),760px)] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-gray-200 bg-white shadow-2xl sm:max-h-[min(94dvh,760px)] sm:rounded-2xl">
        <div className="shrink-0 border-b border-gray-200 px-4 py-4 sm:px-5">
          <h2 id="team-home-address-title" className="text-fluid-base font-semibold text-gray-900">
            집 주소 입력
          </h2>
          <p className="mt-1 text-fluid-xs leading-relaxed text-gray-600">
            집 주소를 입력해야 청소비서를 이용할 수 있습니다.
          </p>
        </div>
        <div
          ref={scrollRef}
          onFocusCapture={onFieldFocus}
          className="modal-form-scroll-surface min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 py-4 sm:px-5"
        >
          {error ? (
            <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-fluid-xs text-red-800">
              {error}
            </div>
          ) : null}
          <div className="space-y-3">
            <div>
              <span className="mb-1 block text-fluid-xs text-gray-600">집 주소 *</span>
              <AddressSearch
                value={address}
                mobilePreferred
                layerZClass="z-[820]"
                onChange={(next) => setAddress(next)}
                placeholder="주소 검색"
              />
            </div>
            <label className="block">
              <span className="mb-1 block text-fluid-xs text-gray-600">상세 주소 (선택)</span>
              <input
                value={detail}
                onChange={(e) => setDetail(e.target.value)}
                maxLength={256}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-fluid-sm"
                placeholder="동·호수"
              />
            </label>
          </div>
          {staffNativeApp ? <div className="mt-4 border-t border-gray-100 pt-4">{saveButton}</div> : null}
        </div>
        {!staffNativeApp ? (
          <div className="shrink-0 border-t border-gray-100 px-4 pt-3 sm:px-5">{saveButton}</div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
