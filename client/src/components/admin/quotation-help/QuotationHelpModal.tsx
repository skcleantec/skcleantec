import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { useModalScrollKeyboardAvoidance } from '../../../hooks/useMobileInputVisibility';
import { ModalCloseButton } from '../ModalCloseButton';
import { QuotationHelpEditorFigure } from './QuotationHelpPreview';
import { QuotationHelpSendFlowDiagram } from './QuotationHelpSendFlowDiagram';
import {
  QUOTATION_CREATE_ACTIONS,
  QUOTATION_LINK_ACTIONS,
  QUOTATION_RECEIPT_ACTIONS,
  QUOTATION_SEND_ACTIONS,
  type QuotationHelpActionRow,
} from './quotationHelpActions';
import {
  QUOTATION_HELP_PAGE_OVERVIEW,
  QUOTATION_HELP_TABS,
  type QuotationHelpTabId,
} from './quotationHelpShared';

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

function HelpActionTable({ rows }: { rows: readonly QuotationHelpActionRow[] }) {
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
                  <p className="mt-1 text-[11px] leading-snug text-violet-700">표시: {row.when}</p>
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

function CreateTab() {
  return (
    <div className="space-y-3">
      <p className="text-fluid-2xs sm:text-fluid-xs text-slate-600 leading-relaxed">{QUOTATION_HELP_PAGE_OVERVIEW}</p>
      <QuotationHelpEditorFigure />
      <HelpSection title="견적서 만드는 법">
        <HelpActionTable rows={QUOTATION_CREATE_ACTIONS} />
        <p className="text-fluid-2xs text-slate-500 leading-snug">
          품목·VAT·하단 안내 문구는{' '}
          <Link
            to="/admin/inquiries/quotations/settings"
            className="text-blue-700 underline underline-offset-2 hover:text-blue-900"
          >
            견적 설정
          </Link>
          에서 미리 등록해 둡니다.
        </p>
      </HelpSection>
    </div>
  );
}

function LinkTab() {
  return (
    <div className="space-y-3">
      <HelpSection title="고객 정보와 접수 연결">
        <HelpActionTable rows={QUOTATION_LINK_ACTIONS} />
      </HelpSection>
      <div className="rounded-lg border border-sky-100 bg-sky-50/70 px-3 py-2.5 text-fluid-2xs text-sky-950 leading-snug">
        접수와 연결하면 견적서 목록·접수 상세 양쪽에서 같은 건을 찾기 쉽습니다. 고객명·연락처·주소·메모가 자동으로
        채워집니다.
      </div>
    </div>
  );
}

function ReceiptTab() {
  return (
    <div className="space-y-3">
      <HelpSection title="영수증 만드는 법">
        <HelpActionTable rows={QUOTATION_RECEIPT_ACTIONS} />
      </HelpSection>
      <p className="text-fluid-2xs text-slate-500 leading-snug">
        같은 편집 화면에서 문서 유형만 「영수증」으로 바꾸면 됩니다. 별도 메뉴는 없습니다.
      </p>
    </div>
  );
}

function SendTab() {
  return (
    <div className="space-y-3">
      <HelpSection title="고객에게 발송되는 과정">
        <QuotationHelpSendFlowDiagram />
        <div className="pt-2">
          <HelpActionTable rows={QUOTATION_SEND_ACTIONS} />
        </div>
      </HelpSection>
      <div className="rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2.5 text-fluid-2xs text-amber-950 leading-snug">
        SMTP가 없으면 「PDF 첨부 발송」이 비활성화됩니다. 상단 안내 배너·
        <Link
          to="/admin/inquiries/quotations/settings"
          className="text-amber-900 underline underline-offset-2 hover:no-underline"
        >
          견적 설정
        </Link>
        · 업체등록정보에서 메일 설정을 확인하세요.
      </div>
    </div>
  );
}

function TabPanel({ tab }: { tab: QuotationHelpTabId }) {
  switch (tab) {
    case 'create':
      return <CreateTab />;
    case 'link':
      return <LinkTab />;
    case 'receipt':
      return <ReceiptTab />;
    case 'send':
      return <SendTab />;
    default:
      return null;
  }
}

export function QuotationHelpModal({ open, onClose }: Props) {
  const [tab, setTab] = useState<QuotationHelpTabId>('send');
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
    if (open) setTab('send');
  }, [open]);

  if (!open) return null;
  const root = typeof document !== 'undefined' ? document.body : null;
  if (!root) return null;

  return createPortal(
    <div
      className="modal-mobile-safe-overlay fixed inset-0 z-[620] flex items-end sm:items-center justify-center bg-black/45 p-0 sm:p-4"
      role="dialog"
      aria-modal
      aria-labelledby="quotation-help-modal-title"
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
          <h2 id="quotation-help-modal-title" className="text-fluid-base sm:text-lg font-semibold text-slate-900">
            견적서 도움말
          </h2>
          <p className="mt-1 text-fluid-2xs sm:text-fluid-xs text-slate-500">
            고객 발송 · 견적서 작성 · 고객 연결 · 영수증
          </p>
          <div
            className="mt-3 inline-flex max-w-full flex-nowrap gap-0.5 overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 p-0.5"
            role="tablist"
            aria-label="견적서 도움말 섹션"
          >
            {QUOTATION_HELP_TABS.map((t) => {
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
