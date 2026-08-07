import type { ReactNode } from 'react';
import { CustomerNameWithInternalTone } from '../CustomerNameWithInternalTone';
import { InquiryDbMarketplaceBadge } from '../InquiryDbMarketplaceBadge';
import { OperatingCompanyBadge } from '../OperatingCompanyBadge';
import { TenantInquiryShareBadge } from '../TenantInquiryShareBadge';
import {
  ProfOptionsAmountReviewBadge,
  ProfOptionsAmountReviewCompletedBadge,
} from '../../inquiry/ProfOptionsAmountReviewNotice';
import { InspectionProgressBadge } from '../../inquiry-inspection/InspectionProgressBadge';
import {
  InquiryMobileCallButton,
  InquiryOrderPendingHint,
  InquiryStatusChipPreview,
} from '../../inquiries/inquiriesUiParts';
import {
  INQUIRY_HELP_DEMO,
  INQUIRY_HELP_DEMO_DB_LISTING,
  INQUIRY_HELP_DEMO_INSPECTION,
  INQUIRY_HELP_DEMO_SHARE_SOURCE,
} from './inquiryHelpDemoData';
import { INQUIRY_HELP_LIST_FULL_CALLOUTS } from './inquiryHelpScreenshots';
import { InquiryHelpZoomableFigure } from './InquiryHelpZoomableFigure';

function Ox({ yes }: { yes: boolean; label?: string }) {
  return (
    <span
      className={`inline-flex min-w-[1.125rem] items-center justify-center rounded px-0.5 py-px text-[10px] font-bold tabular-nums ${
        yes ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-400'
      }`}
    >
      {yes ? 'O' : 'X'}
    </span>
  );
}

const ACTION_BTN =
  'inline-flex shrink-0 items-center rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold leading-tight shadow-sm';

function QuickEditCell({ children, label }: { children: ReactNode; label: string }) {
  return (
    <span
      className="inline-block w-full rounded px-0.5 py-0.5 ring-1 ring-transparent hover:ring-blue-200 hover:bg-blue-50/90"
      title={`${label} — 클릭하여 수정`}
    >
      {children}
    </span>
  );
}

/** PC 표 + 모바일 카드 — 도움말용 전체 아이콘·배지 예시 (데모 데이터) */
export function InquiryHelpListFullPreviewInner({ enlarged = false }: { enlarged?: boolean }) {
  const textScale = enlarged ? 'text-fluid-xs' : 'text-[10px]';
  return (
    <div className={`pointer-events-none select-none space-y-2 ${enlarged ? 'p-1' : ''}`}>
      <div className={`flex flex-wrap items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 ${textScale} text-slate-600`}>
        <span className="font-medium text-slate-700">날짜 기준</span>
        <span className="rounded border border-slate-200 bg-white px-1.5 py-0.5">접수일</span>
        <span className="inline-flex overflow-hidden rounded-md border border-slate-200">
          <span className="bg-slate-900 px-2 py-0.5 text-white">당일</span>
          <span className="bg-white px-2 py-0.5">전체</span>
          <span className="border-l border-slate-200 bg-white px-2 py-0.5">월별</span>
        </span>
        <span className="ml-auto text-slate-500">목록 상단 고정 · 미제출·입금·대기</span>
      </div>

      <div className="hidden lg:block overflow-x-auto rounded-lg border border-slate-200">
        <table className={`w-full min-w-[52rem] border-collapse ${textScale}`}>
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
              {['접수일', '접수자', '서비스', '유입', '고객', '연락처', '주소', '평수', '예약일', '시간·거리', '상태', '특이', '사진', '검수', '팀장', '작업'].map(
                (h) => (
                  <th key={h} className="px-1 py-1 text-center font-medium">
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-rose-100 bg-rose-50/80">
              <td className="sticky left-0 z-[1] bg-rose-50/90 px-1 py-1 align-top text-center">
                <div className="tabular-nums text-slate-700">08-07 (목)</div>
                <div className="mt-0.5 font-mono tabular-nums text-slate-500">{INQUIRY_HELP_DEMO.inquiryNumber}</div>
                <div className="mt-0.5">
                  <OperatingCompanyBadge company={INQUIRY_HELP_DEMO.operatingCompany} />
                </div>
                <div className="mt-0.5">
                  <InquiryDbMarketplaceBadge dbListing={INQUIRY_HELP_DEMO_DB_LISTING} iconOnly />
                </div>
              </td>
              <td className="px-1 py-1 text-center text-slate-600">{INQUIRY_HELP_DEMO.marketer}</td>
              <td className="px-1 py-1 text-center font-medium text-slate-600">입주</td>
              <td className="px-1 py-1 text-center text-violet-800">cbiseo</td>
              <td className="px-1 py-1 text-center">
                <CustomerNameWithInternalTone name={INQUIRY_HELP_DEMO.customerName} tone="GOOD" viewerRole="ADMIN" />
                <span className="ml-0.5 text-orange-600">●</span>
              </td>
              <td className="px-1 py-1 text-center tabular-nums">{INQUIRY_HELP_DEMO.phone}</td>
              <td className="px-1 py-1 text-center">{INQUIRY_HELP_DEMO.addressShort}</td>
              <td className="px-1 py-1 text-center tabular-nums">33평</td>
              <td className="px-1 py-1 text-center tabular-nums">08-12 (화)</td>
              <td className="px-1 py-1 text-center">
                오전
                <div className="text-slate-500 tabular-nums">12km</div>
              </td>
              <td className="px-1 py-1 text-center">
                <InquiryStatusChipPreview status="ORDER_FORM_PENDING" />
                <div className="mt-0.5">
                  <InquiryOrderPendingHint />
                </div>
              </td>
              <td className="px-1 py-1 text-center">
                <Ox yes={false} label="특이" />
              </td>
              <td className="px-1 py-1 text-center">
                <Ox yes={true} label="사진" />
              </td>
              <td className="px-1 py-1 text-center text-slate-400">—</td>
              <td className="px-1 py-1 text-center">
                <span className="rounded border border-slate-200 bg-white px-1 py-0.5">미배정</span>
              </td>
              <td className="px-1 py-1">
                <span className={`${ACTION_BTN} text-blue-700`}>고객 발송</span>
                <span className={`${ACTION_BTN} ml-1 text-red-600`}>삭제</span>
              </td>
            </tr>
            <tr className="border-b border-slate-100 bg-white">
              <td className="sticky left-0 z-[1] bg-white px-1 py-1 align-top text-center">
                <div className="tabular-nums">08-06 (수)</div>
                <div className="mt-0.5 font-mono tabular-nums text-slate-500">{INQUIRY_HELP_DEMO.inquiryNumber2}</div>
                <div className="mt-0.5">
                  <TenantInquiryShareBadge share={INQUIRY_HELP_DEMO_SHARE_SOURCE} compact />
                </div>
              </td>
              <td className="px-1 py-1 text-center">{INQUIRY_HELP_DEMO.marketer}</td>
              <td className="px-1 py-1 text-center font-medium text-sky-800">에어컨</td>
              <td className="px-1 py-1 text-center text-violet-800">네이버</td>
              <td className="px-1 py-1 text-center">
                <CustomerNameWithInternalTone name={INQUIRY_HELP_DEMO.customerName2} tone={null} viewerRole="ADMIN" />
              </td>
              <td className="px-1 py-1 text-center tabular-nums">{INQUIRY_HELP_DEMO.phone}</td>
              <td className="px-1 py-1 text-center">서울 송파구</td>
              <td className="px-1 py-1 text-center">
                <QuickEditCell label="평수">28평 · 3R</QuickEditCell>
              </td>
              <td className="px-1 py-1 text-center">
                <QuickEditCell label="예약일">08-15 (금)</QuickEditCell>
              </td>
              <td className="px-1 py-1 text-center">
                <QuickEditCell label="시간">
                  오후
                  <div className="text-slate-500 tabular-nums">8km</div>
                </QuickEditCell>
              </td>
              <td className="px-1 py-1 text-center">
                <InquiryStatusChipPreview status="RECEIVED" />
                <div className="mt-1 flex flex-col items-center gap-0.5">
                  <ProfOptionsAmountReviewBadge />
                </div>
              </td>
              <td className="px-1 py-1 text-center">
                <Ox yes={true} label="특이" />
              </td>
              <td className="px-1 py-1 text-center">
                <Ox yes={true} label="사진" />
              </td>
              <td className="px-1 py-1 text-center">
                <InspectionProgressBadge summary={INQUIRY_HELP_DEMO_INSPECTION} variant="list" />
              </td>
              <td className="px-1 py-1 text-center">
                <span className="rounded border border-slate-200 bg-white px-1 py-0.5">{INQUIRY_HELP_DEMO.teamLeader}</span>
              </td>
              <td className="px-1 py-1">
                <span className={`${ACTION_BTN} text-blue-600`}>수정</span>
                <span className={`${ACTION_BTN} ml-1 text-violet-700`}>클레임</span>
              </td>
            </tr>
            <tr className="bg-emerald-50/50">
              <td colSpan={16} className="px-2 py-1 text-center text-slate-500">
                <ProfOptionsAmountReviewCompletedBadge /> · 해피콜 HC초과 행 · 보류 ON_HOLD 노란 테두리 등 상태별 행색도 동일 규칙
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="lg:hidden rounded-lg border border-slate-200 bg-rose-50/90 p-2 space-y-2">
        <div className="flex gap-2">
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-1">
              <CustomerNameWithInternalTone
                name={INQUIRY_HELP_DEMO.customerName}
                tone="GOOD"
                viewerRole="ADMIN"
                nameClassName="font-semibold text-slate-900"
              />
              <span className="rounded bg-slate-900 px-1.5 py-0.5 font-mono text-[10px] text-white tabular-nums">
                {INQUIRY_HELP_DEMO.inquiryNumber}
              </span>
              <OperatingCompanyBadge company={INQUIRY_HELP_DEMO.operatingCompany} />
              <InquiryDbMarketplaceBadge dbListing={INQUIRY_HELP_DEMO_DB_LISTING} iconOnly />
              <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] ring-1 ring-slate-200">입주</span>
              <span className="rounded-full bg-violet-50 px-1.5 py-0.5 text-[10px] text-violet-800 ring-1 ring-violet-200">cbiseo</span>
            </div>
            <p className="text-[10px] text-slate-500">접수 08-07 · {INQUIRY_HELP_DEMO.marketer} · 33평 · 오전</p>
            <p className="text-[10px] text-slate-600">{INQUIRY_HELP_DEMO.addressShort}</p>
            <div className="flex flex-wrap gap-1 text-[10px]">
              <InquiryStatusChipPreview status="ORDER_FORM_PENDING" />
              <span className="rounded bg-slate-50 px-1.5 ring-1 ring-slate-200">
                특이 <Ox yes={false} label="특이" /> · 사진 <Ox yes={true} label="사진" />
              </span>
            </div>
          </div>
          <InquiryMobileCallButton tabIndex={-1} aria-hidden disabled />
        </div>
        <div className="flex gap-2 border-t border-slate-200/80 pt-1">
          <InquiryStatusChipPreview status="ORDER_FORM_PENDING" />
          <span className={`${ACTION_BTN} text-blue-700`}>고객 발송</span>
        </div>
      </div>
    </div>
  );
}

export function InquiryHelpListFullPreview() {
  return (
    <InquiryHelpZoomableFigure
      callouts={INQUIRY_HELP_LIST_FULL_CALLOUTS}
      contentClassName="p-1.5 sm:p-2 bg-slate-50/50"
      zoomContent={<InquiryHelpListFullPreviewInner enlarged />}
      caption="데모 데이터(○○ 마스킹)로 모든 배지·열·버튼을 한 화면에 모았습니다. 「크게 보기」로 확대할 수 있습니다. 행 전체 클릭 → 접수 상세."
    >
      <InquiryHelpListFullPreviewInner />
    </InquiryHelpZoomableFigure>
  );
}
