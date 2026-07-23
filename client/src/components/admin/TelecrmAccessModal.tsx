import { createPortal } from 'react-dom';
import type { TelecrmAccessDenyReason } from '@shared/telecrmTenantPolicy';

type Props = {
  open: boolean;
  reason: TelecrmAccessDenyReason;
  onClose: () => void;
};

const COPY: Record<
  TelecrmAccessDenyReason,
  { title: string; body: string }
> = {
  not_licensed: {
    title: 'CRM 별도 신청 안내',
    body: 'CRM은 Premium 플랜에 포함되지 않으며, 별도 신청·추가 사용료가 필요합니다. 플랫폼 담당자에게 CRM 가입(신청)을 요청해 주세요.',
  },
  not_allowed: {
    title: 'CRM 사용 권한 없음',
    body: '이 계정은 CRM 사용 허용 목록에 포함되어 있지 않습니다. 업체 관리자 또는 플랫폼 담당자에게 문의해 주세요.',
  },
};

export function TelecrmAccessModal({ open, reason, onClose }: Props) {
  if (!open) return null;

  const { title, body } = COPY[reason];

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="telecrm-access-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="telecrm-access-modal-title" className="text-fluid-sm font-semibold text-slate-900">
          {title}
        </h2>
        <p className="mt-2 text-fluid-xs leading-relaxed text-slate-600">{body}</p>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="min-h-10 rounded-lg bg-slate-900 px-4 text-fluid-xs font-semibold text-white hover:bg-slate-800"
          >
            확인
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
