import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useModalScrollKeyboardAvoidance } from '../../../hooks/useMobileInputVisibility';
import { ModalCloseButton } from '../ModalCloseButton';
import { AiDispatchHelpPreview } from './AiDispatchHelpPreview';
import { AI_DISPATCH_HELP_ACTIONS, type AiDispatchHelpActionRow } from './aiDispatchHelpActions';
import {
  AI_DISPATCH_HELP_CAUTION,
  AI_DISPATCH_HELP_FLOW,
  AI_DISPATCH_HELP_OVERVIEW,
  AI_DISPATCH_HELP_TABS,
  type AiDispatchHelpTabId,
} from './aiDispatchHelpShared';

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

function HelpActionTable({ rows }: { rows: readonly AiDispatchHelpActionRow[] }) {
  return (
    <div className="overflow-x-auto -mx-1 px-1">
      <table className="w-full min-w-[18rem] border-collapse text-fluid-2xs sm:text-fluid-xs">
        <thead>
          <tr className="border-b border-slate-200 text-slate-500">
            <th className="w-[42%] py-1.5 pr-3 text-center font-medium">화면 · 버튼</th>
            <th className="py-1.5 text-center font-medium">설명</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.meaning} className="border-b border-slate-100 align-top">
              <td className="py-2 pr-3 text-center">
                <div className="flex flex-wrap items-center justify-center gap-1">{row.sample}</div>
                {row.when ? <p className="mt-1 text-fluid-2xs leading-snug text-violet-700">표시: {row.when}</p> : null}
              </td>
              <td className="py-2 text-center text-slate-600 leading-snug">{row.meaning}</td>
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
      <p className="text-fluid-2xs leading-relaxed text-slate-600 sm:text-fluid-xs">{AI_DISPATCH_HELP_OVERVIEW}</p>
      <AiDispatchHelpPreview />
      <HelpSection title="순서">
        <ol className="list-decimal space-y-1.5 pl-4 text-fluid-2xs leading-snug text-slate-600 sm:text-fluid-xs">
          {AI_DISPATCH_HELP_FLOW.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </HelpSection>
    </div>
  );
}

function ScreenTab() {
  return (
    <div className="space-y-3">
      <HelpSection title="버튼 · 화면">
        <HelpActionTable rows={AI_DISPATCH_HELP_ACTIONS} />
      </HelpSection>
      <HelpSection title="색">
        <ul className="space-y-1.5 text-fluid-2xs leading-snug text-slate-600 sm:text-fluid-xs">
          <li>오전은 호박색, 오후는 하늘색, 종일은 초록, 사람 판단은 보라 박스입니다.</li>
          <li>팀장 컨디션은 좋음 초록, 보통 노랑, 나쁨 빨강, 매우 나쁨은 더 진한 빨강입니다.</li>
          <li>팀장 목록을 열면 이 초안에 있는 팀장은 분홍, 아직 없는 팀장은 흰색입니다.</li>
        </ul>
      </HelpSection>
    </div>
  );
}

function CautionTab() {
  return (
    <HelpSection title="주의할 점">
      <ul className="list-disc space-y-1.5 pl-4 text-fluid-2xs leading-snug text-slate-600 sm:text-fluid-xs">
        {AI_DISPATCH_HELP_CAUTION.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </HelpSection>
  );
}

export function AiDispatchHelpModal({ open, onClose }: Props) {
  const [tab, setTab] = useState<AiDispatchHelpTabId>('flow');
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
      className="modal-mobile-safe-overlay fixed inset-0 z-[620] flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal
      aria-labelledby="ai-dispatch-help-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal-mobile-fullscreen-panel relative flex max-h-[min(92vh,44rem)] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-xl sm:max-h-[min(92vh,42rem)] sm:rounded-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <ModalCloseButton onClick={onClose} />
        <div className="shrink-0 border-b border-slate-200 px-4 pb-3 pr-14 pt-4 sm:px-5 sm:pt-5">
          <h2 id="ai-dispatch-help-title" className="text-fluid-base font-semibold text-slate-900 sm:text-lg">
            AI 미리 배정 도움말
          </h2>
          <p className="mt-1 text-fluid-2xs text-slate-500 sm:text-fluid-xs">사용 순서 · 화면 버튼 · 주의할 점</p>
          <div
            className="mt-3 inline-flex max-w-full flex-nowrap gap-0.5 overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 p-0.5"
            role="tablist"
            aria-label="AI 미리 배정 도움말 섹션"
          >
            {AI_DISPATCH_HELP_TABS.map((item) => {
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTab(item.id)}
                  className={`shrink-0 whitespace-nowrap rounded-md px-2.5 py-1.5 text-fluid-2xs font-medium hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 sm:px-3 sm:text-fluid-xs ${
                    active ? 'bg-slate-900 text-white shadow-sm hover:bg-slate-800' : 'text-slate-600'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
        <div
          ref={scrollRef}
          className="modal-form-scroll-surface min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 py-3 sm:px-5 sm:py-4"
          onFocusCapture={onFieldFocus}
        >
          {tab === 'flow' ? <FlowTab /> : null}
          {tab === 'screen' ? <ScreenTab /> : null}
          {tab === 'caution' ? <CautionTab /> : null}
        </div>
      </div>
    </div>,
    root,
  );
}
