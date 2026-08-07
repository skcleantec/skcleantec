import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { InquiryStatusChipPreview } from '../../inquiries/inquiriesUiParts';

function previewProps(disabled = true) {
  return {
    disabled,
    tabIndex: -1,
    'aria-hidden': true as const,
  };
}

function HelpUiShell({ block, children }: { block?: boolean; children: ReactNode }) {
  return (
    <span
      className={
        block
          ? 'my-1 flex flex-wrap items-center gap-1.5 pointer-events-none select-none'
          : 'inline-flex align-middle pointer-events-none select-none vertical-align-middle'
      }
      aria-hidden
    >
      {children}
    </span>
  );
}

/** 발급 화면 — 필드 라벨 */
export function OrderIssueHelpFieldLabel({ children }: { children: ReactNode }) {
  return (
    <HelpUiShell>
      <span className="text-fluid-xs font-medium text-gray-700 sm:text-fluid-sm">{children}</span>
    </HelpUiShell>
  );
}

/** 발주서 편집 하단 — 발급 및 링크 생성 */
export function OrderIssueHelpCreateButton(props: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>) {
  return (
    <HelpUiShell block>
      <button
        type="button"
        className="min-w-[9rem] rounded bg-gray-800 px-3 py-2 text-fluid-2xs font-medium text-white shadow-sm sm:text-fluid-xs"
        {...previewProps()}
        {...props}
      >
        발급 및 링크 생성
      </button>
    </HelpUiShell>
  );
}

/** 고객 공개 폼 — 제출하기 */
export function OrderIssueHelpCustomerSubmitButton(props: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>) {
  return (
    <HelpUiShell block>
      <button
        type="button"
        className="min-w-[7rem] rounded bg-gray-800 px-3 py-2 text-fluid-2xs font-medium text-white shadow-sm sm:text-fluid-xs"
        {...previewProps()}
        {...props}
      >
        제출하기
      </button>
    </HelpUiShell>
  );
}

const completeBtn =
  'inline-flex items-center rounded-md px-3 py-1.5 text-fluid-2xs font-medium shadow-sm sm:text-fluid-xs';

export function OrderIssueHelpCopyMessageButton(props: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>) {
  return (
    <HelpUiShell>
      <button type="button" className={`${completeBtn} bg-gray-800 text-white`} {...previewProps()} {...props}>
        메시지 복사
      </button>
    </HelpUiShell>
  );
}

export function OrderIssueHelpCopyLinkButton(props: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>) {
  return (
    <HelpUiShell>
      <button type="button" className={`${completeBtn} bg-gray-700 text-white`} {...previewProps()} {...props}>
        링크 복사
      </button>
    </HelpUiShell>
  );
}

export function OrderIssueHelpPrefillButton(props: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>) {
  return (
    <HelpUiShell>
      <button type="button" className={`${completeBtn} bg-emerald-600 text-white`} {...previewProps()} {...props}>
        미리 작성
      </button>
    </HelpUiShell>
  );
}

export function OrderIssueHelpNewIssueButton(props: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>) {
  return (
    <HelpUiShell>
      <button
        type="button"
        className={`${completeBtn} border border-sky-300 bg-sky-50 text-sky-900`}
        {...previewProps()}
        {...props}
      >
        새로 발급
      </button>
    </HelpUiShell>
  );
}

/** 발주서 목록 — 상태 필터 칩 */
export function OrderIssueHelpListFilterChip({
  label,
  active = false,
}: {
  label: string;
  active?: boolean;
}) {
  return (
    <HelpUiShell>
      <span
        className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium sm:text-fluid-2xs ${
          active ? 'border-gray-800 bg-gray-900 text-white' : 'border-gray-200 bg-white text-gray-700'
        }`}
      >
        {label}
      </span>
    </HelpUiShell>
  );
}

/** 발주서 목록 · 표 — 미제출 / 제출완료 */
export function OrderIssueHelpFormListStatusBadge({ submitted }: { submitted: boolean }) {
  return (
    <HelpUiShell>
      <span
        className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium sm:text-fluid-2xs ${
          submitted ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200' : 'bg-amber-50 text-amber-900 ring-1 ring-amber-200'
        }`}
      >
        {submitted ? '제출완료' : '미제출'}
      </span>
    </HelpUiShell>
  );
}

/** 서비스접수 목록 — 상태 칩 */
export function OrderIssueHelpInquiryStatusChip({
  status,
}: {
  status: 'ORDER_FORM_PENDING' | 'RECEIVED' | 'ASSIGNED';
}) {
  return (
    <HelpUiShell>
      <InquiryStatusChipPreview status={status} />
    </HelpUiShell>
  );
}

/** 발주서 목록 — 관리 · 확인 메일 재발송 */
export function OrderIssueHelpEmailResendButton(props: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>) {
  return (
    <HelpUiShell>
      <button
        type="button"
        className="inline-flex rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-medium text-slate-800 shadow-sm sm:text-fluid-2xs"
        {...previewProps()}
        {...props}
      >
        확인 메일 강제 재발송
      </button>
    </HelpUiShell>
  );
}

/** 사이드 메뉴 — 발주서 발급 / 발주서 목록 */
export function OrderIssueHelpSideNavItem({
  label,
  active = false,
}: {
  label: string;
  active?: boolean;
}) {
  return (
    <HelpUiShell block>
      <span
        className={`inline-flex w-full max-w-[10rem] rounded-lg px-2.5 py-1.5 text-fluid-2xs font-medium sm:text-fluid-xs ${
          active ? 'bg-blue-600 text-white' : 'text-slate-700'
        }`}
      >
        {label}
      </span>
    </HelpUiShell>
  );
}

/** 고객화면 미리보기 링크 버튼 스타일 */
export function OrderIssueHelpPreviewLinkButton({ children }: { children: ReactNode }) {
  return (
    <HelpUiShell>
      <span className="inline-flex rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-fluid-2xs font-medium text-slate-800 sm:text-fluid-xs">
        {children}
      </span>
    </HelpUiShell>
  );
}
