import { InquiryDbMarketplaceBadge } from '../InquiryDbMarketplaceBadge';
import {
  ScheduleCloseDayButton,
  ScheduleSlotBadge,
  ScheduleToolbarButton,
  scheduleLeaderAdjustButtonClass,
  scheduleStaffAdjustButtonClass,
} from '../../schedule/scheduleUiParts';
import { InquiryHelpZoomableFigure } from '../inquiry-help/InquiryHelpZoomableFigure';
import type { ScheduleHelpCalloutDef } from '../schedule-help/ScheduleHelpAnnotatedPanel';
import { SCHEDULE_MARKETPLACE_SECTION_HELP } from '../schedule-help/scheduleHelpShared';
import { DB_MARKETPLACE_HELP_SCHEDULE_CAPTION } from './dbMarketplaceHelpShared';

const DEMO_LISTINGS = [
  { status: 'DRAFT' as const, name: '김○○', meta: '강남구 · 33평 · 오전 · 공유 준비' },
  { status: 'OPEN' as const, name: '이○○', meta: '송파구 · 28평 · 오후 · 공유 중' },
  { status: 'PENDING_SELLER' as const, name: '박○○', meta: '마포구 · 25평 · 오전 · 인계 대기' },
];

export const DB_MARKETPLACE_SCHEDULE_CALLOUTS: readonly ScheduleHelpCalloutDef[] = [
  { id: 1, label: '정보공유 구역 — 공유 등록 접수만 모음', anchorX: 28, anchorY: 14 },
  { id: 2, label: '카트 아이콘 — 마우스를 올리면 준비·공유중 등 단계', anchorX: 12, anchorY: 52 },
  { id: 3, label: '일정(오전/오후)은 그대로 표시', anchorX: 10, anchorY: 38 },
];

function ScheduleMarketplaceCardDemo({
  status,
  name,
  meta,
  slot,
}: {
  status: 'DRAFT' | 'OPEN' | 'PENDING_SELLER';
  name: string;
  meta: string;
  slot: 'morning' | 'afternoon';
}) {
  const slotBorder = slot === 'morning' ? 'border-l-amber-500 border-amber-200' : 'border-l-sky-500 border-sky-200';
  return (
    <div className={`rounded-lg border border-l-[5px] bg-white p-2 shadow-sm ${slotBorder}`}>
      <div className="flex gap-2">
        <div className="flex shrink-0 flex-col items-center gap-0.5">
          <ScheduleSlotBadge label={slot === 'morning' ? '오전' : '오후'} bucket={slot} />
          <InquiryDbMarketplaceBadge dbListing={{ listingId: 'demo', status }} iconOnly />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-fluid-2xs font-semibold text-slate-900">{name}</p>
          <p className="mt-0.5 text-[9px] text-slate-500 sm:text-[10px]">{meta}</p>
        </div>
      </div>
    </div>
  );
}

/** 스케줄 — 정보공유 구역 미리보기 (실제 UI 조합) */
export function DbMarketplaceHelpSchedulePreviewInner({ enlarged = false }: { enlarged?: boolean }) {
  const t = enlarged ? 'text-fluid-xs' : 'text-[11px] sm:text-fluid-2xs';
  return (
    <div className={`overflow-hidden rounded-lg border border-slate-200 bg-slate-50/80 shadow-sm pointer-events-none select-none ${t}`}>
      <div className="border-b border-slate-200 bg-white px-2.5 py-2 sm:px-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-fluid-xs font-semibold text-slate-900 tabular-nums">3월 15일 (토)</p>
          <div className="flex flex-wrap items-center gap-1">
            <ScheduleToolbarButton className={scheduleStaffAdjustButtonClass} tabIndex={-1} aria-hidden disabled>
              인원조정
            </ScheduleToolbarButton>
            <ScheduleToolbarButton className={scheduleLeaderAdjustButtonClass} tabIndex={-1} aria-hidden disabled>
              팀장조정
            </ScheduleToolbarButton>
            <ScheduleCloseDayButton tabIndex={-1} aria-hidden disabled />
          </div>
        </div>
      </div>

      <div className="space-y-3 p-2 sm:p-2.5">
        <p className="text-[9px] text-slate-400 sm:text-[10px]">… 팀장 미배정 · 오전/오후 일정 …</p>

        <div>
          <div className="mb-2 flex items-center gap-2 rounded-lg border border-violet-100 bg-violet-50 px-2.5 py-1.5">
            <span className="h-2 w-2 shrink-0 rounded-full bg-violet-500" />
            <span className="flex-1 text-fluid-xs font-bold text-violet-950">정보공유</span>
            <span className="rounded-md bg-violet-100/80 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-violet-700">
              3건
            </span>
          </div>

          <div className="space-y-2">
            <div>
              <div className="mb-1.5 flex items-center gap-2 border-b border-amber-500/70 pb-1">
                <span className="text-fluid-xs font-bold text-amber-950">정보공유 · 오전</span>
                <span className="text-fluid-2xs tabular-nums text-amber-900/80">2건</span>
              </div>
              <div className="flex flex-col gap-1.5">
                <ScheduleMarketplaceCardDemo {...DEMO_LISTINGS[0]} slot="morning" />
                <ScheduleMarketplaceCardDemo {...DEMO_LISTINGS[2]} slot="morning" />
              </div>
            </div>
            <div>
              <div className="mb-1.5 flex items-center gap-2 border-b border-sky-500/70 pb-1">
                <span className="text-fluid-xs font-bold text-sky-950">정보공유 · 오후</span>
                <span className="text-fluid-2xs tabular-nums text-sky-900/80">1건</span>
              </div>
              <ScheduleMarketplaceCardDemo {...DEMO_LISTINGS[1]} slot="afternoon" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** 스케줄 정보공유 구역 — 주석 + 크게 보기 */
export function DbMarketplaceHelpScheduleFigure() {
  return (
    <InquiryHelpZoomableFigure
      caption={DB_MARKETPLACE_HELP_SCHEDULE_CAPTION}
      callouts={DB_MARKETPLACE_SCHEDULE_CALLOUTS}
      zoomContent={<DbMarketplaceHelpSchedulePreviewInner enlarged />}
    >
      <DbMarketplaceHelpSchedulePreviewInner />
    </InquiryHelpZoomableFigure>
  );
}

/** 상태별 카트 아이콘 안내 */
export function DbMarketplaceHelpScheduleIconNote() {
  return (
    <p className="text-fluid-2xs text-slate-500 leading-snug">{SCHEDULE_MARKETPLACE_SECTION_HELP}</p>
  );
}
