import { createPortal } from 'react-dom';
import { ModalCloseButton } from '../admin/ModalCloseButton';
import type { OrderForm } from '../../api/orderform';
import { formatDateCompactWithWeekday } from '../../utils/dateFormat';
import { labelOrderFormIssuer } from '../../utils/orderFormCustomerCopy';

type ActionTone = 'default' | 'primary' | 'success' | 'violet' | 'warning' | 'danger';

type ActionItem = {
  key: string;
  label: string;
  description: string;
  tone: ActionTone;
  disabled?: boolean;
  onClick: () => void;
};

const toneClass: Record<ActionTone, string> = {
  default: 'border-slate-200/80 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50',
  primary: 'border-indigo-200/80 bg-indigo-50/40 text-indigo-800 hover:border-indigo-300 hover:bg-indigo-50/70',
  success: 'border-emerald-200/80 bg-emerald-50/40 text-emerald-800 hover:border-emerald-300 hover:bg-emerald-50/70',
  violet: 'border-violet-200/80 bg-violet-50/40 text-violet-800 hover:border-violet-300 hover:bg-violet-50/70',
  warning: 'border-amber-200/80 bg-amber-50/50 text-amber-900 hover:border-amber-300 hover:bg-amber-50/80',
  danger: 'border-red-200/80 bg-red-50/40 text-red-700 hover:border-red-300 hover:bg-red-50/70',
};

function ActionGrid({ items }: { items: ActionItem[] }) {
  if (items.length === 0) return null;
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          disabled={item.disabled}
          onClick={item.onClick}
          className={`flex min-h-[4.25rem] flex-col items-start rounded-xl border px-3.5 py-3 text-left shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${toneClass[item.tone]}`}
        >
          <span className="text-fluid-sm font-semibold leading-snug">{item.label}</span>
          <span className="mt-1 text-fluid-2xs leading-snug text-slate-500">{item.description}</span>
        </button>
      ))}
    </div>
  );
}

function ActionSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-fluid-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
      {children}
    </section>
  );
}

export function OrderFormListActionsModal(props: {
  order: OrderForm;
  resendBusy: boolean;
  onClose: () => void;
  onPreviewMessage: () => void;
  onPreviewLink: () => void;
  onOpenNewTab: () => void;
  onPrefill: () => void;
  onPhotos: () => void;
  onSubmissionViewer: () => void;
  onResendEmail: () => void;
  onDelete: () => void;
  canResendEmail: boolean;
}) {
  const {
    order,
    resendBusy,
    onClose,
    onPreviewMessage,
    onPreviewLink,
    onOpenNewTab,
    onPrefill,
    onPhotos,
    onSubmissionViewer,
    onResendEmail,
    onDelete,
    canResendEmail,
  } = props;

  const closeThen = (fn: () => void) => () => {
    onClose();
    fn();
  };

  const customerGuide: ActionItem[] = [
    {
      key: 'message',
      label: '고객 발송용 메시지',
      description: '카카오·문자에 붙여 넣을 안내 문구',
      tone: 'primary',
      onClick: closeThen(onPreviewMessage),
    },
    {
      key: 'link',
      label: '발주서 링크',
      description: '고객용 URL 미리보기·복사',
      tone: 'default',
      onClick: closeThen(onPreviewLink),
    },
    {
      key: 'new-tab',
      label: '발주서 새 창',
      description: '고객 화면을 브라우저 새 탭에서 열기',
      tone: 'default',
      onClick: closeThen(onOpenNewTab),
    },
  ];

  const manage: ActionItem[] = [
    ...(!order.submittedAt
      ? [
          {
            key: 'prefill',
            label: '발주서 작성',
            description: '마케터가 고객 대신 미리 작성',
            tone: 'success' as const,
            onClick: closeThen(onPrefill),
          },
        ]
      : []),
    {
      key: 'photos',
      label: '사진 관리',
      description: '고객·현장 사진 업로드·확인',
      tone: 'success',
      onClick: closeThen(onPhotos),
    },
    ...(order.submittedAt
      ? [
          {
            key: 'submission',
            label: '제출 원본',
            description: '고객이 제출한 내용 전체 보기',
            tone: 'violet' as const,
            onClick: closeThen(onSubmissionViewer),
          },
        ]
      : []),
  ];

  const email: ActionItem[] = canResendEmail
    ? [
        {
          key: 'resend',
          label: resendBusy ? '메일 발송 중…' : '확인 메일 강제 재발송',
          description: '발송 완료 건도 고객 이메일로 다시 보냅니다',
          tone: 'warning',
          disabled: resendBusy,
          onClick: () => {
            onResendEmail();
          },
        },
      ]
    : [];

  const danger: ActionItem[] = [
    {
      key: 'delete',
      label: '발주서 삭제',
      description: '비밀번호 확인 후 영구 삭제',
      tone: 'danger',
      onClick: closeThen(onDelete),
    },
  ];

  const statusLabel = order.submittedAt ? '제출완료' : '미제출';
  const issuer = labelOrderFormIssuer(order.createdBy ?? undefined);

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="order-form-actions-title"
        onClick={(e) => e.stopPropagation()}
      >
        <ModalCloseButton onClick={onClose} />
        <div className="shrink-0 border-b border-slate-200/80 px-4 pb-4 pt-5 pr-14">
          <p className="text-fluid-xs font-medium uppercase tracking-wide text-slate-500">발주서 관리</p>
          <h2 id="order-form-actions-title" className="mt-1 text-lg font-semibold text-slate-900">
            {order.customerName}
          </h2>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-fluid-xs text-slate-600">
            <span className="tabular-nums font-semibold text-slate-900">
              {order.totalAmount.toLocaleString('ko-KR')}원
            </span>
            <span
              className={`rounded-md px-2 py-0.5 font-semibold ${
                order.submittedAt
                  ? 'bg-green-50 text-green-700 ring-1 ring-green-200/50'
                  : 'bg-slate-100 text-slate-600 ring-1 ring-slate-200/60'
              }`}
            >
              {statusLabel}
            </span>
            <span className="text-slate-500">
              발급 {formatDateCompactWithWeekday(order.createdAt)} · {issuer}
            </span>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4">
          <ActionSection title="고객 안내">
            <ActionGrid items={customerGuide} />
          </ActionSection>
          <ActionSection title="발주서 작업">
            <ActionGrid items={manage} />
          </ActionSection>
          {email.length > 0 ? (
            <ActionSection title="확인 메일">
              <ActionGrid items={email} />
            </ActionSection>
          ) : null}
          <ActionSection title="위험 작업">
            <ActionGrid items={danger} />
          </ActionSection>
        </div>

        <div className="shrink-0 border-t border-slate-200/80 px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 text-fluid-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            닫기
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
