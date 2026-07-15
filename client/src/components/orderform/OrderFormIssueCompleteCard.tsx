import { Link } from 'react-router-dom';
import { OrderFormLinkPlaceholderPicker } from './OrderFormLinkPlaceholderPicker';

type Props = {
  customerName: string;
  totalAmount: number;
  link: string;
  message: string;
  onCopyMessage: () => void | Promise<void>;
  onCopyLink: () => void | Promise<void>;
  onOpenNewTab?: () => void;
  onPrefill?: () => void;
  onNewIssue: () => void;
  showPrefill?: boolean;
  compact?: boolean;
};

export function OrderFormIssueCompleteCard({
  customerName,
  totalAmount,
  link,
  message,
  onCopyMessage,
  onCopyLink,
  onOpenNewTab,
  onPrefill,
  onNewIssue,
  showPrefill = true,
  compact = false,
}: Props) {
  return (
    <div
      className={`rounded-xl border border-emerald-200/90 bg-emerald-50/50 space-y-3 ${
        compact ? 'p-4' : 'p-5 sm:p-6'
      }`}
    >
      <div className="min-w-0">
        <p className="text-fluid-sm font-semibold text-gray-900">발급 완료</p>
        <p className="mt-1 text-fluid-sm text-gray-600 tabular-nums">
          {customerName.trim() ? `${customerName.trim()}님 · ` : ''}
          {totalAmount.toLocaleString('ko-KR')}원
        </p>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-3 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-fluid-xs font-medium text-gray-800">고객 발송 메시지</p>
          <OrderFormLinkPlaceholderPicker compact />
        </div>
        <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words text-fluid-xs leading-relaxed text-gray-800">
          {message}
        </pre>
        <p className="break-all text-fluid-2xs text-gray-500">{link}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void onCopyMessage()}
          className="rounded-md bg-gray-800 px-4 py-2 text-fluid-sm font-medium text-white shadow-sm hover:bg-gray-900"
        >
          메시지 복사
        </button>
        <button
          type="button"
          onClick={() => void onCopyLink()}
          className="rounded-md bg-gray-700 px-4 py-2 text-fluid-sm text-white shadow-sm hover:bg-gray-800"
        >
          링크 복사
        </button>
        {onOpenNewTab ? (
          <button
            type="button"
            onClick={onOpenNewTab}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-fluid-sm text-gray-800 shadow-sm hover:bg-gray-50"
          >
            새 창
          </button>
        ) : null}
        {showPrefill && onPrefill ? (
          <button
            type="button"
            onClick={onPrefill}
            className="rounded-md bg-emerald-600 px-4 py-2 text-fluid-sm font-medium text-white shadow-sm hover:bg-emerald-700"
          >
            미리 작성
          </button>
        ) : null}
        <button
          type="button"
          onClick={onNewIssue}
          className="rounded-md border border-sky-300 bg-sky-50 px-4 py-2 text-fluid-sm font-medium text-sky-900 shadow-sm hover:bg-sky-100"
        >
          새로 발급
        </button>
      </div>

      <p className="text-fluid-2xs text-gray-600">
        메시지 복사 후 카카오톡·문자로 보내세요. 문구는{' '}
        <Link
          to="/admin/inquiries/order-customer-link"
          className="text-blue-700 underline underline-offset-2 hover:text-blue-900"
        >
          고객링크설정
        </Link>
        에서 바꿀 수 있습니다.
      </p>
    </div>
  );
}
