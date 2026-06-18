import { createPortal } from 'react-dom';

type Props = {
  message: string | null;
  onClose: () => void;
};

export function CompanyProfileSuccessModal({ message, onClose }: Props) {
  if (!message) return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[500] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="company-profile-success-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <p
          id="company-profile-success-title"
          className="text-base font-semibold text-gray-900 whitespace-pre-wrap"
        >
          {message}
        </p>
        <button
          type="button"
          onClick={onClose}
          className="mt-5 min-h-[44px] w-full rounded-md bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800"
        >
          확인
        </button>
      </div>
    </div>,
    document.body,
  );
}
