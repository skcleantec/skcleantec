import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useModalScrollKeyboardAvoidance } from '../../../hooks/useMobileInputVisibility';
import { ModalCloseButton } from '../ModalCloseButton';
import { InquiryHelpDetailSectionFigure } from '../inquiry-help/InquiryHelpDetailSectionPreview';
import { DbMarketplaceHelpPageFigure } from './DbMarketplaceHelpPreview';
import {
  DbMarketplaceHelpScheduleFigure,
  DbMarketplaceHelpScheduleIconNote,
} from './DbMarketplaceHelpSchedulePreview';
import {
  DB_MARKETPLACE_HELP_INQUIRY_DETAIL_CAPTION,
  DB_MARKETPLACE_CAUTION_ITEMS,
  DB_MARKETPLACE_HELP_PAGE_OVERVIEW,
  DB_MARKETPLACE_HELP_TABS,
  DB_MARKETPLACE_LEGAL_NOTICE,
  DB_MARKETPLACE_RECEIVE_TABS,
  DB_MARKETPLACE_SHARE_TABS,
  DB_MARKETPLACE_STATUS_ROWS,
  type DbMarketplaceHelpTabId,
} from './dbMarketplaceHelpShared';
import {
  DB_MARKETPLACE_INQUIRY_DETAIL_ACTIONS,
  DB_MARKETPLACE_RECEIVE_ACTIONS,
  DB_MARKETPLACE_SHARE_ACTIONS,
  type DbMarketplaceHelpActionRow,
} from './dbMarketplaceHelpActions';

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

function HelpActionTable({ rows }: { rows: readonly DbMarketplaceHelpActionRow[] }) {
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

function FlowSteps({ steps }: { steps: readonly string[] }) {
  return (
    <ol className="list-decimal space-y-1.5 pl-4 text-fluid-2xs sm:text-fluid-xs text-slate-600 leading-snug">
      {steps.map((step, i) => (
        <li key={i}>{step}</li>
      ))}
    </ol>
  );
}

function ReceiveTab() {
  return (
    <div className="space-y-3">
      <p className="text-fluid-2xs sm:text-fluid-xs text-slate-600 leading-relaxed">{DB_MARKETPLACE_HELP_PAGE_OVERVIEW}</p>
      <DbMarketplaceHelpPageFigure side="receive" />
      <HelpSection title="정보 받기 — 진행 순서">
        <FlowSteps
          steps={[
            '상단 「받기」를 선택합니다.',
            '「목록」 탭에서 공유된 접수를 확인합니다. (지역·일정·표시 금액만 보임)',
            '인수할 접수를 체크하거나 행을 눌러 상세를 엽니다.',
            '「인수 신청」을 누르면 「진행」 탭으로 이동합니다.',
            '공유 업체가 「인계 확정」하면 「완료」 탭에서 연락처·상세 정보를 볼 수 있습니다.',
          ]}
        />
      </HelpSection>
      <HelpSection title="받기 탭 안내">
        <div className="space-y-2">
          {DB_MARKETPLACE_RECEIVE_TABS.map((t) => (
            <div key={t.id} className="flex gap-2 text-fluid-2xs sm:text-fluid-xs">
              <span className="shrink-0 rounded-md border border-gray-200 bg-slate-50 px-2 py-0.5 font-medium text-slate-800">
                {t.shortLabel}
              </span>
              <span className="text-slate-600 leading-snug">{t.longLabel} — {t.id === 'browse' ? '인수 신청 전' : t.id === 'pending' ? '인계 확정 대기' : '인수 완료 후 상세 열람'}</span>
            </div>
          ))}
        </div>
      </HelpSection>
      <HelpSection title="버튼 · 화면">
        <HelpActionTable rows={DB_MARKETPLACE_RECEIVE_ACTIONS} />
      </HelpSection>
      <div className="rounded-lg border border-sky-200 bg-sky-50/80 px-3 py-2.5 text-fluid-2xs text-sky-950 leading-snug">
        팀장 화면에도 「정보공유」 메뉴가 있으며, 받기(인수) 흐름은 동일합니다. 공유·인계 확정은 관리자(마케터) 화면에서
        처리합니다.
      </div>
    </div>
  );
}

function ShareTab() {
  return (
    <div className="space-y-3">
      <HelpSection title="접수 상세에서 공유하기">
        <p className="text-fluid-2xs sm:text-fluid-xs text-slate-600 leading-relaxed">
          서비스접수 목록·스케줄에서 접수를 연 뒤, 스크롤하여 <strong className="font-semibold text-slate-800">「4. 정산 · 옵션」</strong>{' '}
          아래 <strong className="font-semibold text-violet-900">정보공유 — 공유 등록</strong> 블록을 사용합니다. 우측
          단계 점프(4번)로 바로 이동할 수도 있습니다.
        </p>
        <FlowSteps
          steps={[
            '접수 상세를 엽니다. (서비스접수 목록 행 클릭 · 스케줄 일정 카드 클릭)',
            '「4. 정산 · 옵션」 → 정보공유 블록에서 정보공유 수수료(원)를 입력합니다.',
            '「공유 준비」 → 「노출 대상」에서 파트너·타업체·순위를 설정합니다.',
            '「정보공유 게시」로 상대 업체에 노출합니다. (또는 정보공유 메뉴 준비 탭에서 일괄 게시)',
            '인수 신청이 오면 「인계 확정」 또는 「인수 신청 거절」을 선택합니다.',
          ]}
        />
        <InquiryHelpDetailSectionFigure id="marketplace" caption={DB_MARKETPLACE_HELP_INQUIRY_DETAIL_CAPTION} />
        <HelpActionTable rows={DB_MARKETPLACE_INQUIRY_DETAIL_ACTIONS} />
      </HelpSection>

      <HelpSection title="스케줄에서 어떻게 보이나요">
        <p className="text-fluid-2xs sm:text-fluid-xs text-slate-600 leading-relaxed">
          공유 준비·공유 중·인계 대기·인계 완료 등록된 접수는 해당 청소일 스케줄 하단{' '}
          <strong className="font-semibold text-violet-900">「정보공유」</strong> 구역에 따로 모입니다. 팀장 미배정·자사
          TO(오전/오후 잔여) 집계에는 포함되지 않지만, 카드를 눌러 접수 수정·공유 상태 변경은 그대로 할 수 있습니다.
        </p>
        <DbMarketplaceHelpScheduleFigure />
        <DbMarketplaceHelpScheduleIconNote />
      </HelpSection>

      <DbMarketplaceHelpPageFigure side="share" />
      <HelpSection title="정보공유 메뉴 — 진행 순서">
        <FlowSteps
          steps={[
            '상단 「공유」를 선택합니다.',
            '「준비」 탭 — 접수 상세에서 공유 준비한 건 확인·일괄 게시',
            '「공유중」 — 노출 중인 접수 · 공유 준비로 되돌리기',
            '「대기」 — 인수 신청 처리(인계 확정 / 신청 거절)',
            '「완료」 — 인계가 끝난 접수',
          ]}
        />
      </HelpSection>
      <HelpSection title="공유 탭 안내">
        <div className="space-y-2">
          {DB_MARKETPLACE_SHARE_TABS.map((t) => (
            <div key={t.id} className="flex gap-2 text-fluid-2xs sm:text-fluid-xs">
              <span className="shrink-0 rounded-md border border-violet-200 bg-violet-50 px-2 py-0.5 font-medium text-violet-900">
                {t.shortLabel}
              </span>
              <span className="text-slate-600 leading-snug">{t.longLabel}</span>
            </div>
          ))}
        </div>
      </HelpSection>
      <HelpSection title="버튼 · 화면 (정보공유 메뉴)">
        <HelpActionTable rows={DB_MARKETPLACE_SHARE_ACTIONS} />
      </HelpSection>
      <div className="rounded-lg border border-violet-200 bg-violet-50/80 px-3 py-2.5 text-fluid-2xs text-violet-950 leading-snug">
        타업체 담당·파트너 직접 연계와 정보공유는 동시에 쓸 수 없습니다. 이미 배정·연계된 접수는 정보공유 블록이
        비활성화될 수 있습니다.
      </div>
    </div>
  );
}

function StatusTab() {
  return (
    <div className="space-y-3">
      <HelpSection title="상태 배지">
        <div className="overflow-x-auto -mx-1 px-1">
          <table className="w-full min-w-[16rem] border-collapse text-fluid-2xs sm:text-fluid-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-1.5 pr-3 text-left font-medium">표시</th>
                <th className="py-1.5 text-left font-medium">의미</th>
              </tr>
            </thead>
            <tbody>
              {DB_MARKETPLACE_STATUS_ROWS.map((row) => (
                <tr key={row.label} className="border-b border-slate-100 align-top">
                  <td className="py-2 pr-3 font-medium text-slate-800">{row.label}</td>
                  <td className="py-2 text-slate-600 leading-snug">{row.meaning}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </HelpSection>
      <HelpSection title="법적·운영 안내">
        <p className="text-fluid-2xs sm:text-fluid-xs text-slate-600 leading-relaxed">{DB_MARKETPLACE_LEGAL_NOTICE}</p>
      </HelpSection>
      <HelpSection title="주의할 점">
        <ul className="list-disc space-y-1.5 pl-4 text-fluid-2xs sm:text-fluid-xs text-slate-600 leading-snug">
          {DB_MARKETPLACE_CAUTION_ITEMS.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </HelpSection>
      <HelpSection title="자주 하는 실수">
        <ul className="list-disc space-y-1.5 pl-4 text-fluid-2xs sm:text-fluid-xs text-slate-600 leading-snug">
          <li>인수 신청 전에 연락처가 보이지 않는 것을 오류로 생각함 → 인계 확정 후에만 전체 정보가 열립니다.</li>
          <li>공유 준비만 하고 게시하지 않음 → 「공유중」 탭에 올라가야 상대 업체 목록에 보입니다.</li>
          <li>인계 확정 없이 연락처를 다른 경로로 전달 → 플랫폼·약관상 각 회원사 책임입니다.</li>
          <li>순위 노출 건에서 거절하지 않고 방치 → 다음 순위 업체로 넘어가지 않을 수 있습니다.</li>
        </ul>
      </HelpSection>
    </div>
  );
}

function TabPanel({ tab }: { tab: DbMarketplaceHelpTabId }) {
  switch (tab) {
    case 'receive':
      return <ReceiveTab />;
    case 'share':
      return <ShareTab />;
    case 'status':
      return <StatusTab />;
    default:
      return null;
  }
}

export function DbMarketplaceHelpModal({ open, onClose }: Props) {
  const [tab, setTab] = useState<DbMarketplaceHelpTabId>('receive');
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
    if (open) setTab('receive');
  }, [open]);

  if (!open) return null;
  const root = typeof document !== 'undefined' ? document.body : null;
  if (!root) return null;

  return createPortal(
    <div
      className="modal-mobile-safe-overlay fixed inset-0 z-[620] flex items-end sm:items-center justify-center bg-black/45 p-0 sm:p-4"
      role="dialog"
      aria-modal
      aria-labelledby="db-marketplace-help-modal-title"
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
          <h2 id="db-marketplace-help-modal-title" className="text-fluid-base sm:text-lg font-semibold text-slate-900">
            정보공유 도움말
          </h2>
          <p className="mt-1 text-fluid-2xs sm:text-fluid-xs text-slate-500">
            정보 받기 · 정보 공유하기 · 상태·주의
          </p>
          <div
            className="mt-3 inline-flex max-w-full flex-nowrap gap-0.5 overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 p-0.5"
            role="tablist"
            aria-label="정보공유 도움말 섹션"
          >
            {DB_MARKETPLACE_HELP_TABS.map((t) => {
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTab(t.id)}
                  className={`shrink-0 rounded-md px-2.5 py-1.5 text-fluid-2xs font-medium whitespace-nowrap sm:px-3 sm:text-fluid-xs ${
                    active ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-white'
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
          className="modal-form-scroll-surface min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 py-3 sm:px-5 sm:py-4"
          onFocusCapture={onFieldFocus}
        >
          <TabPanel tab={tab} />
        </div>
      </div>
    </div>,
    root,
  );
}
