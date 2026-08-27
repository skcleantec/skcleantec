import type { ReactNode } from 'react';
import { InternalCustomerToneRadio } from '../InternalCustomerToneRadio';
import { DEFAULT_INTERNAL_CUSTOMER_TONE } from '../../../constants/internalCustomerTone';
import { InquiryHelpZoomableFigure } from '../inquiry-help/InquiryHelpZoomableFigure';
import { ORDER_ISSUE_HELP_CAPTION } from './orderIssueHelpShared';

function PreviewShell({ enlarged, children }: { enlarged?: boolean; children: ReactNode }) {
  return (
    <div
      className={`pointer-events-none select-none space-y-3 ${enlarged ? 'text-fluid-xs' : 'text-[12px] sm:text-fluid-2xs'}`}
    >
      {children}
    </div>
  );
}

const fieldSelect =
  'w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-fluid-2xs text-gray-900 shadow-sm';

function MockIssueFormTop({ enlarged }: { enlarged?: boolean }) {
  const label = enlarged ? 'text-fluid-sm font-medium text-gray-700' : 'text-fluid-xs font-medium text-gray-700';
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 bg-gray-50 px-3 py-2.5 sm:px-4">
        <h4 className="text-fluid-sm font-semibold text-gray-900">발주서 발급</h4>
      </div>
      <div className="space-y-3 p-3 sm:p-4">
        <div>
          <label className={`mb-1 block ${label}`}>발주서 양식</label>
          <select className={fieldSelect} disabled aria-hidden tabIndex={-1}>
            <option>입주·이사 청소 (기본)</option>
          </select>
          <p className="mt-1 text-fluid-2xs text-gray-500">고객에게 보낼 발주서 양식을 선택합니다.</p>
        </div>
        <div>
          <label className={`mb-1 block ${label}`}>대기 접수 연결 (선택)</label>
          <select className={fieldSelect} disabled aria-hidden tabIndex={-1}>
            <option>이○○ · 010-****-1234</option>
          </select>
        </div>
        <div>
          <label className={`mb-1 block ${label}`}>영업 브랜드 *</label>
          <select className={fieldSelect} disabled aria-hidden tabIndex={-1}>
            <option>청소비서 (기본)</option>
          </select>
        </div>
        <div>
          <label className={`mb-1 block ${label}`}>유입 경로 *</label>
          <select className={fieldSelect} disabled aria-hidden tabIndex={-1}>
            <option>숨고</option>
          </select>
        </div>
        <InternalCustomerToneRadio
          value={DEFAULT_INTERNAL_CUSTOMER_TONE}
          onChange={() => {}}
          name="orderIssueHelpTone"
        />
        <p className="border-t border-gray-100 pt-3 text-fluid-2xs leading-relaxed text-gray-500">
          선택한 양식이 아래에 표시됩니다. 상담 내용을 미리 채우면 고객 화면에서 잠기고, 비운 항목은 고객이 작성합니다.
        </p>
        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50/80 px-3 py-6 text-center text-fluid-2xs text-gray-500">
          발주서 편집 · 발급 영역
        </div>
      </div>
    </div>
  );
}

function MockIssueCompleteCard({ enlarged }: { enlarged?: boolean }) {
  const pad = enlarged ? 'p-4 sm:p-5' : 'p-3 sm:p-4';
  const btn =
    'inline-flex items-center rounded-md px-3 py-1.5 text-fluid-2xs font-medium shadow-sm whitespace-nowrap';
  return (
    <div className={`rounded-xl border border-emerald-200/90 bg-emerald-50/50 space-y-2.5 ${pad}`}>
      <div>
        <p className="text-fluid-sm font-semibold text-gray-900">발급 완료</p>
        <p className="mt-0.5 text-fluid-xs text-gray-600 tabular-nums">이○○님 · 350,000원</p>
      </div>
      <div className="rounded-lg border border-gray-200 bg-white p-2.5 space-y-1.5">
        <p className="text-fluid-2xs font-medium text-gray-800">고객 발송 메시지</p>
        <pre className="max-h-20 overflow-hidden whitespace-pre-wrap break-words text-fluid-2xs leading-relaxed text-gray-800">
          {`안녕하세요. 아래 링크에서 발주서를 확인·작성해 주세요.\nhttps://www.cbiseo.com/order/…`}
        </pre>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <span className={`${btn} bg-gray-800 text-white`}>메시지 복사</span>
        <span className={`${btn} bg-gray-700 text-white`}>링크 복사</span>
        <span className={`${btn} border border-gray-300 bg-white text-gray-800`}>새 창</span>
        <span className={`${btn} bg-emerald-600 text-white`}>미리 작성</span>
        <span className={`${btn} border border-sky-300 bg-sky-50 text-sky-900`}>새로 발급</span>
      </div>
    </div>
  );
}

export function OrderIssueHelpIssueScreenPreviewInner({ enlarged = false }: { enlarged?: boolean }) {
  return (
    <PreviewShell enlarged={enlarged}>
      <MockIssueFormTop enlarged={enlarged} />
      <MockIssueCompleteCard enlarged={enlarged} />
    </PreviewShell>
  );
}

export function OrderIssueHelpIssueScreenFigure({
  caption = ORDER_ISSUE_HELP_CAPTION,
}: {
  caption?: string;
}) {
  return (
    <InquiryHelpZoomableFigure
      caption={caption}
      contentClassName="p-0 bg-transparent border-0 shadow-none"
      zoomContent={<OrderIssueHelpIssueScreenPreviewInner enlarged />}
    >
      <OrderIssueHelpIssueScreenPreviewInner />
    </InquiryHelpZoomableFigure>
  );
}
