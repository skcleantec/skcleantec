import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { useModalScrollKeyboardAvoidance } from '../../../hooks/useMobileInputVisibility';
import { ModalCloseButton } from '../ModalCloseButton';
import { OrderIssueHelpIssueScreenFigure } from './OrderIssueHelpPreview';
import { OrderIssueHelpWorkflowDiagram } from './OrderIssueHelpWorkflowDiagram';
import {
  ORDER_ISSUE_AFTER_ISSUE_ACTIONS,
  ORDER_ISSUE_COMPLETE_ACTIONS,
  ORDER_ISSUE_CUSTOMER_ACTIONS,
  ORDER_ISSUE_MARKETER_ACTIONS,
  ORDER_ISSUE_ON_SUBMIT_ACTIONS,
  ORDER_ISSUE_SCREEN_ACTIONS,
  type OrderIssueHelpActionRow,
} from './orderIssueHelpActions';
import { OrderIssueHelpPreviewLinkButton } from './OrderIssueHelpUiParts';
import {
  ORDER_ISSUE_HELP_TABS,
  ORDER_ISSUE_PAGE_OVERVIEW,
  type OrderIssueHelpTabId,
} from './orderIssueHelpShared';

type Props = {
  open: boolean;
  onClose: () => void;
};

function HelpSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2.5 rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
      <h3 className="text-fluid-sm font-semibold text-slate-900">{title}</h3>
      {children}
    </section>
  );
}

function HelpActionTable({ rows }: { rows: readonly OrderIssueHelpActionRow[] }) {
  return (
    <div className="overflow-x-auto -mx-1 px-1">
      <table className="w-full min-w-[18rem] border-collapse text-fluid-2xs sm:text-fluid-xs">
        <thead>
          <tr className="border-b border-slate-200 text-slate-500">
            <th className="w-[42%] py-1.5 pr-3 text-left font-medium">화면 · 버튼</th>
            <th className="py-1.5 text-left font-medium">설명</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-slate-100 align-top">
              <td className="py-2 pr-3">
                <div className="flex flex-wrap items-center gap-1">{row.sample}</div>
                {row.when ? (
                  <p className="mt-1 text-[10px] leading-snug text-violet-700">표시: {row.when}</p>
                ) : null}
              </td>
              <td className="py-2 text-slate-600 leading-snug">{row.meaning}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FlowTab() {
  return (
    <div className="space-y-3">
      <p className="text-fluid-2xs sm:text-fluid-xs text-slate-600 leading-relaxed">{ORDER_ISSUE_PAGE_OVERVIEW}</p>
      <HelpSection title="전체 진행 흐름도">
        <OrderIssueHelpWorkflowDiagram />
      </HelpSection>
      <HelpSection title="자주 헷갈리는 점">
        <HelpActionTable
          rows={[
            {
              sample: <OrderIssueHelpPreviewLinkButton>발주서</OrderIssueHelpPreviewLinkButton>,
              meaning: '고객에게 보내는 작성·확인 폼입니다.',
            },
            {
              sample: <OrderIssueHelpPreviewLinkButton>접수</OrderIssueHelpPreviewLinkButton>,
              meaning: '업무용 서비스접수 건입니다. 발급만으로는 「예약완료」가 아닙니다.',
            },
          ]}
        />
        <ul className="list-disc space-y-1.5 pl-4 text-fluid-2xs sm:text-fluid-xs text-slate-600 leading-snug">
          <li>발급 시 접수가 새로 생기거나(일반 발급) 기존 대기 건에 링크가 붙습니다(연결 발급)</li>
          <li>견적서·C/S·페이백은 별도 메뉴이며, 발주서 제출과 순서가 다를 수 있습니다</li>
        </ul>
      </HelpSection>
    </div>
  );
}

function MarketerTab() {
  return (
    <div className="space-y-3">
      <OrderIssueHelpIssueScreenFigure />
      <HelpSection title="발급 화면 · 버튼">
        <HelpActionTable rows={ORDER_ISSUE_SCREEN_ACTIONS} />
      </HelpSection>
      <HelpSection title="발급 완료 후 버튼">
        <HelpActionTable rows={ORDER_ISSUE_COMPLETE_ACTIONS} />
      </HelpSection>
      <HelpSection title="마케터가 꼭 해야 할 것">
        <HelpActionTable rows={ORDER_ISSUE_MARKETER_ACTIONS} />
        <p className="text-fluid-2xs text-slate-500 leading-snug">
          스케줄·접수 상세 「발주서」 버튼으로 들어오면 해당 접수와 자동 연결됩니다.{' '}
          <Link
            to="/admin/inquiries/order-forms"
            className="text-blue-700 underline underline-offset-2 hover:text-blue-900"
          >
            발주서 목록
          </Link>
          ·{' '}
          <Link
            to="/admin/inquiries"
            className="text-blue-700 underline underline-offset-2 hover:text-blue-900"
          >
            서비스접수 목록
          </Link>
          에서 미제출·예약완료를 확인하세요.
        </p>
      </HelpSection>
    </div>
  );
}

function CustomerTab() {
  return (
    <div className="space-y-3">
      <HelpSection title="고객이 해도 되는 것">
        <HelpActionTable rows={ORDER_ISSUE_CUSTOMER_ACTIONS} />
      </HelpSection>
      <HelpSection title="고객 화면 미리보기">
        <p className="text-fluid-2xs text-slate-600 leading-snug">
          아래 버튼과 같은 메뉴에서 실제 공개 발주서 모양을 확인할 수 있습니다.
        </p>
        <Link
          to="/admin/inquiries/order-customer-preview"
          className="inline-flex rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-fluid-2xs font-medium text-slate-800 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
        >
          고객화면 미리보기 열기 →
        </Link>
      </HelpSection>
    </div>
  );
}

function AfterIssueTab() {
  return (
    <div className="space-y-3">
      <HelpSection title="발급 이후 — 화면에서 이렇게 진행">
        <HelpActionTable rows={ORDER_ISSUE_AFTER_ISSUE_ACTIONS} />
      </HelpSection>
    </div>
  );
}

function OnSubmitTab() {
  return (
    <div className="space-y-3">
      <HelpSection title="고객 제출이 들어오면">
        <HelpActionTable rows={ORDER_ISSUE_ON_SUBMIT_ACTIONS} />
      </HelpSection>
      <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-2.5 text-fluid-2xs text-emerald-950 leading-snug">
        제출 직후 접수 상세에서 팀장 배정·일정 확인을 진행하세요. 아직 제출 전이면 「발주서 링크는 발급됐으나 고객
        미제출」 안내가 보이며 분배가 제한될 수 있습니다.
      </div>
    </div>
  );
}

function TabPanel({ tab }: { tab: OrderIssueHelpTabId }) {
  switch (tab) {
    case 'flow':
      return <FlowTab />;
    case 'marketer':
      return <MarketerTab />;
    case 'customer':
      return <CustomerTab />;
    case 'after-issue':
      return <AfterIssueTab />;
    case 'on-submit':
      return <OnSubmitTab />;
    default:
      return null;
  }
}

export function OrderIssueHelpModal({ open, onClose }: Props) {
  const [tab, setTab] = useState<OrderIssueHelpTabId>('flow');
  const scrollRef = useRef<HTMLDivElement>(null);
  const { onFieldFocus } = useModalScrollKeyboardAvoidance(scrollRef, open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (open) setTab('flow');
  }, [open]);

  if (!open) return null;
  const root = typeof document !== 'undefined' ? document.body : null;
  if (!root) return null;

  return createPortal(
    <div
      className="modal-mobile-safe-overlay fixed inset-0 z-[620] flex items-end sm:items-center justify-center bg-black/45 p-0 sm:p-4"
      role="dialog"
      aria-modal
      aria-labelledby="order-issue-help-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal-mobile-fullscreen-panel relative flex w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl sm:rounded-xl bg-white shadow-xl border border-slate-200 max-h-[min(92vh,44rem)] sm:max-h-[min(92vh,42rem)]"
        onClick={(e) => e.stopPropagation()}
      >
        <ModalCloseButton onClick={onClose} />
        <div className="shrink-0 border-b border-slate-200 px-4 pb-3 pt-4 pr-14 sm:px-5 sm:pt-5">
          <h2 id="order-issue-help-modal-title" className="text-fluid-base sm:text-lg font-semibold text-slate-900">
            발주서 발급 도움말
          </h2>
          <p className="mt-1 text-fluid-2xs sm:text-fluid-xs text-slate-500">
            전체 흐름 · 마케터 필수 · 고객 작성 · 발급 후 · 제출 시
          </p>
          <div
            className="mt-3 inline-flex max-w-full flex-nowrap gap-0.5 overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 p-0.5"
            role="tablist"
            aria-label="발주서 도움말 섹션"
          >
            {ORDER_ISSUE_HELP_TABS.map((t) => {
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTab(t.id)}
                  className={`shrink-0 rounded-md px-2 py-1.5 text-fluid-2xs sm:text-fluid-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 ${
                    active ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-white hover:text-slate-900'
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
        <div
          ref={scrollRef}
          className="modal-form-scroll-surface min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 py-4 sm:px-5"
          onFocusCapture={onFieldFocus}
        >
          <TabPanel tab={tab} />
        </div>
      </div>
    </div>,
    root,
  );
}
