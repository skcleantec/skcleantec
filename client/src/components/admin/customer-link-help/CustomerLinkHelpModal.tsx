import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { ORDER_FORM_LINK_PLACEHOLDERS } from '@shared/orderFormCustomerLinkPlaceholders';
import { useModalScrollKeyboardAvoidance } from '../../../hooks/useMobileInputVisibility';
import { ModalCloseButton } from '../ModalCloseButton';
import { CustomerLinkHelpEditorFigure } from './CustomerLinkHelpPreview';
import { CUSTOMER_LINK_EDIT_ACTIONS, type CustomerLinkHelpActionRow } from './customerLinkHelpActions';
import {
  CUSTOMER_LINK_COMPOSITE_WARNING,
  CUSTOMER_LINK_HELP_PAGE_OVERVIEW,
  CUSTOMER_LINK_HELP_TABS,
  CUSTOMER_LINK_PLACEHOLDER_INTRO,
  type CustomerLinkHelpTabId,
} from './customerLinkHelpShared';
import { CustomerLinkHelpTokenChip } from './CustomerLinkHelpUiParts';

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

function HelpActionTable({ rows }: { rows: readonly CustomerLinkHelpActionRow[] }) {
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

function PlaceholderTable() {
  const atomic = ORDER_FORM_LINK_PLACEHOLDERS.filter((p) => !p.composite);
  const composite = ORDER_FORM_LINK_PLACEHOLDERS.filter((p) => p.composite);

  return (
    <div className="space-y-4">
      <p className="text-fluid-2xs sm:text-fluid-xs text-slate-600 leading-relaxed">
        {CUSTOMER_LINK_PLACEHOLDER_INTRO}
      </p>

      <div className="overflow-x-auto -mx-1 px-1">
        <p className="mb-2 text-fluid-2xs font-semibold text-slate-800">값만 치환 (권장)</p>
        <table className="w-full min-w-[20rem] border-collapse text-fluid-2xs sm:text-fluid-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-600">
              <th className="py-1.5 px-2 text-left font-medium">치환코드</th>
              <th className="py-1.5 px-2 text-left font-medium">의미</th>
              <th className="py-1.5 px-2 text-left font-medium">채워지는 값</th>
            </tr>
          </thead>
          <tbody>
            {atomic.map((p) => (
              <tr key={p.id} className="border-b border-slate-100 align-top">
                <td className="py-2 px-2 whitespace-nowrap">
                  <CustomerLinkHelpTokenChip token={p.token} />
                </td>
                <td className="py-2 px-2 text-slate-800 font-medium">{p.label}</td>
                <td className="py-2 px-2 text-slate-600 leading-snug">{p.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="overflow-x-auto -mx-1 px-1">
        <p className="mb-2 text-fluid-2xs font-semibold text-amber-900">통째 치환 (라벨 수정 어려움)</p>
        <p className="mb-2 text-fluid-2xs text-amber-950/90 leading-snug">{CUSTOMER_LINK_COMPOSITE_WARNING}</p>
        <table className="w-full min-w-[20rem] border-collapse text-fluid-2xs sm:text-fluid-xs">
          <thead>
            <tr className="border-b border-amber-200/80 bg-amber-50/60 text-slate-600">
              <th className="py-1.5 px-2 text-left font-medium">치환코드</th>
              <th className="py-1.5 px-2 text-left font-medium">의미</th>
              <th className="py-1.5 px-2 text-left font-medium">비고</th>
            </tr>
          </thead>
          <tbody>
            {composite.map((p) => (
              <tr key={p.id} className="border-b border-amber-100/80 align-top">
                <td className="py-2 px-2 whitespace-nowrap">
                  <CustomerLinkHelpTokenChip token={p.token} />
                </td>
                <td className="py-2 px-2 text-slate-800 font-medium">{p.label}</td>
                <td className="py-2 px-2 text-slate-600 leading-snug">{p.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-lg border border-sky-100 bg-sky-50/70 px-3 py-2.5 text-fluid-2xs text-sky-950 leading-snug space-y-1">
        <p className="font-medium">작성 예시</p>
        <p>
          ✅ <code className="text-fluid-2xs">{'실제청소일시: {{date}} ({{timeSlot}})'}</code> — 「실제청소일시」는
          글자, 날짜·시간대만 치환
        </p>
        <p>
          ✅ <code className="text-fluid-2xs">{'페이백 신청: {{paybackLink}}'}</code> — 앞 문구는 자유롭게 수정
        </p>
        <p>
          ⚠️ <code className="text-fluid-2xs">{'{{scheduleLine}}'}</code> — 「청소일시: …」줄 전체. 라벨을 바꾸려면{' '}
          <code className="text-fluid-2xs">{'{{date}}'}</code> 방식 사용
        </p>
      </div>
    </div>
  );
}

function EditTab() {
  return (
    <div className="space-y-3">
      <p className="text-fluid-2xs sm:text-fluid-xs text-slate-600 leading-relaxed">
        {CUSTOMER_LINK_HELP_PAGE_OVERVIEW}
      </p>
      <CustomerLinkHelpEditorFigure />
      <HelpSection title="수정 순서">
        <ol className="list-decimal space-y-1.5 pl-4 text-fluid-2xs sm:text-fluid-xs text-slate-600 leading-snug">
          <li>「영업 브랜드」로 편집할 브랜드를 고릅니다.</li>
          <li>「메시지 본문」에서 문장·라벨을 수정하고, 필요한 곳에 치환코드를 넣습니다.</li>
          <li>「샘플 미리보기」로 치환 결과를 확인합니다.</li>
          <li>「저장」 — 이후 발급·「메시지 복사」부터 적용됩니다.</li>
        </ol>
      </HelpSection>
      <HelpSection title="화면 · 버튼">
        <HelpActionTable rows={CUSTOMER_LINK_EDIT_ACTIONS} />
        <p className="text-fluid-2xs text-slate-500 leading-snug">
          발주서 고객 화면 문구는{' '}
          <Link
            to="/admin/inquiries/order-customer-preview"
            className="text-blue-700 underline underline-offset-2 hover:text-blue-900"
          >
            발주서설정
          </Link>
          과 역할이 다릅니다. 여기는 카카오톡·문자에 붙여 넣는 안내만 다룹니다.
        </p>
      </HelpSection>
    </div>
  );
}

function PlaceholdersTab() {
  return (
    <div className="space-y-3">
      <HelpSection title="치환코드 목록">
        <PlaceholderTable />
      </HelpSection>
    </div>
  );
}

function CautionTab() {
  return (
    <div className="space-y-3">
      <HelpSection title="저장·반영">
        <ul className="list-disc space-y-1.5 pl-4 text-fluid-2xs sm:text-fluid-xs text-slate-600 leading-snug">
          <li>저장 후 새로 발급하거나 「메시지 복사」하는 건부터 반영됩니다. 이미 고객에게 보낸 문자는 바뀌지 않습니다.</li>
          <li>브랜드별로 따로 저장됩니다. 다른 브랜드로 발급하면 그 브랜드 설정이 쓰입니다.</li>
          <li>본문이 비어 있으면 저장할 수 없습니다.</li>
        </ul>
      </HelpSection>
      <HelpSection title="치환·빈 값">
        <ul className="list-disc space-y-1.5 pl-4 text-fluid-2xs sm:text-fluid-xs text-slate-600 leading-snug">
          <li>
            일정·희망 시각이 없으면 「청소일시:」「희망 시각:」처럼 값만 비어 라벨만 남은 줄은 복사본에서
            자동으로 빠집니다.
          </li>
          <li>
            <code className="text-fluid-2xs">{'{{optionNote}}'}</code> — 옵션·특이 메모가 없으면 빈 줄로 처리됩니다.
          </li>
          <li>
            페이백 링크가 없는 발급 건은 ★ 페이백 안내 단락 전체가 빠질 수 있습니다. 페이백 문구는 꼭 필요할
            때만 넣으세요.
          </li>
          <li>
            <code className="text-fluid-2xs">{'{{brandName}}'}</code> 이 비어 있으면 제목 줄이 「발주서설정」의
            양식 제목으로 대체될 수 있습니다.
          </li>
        </ul>
      </HelpSection>
      <HelpSection title="자주 하는 실수">
        <ul className="list-disc space-y-1.5 pl-4 text-fluid-2xs sm:text-fluid-xs text-slate-600 leading-snug">
          <li>
            <code className="text-fluid-2xs">{'{{scheduleLine}}'}</code> 를 쓰고 「청소일시」를 「실제청소일시」로
            바꾸려 함 → <code className="text-fluid-2xs">{'{{date}}'}</code>·
            <code className="text-fluid-2xs">{'{{timeSlot}}'}</code> 와 글자 조합 사용
          </li>
          <li>링크 URL을 직접 붙여 넣음 → 발급마다 바뀌므로 반드시{' '}
            <code className="text-fluid-2xs">{'{{orderLink}}'}</code>·
            <code className="text-fluid-2xs">{'{{paybackLink}}'}</code> 사용
          </li>
          <li>치환코드 철자 오타 — <code className="text-fluid-2xs">{'{{ date }}'}</code> 처럼 공백 넣으면
            치환되지 않습니다. 「넣기」 버튼 사용 권장
          </li>
          <li>「기본 양식으로 다시 채우기」는 저장 전 편집 중인 내용을 지웁니다. 확인 창을 꼭 읽으세요.</li>
        </ul>
      </HelpSection>
      <div className="rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2.5 text-fluid-2xs text-amber-950 leading-snug">
        SMTP·발주서 양식·제출 완료 문구는 다른 메뉴에서 설정합니다. 고객링크설정은 복사용 안내 문자만
        담당합니다.
      </div>
    </div>
  );
}

function TabPanel({ tab }: { tab: CustomerLinkHelpTabId }) {
  switch (tab) {
    case 'edit':
      return <EditTab />;
    case 'placeholders':
      return <PlaceholdersTab />;
    case 'caution':
      return <CautionTab />;
    default:
      return null;
  }
}

export function CustomerLinkHelpModal({ open, onClose }: Props) {
  const [tab, setTab] = useState<CustomerLinkHelpTabId>('edit');
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
    if (open) setTab('edit');
  }, [open]);

  if (!open) return null;
  const root = typeof document !== 'undefined' ? document.body : null;
  if (!root) return null;

  return createPortal(
    <div
      className="modal-mobile-safe-overlay fixed inset-0 z-[620] flex items-end sm:items-center justify-center bg-black/45 p-0 sm:p-4"
      role="dialog"
      aria-modal
      aria-labelledby="customer-link-help-modal-title"
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
          <h2 id="customer-link-help-modal-title" className="text-fluid-base sm:text-lg font-semibold text-slate-900">
            고객링크설정 도움말
          </h2>
          <p className="mt-1 text-fluid-2xs sm:text-fluid-xs text-slate-500">
            편집 방법 · 치환코드 · 주의할 점
          </p>
          <div
            className="mt-3 inline-flex max-w-full flex-nowrap gap-0.5 overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 p-0.5"
            role="tablist"
            aria-label="고객링크설정 도움말 섹션"
          >
            {CUSTOMER_LINK_HELP_TABS.map((t) => {
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
